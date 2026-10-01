// src/entrypoints/offscreen/main.ts
// Offscreen document script providing DOMParser access for background service workers

import { parseProductPage } from '../../parsers/productPage';
import { parseProductReviews } from '../../parsers/reviewsParser';
import { parseBestSellersPage } from '../../parsers/bestSellersPage';
import { parseMoversShakersPage } from '../../parsers/moversShakersPage';
import { parseNewReleasesPage } from '../../parsers/newReleasesPage';

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

  if (message.type === 'DOM_PARSE_BEST_SELLERS') {
    try {
      const parsed = parseBestSellersPage(message.html);
      sendResponse({ success: true, parsed });
    } catch (err: any) {
      sendResponse({ success: false, error: err?.message || 'Parsing failed' });
    }
    return true;
  }

  if (message.type === 'DOM_PARSE_MOVERS_SHAKERS') {
    try {
      const parsed = parseMoversShakersPage(message.html);
      sendResponse({ success: true, parsed });
    } catch (err: any) {
      sendResponse({ success: false, error: err?.message || 'Parsing failed' });
    }
    return true;
  }

  if (message.type === 'DOM_PARSE_NEW_RELEASES') {
    try {
      const parsed = parseNewReleasesPage(message.html);
      sendResponse({ success: true, parsed });
    } catch (err: any) {
      sendResponse({ success: false, error: err?.message || 'Parsing failed' });
    }
    return true;
  }

  return false;
});
