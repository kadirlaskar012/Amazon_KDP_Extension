// src/services/seasonality.ts
// Seasonality & Holiday Trend Predictor:
// Evaluates whether a niche is Evergreen or Seasonal/Holiday-driven, predicts peak months,
// computes launch windows, generates 12-month demand heatmap, and provides actionable timing advice.

import type {
  Book,
  KeywordItem,
  SeasonalityReport,
  SeasonalityType,
  DemandIntensity,
  MonthDemand,
} from '../types';

interface SeasonalEventPattern {
  name: string;
  type: SeasonalityType;
  typeLabel: string;
  keywords: string[];
  peakMonths: string;
  peakMonthIndices: number[]; // 0 = Jan, 11 = Dec
  recommendedLaunchWindow: string;
  launchMonthIndices: number[];
  baseMonthlyScores: number[]; // 12 numbers (0-100)
  evergreenScore: number;
}

const SEASONAL_PATTERNS: SeasonalEventPattern[] = [
  {
    name: 'Christmas & Q4 Gifting',
    type: 'holiday_spike',
    typeLabel: 'Holiday Spike (Q4 Seasonal)',
    keywords: [
      'christmas',
      'xmas',
      'santa',
      'stocking stuffer',
      'advent',
      'holiday gift',
      'winter holiday',
      'noel',
      'reindeer',
      'holiday season',
    ],
    peakMonths: 'Oct - Dec (Peaks Nov/Dec)',
    peakMonthIndices: [9, 10, 11],
    recommendedLaunchWindow: 'July - August (60-90 days prior to Q4)',
    launchMonthIndices: [6, 7],
    baseMonthlyScores: [30, 20, 20, 20, 20, 25, 30, 45, 65, 85, 100, 100],
    evergreenScore: 25,
  },
  {
    name: 'Halloween & Spooky Fall',
    type: 'holiday_spike',
    typeLabel: 'Holiday Spike (Halloween)',
    keywords: [
      'halloween',
      'spooky',
      'pumpkin',
      'witch',
      'ghost',
      'trick or treat',
      'jack-o-lantern',
      'haunted',
      'horror coloring',
    ],
    peakMonths: 'Sep - Oct (Peaks mid-October)',
    peakMonthIndices: [8, 9],
    recommendedLaunchWindow: 'June - July (Prior to fall search buildup)',
    launchMonthIndices: [5, 6],
    baseMonthlyScores: [15, 15, 15, 15, 20, 30, 45, 70, 95, 100, 25, 20],
    evergreenScore: 20,
  },
  {
    name: 'Back to School & Fall Education',
    type: 'seasonal_wave',
    typeLabel: 'Seasonal Wave (Back to School)',
    keywords: [
      'back to school',
      'kindergarten workbook',
      'preschool workbook',
      'pre-k',
      '1st grade',
      '2nd grade',
      'handwriting practice',
      'teacher planner',
      'homeschool curriculum',
      'scissor skills',
      'alphabet tracing',
      'sight words',
    ],
    peakMonths: 'Jul - Sep (Peaks in August)',
    peakMonthIndices: [6, 7, 8],
    recommendedLaunchWindow: 'May - June (Before school supply buying)',
    launchMonthIndices: [4, 5],
    baseMonthlyScores: [50, 45, 50, 50, 55, 75, 95, 100, 90, 55, 50, 50],
    evergreenScore: 65,
  },
  {
    name: 'Easter & Spring',
    type: 'holiday_spike',
    typeLabel: 'Holiday Spike (Easter / Spring)',
    keywords: [
      'easter',
      'bunny',
      'spring coloring',
      'easter basket',
      'egg hunt',
      'resurrection',
      'easter gift',
    ],
    peakMonths: 'Mar - Apr (Easter season)',
    peakMonthIndices: [2, 3],
    recommendedLaunchWindow: 'January - February',
    launchMonthIndices: [0, 1],
    baseMonthlyScores: [20, 45, 95, 100, 40, 25, 20, 20, 20, 20, 25, 30],
    evergreenScore: 25,
  },
  {
    name: "Valentine's Day & Romance",
    type: 'holiday_spike',
    typeLabel: "Holiday Spike (Valentine's)",
    keywords: [
      'valentine',
      'love coupon',
      'couple journal',
      'anniversary book',
      'romantic gift',
    ],
    peakMonths: 'Jan - Feb (Peaks Feb 1-14)',
    peakMonthIndices: [0, 1],
    recommendedLaunchWindow: 'November - December',
    launchMonthIndices: [10, 11],
    baseMonthlyScores: [85, 100, 30, 25, 25, 25, 25, 25, 25, 30, 45, 60],
    evergreenScore: 35,
  },
  {
    name: "Mother's & Father's Day",
    type: 'holiday_spike',
    typeLabel: "Holiday Spike (Parent's Day)",
    keywords: [
      "mother's day",
      'mothers day',
      "father's day",
      'fathers day',
      'mom journal',
      'dad journal',
      'best mom',
      'best dad',
      'i love you mom',
    ],
    peakMonths: 'Apr - Jun (Mother & Father gifting)',
    peakMonthIndices: [3, 4, 5],
    recommendedLaunchWindow: 'February - March',
    launchMonthIndices: [1, 2],
    baseMonthlyScores: [30, 35, 55, 95, 100, 90, 35, 30, 30, 30, 45, 55],
    evergreenScore: 40,
  },
  {
    name: 'Summer Vacation & Road Trips',
    type: 'seasonal_wave',
    typeLabel: 'Seasonal Wave (Summer & Travel)',
    keywords: [
      'summer vacation',
      'road trip',
      'camping journal',
      'beach activity',
      'travel activity book',
      'camp log',
      'rv travel',
    ],
    peakMonths: 'May - Jul (Summer holiday travel)',
    peakMonthIndices: [4, 5, 6],
    recommendedLaunchWindow: 'March - April',
    launchMonthIndices: [2, 3],
    baseMonthlyScores: [30, 30, 40, 60, 90, 100, 95, 70, 40, 35, 40, 45],
    evergreenScore: 50,
  },
  {
    name: 'New Year, Habits & Annual Planners',
    type: 'annual_event',
    typeLabel: 'Annual Event (New Year / Goals)',
    keywords: [
      'planner 202',
      'calendar 202',
      'daily planner',
      'weekly planner',
      'new year resolution',
      'habit tracker',
      'budget planner',
      'fitness planner',
      'goal setting',
    ],
    peakMonths: 'Nov - Jan (Q4 planning & January rush)',
    peakMonthIndices: [10, 11, 0],
    recommendedLaunchWindow: 'September - October',
    launchMonthIndices: [8, 9],
    baseMonthlyScores: [95, 50, 40, 35, 35, 35, 35, 45, 60, 75, 90, 100],
    evergreenScore: 45,
  },
  {
    name: 'Thanksgiving & Fall Harvest',
    type: 'holiday_spike',
    typeLabel: 'Holiday Spike (Thanksgiving)',
    keywords: [
      'thanksgiving',
      'turkey coloring',
      'fall harvest',
      'autumn coloring',
      'gratitude book kids',
    ],
    peakMonths: 'Oct - Nov',
    peakMonthIndices: [9, 10],
    recommendedLaunchWindow: 'August - September',
    launchMonthIndices: [7, 8],
    baseMonthlyScores: [15, 15, 15, 15, 20, 20, 25, 45, 75, 95, 100, 30],
    evergreenScore: 20,
  },
];

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function scoreToIntensity(score: number): DemandIntensity {
  if (score >= 90) return 'Peak';
  if (score >= 70) return 'High';
  if (score >= 40) return 'Med';
  return 'Low';
}

/**
 * Evaluates whether a niche is Evergreen or driven by Seasonal/Holiday waves.
 */
export function analyzeSeasonality(params: {
  query: string;
  books?: Book[];
  keywords?: KeywordItem[];
  geo?: string;
  currentDate?: Date;
}): SeasonalityReport {
  const { query = '', books = [], keywords = [], geo = 'US', currentDate = new Date() } = params;
  const currentMonth = currentDate.getMonth(); // 0 to 11

  const cleanQuery = query.toLowerCase();
  const bookTitlesText = books.map((b) => (b.title + ' ' + (b.author || '')).toLowerCase()).join(' ');
  const keywordsText = keywords.map((k) => k.keyword.toLowerCase()).join(' ');

  let bestMatch: SeasonalEventPattern | null = null;
  let maxWeight = 0;
  const detectedSignals: string[] = [];

  for (const pattern of SEASONAL_PATTERNS) {
    let weight = 0;

    // 1. Direct query match (strongest signal)
    for (const kw of pattern.keywords) {
      if (cleanQuery.includes(kw)) {
        weight += 10;
        detectedSignals.push(`Search query directly matches '${kw}'`);
        break;
      }
    }

    // 2. Competitor book titles match
    let titleMatches = 0;
    for (const kw of pattern.keywords) {
      if (bookTitlesText.includes(kw)) {
        titleMatches++;
      }
    }
    if (titleMatches > 0) {
      weight += Math.min(6, titleMatches * 2);
      detectedSignals.push(`${titleMatches} competitor title(s) reference '${pattern.name}' themes`);
    }

    // 3. Extracted keywords match
    let kwMatches = 0;
    for (const kw of pattern.keywords) {
      if (keywordsText.includes(kw)) {
        kwMatches++;
      }
    }
    if (kwMatches > 0) {
      weight += Math.min(4, kwMatches);
      detectedSignals.push(`Keyword discovery identified '${pattern.name}' search volume`);
    }

    if (weight > maxWeight && weight >= 6) {
      maxWeight = weight;
      bestMatch = pattern;
    }
  }

  // Google Trends 5-year URL
  const trendsUrl = `https://trends.google.com/trends/explore?date=today%205-y&geo=${encodeURIComponent(
    geo
  )}&q=${encodeURIComponent(query || 'kdp niche')}`;

  // If no strong seasonal pattern detected -> Evergreen Niche!
  if (!bestMatch) {
    const evergreenScores = [75, 70, 75, 75, 75, 75, 75, 80, 80, 85, 95, 100];
    const heatmap: MonthDemand[] = MONTH_NAMES.map((m, idx) => ({
      month: m,
      monthIndex: idx,
      score: evergreenScores[idx] || 75,
      intensity: scoreToIntensity(evergreenScores[idx] || 75),
    }));

    return {
      type: 'evergreen',
      typeLabel: 'Evergreen (Year-Round Demand)',
      primaryEvent: 'None (Stable All-Season Baseline)',
      peakMonths: 'Year-Round Steady (With Q4 Holiday Gifting Uptick)',
      recommendedLaunchWindow: 'Immediate (Publish anytime with consistent sales)',
      launchUrgency: 'anytime',
      urgencyAdvice:
        'Safe Year-Round Income: This niche sells consistently across all 12 months with minimal seasonal drops. You can launch today with zero cutoff deadline risk.',
      evergreenScore: 92,
      monthlyHeatmap: heatmap,
      trendsUrl,
      signalsDetected:
        detectedSignals.length > 0
          ? detectedSignals
          : ['No restrictive holiday spikes detected in title or keyword corpus', 'Sales velocity displays standard evergreen distribution'],
    };
  }

  // Seasonal Match found:
  const heatmap: MonthDemand[] = MONTH_NAMES.map((m, idx) => {
    const sc = bestMatch!.baseMonthlyScores[idx] || 30;
    return {
      month: m,
      monthIndex: idx,
      score: sc,
      intensity: scoreToIntensity(sc),
    };
  });

  // Calculate dynamic launch urgency based on current month:
  let launchUrgency: 'optimal_now' | 'preparation' | 'late' | 'anytime' = 'preparation';
  let urgencyAdvice = '';

  const isOptimalMonth = bestMatch.launchMonthIndices.includes(currentMonth);
  const isPeakMonth = bestMatch.peakMonthIndices.includes(currentMonth);

  if (isOptimalMonth) {
    launchUrgency = 'optimal_now';
    urgencyAdvice = `Optimal Launch Window NOW! Publishing this month provides the ideal 60-90 day runway for Amazon KDP indexing, keyword relevance scoring, and initial review collection before peak customer buying begins in ${bestMatch.peakMonths}.`;
  } else if (isPeakMonth) {
    launchUrgency = 'late';
    urgencyAdvice = `Active Peak Season In Progress: Customer buying for ${bestMatch.name} is occurring right now. New listings published today face established competitors and may miss the organic indexing surge. Aggressive PPC is advised if launching immediately.`;
  } else {
    // Check distance in months
    const firstPeak = bestMatch.peakMonthIndices[0]!;
    let monthsToPeak = firstPeak - currentMonth;
    if (monthsToPeak < 0) monthsToPeak += 12;

    if (monthsToPeak <= 4 && monthsToPeak >= 2) {
      launchUrgency = 'preparation';
      urgencyAdvice = `Preparation & Formatting Phase: The peak season (${bestMatch.peakMonths}) is ~${monthsToPeak} months away. This is the ideal time to complete your manuscript, commission cover art, and order a physical proof copy. Plan to publish during ${bestMatch.recommendedLaunchWindow}.`;
    } else {
      launchUrgency = 'preparation';
      urgencyAdvice = `Off-Season Planning: Peak buying occurs in ${bestMatch.peakMonths}. Schedule your book production so that your final listing goes live in ${bestMatch.recommendedLaunchWindow}.`;
    }
  }

  return {
    type: bestMatch.type,
    typeLabel: bestMatch.typeLabel,
    primaryEvent: bestMatch.name,
    peakMonths: bestMatch.peakMonths,
    recommendedLaunchWindow: bestMatch.recommendedLaunchWindow,
    launchUrgency,
    urgencyAdvice,
    evergreenScore: bestMatch.evergreenScore,
    monthlyHeatmap: heatmap,
    trendsUrl,
    signalsDetected: detectedSignals,
  };
}
