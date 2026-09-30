# KDP Niche Finder — Release Notes v1.0.0

**Release Date: September 30, 2026**
**Package:** `kdp-niche-finder-v1.0.0.zip`
**Manifest Version:** 3

---

## What's New in v1.0.0

### 1. Amazon Books Real-Time Parser & Sidebar (Phase 1)
- Seamless sidebar injected on `amazon.com` Books search pages.
- Real-time DOM parser extracting Title, Price, BSR, Review Counts, Star Ratings, and Publication Dates.
- Polite background queue throttling requests to 1 every 2-3 seconds to prevent CAPTCHAs.
- 24-hour smart local caching with automatic eviction.

### 2. Decision Engine & 5-Factor Niche Scoring (Phase 2)
- **Proprietary Niche Score (0-100)**: Evaluates demand and competition using 5 weighted metrics:
  - Demand (35%)
  - Competition Gap (30%)
  - Weak Competitors (15%)
  - Profit Potential (10%)
  - New Entrant Friendliness (10%)
- Circular SVG Score Gauge with dynamic coloring (Green $\ge 80$, Yellow $\ge 60$, Red $< 60$).
- Plain-English score breakdown explanations and rule-based verdict generation.

### 3. Accurate Sales & Royalty Estimator
- BSR-to-Monthly-Sales projection lookup table.
- Automated KDP Paperback printing cost deduction ($1.00 fixed + $0.012 per page).
- 60% Amazon royalty formula for exact net royalty per sale.
- Niche total monthly royalty estimate with "rough estimate" tag.

### 4. "Opportunity" Weak Competitor Detector
- Spots vulnerable books (BSR < 100,000 with < 30 reviews or < 4.0 star ratings).
- Highlights opportunity rows in soft green with green pill badges.
- Interactive tooltips detailing the exact opportunity reasons.

### 5. Interactive Books Analysis Table & Tools
- Sortable table across all metrics (default sort BSR ascending).
- Instant real-time title search filter.
- Toggle "Show only opportunities".
- "Copy table as TSV" for one-click pasting into Excel / Google Sheets.

### 6. Full Options & Customization Dashboard
- Weight sliders that automatically normalize to 100%.
- Editable BSR-sales mapping table.
- Editable KDP printing cost parameters.
- Instant recalculation of active snapshot scores without refetching pages.
