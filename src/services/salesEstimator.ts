import type { BsrSalesTier, PrintingCostTier } from '../types';
import { DEFAULT_BSR_SALES_TABLE, DEFAULT_PRINTING_COST_TABLE } from '../config/defaults';

/**
 * Estimates monthly sales units from Amazon BSR using the lookup table
 */
export function estimateMonthlySales(
  bsr?: number,
  table: BsrSalesTier[] = DEFAULT_BSR_SALES_TABLE
): number {
  if (bsr === undefined || bsr <= 0) return 0;

  for (const tier of table) {
    if (bsr >= tier.minBsr && bsr <= tier.maxBsr) {
      return tier.monthlySales;
    }
  }

  // If higher than maximum in table
  return table[table.length - 1]?.monthlySales || 0;
}

/**
 * Calculates printing cost for standard KDP paperback
 */
export function calculatePrintingCost(
  pageCount: number = 100,
  costTable: PrintingCostTier[] = DEFAULT_PRINTING_COST_TABLE
): number {
  for (const tier of costTable) {
    if (pageCount >= tier.minPages && pageCount <= tier.maxPages) {
      return Number((tier.fixedCost + pageCount * tier.perPageCost).toFixed(2));
    }
  }
  // Default fallback printing cost
  return 2.30;
}

/**
 * Estimates monthly royalty for a book:
 * Royalty per sale = 0.6 * price - printingCost
 * Monthly royalty = sales * royaltyPerSale
 */
export function estimateRoyalty(
  price: number = 9.99,
  bsr?: number,
  pageCount: number = 100,
  bsrTable: BsrSalesTier[] = DEFAULT_BSR_SALES_TABLE,
  costTable: PrintingCostTier[] = DEFAULT_PRINTING_COST_TABLE
): {
  monthlySales: number;
  royaltyPerSale: number;
  monthlyRoyalty: number;
} {
  const monthlySales = estimateMonthlySales(bsr, bsrTable);
  const printCost = calculatePrintingCost(pageCount, costTable);
  const royaltyPerSale = Math.max(0, Number((0.6 * price - printCost).toFixed(2)));
  const monthlyRoyalty = Math.max(0, Number((monthlySales * royaltyPerSale).toFixed(2)));

  return {
    monthlySales,
    royaltyPerSale,
    monthlyRoyalty,
  };
}
