// src/types/discover.ts
// All types for the Discover Top 10 Opportunities feature

export type DiscoverIdeaStatus = 'quick' | 'checked' | 'verified';
export type DiscoverSource =
  | 'Rising today'     // Movers & Shakers
  | 'New release'      // New Releases page
  | 'Weak competitor'  // Best Sellers page (weak BSR + low reviews/rating)
  | 'Autocomplete'     // Rotating seed + letter window
  | 'Related';         // Related pool from browsing (last 7 days)

export type DiscoverScanStatus =
  | 'idle'
  | 'running'
  | 'complete'
  | 'partial'  // interrupted (browser closed, captcha)
  | 'captcha'; // stopped at CAPTCHA

export type DiscoverTrend =
  | 'new today'
  | `up ${number}`
  | `down ${number}`
  | 'same'
  | 'rising';

/** A single candidate idea in the Discover pool */
export interface DiscoverIdea {
  phrase: string;                 // The niche keyword phrase
  source: DiscoverSource;
  score: number;                  // 0–100 niche score (NicheScore.total)
  scoreLabel?: 'green' | 'yellow' | 'red' | 'insufficient';
  status: DiscoverIdeaStatus;
  bsrChecked: number;             // How many of top-5 results have BSR known
  bsrTotal: number;               // Denominator (usually 5)
  whyText: string;                // One-line rule-based explanation
  isNewToday?: boolean;
  trend?: string;                 // "New today" | "Up 3" | "Down 2" | "Same" | "Rising"
  streak?: number;                // Days in a row in Top 10
  rankChangePercent?: number;     // From M&S page if available
  publishDate?: string;           // From New Releases page if available
  asin?: string;                  // Leading ASIN (for Book gap ideas)
}

/** Persistent storage for discover scan results */
export interface DiscoverIdeasStorage {
  generatedAt: number;
  scanStatus: DiscoverScanStatus;
  requestsUsed: number;
  pool: DiscoverIdea[];   // all candidates evaluated
  top10: DiscoverIdea[];  // final filtered/ranked top 10
}

/** One day's top-10 snapshot for history */
export interface DiscoverHistoryEntry {
  date: string;           // ISO date string "YYYY-MM-DD"
  ideas10: DiscoverIdea[];
}

/** A dismissed phrase entry */
export interface DiscoverDismissedEntry {
  phrase: string;
  until: number;          // Timestamp when dismissal expires (30 days)
}

/** Scan cursor state for resuming interrupted scans */
export interface DiscoverScanState {
  cursor: number;         // Index of last completed pool item
  lockedAt?: number;      // Timestamp of active lock
}

/** Category source URLs configuration (one per category) */
export interface DiscoverCategorySource {
  label: string;          // e.g. "Coloring Books"
  moversShakersUrl?: string;
  newReleasesUrl?: string;
  bestSellersUrl?: string;
}

/** Discover-specific settings stored in Settings */
export interface DiscoverSettings {
  autoRefresh: boolean;          // default true
  maxRequestsPerScan: number;    // default 120
  categorysources: DiscoverCategorySource[];
  seedList: string[];            // editable seed phrases
}
