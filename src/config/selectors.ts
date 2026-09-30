/**
 * Centralized Amazon Selectors and Fallbacks
 * 
 * IMPORTANT: Amazon frequently modifies its DOM structure, class names,
 * and test attributes. All extraction code MUST reference these definitions
 * and loop through fallbacks until a match is found or return undefined / 'N/A'.
 */

export interface SelectorGroup {
  container?: string[];
  items?: string[];
  title?: string[];
  subtitle?: string[];
  author?: string[];
  price?: string[];
  rating?: string[];
  reviewCount?: string[];
  asin?: string[];
  productLink?: string[];
  sponsored?: string[];
}

export const SEARCH_SELECTORS = {
  // Main search results container
  containers: [
    'div.s-main-slot.s-result-list',
    'div[data-component-type="s-search-results"]',
    'div.s-main-slot',
    '.s-result-list',
  ],

  // Individual search result cards
  items: [
    'div[data-component-type="s-search-result"]',
    'div.s-result-item[data-asin]:not([data-asin=""])',
    'div[data-asin]:not([data-asin=""])',
  ],

  // Identifying sponsored products (must be skipped per requirements)
  sponsoredMarkers: [
    '.puis-sponsored-label-text',
    '.s-sponsored-label-info-icon',
    'span.s-label-popover-hover',
    'span[aria-label="View Sponsored information or leave ad feedback"]',
    '.s-sponsored-info-icon',
    'span.puis-sponsored-label-text',
    'span.a-color-secondary:contains("Sponsored")',
  ],

  // Title extraction
  title: [
    'h2 a span',
    'h2.a-size-mini span',
    'h2.a-size-base-plus span',
    'h2 a.a-link-normal span',
    'h2 span',
    'a.a-link-normal span.a-text-normal',
  ],

  // Subtitle / format info
  subtitle: [
    'h2 + div span.a-size-base',
    'h2 ~ div.a-row span.a-size-base.a-color-secondary',
    '.a-row.a-size-base.a-color-secondary',
  ],

  // Author name
  author: [
    'a[href*="/e/"]',
    '.a-row.a-size-base a.a-link-normal',
    '.a-row.a-size-base .a-size-base + .a-size-base',
    '.a-row.a-size-base .a-size-base + a',
    '.a-row .a-size-base.a-link-normal',
    'span.a-size-base.a-link-normal',
  ],

  // Product price (paperback or Kindle)
  price: [
    '.a-price:not(.a-text-price) .a-offscreen',
    '.a-price .a-offscreen',
    'span.a-price span.a-price-whole',
    '.a-color-price',
  ],

  // Star rating
  rating: [
    'span[aria-label*="out of 5 stars"]',
    'span[aria-label*="stars"]',
    'i.a-icon-star-small span.a-icon-alt',
    'i.a-icon-star span.a-icon-alt',
    'span[aria-label*="de 5 estrellas"]',
  ],

  // Number of reviews
  reviewCount: [
    'span[aria-label*="stars"] ~ span a span',
    'a[href*="#customerReviews"] span',
    'span.a-size-base.s-underline-text',
    'div.a-spacing-top-micro span.a-size-base',
  ],

  // Product link to get ASIN and href
  productLink: [
    'h2 a.a-link-normal',
    'a.a-link-normal[href*="/dp/"]',
    'a.a-link-normal[href*="/gp/product/"]',
  ],
};

export const PRODUCT_PAGE_SELECTORS = {
  // Container for book details (bulleted list layout)
  detailBullets: [
    '#detailBullets_feature_div',
    '#detailBulletsWrapper_feature_div',
  ],

  // Container for book details (tabular layout)
  detailTable: [
    '#productDetails_db_sections',
    '#prodDetails',
    '#SalesRank',
  ],

  // Carousel/RPI badge pills layout (newer Amazon layouts)
  rpiPills: [
    '#rpi-attribute-book_details-fiona_pages',
    '#rpi-attribute-book_details-dimensions',
    '#rpi-attribute-book_details-publication_date',
    '#rpi-attribute-book_details-reading_age',
  ],

  // Review section for Module H
  reviewSection: [
    '#cm-cr-dp-review-list',
    '#customerReviews',
    'div[data-hook="review"]',
  ],

  reviewItems: [
    'div[data-hook="review"]',
    'div.review',
  ],

  reviewRating: [
    'i[data-hook="review-star-rating"] span.a-icon-alt',
    'i[data-hook="cmps-review-star-rating"] span.a-icon-alt',
    'span.a-icon-alt',
  ],

  reviewText: [
    'span[data-hook="review-body"] span',
    'div.review-text-content span',
    'span[data-hook="review-body"]',
  ],
};

export const BEST_SELLERS_SELECTORS = {
  categoryTitle: [
    'h1.a-size-large.a-spacing-medium',
    'span._cDEzb_headline_29sla',
    'h1._cDEzb_headline_29sla',
    'span.a-size-extra-large',
    'h1',
  ],
  items: [
    'div#gridItemRoot',
    'div.zg-grid-general-faceout',
    'li.zg-item-immersion',
    'div[data-asin]:not([data-asin=""])',
  ],
  rankBadge: [
    'span.zg-bdg-text',
    'span.zg-badge-text',
    '.zg-badge',
    'span.zg-badge',
    'span.a-badge-text',
  ],
  title: [
    'div._cDEzb_p13n-sc-css-line-clamp-1_1Fn1y',
    'div._cDEzb_p13n-sc-css-line-clamp-2_EWbwV',
    'div.p13n-sc-truncated',
    'span.a-size-base.a-color-base',
    'a.a-link-normal span',
    'h2 span',
  ],
  price: [
    '.a-price:not(.a-text-price) .a-offscreen',
    'span.p13n-sc-price',
    'span.a-color-price',
    'span.a-size-base.a-color-price',
    '.a-price .a-offscreen',
  ],
  rating: [
    'i.a-icon-star-small span.a-icon-alt',
    'i.a-icon-star span.a-icon-alt',
    'span[aria-label*="out of 5 stars"]',
    'span[aria-label*="stars"]',
    'i.a-icon-star-small',
  ],
  reviewCount: [
    'a.a-link-normal[href*="#customerReviews"] span',
    'a.a-link-normal[href*="/product-reviews/"] span',
    'div.a-icon-row span.a-size-small',
    'span.a-size-small.a-color-secondary',
    'span.a-size-small',
  ],
  asinLink: [
    'a.a-link-normal[href*="/dp/"]',
    'a.a-link-normal[href*="/gp/product/"]',
  ],
};

/**
 * Patterns to immediately detect Amazon CAPTCHA or Robot Check pages.
 * When ANY of these match, the fetch queue must halt instantly to protect the user's IP.
 */
export const CAPTCHA_DETECTION = {
  formAction: '/errors/validateCaptcha',
  captchaInputId: 'captchacharacters',
  textPhrases: [
    'enter the characters you see below',
    'type the characters you see in this image',
    'robot check',
    "sorry, we just need to make sure you're not a robot",
    'to discuss automated access to amazon data please contact',
  ],
  pageTitles: [
    'robot check',
    'amazon.com verification',
    'sorry! something went wrong',
  ],
};
