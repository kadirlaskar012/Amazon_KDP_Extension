import type { Book, NicheScore, ScoreWeights } from '../types';
import { DEFAULT_SCORE_WEIGHTS } from '../config/defaults';

/**
 * Calculates Niche Score (0-100) based on top 10 results (Module B)
 * - Demand (35 pts): count of books with BSR < 100,000, scaled to 35.
 * - Competition gap (30 pts): count of books with reviewCount < 50, scaled to 30.
 * - Weak competitors (15 pts): count of books with BSR < 100,000 AND (reviewCount < 30 OR rating < 4.0), scaled to 15.
 * - Profit (10 pts): based on average price minus printing cost, scaled to 10.
 * - New-entrant friendly (10 pts): count of top-10 books published within last 12 months, scaled to 10.
 */
export function calculateNicheScore(
  books: Book[],
  weights: ScoreWeights = DEFAULT_SCORE_WEIGHTS
): NicheScore {
  const top10 = books.slice(0, 10);
  const totalInTop10 = Math.max(top10.length, 1);

  // 1. Demand: count with BSR < 100,000
  const demandCount = top10.filter((b) => b.bsrOverall !== undefined && b.bsrOverall < 100000).length;
  const demandScore = Math.round((demandCount / totalInTop10) * weights.demand);

  // 2. Competition Gap: count with reviewCount < 50
  const compGapCount = top10.filter((b) => b.reviewCount !== undefined && b.reviewCount < 50).length;
  const competitionGapScore = Math.round((compGapCount / totalInTop10) * weights.competitionGap);

  // 3. Weak Competitors: BSR < 100,000 AND (reviews < 30 OR rating < 4.0)
  const weakCount = top10.filter((b) => {
    const hasBsr = b.bsrOverall !== undefined && b.bsrOverall < 100000;
    const lowReviews = b.reviewCount !== undefined && b.reviewCount < 30;
    const lowRating = b.rating !== undefined && b.rating < 4.0;
    return hasBsr && (lowReviews || lowRating);
  }).length;
  const weakCompetitorsScore = Math.round((weakCount / totalInTop10) * weights.weakCompetitors);

  // 4. Profit: Average price vs printing cost
  const validPrices = top10.filter((b) => b.price !== undefined).map((b) => b.price!);
  const avgPrice = validPrices.length ? validPrices.reduce((a, b) => a + b, 0) / validPrices.length : 9.99;
  // Estimated baseline profit margin: price > 12 = full points, price < 6 = 2 points
  const profitRatio = Math.min(1, Math.max(0, (avgPrice - 5) / 10));
  const profitScore = Math.round(profitRatio * weights.profit);

  // 5. New-entrant friendly: published within last 12 months
  const now = Date.now();
  const twelveMonthsMs = 365 * 24 * 60 * 60 * 1000;
  const newEntrantCount = top10.filter((b) => {
    if (!b.publishDate) return false;
    const pubTime = new Date(b.publishDate).getTime();
    return !isNaN(pubTime) && now - pubTime < twelveMonthsMs;
  }).length;
  const newEntrantScore = Math.round((newEntrantCount / totalInTop10) * weights.newEntrant);

  const total = Math.min(100, demandScore + competitionGapScore + weakCompetitorsScore + profitScore + newEntrantScore);
  const label: 'green' | 'yellow' | 'red' = total >= 80 ? 'green' : total >= 60 ? 'yellow' : 'red';

  return {
    total,
    demand: demandScore,
    competitionGap: competitionGapScore,
    weakCompetitors: weakCompetitorsScore,
    profit: profitScore,
    newEntrant: newEntrantScore,
    label,
  };
}
