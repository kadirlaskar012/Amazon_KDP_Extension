// tests/bestSellersPage.test.ts
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { parseBestSellersPage } from '../src/parsers/bestSellersPage';

describe('bestSellersPage parser', () => {
  it('parses a saved HTML fixture, returning ranks 1..n with ASINs and handles missing review counts', () => {
    const fixturePath = path.resolve(__dirname, 'fixtures/bestsellers_page.html');
    const html = fs.readFileSync(fixturePath, 'utf-8');

    const result = parseBestSellersPage(html);

    expect(result.isCaptcha).toBe(false);
    expect(result.categoryName).toContain("Children's Activity Books");
    expect(result.items.length).toBe(3);

    // Item #1
    const item1 = result.items[0]!;
    expect(item1.rank).toBe(1);
    expect(item1.asin).toBe('B08XYZ1111');
    expect(item1.title).toContain('Toddler Coloring Book');
    expect(item1.price).toBe(6.99);
    expect(item1.rating).toBe(4.7);
    expect(item1.reviewCount).toBe(1540);

    // Item #2 has missing review count
    const item2 = result.items[1]!;
    expect(item2.rank).toBe(2);
    expect(item2.asin).toBe('B08XYZ2222');
    expect(item2.title).toContain('My First Toddler Coloring Book');
    expect(item2.price).toBe(7.49);
    expect(item2.rating).toBe(4.8);
    expect(item2.reviewCount).toBeUndefined(); // gracefully handled

    // Item #3
    const item3 = result.items[2]!;
    expect(item3.rank).toBe(3);
    expect(item3.asin).toBe('B08XYZ3333');
    expect(item3.price).toBe(8.99);
    expect(item3.reviewCount).toBe(320);
  });

  it('detects CAPTCHA on best sellers page', () => {
    const captchaHtml = `
      <html>
        <head><title>Robot Check</title></head>
        <body>
          <form action="/errors/validateCaptcha">
            <input id="captchacharacters" />
          </form>
        </body>
      </html>
    `;
    const result = parseBestSellersPage(captchaHtml);
    expect(result.isCaptcha).toBe(true);
    expect(result.items).toEqual([]);
  });
});
