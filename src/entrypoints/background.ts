// src/entrypoints/background.ts
// Background service worker: Handles fetch queues, daily watchlist alarms, offscreen parsing, and messaging

import { defineBackground } from 'wxt/utils/define-background';
import { FetchQueueService } from '../services/fetchQueue';
import { refreshWatchlist } from '../services/tracker';
import { generateBookIdeas, testClaudeApiKey } from '../services/aiIdeas';
import { DEFAULT_TRACKER_CONFIG } from '../config/defaults';
import type { ExtensionMessage } from '../types';

export default defineBackground(() => {
  console.log('[KDP Niche Finder] Service worker initialized.');

  // Helper to check if an offscreen document currently exists
  const hasOffscreenDocument = async (): Promise<boolean> => {
    try {
      if ('getContexts' in chrome.runtime) {
        const contexts = await (chrome.runtime as any).getContexts({
          contextTypes: ['OFFSCREEN_DOCUMENT'],
        });
        return Boolean(contexts.length);
      }
    } catch {
      // Fallback
    }
    return false;
  };

  // Helper to create the offscreen document when needed
  const ensureOffscreenDocument = async (): Promise<void> => {
    try {
      if (typeof chrome.offscreen === 'undefined') return;
      if (await hasOffscreenDocument()) return;
      await chrome.offscreen.createDocument({
        url: 'offscreen.html',
        reasons: [chrome.offscreen.Reason.DOM_PARSER],
        justification: 'Parse Amazon HTML for BSR and reviews without DOM in worker',
      });
    } catch (err) {
      console.warn('[KDP Background] Offscreen creation error:', err);
    }
  };

  // Helper to close the offscreen document when work completes
  const closeOffscreenDocument = async (): Promise<void> => {
    try {
      if (typeof chrome.offscreen === 'undefined') return;
      if (await hasOffscreenDocument()) {
        await chrome.offscreen.closeDocument();
      }
    } catch (err) {
      console.warn('[KDP Background] Offscreen close error:', err);
    }
  };

  // Helper to broadcast a message to all tabs
  const broadcastToTabs = async (message: ExtensionMessage) => {
    try {
      const tabs = await chrome.tabs.query({});
      for (const tab of tabs) {
        if (tab.id) {
          chrome.tabs.sendMessage(tab.id, message).catch(() => {
            // Tab might not have content script injected; ignore safely
          });
        }
      }
    } catch (err) {
      console.warn('[KDP Background] Error broadcasting message:', err);
    }
  };

  const queueService = new FetchQueueService({
    onStatusChange: (status) => {
      broadcastToTabs({
        type: 'QUEUE_STATUS_UPDATE',
        status,
      });
    },
    onItemFetched: (asin, partial) => {
      broadcastToTabs({
        type: 'PRODUCT_FETCHED',
        asin,
        bookPartial: partial,
      });
    },
    onCaptcha: (url) => {
      broadcastToTabs({
        type: 'CAPTCHA_TRIGGERED',
        url,
      });
    },
  });

  // Executes a watchlist tracker refresh with offscreen lifecycle management
  const runTrackerRefresh = async (forceAll: boolean = false) => {
    try {
      await ensureOffscreenDocument();
      const result = await refreshWatchlist({ forceAll });
      broadcastToTabs({
        type: 'WATCHLIST_REFRESH_COMPLETE',
        updatedCount: result.updatedCount,
      });
      if (result.reason === 'CAPTCHA_DETECTED') {
        broadcastToTabs({
          type: 'WATCHLIST_CAPTCHA',
          url: result.captchaUrl,
        });
      }
      return result;
    } finally {
      await closeOffscreenDocument();
    }
  };

  // Message dispatcher
  chrome.runtime.onMessage.addListener(
    (
      message: ExtensionMessage,
      sender: chrome.runtime.MessageSender,
      sendResponse: (response?: unknown) => void
    ) => {
      switch (message.type) {
        case 'START_PRODUCT_FETCH':
          queueService.enqueue(message.asins, sender.tab?.id);
          sendResponse({ success: true, status: queueService.getStatus() });
          return true;

        case 'PAUSE_QUEUE':
          queueService.pause();
          sendResponse({ success: true, status: queueService.getStatus() });
          return true;

        case 'RESUME_QUEUE':
          queueService.resume();
          sendResponse({ success: true, status: queueService.getStatus() });
          return true;

        case 'CANCEL_QUEUE':
          queueService.cancel();
          sendResponse({ success: true, status: queueService.getStatus() });
          return true;

        case 'GET_QUEUE_STATUS':
          sendResponse({ success: true, status: queueService.getStatus() });
          return true;

        case 'REFRESH_WATCHLIST_NOW':
          runTrackerRefresh(true).then((res) => {
            sendResponse({ success: true, result: res });
          });
          return true;

        case 'GENERATE_AI_IDEAS':
          generateBookIdeas(message.payloadText, message.systemPrompt)
            .then((result) => sendResponse({ success: true, result }))
            .catch((err) => sendResponse({ success: false, error: err?.message || 'AI request failed' }));
          return true;

        case 'TEST_CLAUDE_KEY':
          testClaudeApiKey(message.apiKey, message.model)
            .then((result) => sendResponse(result))
            .catch((err) => sendResponse({ success: false, message: err?.message || 'Test failed' }));
          return true;

        case 'GET_STORAGE_USAGE':
          if (chrome.storage?.local?.getBytesInUse) {
            chrome.storage.local.getBytesInUse(null, (bytesInUse) => {
              sendResponse({ success: true, bytesInUse });
            });
          } else {
            sendResponse({ success: true, bytesInUse: 0 });
          }
          return true;

        default:
          break;
      }
      return false;
    }
  );

  // Daily alarm setup for watchlist monitoring
  chrome.alarms.onAlarm.addListener((alarm: chrome.alarms.Alarm) => {
    if (alarm.name === DEFAULT_TRACKER_CONFIG.alarmName) {
      console.log('[KDP Background] Daily watchlist sync triggered.');
      runTrackerRefresh(false);
    }
  });

  // Register alarm on install / update
  chrome.runtime.onInstalled.addListener(() => {
    chrome.alarms.create(DEFAULT_TRACKER_CONFIG.alarmName, {
      periodInMinutes: DEFAULT_TRACKER_CONFIG.periodMinutes,
    });
  });

  // Check refresh on browser startup (covers closed browser days)
  chrome.runtime.onStartup.addListener(() => {
    console.log('[KDP Background] Startup check for pending watchlist refresh.');
    runTrackerRefresh(false);
  });
});
