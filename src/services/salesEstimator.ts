import type {
  Book,
  Settings,
  BsrSalesTier,
  EstimateResult,
  NicheRevenueEstimate,
} from '../types';
import {
  DEFAULT_BSR_SALES_TABLE,
  DEFAULT_PRINTING_COST,
  DEFAULT_ROYALTY_RATE,
} from '../config/defaults';

/**
 * Calculates raw monthly sales units from Amazon BSR using lookup table.
 * Returns null if BSR is missing, null, or <= 0.
 */
export function estimateMonthlySalesRaw(
  bsr?: number | null,
  table: BsrSalesTier[] = DEFAULT_BSR_SALES_TABLE
): number | null {
  if (bsr === undefined || bsr === null || bsr <= 0) {
    return null;
  }

  for (const tier of table) {
    if (bsr >= tier.minBsr && bsr <= tier.maxBsr) {
      return tier.monthlySales;
    }
  }

  // If above maximum range, use highest tier (typically 20 sales)
  return table[table.length - 1]?.monthlySales ?? 20;
}

/**
 * Wrapped monthly sales estimation returning EstimateResult
 */
export function estimateMonthlySales(
  bsr?: number | null,
  table: BsrSalesTier[] = DEFAULT_BSR_SALES_TABLE
): EstimateResult<number | null> {
  return {
    value: estimateMonthlySalesRaw(bsr, table),
    isEstimate: true,
  };
}

/**
 * Calculates printing cost for standard KDP paperback:
 * printingCost = fixedCost + perPageCost * pageCount
 */
export function calculatePrintingCost(
  pageCount: number = 100,
  printingCost = DEFAULT_PRINTING_COST
): number {
  const pages = Math.max(pageCount, 1);
  const cost = printingCost.fixedCost + printingCost.perPageCost * pages;
  return Number(cost.toFixed(2));
}

/**
 * Estimates royalty per sale:
 * royalty = royaltyRate * price - printingCost(pageCount)
 */
export function estimateRoyaltyPerSale(
  price?: number | null,
  pageCount?: number | null,
  settings?: Partial<Settings>
): EstimateResult<number | null> {
  if (price === undefined || price === null || price <= 0) {
    return { value: null, isEstimate: true };
  }

  const royaltyRate = settings?.royaltyRate ?? DEFAULT_ROYALTY_RATE;
  const printCostConfig = settings?.printingCost ?? DEFAULT_PRINTING_COST;
  const printCost = calculatePrintingCost(pageCount || 100, printCostConfig);

  const rawRoyalty = royaltyRate * price - printCost;
  const royaltyPerSale = Math.max(0, Number(rawRoyalty.toFixed(2)));

  return {
    value: royaltyPerSale,
    isEstimate: true,
  };
}

/**
 * Estimates monthly royalty for an individual book:
 * monthlyRoyalty = monthlySales * royaltyPerSale
 */
export function estimateMonthlyRoyalty(
  book: Book,
  settings?: Partial<Settings>
): EstimateResult<number | null> {
  const salesResult = estimateMonthlySales(
    book.bsrOverall,
    settings?.bsrSalesTable ?? DEFAULT_BSR_SALES_TABLE
  );
  const royaltyPerSaleResult = estimateRoyaltyPerSale(
    book.price,
    book.pageCount,
    settings
  );

  if (salesResult.value === null || royaltyPerSaleResult.value === null) {
    return { value: null, isEstimate: true };
  }

  const monthlyTotal = Number(
    (salesResult.value * royaltyPerSaleResult.value).toFixed(2)
  );

  return {
    value: monthlyTotal,
    isEstimate: true,
  };
}

/**
 * Computes niche revenue summary for top 10 books:
 * - total monthly royalty
 * - average monthly royalty per book
 * - median monthly royalty per book
 */
export function estimateNicheRevenue(
  books: Book[],
  settings?: Partial<Settings>
): NicheRevenueEstimate {
  const top10 = books.slice(0, 10);
  const royalties: number[] = [];

  for (const book of top10) {
    const est = estimateMonthlyRoyalty(book, settings);
    if (est.value !== null) {
      royalties.push(est.value);
    }
  }

  if (royalties.length === 0) {
    return {
      totalMonthlyRoyalty: { value: 0, isEstimate: true },
      avgMonthlyRoyalty: { value: 0, isEstimate: true },
      medianMonthlyRoyalty: { value: 0, isEstimate: true },
      booksWithEstimates: 0,
    };
  }

  const total = Number(royalties.reduce((sum, val) => sum + val, 0).toFixed(2));
  const avg = Number((total / royalties.length).toFixed(2));

  // Calculate median
  const sorted = [...royalties].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 !== 0
      ? sorted[mid]!
      : Number((((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2).toFixed(2));

  return {
    totalMonthlyRoyalty: { value: total, isEstimate: true },
    avgMonthlyRoyalty: { value: avg, isEstimate: true },
    medianMonthlyRoyalty: { value: median, isEstimate: true },
    booksWithEstimates: royalties.length,
  };
}
