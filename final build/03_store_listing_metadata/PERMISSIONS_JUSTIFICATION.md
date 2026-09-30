# Chrome Web Store Permissions Justification

When submitting your extension to the Chrome Web Store Developer Dashboard, you will be required to explain why each permission is requested in the **Privacy Practices** tab. Use the justifications below:

---

## Single Purpose Description
> **"KDP Niche Finder has a single purpose: to assist Amazon KDP authors and publishers in evaluating book niche competition, estimating royalties, and discovering low-competition book opportunities directly on Amazon search and product pages."**

---

## Detailed Permission Justifications

### 1. `storage`
- **Why it is needed:** Used to store user configuration settings (scoring factor weights, BSR sales thresholds, KDP printing costs) and a local 24-hour cache of search snapshots so users do not repeatedly re-request Amazon pages.
- **Data storage location:** Stored strictly locally on the user's device via `chrome.storage.local`. No personal data is transmitted externally.

### 2. `activeTab`
- **Why it is needed:** Allows the extension to interact with the currently focused Amazon Books search or product page when the user initiates research.

### 3. `scripting`
- **Why it is needed:** Required to inject the sidebar interface overlay and companion styles into Amazon search pages to present live niche scores, charts, and table metrics.

### 4. `downloads`
- **Why it is needed:** Allows users to export the analyzed books dataset directly to their computer as a TSV or CSV spreadsheet file for offline spreadsheet analysis.

### 5. `alarms`
- **Why it is needed:** Used to schedule periodic cleanup of expired local cache entries (>24 hours) and handle background request throttling timers.

---

## Host Permissions Justifications

### 1. `https://www.amazon.com/*`
- **Why it is needed:** Necessary to extract public catalog data (Title, Price, Best Sellers Rank, Review Count, Star Rating, Page Count, and Publication Date) from Amazon search results and product pages requested by the user.

### 2. `https://completion.amazon.com/*`
- **Why it is needed:** Queries Amazon's public search suggestion API to provide keyword expansion and auto-suggested sub-niches to the author.

### 3. `https://api.anthropic.com/*`
- **Why it is needed:** Allows users who provide their own optional API key to generate creative book titles, subtitle ideas, and chapter outlines based on analyzed niche gaps.

---

## Chrome Web Store Reviewer Note
All web requests made by the extension are rate-limited to 1 request every 2-3 seconds to prevent server strain. No personal data, passwords, payment info, or browsing history outside of Amazon book research is accessed, collected, or shared.
