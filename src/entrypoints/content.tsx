import { defineContentScript } from 'wxt/utils/define-content-script';
import { createShadowRootUi } from 'wxt/utils/content-script-ui/shadow-root';
import React, { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import { Sidebar } from '../components/Sidebar';
import { WatchButton } from '../components/WatchButton';
import { parseSearchResults, getSearchQuery, isAmazonBookSearchPage } from '../parsers/searchPage';
import { parseBestSellersPage, isBestSellersCaptcha } from '../parsers/bestSellersPage';
import { PRODUCT_PAGE_SELECTORS } from '../config/selectors';
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
  const startBackgroundQueue = useCallback(async (booksToFetch: Book[]) => {
    const settings = await getSettings();
    const maxFetches = settings.maxFetchesPerSearch || 20;
    const asins = booksToFetch.slice(0, maxFetches).map((b) => b.asin);
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

    const pathname = window.location.pathname.toLowerCase();

    // 1. Check if this is an Amazon search page or contains book search results
    const isSearch = isAmazonBookSearchPage(document);

    // 2. Check if this is an Amazon Best Sellers books category page
    const isBestSellers =
      (pathname.includes('/bestsellers/books') ||
        pathname.includes('/best-sellers-books') ||
        pathname.includes('/gp/bestsellers/books') ||
        pathname.includes('/gp/bestsellers/digital-text')) &&
      !isBestSellersCaptcha(document);

    if (isSearch || isBestSellers) {
      let books: Book[] = [];
      let query = '';

      if (isSearch) {
        books = parseSearchResults(document);
        query = getSearchQuery(document);
      } else {
        const parsedBestSellers = parseBestSellersPage(document.documentElement.outerHTML);
        books = parsedBestSellers.items.map((item) => ({
          asin: item.asin,
          title: item.title,
          author: 'N/A',
          price: item.price,
          rating: item.rating,
          reviewCount: item.reviewCount,
          bsrOverall: item.rank,
          categoryRanks: [],
        }));
        query = parsedBestSellers.categoryName || 'Best Sellers';
      }

      // Save initial snapshot
      if (books.length > 0) {
        await saveSnapshot({
          query,
          date: Date.now(),
          books,
        });
      }

      // Mount Sidebar Shadow DOM UI
      const mountSidebar = async () => {
        const existing = document.querySelector('kdp-niche-finder-container');
        if (existing) return;

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
      };

      await mountSidebar();

      // MutationObserver to ensure the sidebar survives Amazon's client-side SPA updates
      let debounceTimer: ReturnType<typeof setTimeout> | null = null;
      const observer = new MutationObserver(() => {
        if (!document.querySelector('kdp-niche-finder-container')) {
          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => {
            if (!document.querySelector('kdp-niche-finder-container')) {
              mountSidebar();
            }
          }, 500);
        }
      });

      if (document.body) {
        observer.observe(document.body, { childList: true });
      }

      return;
    }

    // 3. Check if this is an Amazon book product page (/dp/ or /gp/product/ in Books category)
    const asinMatch = pathname.match(/\/(?:dp|gp\/product)\/([a-z0-9]{10})/i);
    if (asinMatch && asinMatch[1]) {
      const asin = asinMatch[1].toUpperCase();

      // Check if it's Books category using centralized selector fallbacks
      const breadcrumbEl = document.querySelector(PRODUCT_PAGE_SELECTORS.breadcrumbs.join(', '));
      const breadcrumbText = (breadcrumbEl?.textContent || '').toLowerCase();
      const bodyText = document.body?.textContent?.toLowerCase() || '';

      const isBooksCategory =
        breadcrumbText.includes('books') ||
        breadcrumbText.includes('kindle') ||
        document.querySelector(PRODUCT_PAGE_SELECTORS.detailBullets.join(', ')) !== null ||
        (bodyText.includes('best sellers rank') && (bodyText.includes('in books') || bodyText.includes('in kindle store')));

      if (isBooksCategory) {
        const titleEl = document.querySelector(PRODUCT_PAGE_SELECTORS.title.join(', '));
        const title = titleEl?.textContent?.trim() || document.title || 'Amazon Book';

        const priceEl = document.querySelector(PRODUCT_PAGE_SELECTORS.price.join(', '));
        const priceText = priceEl?.textContent || '';
        const priceMatch = priceText.match(/[\d,.]+/);
        const price = priceMatch ? parseFloat(priceMatch[0].replace(/,/g, '')) : undefined;

        const ratingEl = document.querySelector(PRODUCT_PAGE_SELECTORS.rating.join(', '));
        const ratingText = ratingEl?.textContent || '';
        const rMatch = ratingText.match(/(\d+(?:\.\d+)?)/);
        const rating = rMatch && rMatch[1] ? parseFloat(rMatch[1]) : undefined;

        const reviewEl = document.querySelector(PRODUCT_PAGE_SELECTORS.reviewCount.join(', '));
        const reviewText = reviewEl?.textContent?.replace(/,/g, '') || '';
        const revMatch = reviewText.match(/\d+/);
        const reviewCount = revMatch ? parseInt(revMatch[0], 10) : undefined;

        const bookDetails: Partial<Book> & { asin: string; title: string } = {
          asin,
          title,
          price,
          rating,
          reviewCount,
        };

        // Mount floating WatchButton Shadow DOM UI
        const watchUi = await createShadowRootUi(ctx, {
          name: 'kdp-floating-watch-container',
          position: 'overlay',
          anchor: 'body',
          append: 'last',
          onMount: (uiContainer) => {
            const root = ReactDOM.createRoot(uiContainer);
            root.render(
              <div className="fixed bottom-6 right-6 z-[999999] font-sans antialiased shadow-2xl rounded-2xl border border-slate-700 bg-slate-900/95 p-2 backdrop-blur-md flex items-center gap-2.5">
                <div className="text-[11px] font-semibold text-slate-200 pl-1 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>KDP Tracker</span>
                </div>
                <WatchButton book={bookDetails} size="sm" showLabel={true} />
              </div>
            );
            return root;
          },
          onRemove: (root) => {
            root?.unmount();
          },
        });

        watchUi.mount();
      }
    }
  },
});
