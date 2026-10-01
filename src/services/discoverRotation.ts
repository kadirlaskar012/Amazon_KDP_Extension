// src/services/discoverRotation.ts
// Pure deterministic functions for daily seed and letter rotation.
// All functions are injectable (accept dayIndex or date) for deterministic testing.

/**
 * Returns the number of days since Unix epoch for a given timestamp.
 * Defaults to today (UTC).
 */
export function getDayIndex(nowMs: number = Date.now()): number {
  return Math.floor(nowMs / (1000 * 60 * 60 * 24));
}

/**
 * Returns the 3 seed phrases to use today from the full seed list,
 * rotating by dayIndex so each day a different slice is used.
 *
 * Rule: use seeds[(dayIndex + i) % seeds.length] for i in 0..2
 */
export function getRotatingSeeds(dayIndex: number, seeds: string[]): string[] {
  if (seeds.length === 0) return [];
  const result: string[] = [];
  for (let i = 0; i < 3; i++) {
    result.push(seeds[(dayIndex + i) % seeds.length]!);
  }
  return result;
}

/**
 * All possible suffix characters for autocomplete expansion:
 * a-z then 0-9 (36 total)
 */
export const ALL_SUFFIXES: string[] = [
  ...'abcdefghijklmnopqrstuvwxyz'.split(''),
  ...'0123456789'.split(''),
];

/**
 * Returns the 9-letter window of autocomplete suffixes for a given dayIndex.
 * The window shifts by 9 each day and wraps around mod 36.
 *
 * Examples:
 *   dayIndex 0  → indices  0-8  → a-i
 *   dayIndex 1  → indices  9-17 → j-r
 *   dayIndex 2  → indices 18-26 → s-0 (s-z + 0,1,2)
 *   dayIndex 3  → indices 27-35 → 3-9 + a,b
 *   dayIndex 4  → wraps back to 0-8 → a-i
 */
export function getLetterWindow(dayIndex: number): string[] {
  const windowSize = 9;
  const total = ALL_SUFFIXES.length; // 36
  const start = (dayIndex * windowSize) % total;
  const result: string[] = [];
  for (let i = 0; i < windowSize; i++) {
    result.push(ALL_SUFFIXES[(start + i) % total]!);
  }
  return result;
}

/**
 * Generates all autocomplete query strings to fire today:
 * For each seed × each suffix in today's window.
 *
 * Returns array of query strings like "coloring book for kids a",
 * "coloring book for kids b", ...
 */
export function buildRotatingQueries(dayIndex: number, seeds: string[]): string[] {
  const rotatingSeeds = getRotatingSeeds(dayIndex, seeds);
  const letterWindow = getLetterWindow(dayIndex);
  const queries: string[] = [];
  for (const seed of rotatingSeeds) {
    for (const letter of letterWindow) {
      queries.push(`${seed} ${letter}`);
    }
  }
  return queries;
}
