import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { parseSearchResults } from '../src/parsers/searchPage';
import { parseProductPage, isCaptchaPage, parseCategoryRanksFromString } from '../src/parsers/productPage';

describe('Search Page Parser', () => {
  it('parses organic book cards and filters out sponsored cards', () => {
    const fixturePath = path.resolve(__dirname, 'fixtures/search_results.html');
    const html = fs.readFileSync(fixturePath, 'utf-8');
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const books = parseSearchResults(doc);

    // Exactly 2 organic books, both sponsored results should be skipped
    expect(books).toHaveLength(2);

    // First organic book
    expect(books[0]!.asin).toBe('B09ABC1234');
    expect(books[0]!.title).toContain('Daily Habit Tracker');
    expect(books[0]!.author).toBe('Sarah Author');
    expect(books[0]!.price).toBe(8.99);
    expect(books[0]!.rating).toBe(4.6);
    expect(books[0]!.reviewCount).toBe(1250);

    // Second organic book
    expect(books[1]!.asin).toBe('B08XYZ5678');
    expect(books[1]!.title).toContain('Minimalist Weekly Planner 2024');
    expect(books[1]!.author).toBe('John Minimal');
    expect(books[1]!.price).toBe(7.50);
    expect(books[1]!.rating).toBe(3.8);
    expect(books[1]!.reviewCount).toBe(14);
  });
});

describe('Product Page Parser', () => {
  it('parses detail bullet points layout correctly', () => {
    const fixturePath = path.resolve(__dirname, 'fixtures/product_bullets.html');
    const html = fs.readFileSync(fixturePath, 'utf-8');

    const details = parseProductPage(html);

    expect(details.isCaptcha).toBe(false);
    expect(details.bsrOverall).toBe(42150);
    expect(details.pageCount).toBe(120);
    expect(details.trimSize).toBe('8.5 x 0.28 x 11 inches');
    expect(details.publishDate).toContain('November 10, 2023');
    expect(details.categoryRanks).toHaveLength(2);
    expect(details.categoryRanks[0]!.rank).toBe(14);
    expect(details.categoryRanks[0]!.name).toBe('Self-Help Calendars');
    expect(details.categoryRanks[1]!.rank).toBe(48);
  });

  it('parses tabular specifications layout correctly', () => {
    const fixturePath = path.resolve(__dirname, 'fixtures/product_table.html');
    const html = fs.readFileSync(fixturePath, 'utf-8');

    const details = parseProductPage(html);

    expect(details.isCaptcha).toBe(false);
    expect(details.bsrOverall).toBe(8940);
    expect(details.pageCount).toBe(150);
    expect(details.trimSize).toBe('6 x 9 inches');
    expect(details.publishDate).toContain('January 15, 2024');
  });

  it('immediately detects Amazon CAPTCHA and robot-check pages', () => {
    const fixturePath = path.resolve(__dirname, 'fixtures/captcha_page.html');
    const html = fs.readFileSync(fixturePath, 'utf-8');

    expect(isCaptchaPage(html)).toBe(true);

    const details = parseProductPage(html);
    expect(details.isCaptcha).toBe(true);
  });

  it('parses category ranks directly from raw HTML strings without DOMParser', () => {
    const rawHtml = `
      <div id="detailBullets_feature_div">
        <ul class="zg_hrsr">
          <li class="zg_hrsr_item">
            <span class="zg_hrsr_rank">#3</span>
            <span class="zg_hrsr_ladder">in <a href="/gp/bestsellers/books/100">Children's Coloring Books</a></span>
          </li>
          <li class="zg_hrsr_item">
            <span class="zg_hrsr_rank">#12</span>
            <span class="zg_hrsr_ladder">in <a href="/gp/bestsellers/books/200">Activity Books</a></span>
          </li>
        </ul>
      </div>
    `;

    const ranks = parseCategoryRanksFromString(rawHtml);
    expect(ranks).toHaveLength(2);
    expect(ranks[0]!.rank).toBe(3);
    expect(ranks[0]!.name).toBe("Children's Coloring Books");
    expect(ranks[1]!.rank).toBe(12);
    expect(ranks[1]!.name).toBe('Activity Books');
  });
});
