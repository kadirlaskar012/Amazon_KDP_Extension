# KDP Niche Finder — Complete Step-by-Step User Guide (English)

Welcome to **KDP Niche Finder**, your personal Chrome Extension designed to uncover high-profit, low-competition book niches on Amazon Kindle Direct Publishing (KDP).

---

## 📌 STEP 1: How to Install the Extension in Google Chrome

1. **Download & Prepare:**
   - Locate the folder:
     `final build/01_extension_package/kdp-niche-finder-v1.0.0-unpacked`
   - *(Alternatively, if using the ZIP file `kdp-niche-finder-v1.0.0.zip`, right-click and extract it into a folder).*

2. **Open Extensions Page:**
   - Open Google Chrome and enter `chrome://extensions/` in the address bar.
   - In the top-right corner, toggle **Developer mode** to **ON**.

3. **Load the Extension:**
   - Click the **Load unpacked** button in the top-left.
   - Select the `kdp-niche-finder-v1.0.0-unpacked` folder.
   - **KDP Niche Finder** will appear in your installed extensions list.

4. **Pin the Extension:**
   - Click the puzzle icon (Extensions menu) in the Chrome toolbar.
   - Click the pin icon next to **KDP Niche Finder** to keep it readily accessible.

---

## 🔎 STEP 2: How to Start Niche Research on Amazon

1. Go to **[https://www.amazon.com](https://www.amazon.com)**.
2. In the Amazon search bar dropdown, select **Books** (or search inside the Books department).
3. Search for a niche idea or keyword (e.g., `toddler coloring book`, `scissor skills activity book`, `daily gratitude journal for women`).
4. Once the search results page loads:
   - The **KDP Niche Finder** sidebar automatically slides out on the right side of your screen.
   - The extension reads the top organic results on the page and begins fetching background product details (BSR, page counts, publish dates) at a safe, polite rate of 1 request every 2-3 seconds to prevent CAPTCHAs.

---

## 📊 STEP 3: Reading the Overview Tab & Niche Score (0–100)

The **Overview Tab** gives you an immediate verdict on whether a niche is worth publishing in:

### 1. The Circular Score Gauge (0–100)
- **80 – 100 (Green / "Good Opportunity"):**
  High customer demand with low competition. Exceptional potential to rank and earn royalties quickly.
- **60 – 79 (Yellow / "Moderate Competition"):**
  Viable niche, but requires a distinctive angle, superior cover design, or targeting a narrower sub-niche.
- **0 – 59 (Red / "Hard Niche"):**
  Oversaturated with high-review competitors or lacks sufficient customer demand. Requires significant Amazon Ads spending to rank.
- **"Insufficient Data":**
  Fewer than 3 books on the page had valid BSR ranks.

### 2. The 5 Scoring Criteria (Sum: 100 pts)
1. **Demand (35 pts):** Awards points based on how many books have a Best Sellers Rank (BSR) under 100,000.
2. **Competition Gap (30 pts):** Awards points based on how many top books have fewer than 50 reviews.
3. **Weak Competitors (15 pts):** Full 15 points if 3 or more high-ranking books have under 30 reviews or under 4.0 star ratings.
4. **Profit Potential (10 pts):** Evaluates estimated royalty per sale after deducting KDP printing costs.
5. **New Entrant Friendly (10 pts):** Awards points if books published within the last 12 months are successfully winning sales.

### 3. Key Stat Cards
- **Avg. BSR (Top 10):** Lower is better. Indicates overall sales velocity.
- **Median Reviews:** Gives a realistic review target needed to compete.
- **Avg. Price:** Helps you price your book profitably.
- **Est. Top 10 Monthly Royalty:** Total monthly net royalties earned across the top 10 books.
- **Opportunities Count:** Number of vulnerable competitor books you can easily outrank.

### 4. Search History Dropdown
- Click the **History** dropdown in the sidebar header to switch between your last 30 saved research snapshots instantly without re-fetching Amazon.

---

## 📖 STEP 4: Using the Books Tab & Weak Competitor Flags

Click on the **Books** tab at the top of the sidebar to inspect competitor books:

### 1. Identify Weak Competitors ("★ Opportunity")
- Rows with soft green backgrounds and green **`Opportunity`** badges represent vulnerable competitors.
- **Hover over any Opportunity badge** to see the exact reasons (e.g., *"BSR 12,450 (High demand)"*, *"Only 18 reviews"*, *"Rating 3.7"*).

### 2. Sorting & Filtering
- **Click Column Headers:** Sort ascending or descending by BSR, Price, Reviews, Rating, Pages, Est. Sales/mo, or Est. Royalty/mo.
- **Show Only Opportunities:** Check this box to instantly filter out tough competitors and view only low-hanging fruit.
- **Title Search:** Type in the search box to find specific book themes or author names.

### 3. One-Click TSV Export
- Click the **TSV** button in the toolbar.
- Open Microsoft Excel or Google Sheets and press `Ctrl + V` to paste a complete, formatted spreadsheet table for offline analysis.

### 4. Add to Watchlist
- Click the bookmark icon on any row to track that specific book over time.

---

## ⚙️ STEP 5: Customizing Settings & Scoring Weights (Options Page)

You can tailor all scoring logic to match your specific publishing strategy:

1. Right-click the extension icon in Chrome and click **Options** (or click the Settings button inside the popup).
2. **Score Weights:** Drag the 5 sliders to prioritize what matters most to you (e.g., higher weight on Demand or Profit). Click **Auto-Normalize to 100** to balance the total.
3. **Scoring Thresholds:** Adjust cutoff values for demand BSR (default: 100,000), low review count (default: 50), and weak review count (default: 30).
4. **BSR to Monthly Sales Table:** Edit monthly sales numbers per BSR tier or add custom ranges.
5. **Printing Cost & Royalty Calculator:**
   - Default formula: `Printing Cost = $1.00 fixed + ($0.012 × pageCount)`.
   - Update printing fees and royalty rates (default: 60%) to match your book formats.
6. **Claude AI Key (Optional):** Enter your Anthropic Claude API key for future AI book title and outline generation.
7. Click **Save Settings** — your new weights and costs will immediately recalculate all scores on active Amazon tabs without re-fetching!

---

## 🛡️ STEP 6: Safety, Rate Limiting & Cache Management

- **Account Safety:** The extension includes a randomized 2 to 3-second delay between background fetches to protect your Amazon browsing session.
- **24-Hour Cache:** Data for scanned books is cached locally for 24 hours. If you re-search the same niche on the same day, results load instantly without network requests.
- **Clear Cache:** If you want fresh data from Amazon, open Settings and click **Clear 24h Cache**.
