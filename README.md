# KDP Niche Finder - Personal Chrome Extension (Manifest V3)

A full-suite, privacy-first personal Chrome Extension for Amazon KDP (Kindle Direct Publishing) niche discovery, keyword and category analysis, competitive specs benchmarking, customer review gap discovery, daily BSR tracking, and data-backed AI book idea generation powered by Google's Gemini API (featuring Gemini 2.5 Flash & Pro).

Built with **WXT**, **React**, **TypeScript**, **Tailwind CSS**, and **Vitest**.

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
All 19 test files (113 tests) run in isolated environments and validate parsers, caching, algorithms, estimators, AI prompts, idea scoring, exports, and Trends URL generation.

### 4. Build Production Bundle
```bash
npm run build
```
The compiled, ready-to-load unpacked Chrome extension will be generated in:
```
.output/chrome-mv3
```

To create a zipped distribution bundle:
```bash
npm run zip
```
The zip package will be created in `.output/kdp-niche-finder-1.0.0-chrome.zip`.

---

## 🧩 How to Load in Google Chrome

1. Open Google Chrome and navigate to:
   ```
   chrome://extensions
   ```
2. Enable **"Developer mode"** using the toggle switch in the top-right corner.
3. Click the **"Load unpacked"** button in the top-left corner.
4. Select the directory:
   ```
   <PROJECT_ROOT>/.output/chrome-mv3
   ```
5. **KDP Niche Finder** is now loaded as an active extension with Manifest V3.
6. Navigate to `https://www.amazon.com/s?k=toddler+coloring+book&i=stripbooks` to see the research sidebar in action.

---

## 💡 How Scores & Analytics are Calculated

### 1. Niche Score (0–100)
A weighted composite score calculated across 5 market factors:
- **Search & Market Demand (30%)**: Evaluates top competitor BSRs and sales velocity. Niches with books ranked under BSR #10,000 score maximum demand points.
- **Competition Gap (20%)**: Evaluates review count distribution. High scores occur when page-one ranking books have fewer than 100–300 reviews.
- **Weak Competitor Opportunities (20%)**: Identifies top-ranked books that have vulnerabilities: low review count (< 50) with strong BSR, poor rating (< 4.2 stars), cover design issues, or missing description details.
- **Profit Potential (15%)**: Assesses median pricing, page count, and estimated KDP royalties per sale.
- **New Entrant Friendly (15%)**: Checks whether books published within the past 6 months have successfully achieved strong sales ranks.

**Color Classification:**
- **Green (Score >= 65)**: Strong opportunity, viable demand with exploitable competitive gaps.
- **Yellow (Score 45–64)**: Moderate potential; requires strong differentiation or targeted micro-niche focus.
- **Red (Score < 45)**: Saturated, hyper-competitive, or insufficient buyer demand.

### 2. Keyword Priority Score (0–100)
Calculated in the **Keywords Tab** via Amazon Autocomplete queries:
- **Autocomplete Position**: Earlier appearance in suggestions indicates higher search volume.
- **Title Frequency (in 10)**: How many top 10 books include the exact keyword phrase in their title.
- **Top Result BSR Score**: The commercial velocity of the #1 search result for that keyword.

### 3. Category Difficulty
Determined by analyzing the Amazon Best Sellers page for each category:
- **Easy**: BSR required for Top 20 is > 10,000 (accessible for new authors).
- **Medium**: BSR required for Top 20 is between 2,500 and 10,000.
- **Hard**: BSR required for Top 20 is < 2,500 (dominated by major publishers/established bestsellers).

### 4. Review Gap Analysis
Scans customer reviews to extract:
- **Top Negative Complaints**: Categorized into Paper Quality, Content/Drawings, Binding, Repetitiveness, Complexity, and Value. Provides concrete suggestions on how to build a superior interior.
- **Positive Features**: Highlights features and phrases customers consistently praise.

### 5. Watchlist & Daily BSR Tracker
- Saves books to an offline watchlist in `chrome.storage.local`.
- Background tracker logs daily BSR, price, and review counts.
- Calculates trend direction (`Improving`, `Declining`, `Stable`) with sparkline visualization.

---

## 🤖 Module J: AI Book Idea Generator (Google Gemini API)

The extension includes a built-in KDP Book Idea Generator powered by Google's Gemini GenerateContent API (latest default: `gemini-2.5-flash`).

### How to Get a Free Google Gemini API Key & Setup:
1. Visit [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Click **Create API Key** (free tier available with generous rate limits).
3. In Chrome, right-click the extension icon and choose **Options** (or click the Settings tab in the sidebar).
4. Navigate to the **AI Settings** section.
5. Paste your key in the **Google Gemini API Key** field and click **Test Key** to verify connectivity.
6. Choose your preferred model (default: `gemini-2.5-flash`, with options for `gemini-2.5-pro`, `gemini-1.5-flash`, `gemini-1.5-pro`).

### How It Works:
- Runs directly from the **background service worker** (`background.ts`) via message passing.
- Builds a structured payload (under 6,000 tokens) summarizing your current search data (Niche score, top 10 books, top 25 keywords, categories, specs, customer review complaints, and your personal style constraints).
- Returns 10 data-backed, differentiated book ideas with:
  - Title and Subtitle (KDP compliant, under 200 characters)
  - Sub-Niche and Target Demographic
  - Exactly 7 Backend Keyword Slots (each under 50 characters, non-overlapping)
  - 3 Suggested Category Paths
  - 150–200 Word High-Converting Book Description
  - Interior Specifications (Page count, trim size, price)
  - Content Layout & Differentiation Angle
- Runs local **sanity scoring** (`ideaScoring.ts`) to flag forbidden claim words (`best seller`, `free`, `new`, `#1`), trademarks, repeated title keywords, and description length deviations.

---

## 📈 Module K: Google Trends Shortcuts

- Built-in URL builders for single-term exploration and 5-keyword comparative trend lines.
- One-click **TrendsLink** icon on keyword rows, ideas, and book titles.
- **"Compare Top 5 (Trends)"** button in the Keywords tab opens Google Trends multi-term comparison in a new tab.
- Configurable regional parameter (US, UK, CA, AU, IN, or Worldwide) in Options.

---

## 📤 Module L: Full Export System & Backup

Triggered via the **Export** dropdown in the sidebar header:
1. **Search Results CSV**: All book metrics, BSR, estimated sales/royalties, and opportunity flags.
2. **Keywords CSV**: Autocomplete positions, title frequencies, BSR scores, and total priority scores.
3. **Categories CSV**: Category hierarchy, book count, best rank, and difficulty benchmarks.
4. **Specs Benchmark CSV**: Median page count, trim size shares, pricing sweet spots, and recommendations.
5. **Customer Review Gap CSV**: Negative complaint frequency, quote excerpts, and positive elements.
6. **Watchlist Tracker CSV**: Full historical tracking entries (date, BSR, price, rating, reviews).
7. **AI Book Ideas CSV**: Complete concept blueprints with backend keywords and interior plans.
8. **Full Research Pack**: Combined multi-section CSV with section headers for an all-in-one workbook.
9. **JSON Snapshot Backup / Restore**: Export entire research snapshots to JSON and restore anytime.

*All CSV files are formatted per RFC 4180 with standard escaping and UTF-8 Byte Order Mark (BOM) for Excel compatibility.*

---

## ⚙️ Options Page (10 Dedicated Sections)

Access by right-clicking the extension icon -> **Options**:
1. **General**: Marketplace selector (Amazon.com default, UK/CA/DE/FR/IT/ES experimental), theme toggle, sidebar default state, position (right/left).
2. **Fetching & Safety**: Rate-limiting delays (2000–3000ms), max fetches per search (default 20), 24h cache TTL, master "Pause all fetching" switch, CAPTCHA status and resume button.
3. **Scoring Model**: Interactive weight sliders with auto-normalization to 100%, threshold cutoffs, and reset to defaults.
4. **Sales & Profit**: BSR-to-sales lookup table editor, printing cost inputs (fixed + per page), royalty rate configuration.
5. **Keywords & Categories**: Stop words editor, generic category filter, difficulty threshold cutoffs.
6. **Customer Reviews**: Analysis sample size, star rating filter, complaint phrase lexicon editor.
7. **Watchlist & Tracker**: Tracker capacity, refresh interval info, "Simulate 24h later" debug button, "Load sample history" debug button, and "Refresh now".
8. **AI Assistant**: API key with show/hide and connection test, model selector, temperature, token limits, forbidden words editor, and editable system prompt.
9. **Data Management**: Storage quota meter (bytes in use), Clear Cache, Clear Snapshots, Clear Watchlist, Purge All Data (requires typing "DELETE"), Settings JSON export/import.
10. **About & Health**: Extension version, architecture guide, selectors health check.

---

## 🛠️ Selectors & In-Sidebar Health Check

Amazon occasionally adjusts class names. To verify or update selectors:
- Click the **"Health Check"** button in the sidebar header or Options page.
- It tests active selectors against the current page (Search Results, Product Page, Best Sellers, Reviews) and alerts you if any selector fails.
- All selectors and regex patterns are consolidated in:
  👉 [`src/config/selectors.ts`](file:///c:/Users/KadiR-PC/Documents/Antigravity/Extension/Amazon%20KDP/src/config/selectors.ts)

---

## 🔒 Security & Privacy Guarantee

- **100% Local Processing**: All search scraping, keyword scores, specs, reviews, and tracking history remain in your browser's `chrome.storage.local`.
- **Zero API Key Leaks**: The Google Gemini API key is stored exclusively in `chrome.storage.local` and accessed only at call time by `background.ts`. It never touches web page DOMs, is never exposed to Amazon content scripts, and is stripped from all exports and JSON backups.
- **Minimal Host Permissions**:
  - `https://*.amazon.com/*` (Amazon book searches)
  - `https://completion.amazon.com/*` (Amazon autocomplete suggestions)
  - `https://generativelanguage.googleapis.com/*` (Google Gemini API)
- **No Remote Code Execution**: All JavaScript is strictly bundled and evaluated locally under Manifest V3 security policies.

---

## ⚠️ Known Limitations

1. **Non-US Marketplaces**: Optimized primarily for `amazon.com`. International domains (`amazon.co.uk`, `amazon.ca`, etc.) are supported experimentally; Amazon DOM variations in those regions may require updating selectors in `selectors.ts`.
2. **Private Reviews Access**: Some customer reviews on Amazon are restricted to signed-in accounts; the extension gracefully handles login gates and analyzes public reviews.
3. **Google Gemini API Usage**: Requires a free or paid API key from Google AI Studio. The extension provides conservative token budgeting (approx. 1,000–1,500 output tokens per 10 ideas).
