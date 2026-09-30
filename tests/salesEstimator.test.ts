import { describe, it, expect } from 'vitest';
import { estimateMonthlySales, calculatePrintingCost, estimateRoyalty } from '../src/services/salesEstimator';

describe('Sales & Royalty Estimator', () => {
  it('estimates monthly sales based on BSR lookup brackets', () => {
    expect(estimateMonthlySales(500)).toBe(3000);
    expect(estimateMonthlySales(2500)).toBe(1500);
    expect(estimateMonthlySales(12000)).toBe(350);
    expect(estimateMonthlySales(65000)).toBe(80);
    expect(estimateMonthlySales(250000)).toBe(20);
  });

  it('calculates printing cost for page counts', () => {
    // Under 108 pages = $2.30 flat
    expect(calculatePrintingCost(80)).toBe(2.30);
    // Over 108 pages = $1.00 + pages * 0.012 (e.g. 200 pages => 1.00 + 2.40 = 3.40)
    expect(calculatePrintingCost(200)).toBe(3.40);
  });

  it('estimates monthly royalties accurately', () => {
    // Price $9.99, BSR 12,000 (350 sales), 100 pages ($2.30 print cost)
    // Royalty per sale = 0.6 * 9.99 - 2.30 = 5.994 - 2.30 = $3.69
    // Monthly royalty = 350 * 3.69 = $1291.50
    const est = estimateRoyalty(9.99, 12000, 100);
    expect(est.monthlySales).toBe(350);
    expect(est.royaltyPerSale).toBe(3.69);
    expect(est.monthlyRoyalty).toBe(1291.50);
  });
});
