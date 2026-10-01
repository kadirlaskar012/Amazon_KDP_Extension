// src/entrypoints/background.ts
// Background service worker: Handles fetch queues, daily watchlist alarms, offscreen parsing, and messaging

import { defineBackground } from 'wxt/utils/define-background';
import { FetchQueueService } from '../services/fetchQueue';
import { refreshWatchlist } from '../services/tracker';
import { generateBookIdeas, testGeminiApiKey } from '../services/aiIdeas';
import { DEFAULT_TRACKER_CONFIG } from '../config/defaults';
import { migrateStorage } from '../storage';
import { runDiscoverScan, triggerScanIfStale, releaseDiscoverLock } from '../services/discoverScanner';
import { DISCOVER_ALARM_NAME } from '../config/discoverDefaults';
import { setTrackerBadge } from '../services/tracker';
import type { ExtensionMessage } from '../types';

export default defineBackground(() => {
  console.log('[KDP Niche Finder] Service worker initialized.');
  migrateStorage();

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

  // Executes a Discover scan with offscreen DOM parsing available
  const runDiscoverRefresh = async (forceRefresh: boolean = false) => {
    try {
      await ensureOffscreenDocument();
      const result = await runDiscoverScan({
        forceRefresh,
        onProgress: (p) => {
          broadcastToTabs({
            type: 'DISCOVER_SCAN_PROGRESS',
            requestsUsed: p.requestsUsed,
            total: p.total,
            message: p.message,
          });
        },
      });
      broadcastToTabs({
        type: 'DISCOVER_SCAN_COMPLETE',
        scanStatus: result.scanStatus,
        requestsUsed: result.requestsUsed,
        top10Count: result.top10.length,
      });
      if (result.captchaUrl) {
        setTrackerBadge('!');
        broadcastToTabs({
          type: 'DISCOVER_SCAN_CAPTCHA',
          url: result.captchaUrl,
        });
      }
      return result;
    } catch (err) {
      console.warn('[KDP Discover] Scan error:', err);
      await releaseDiscoverLock();
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

        case 'TEST_GEMINI_KEY':
          testGeminiApiKey(message.apiKey, message.model)
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

        case 'OPEN_OPTIONS_PAGE':
        case 'OPEN_OPTIONS':
          try {
            if (chrome.runtime?.openOptionsPage) {
              chrome.runtime.openOptionsPage(() => {
                if (chrome.runtime.lastError && chrome.tabs?.create) {
                  chrome.tabs.create({ url: chrome.runtime.getURL('options.html') });
                }
                sendResponse({ success: true });
              });
            } else if (chrome.tabs?.create) {
              chrome.tabs.create({ url: chrome.runtime.getURL('options.html') });
              sendResponse({ success: true });
            } else {
              sendResponse({ success: false });
            }
          } catch {
            if (chrome.tabs?.create) {
              chrome.tabs.create({ url: chrome.runtime.getURL('options.html') });
              sendResponse({ success: true });
            } else {
              sendResponse({ success: false });
            }
          }
          return true;

        case 'DISCOVER_SCAN_START':
          runDiscoverRefresh(message.forceRefresh ?? false).then((res) => {
            sendResponse({ success: true, requestsUsed: res?.requestsUsed ?? 0 });
          });
          return true;

        default:
          break;
      }
      return false;
    }
  );

  // Daily alarm setup for watchlist monitoring and discover scan
  chrome.alarms.onAlarm.addListener((alarm: chrome.alarms.Alarm) => {
    if (alarm.name === DEFAULT_TRACKER_CONFIG.alarmName) {
      console.log('[KDP Background] Daily watchlist sync triggered.');
      runTrackerRefresh(false);
    }
    if (alarm.name === DISCOVER_ALARM_NAME) {
      console.log('[KDP Background] Daily Discover scan triggered.');
      runDiscoverRefresh(false);
    }
  });

  // Register alarm on install / update (deduplicated)
  chrome.runtime.onInstalled.addListener(() => {
    chrome.alarms.get(DEFAULT_TRACKER_CONFIG.alarmName, (alarm) => {
      if (!alarm) {
        chrome.alarms.create(DEFAULT_TRACKER_CONFIG.alarmName, {
          periodInMinutes: DEFAULT_TRACKER_CONFIG.periodMinutes,
        });
      }
    });
    chrome.alarms.get(DISCOVER_ALARM_NAME, (alarm) => {
      if (!alarm) {
        chrome.alarms.create(DISCOVER_ALARM_NAME, { periodInMinutes: 1440 });
      }
    });
  });

  // Check refresh on browser startup (covers closed browser days and verifies alarm)
  chrome.runtime.onStartup.addListener(() => {
    console.log('[KDP Background] Startup check for pending watchlist refresh.');
    chrome.alarms.get(DEFAULT_TRACKER_CONFIG.alarmName, (alarm) => {
      if (!alarm) {
        chrome.alarms.create(DEFAULT_TRACKER_CONFIG.alarmName, {
          periodInMinutes: DEFAULT_TRACKER_CONFIG.periodMinutes,
        });
      }
    });
    chrome.alarms.get(DISCOVER_ALARM_NAME, (alarm) => {
      if (!alarm) {
        chrome.alarms.create(DISCOVER_ALARM_NAME, { periodInMinutes: 1440 });
      }
    });
    runTrackerRefresh(false);
    // Catch-up: start discover scan if data is stale
    triggerScanIfStale().catch(console.warn);
  });
});
