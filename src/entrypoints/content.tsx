import { defineContentScript } from 'wxt/utils/define-content-script';
import { createShadowRootUi } from 'wxt/utils/content-script-ui/shadow-root';
import React, { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import { Sidebar } from '../components/Sidebar';
import { parseSearchResults, getSearchQuery, isAmazonBookSearchPage } from '../parsers/searchPage';
import type { Book, QueueProgressState, ExtensionMessage } from '../types';
import { saveSnapshot } from '../storage';
import { calculateNicheScore } from '../services/scoring';
import { getSettings } from '../storage/settings';
import '../styles/globals.css';

interface ContentAppProps {
  initialBooks: Book[];
  initialQuery: string;
}

const ContentApp: React.FC<ContentAppProps> = ({ initialBooks, initialQuery }) => {
  const [books, setBooks] = useState<Book[]>(initialBooks);
  const [query, setQuery] = useState<string>(initialQuery);
  const [queueStatus, setQueueStatus] = useState<QueueProgressState>({
    isRunning: false,
    isPaused: false,
    current: 0,
    total: initialBooks.length,
    captchaDetected: false,
  });
  const [captchaUrl, setCaptchaUrl] = useState<string | undefined>();

  // Start background queue for product details
  const startBackgroundQueue = useCallback((booksToFetch: Book[]) => {
    const asins = booksToFetch.map((b) => b.asin);
    if (asins.length === 0) return;

    try {
      chrome.runtime.sendMessage(
        {
          type: 'START_PRODUCT_FETCH',
          asins,
          query,
        } as ExtensionMessage,
        (response: { status?: QueueProgressState } | undefined) => {
          if (response?.status) {
            setQueueStatus(response.status);
          }
        }
      );
    } catch (err) {
      console.warn('[KDP Content] Failed to start fetch queue:', err);
    }
  }, [query]);

  // Initial trigger
  useEffect(() => {
    if (initialBooks.length > 0) {
      startBackgroundQueue(initialBooks);
    }
  }, [initialBooks, startBackgroundQueue]);

  // Listen to background service worker events
  useEffect(() => {
    const messageListener = (message: ExtensionMessage) => {
      if (message.type === 'QUEUE_STATUS_UPDATE') {
        setQueueStatus(message.status);
      } else if (message.type === 'PRODUCT_FETCHED') {
        setBooks((prevBooks) => {
          const updated = prevBooks.map((b) => {
            if (b.asin === message.asin) {
              return {
                ...b,
                ...message.bookPartial,
                isOpportunity:
                  message.bookPartial.bsrOverall !== undefined &&
                  message.bookPartial.bsrOverall < 100000 &&
                  ((b.reviewCount !== undefined && b.reviewCount < 30) ||
                    (b.rating !== undefined && b.rating < 4.0)),
              };
            }
            return b;
          });

          // Save active snapshot update with score
          getSettings().then((currentSettings) => {
            saveSnapshot({
              query,
              date: Date.now(),
              books: updated,
              scores: calculateNicheScore(updated, currentSettings),
            });
          });

          return updated;
        });
      } else if (message.type === 'CAPTCHA_TRIGGERED') {
        setCaptchaUrl(message.url);
        setQueueStatus((prev) => ({
          ...prev,
          captchaDetected: true,
          isPaused: true,
        }));
      }
    };

    chrome.runtime.onMessage.addListener(messageListener);
    return () => {
      chrome.runtime.onMessage.removeListener(messageListener);
    };
  }, [query]);

  const handlePauseQueue = () => {
    chrome.runtime.sendMessage({ type: 'PAUSE_QUEUE' } as ExtensionMessage);
  };

  const handleResumeQueue = () => {
    chrome.runtime.sendMessage({ type: 'RESUME_QUEUE' } as ExtensionMessage);
  };

  const handleRescanPage = () => {
    const freshBooks = parseSearchResults(document);
    const freshQuery = getSearchQuery(document);
    setBooks(freshBooks);
    setQuery(freshQuery);
    startBackgroundQueue(freshBooks);
  };

  return (
    <Sidebar
      initialBooks={books}
      initialQuery={query}
      queueStatus={queueStatus}
      captchaUrl={captchaUrl}
      onPauseQueue={handlePauseQueue}
      onResumeQueue={handleResumeQueue}
      onRescanPage={handleRescanPage}
    />
  );
};

export default defineContentScript({
  matches: ['*://*.amazon.com/*'],
  cssInjectionMode: 'ui',
  async main(ctx) {
    console.log('[KDP Niche Finder] Content script active on:', window.location.href);

    // Check if this is an Amazon search page or contains book search results
    const isSearch = isAmazonBookSearchPage(document);
    if (!isSearch) {
      // Not a search page, do not inject sidebar automatically
      return;
    }

    const books = parseSearchResults(document);
    const query = getSearchQuery(document);

    // Save initial snapshot
    if (books.length > 0) {
      await saveSnapshot({
        query,
        date: Date.now(),
        books,
      });
    }

    // Mount Shadow DOM UI
    const ui = await createShadowRootUi(ctx, {
      name: 'kdp-niche-finder-container',
      position: 'overlay',
      anchor: 'body',
      append: 'last',
      onMount: (uiContainer) => {
        const root = ReactDOM.createRoot(uiContainer);
        root.render(<ContentApp initialBooks={books} initialQuery={query} />);
        return root;
      },
      onRemove: (root) => {
        root?.unmount();
      },
    });

    ui.mount();
  },
});
