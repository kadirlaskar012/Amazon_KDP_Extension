# KDP Niche Finder - Personal Chrome Extension (Manifest V3)

A Chrome Extension for personal Amazon KDP (Kindle Direct Publishing) niche, keyword, and category research. Built with **WXT**, **React**, **TypeScript**, and **Tailwind CSS**.

---

## 🚀 Quick Setup & Build

### 1. Requirements
- Node.js (v20+ recommended)
- npm

### 2. Install Dependencies
```bash
npm install
```

### 3. Run Unit Tests (Vitest)
```bash
npm test
```

### 4. Build Production Bundle
```bash
npm run build
```
The compiled, ready-to-load unpacked Chrome extension will be in:
```
.output/chrome-mv3
```

---

## 🧩 How to Load in Google Chrome

1. Open Google Chrome and navigate to:
   ```
   chrome://extensions
   ```
2. Enable **"Developer mode"** via the toggle in the top-right corner.
3. Click the **"Load unpacked"** button in the top-left corner.
4. Select the directory:
   ```
   <PROJECT_ROOT>/.output/chrome-mv3
   ```
5. You will see **"KDP Niche Finder"** loaded as an active extension with Manifest V3.

---

## 🧪 Phase 1 Test Checklist

- [x] **Project Foundation**: WXT + React + TypeScript + Tailwind CSS configured with Manifest V3.
- [x] **Strict Selectors Architecture**: Centralized in [`src/config/selectors.ts`](file:///c:/Users/KadiR-PC/Documents/Antigravity/Extension/Amazon%20KDP/src/config/selectors.ts) with multiple fallbacks per field.
- [x] **Search Page Reader**: Injects a collapsible 380px sidebar into Amazon Books search results pages using isolated **Shadow DOM** to prevent CSS bleeding.
- [x] **Organic Results Filter**: Automatically identifies and discards sponsored/ad products, extracting only true organic results (up to 16 books).
- [x] **Background Rate-Limited Fetch Queue**:
  - Randomized delay of 2–3 seconds per request.
  - Hard cap of max 20 requests per search.
  - Progressive detail enrichment: BSR overall, category sub-ranks, page count, trim size, publish date, reading age.
- [x] **CAPTCHA & Robot-Check Detection**:
  - Immediately halts the fetch queue when Amazon displays a verification or robot check page.
  - Alerts the user: *"Amazon asked for verification, open Amazon and solve it, then resume."*
  - Provides a direct link to solve the challenge and a button to resume.
- [x] **24-Hour Product Cache**:
  - Caches fetched ASIN metadata in `chrome.storage.local`.
  - Repeat searches for the same books load instantly without issuing network requests.
- [x] **Unit Tests Passing**:
  - 12 Vitest tests passing across search parser, product parser, 24h cache TTL, and scoring/sales estimator formulas.

---

## 🛠️ How to Update Selectors When Amazon Changes Layout

All CSS selectors and regex patterns are consolidated in:
👉 [`src/config/selectors.ts`](file:///c:/Users/KadiR-PC/Documents/Antigravity/Extension/Amazon%20KDP/src/config/selectors.ts)

When Amazon updates its HTML classes or DOM structure:
1. Open the Amazon page in Chrome DevTools (`F12`).
2. Inspect the element that failed to parse (e.g. BSR, title, price, or author).
3. Copy the selector or attribute.
4. Add it to the top of the relevant fallback array in `SEARCH_SELECTORS` or `PRODUCT_PAGE_SELECTORS`.
5. Run tests:
   ```bash
   npm test
   ```
6. Rebuild the extension:
   ```bash
   npm run build
   ```
7. Click the reload icon on the extension card in `chrome://extensions`.

---

## 🛡️ Rate Limiting & Account Safety Rules

1. **Only reads pages opened by you** or product details queued from your active search.
2. **Never rotates user-agents or proxies**.
3. **Queue pauses immediately upon CAPTCHA detection** to prevent blocking or flags.
4. **All data and API keys stay local** in `chrome.storage.local`.
