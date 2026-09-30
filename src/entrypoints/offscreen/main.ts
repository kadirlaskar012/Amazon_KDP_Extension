// src/entrypoints/offscreen/main.ts
// Offscreen document script providing DOMParser access for background service workers

import { parseProductPage } from '../../parsers/productPage';
import { parseProductReviews } from '../../parsers/reviewsParser';

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'DOM_PARSE_PRODUCT') {
    try {
      const parsed = parseProductPage(message.html);
      sendResponse({ success: true, parsed });
    } catch (err: any) {
      sendResponse({ success: false, error: err?.message || 'Parsing failed' });
    }
    return true;
  }

  if (message.type === 'DOM_PARSE_REVIEWS') {
    try {
      const parsed = parseProductReviews(message.html, message.asin);
      sendResponse({ success: true, parsed });
    } catch (err: any) {
      sendResponse({ success: false, error: err?.message || 'Parsing failed' });
    }
    return true;
  }

  return false;
});
