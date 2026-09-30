# Privacy Policy for KDP Niche Finder

**Last Updated: September 30, 2026**

This Privacy Policy explains how the **KDP Niche Finder** Chrome Extension ("we", "our", or "the extension") handles user information and data.

## 1. Information We Do NOT Collect
- We do **not** collect or transmit any personally identifiable information (PII).
- We do **not** collect passwords, credit card details, financial information, or personal account credentials.
- We do **not** track or collect your general browsing history, cookies, or internet activity outside of the specific Amazon book search requests you initiate.

## 2. Information Handled Locally
- **Amazon Book Metadata:** The extension parses publicly visible book data (such as title, author, price, reviews, ratings, BSR, and page counts) from Amazon search results and product pages. This data is processed purely in your local browser environment.
- **Local Storage:** The extension uses `chrome.storage.local` solely on your device to store user preferences (custom scoring weights, thresholds) and temporary cache snapshots (held up to 24 hours to prevent redundant network requests).
- **Optional API Keys:** If you provide an Anthropic API key for AI generation features, it is stored securely in your browser's local storage and is only transmitted directly to Anthropic's official API endpoint (`api.anthropic.com`). We never see or store your API key.

## 3. Data Sharing & Third Parties
- We do **not** sell, rent, monetize, or transfer your personal data or search habits to any third parties, advertisers, or data brokers.
- No analytics or telemetry tracking scripts are bundled into the extension.

## 4. Single-Purpose Compliance
The extension strictly adheres to Google Chrome's Web Store Developer Program Policies, specifically the Single-Purpose Policy. Its sole function is assisting self-publishers with niche and keyword analytics for Amazon KDP.

## 5. Contact
For questions, support, or feedback regarding this policy, please open an issue on the official GitHub repository:
https://github.com/kadirlaskar012/Amazon_KDP_Extension
