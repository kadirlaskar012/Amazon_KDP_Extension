/**
 * Review Gap Analyzer (Module H)
 * Detects common customer complaints from 1-3 star reviews
 */
export const COMMON_COMPLAINT_PATTERNS = [
  'thin paper',
  'bleed through',
  'bleed-through',
  'small designs',
  'too few pages',
  'blurry',
  'repeated images',
  'duplicate images',
  'poor quality',
  'typos',
  'spelling errors',
  'bad binding',
  'misaligned',
  'black back pages missing',
  'single sided',
];

export interface ComplaintFrequency {
  phrase: string;
  count: number;
}

export function extractComplaints(reviews: string[]): ComplaintFrequency[] {
  const counts: Record<string, number> = {};

  for (const review of reviews) {
    const lower = review.toLowerCase();
    for (const pattern of COMMON_COMPLAINT_PATTERNS) {
      if (lower.includes(pattern)) {
        counts[pattern] = (counts[pattern] || 0) + 1;
      }
    }
  }

  return Object.entries(counts)
    .map(([phrase, count]) => ({ phrase, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);
}
