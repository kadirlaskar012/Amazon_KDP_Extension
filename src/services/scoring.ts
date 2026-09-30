import type {
  Book,
  Settings,
  NicheScore,
  ScoreBreakdown,
  ScoreWeights,
} from '../types';
import { DEFAULT_SETTINGS } from '../config/defaults';
import { isOpportunity } from './weakCompetitor';
import { estimateRoyaltyPerSale } from './salesEstimator';

/**
 * Normalizes custom weights to ensure they sum to exactly 100
 */
export function normalizeWeights(weights: ScoreWeights): ScoreWeights {
  const sum =
    weights.demand +
    weights.competitionGap +
    weights.weakCompetitors +
    weights.profit +
    weights.newEntrant;

  if (sum === 100 || sum === 0) return { ...weights };

  const factor = 100 / sum;
  const d = Math.round(weights.demand * factor);
  const c = Math.round(weights.competitionGap * factor);
  const w = Math.round(weights.weakCompetitors * factor);
  const p = Math.round(weights.profit * factor);
  const n = 100 - (d + c + w + p);

  return {
    demand: d,
    competitionGap: c,
    weakCompetitors: w,
    profit: p,
    newEntrant: n,
  };
}

/**
 * Calculates Niche Score (0-100) based on top 10 organic results (Module B)
 */
export function calculateNicheScore(
  books: Book[],
  settings: Settings = DEFAULT_SETTINGS
): NicheScore {
  const thresholds = settings.thresholds;
  const weights = settings.weights;
  const top10 = books.slice(0, 10);

  // Filter books with BSR
  const validBsrBooks = top10.filter(
    (b) => b.bsrOverall !== undefined && b.bsrOverall !== null && b.bsrOverall > 0
  );
  const n = validBsrBooks.length;
  const unknownBsrCount = top10.length - n;

  const warnings: string[] = [];
  if (unknownBsrCount > 0) {
    warnings.push(`${unknownBsrCount} of top ${top10.length} books had no BSR yet.`);
  }

  // Edge case: if n < 3, return insufficient
  if (n < 3) {
    warnings.push(`Insufficient data: analyzed ${n} books with BSR (minimum 3 required).`);
    const emptyBreakdown: ScoreBreakdown = {
      demand: {
        name: 'Demand',
        points: 0,
        maxPoints: weights.demand,
        ratio: 0,
        explanation: 'Fewer than 3 books have BSR data.',
      },
      competitionGap: {
        name: 'Competition Gap',
        points: 0,
        maxPoints: weights.competitionGap,
        ratio: 0,
        explanation: 'Fewer than 3 books have BSR data.',
      },
      weakCompetitors: {
        name: 'Weak Competitors',
        points: 0,
        maxPoints: weights.weakCompetitors,
        ratio: 0,
        explanation: 'Fewer than 3 books have BSR data.',
      },
      profit: {
        name: 'Profit Potential',
        points: 0,
        maxPoints: weights.profit,
        ratio: 0,
        explanation: 'Fewer than 3 books have BSR data.',
      },
      newEntrant: {
        name: 'New Entrant Friendly',
        points: 0,
        maxPoints: weights.newEntrant,
        ratio: 0,
        explanation: 'Fewer than 3 books have BSR data.',
      },
    };

    return {
      total: 0,
      demand: 0,
      competitionGap: 0,
      weakCompetitors: 0,
      profit: 0,
      newEntrant: 0,
      label: 'insufficient',
      breakdown: emptyBreakdown,
      booksAnalyzed: n,
      warnings,
      verdict: 'Not enough book data to score this niche yet.',
    };
  }

  if (n < 10) {
    warnings.push(`Scored based on ${n} books with BSR instead of 10.`);
  }

  // 1. Demand: ratio with BSR < thresholds.demandBsr
  const demandCount = validBsrBooks.filter(
    (b) => b.bsrOverall! < thresholds.demandBsr
  ).length;
  const demandRatio = demandCount / n;
  const demandPoints = Number((demandRatio * weights.demand).toFixed(1));
  const demandExplanation = `${demandCount} of ${n} books have BSR under ${thresholds.demandBsr.toLocaleString()}`;

  // 2. Competition Gap: ratio with reviewCount < thresholds.lowReviewCount
  const compGapCount = validBsrBooks.filter(
    (b) =>
      b.reviewCount !== undefined &&
      b.reviewCount < thresholds.lowReviewCount
  ).length;
  const compGapRatio = compGapCount / n;
  const compGapPoints = Number((compGapRatio * weights.competitionGap).toFixed(1));
  const compGapExplanation = `${compGapCount} of ${n} books have under ${thresholds.lowReviewCount} reviews`;

  // 3. Weak Competitors: BSR < demandBsr AND (reviews < weakReviewCount OR rating < weakRating)
  const weakBooks = validBsrBooks.filter((b) => isOpportunity(b, thresholds));
  const weakRatio = Math.min(weakBooks.length / 3, 1); // 3+ gives full points
  const weakPoints = Number((weakRatio * weights.weakCompetitors).toFixed(1));
  const weakExplanation = `${weakBooks.length} weak competitor${
    weakBooks.length === 1 ? '' : 's'
  } with BSR < 100k and low reviews/rating (3+ for full score)`;

  // 4. Profit: Median royalty of books with valid price
  const profits: number[] = [];
  for (const book of top10) {
    if (book.price !== undefined && book.price > 0) {
      const royalty = estimateRoyaltyPerSale(book.price, book.pageCount, settings);
      if (royalty.value !== null) {
        profits.push(royalty.value);
      }
    }
  }

  let medianProfit = 0;
  if (profits.length > 0) {
    const sorted = [...profits].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    medianProfit =
      sorted.length % 2 !== 0
        ? sorted[mid]!
        : (sorted[mid - 1]! + sorted[mid]!) / 2;
  }

  const profitRatio = Math.min(Math.max(medianProfit / 3.0, 0), 1); // $3+ gives full points
  const profitPoints = Number((profitRatio * weights.profit).toFixed(1));
  const profitExplanation =
    profits.length > 0
      ? `Median royalty is $${medianProfit.toFixed(2)}/sale ($3.00+ for full score)`
      : 'No price data available for royalty calculation.';

  // 5. New Entrant Friendly: Published within newEntrantMonths
  const now = Date.now();
  const msInMonths = thresholds.newEntrantMonths * 30.44 * 24 * 60 * 60 * 1000;
  let recentCount = 0;
  for (const b of validBsrBooks) {
    if (b.publishDate) {
      const pubTime = new Date(b.publishDate).getTime();
      if (!isNaN(pubTime) && now - pubTime <= msInMonths) {
        recentCount++;
      }
    }
  }

  const rawRecentRatio = recentCount / n;
  const recentRatio = Math.min(rawRecentRatio / 0.3, 1); // 30%+ gives full points
  const recentPoints = Number((recentRatio * weights.newEntrant).toFixed(1));
  const recentExplanation = `${recentCount} of ${n} books published in last ${
    thresholds.newEntrantMonths
  } months (${Math.round(rawRecentRatio * 100)}% vs 30% target)`;

  // Sum points and round total
  const sumPoints =
    demandPoints + compGapPoints + weakPoints + profitPoints + recentPoints;
  const total = Math.min(100, Math.max(0, Math.round(sumPoints)));

  let label: 'green' | 'yellow' | 'red' = 'red';
  let verdict = 'Too competitive or low demand. Try a more specific sub-niche.';

  if (total >= thresholds.greenMin) {
    label = 'green';
    verdict = 'Demand is strong and competition is weak. Worth building.';
  } else if (total >= thresholds.yellowMin) {
    label = 'yellow';
    verdict = 'Moderate demand with some competition. Needs strong differentiation.';
  }

  const breakdown: ScoreBreakdown = {
    demand: {
      name: 'Demand',
      points: demandPoints,
      maxPoints: weights.demand,
      ratio: demandRatio,
      explanation: demandExplanation,
    },
    competitionGap: {
      name: 'Competition Gap',
      points: compGapPoints,
      maxPoints: weights.competitionGap,
      ratio: compGapRatio,
      explanation: compGapExplanation,
    },
    weakCompetitors: {
      name: 'Weak Competitors',
      points: weakPoints,
      maxPoints: weights.weakCompetitors,
      ratio: weakRatio,
      explanation: weakExplanation,
    },
    profit: {
      name: 'Profit Potential',
      points: profitPoints,
      maxPoints: weights.profit,
      ratio: profitRatio,
      explanation: profitExplanation,
    },
    newEntrant: {
      name: 'New Entrant Friendly',
      points: recentPoints,
      maxPoints: weights.newEntrant,
      ratio: recentRatio,
      explanation: recentExplanation,
    },
  };

  return {
    total,
    demand: demandPoints,
    competitionGap: compGapPoints,
    weakCompetitors: weakPoints,
    profit: profitPoints,
    newEntrant: recentPoints,
    label,
    breakdown,
    booksAnalyzed: n,
    warnings,
    verdict,
  };
}
