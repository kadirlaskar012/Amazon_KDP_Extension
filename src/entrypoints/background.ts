import { defineBackground } from 'wxt/utils/define-background';
import { FetchQueueService } from '../services/fetchQueue';
import type { ExtensionMessage } from '../types';

export default defineBackground(() => {
  console.log('[KDP Niche Finder] Service worker initialized.');

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

      default:
        break;
    }
    return false;
  });

  // Daily alarm setup for watchlist monitoring
  chrome.alarms.onAlarm.addListener((alarm: chrome.alarms.Alarm) => {
    if (alarm.name === 'kdp_daily_watchlist_sync') {
      console.log('[KDP Background] Daily watchlist sync triggered.');
    }
  });

  // Ensure daily alarm is registered
  chrome.alarms.create('kdp_daily_watchlist_sync', {
    periodInMinutes: 24 * 60, // once a day
  });
});
