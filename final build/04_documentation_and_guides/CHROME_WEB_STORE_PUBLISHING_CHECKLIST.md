# Chrome Web Store Publishing Checklist & Guide

Follow these exact steps to publish **KDP Niche Finder** to the official Google Chrome Web Store.

---

## Step 1: Open Chrome Developer Dashboard
1. Go to the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).
2. Sign in with your Google account.
3. If this is your first extension, pay the one-time $5 developer registration fee required by Google.

---

## Step 2: Upload the Extension Package
1. Click **+ New Item** in the top right.
2. Drag and drop or browse to the zip file located in:
   `final build/01_extension_package/kdp-niche-finder-v1.0.0.zip`
3. Wait for Google's automated validator to verify the manifest and packages.

---

## Step 3: Fill Out the Store Listing Tab
Open `final build/03_store_listing_metadata/STORE_LISTING_METADATA.md` and copy over:
- **Product Name:** `KDP Niche Finder`
- **Summary:** Paste the 122-character summary from the file.
- **Detailed Description:** Copy and paste the formatted markdown / plain text description.
- **Category:** Select `Productivity` (or `Developer Tools`).
- **Language:** Select `English`.

---

## Step 4: Upload Graphic Assets
From the folder `final build/02_store_listing_assets/`:
1. **Store Icon:**
   - Upload `images/icons/128.png` (128x128).
2. **Screenshots (Minimum 1 required, upload all 3 for best conversion):**
   - Screenshot 1: `images/screenshot_1_overview_tab.jpg`
   - Screenshot 2: `images/screenshot_2_books_tab.jpg`
   - Screenshot 3: `images/screenshot_3_settings.jpg`
3. **Promotional Tiles:**
   - Marquee Promo Tile: `images/promo_marquee_banner.jpg`
4. **Promo Video (Optional but recommended):**
   - You can upload `video/kdp_niche_finder_demo.webp` or a screen recording of `video/demo_preview.html` to YouTube and paste the link in the "YouTube video" box.

---

## Step 5: Fill Out Privacy Practices
Open `final build/03_store_listing_metadata/PERMISSIONS_JUSTIFICATION.md` and copy over:
1. **Single Purpose:** Paste the single purpose description.
2. **Permission Justifications:**
   - Paste the justification for `storage`, `activeTab`, `scripting`, `downloads`, `alarms`, and `host_permissions`.
3. **Data Usage:**
   - Select "No" for collection of Personally Identifiable Information.
   - Select "Yes" for handling public web page content locally.
4. **Privacy Policy Link:**
   - Host `PRIVACY_POLICY.md` on GitHub (e.g., in your repository or GitHub Pages) and paste the URL.

---

## Step 6: Review & Submit
1. Select **Publishing options**: Public (visible to all) or Unlisted (only people with direct link).
2. Click **Submit for Review**.
3. Google will typically review Manifest V3 extensions within 24 to 72 hours.
