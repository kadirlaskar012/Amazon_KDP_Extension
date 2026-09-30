import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { parseProductReviews } from '../src/parsers/reviewsParser';

describe('reviewsParser', () => {
  it('parses visible reviews from HTML fixture correctly', () => {
    const fixturePath = path.resolve(__dirname, 'fixtures/product_reviews.html');
    const html = fs.readFileSync(fixturePath, 'utf-8');

    const result = parseProductReviews(html, 'B09COLORBOOK');

    expect(result.reviewsRequireLogin).toBe(false);
    expect(result.reviews).toHaveLength(4);

    // Review 1: 2 stars, 14 helpful votes
    const r1 = result.reviews[0]!;
    expect(r1.rating).toBe(2);
    expect(r1.title).toBe('Thin paper and bleed through');
    expect(r1.body).toContain('ink bleeds through every single page');
    expect(r1.date).toContain('March 15, 2024');
    expect(r1.helpfulVotes).toBe(14);
    expect(r1.asin).toBe('B09COLORBOOK');

    // Review 2: 1 star, "One person found this helpful" -> 1
    const r2 = result.reviews[1]!;
    expect(r2.rating).toBe(1);
    expect(r2.title).toBe('Pages are cut off and small designs');
    expect(r2.body).toContain('pages are cut off near the margins');
    expect(r2.helpfulVotes).toBe(1);

    // Review 3: 3 stars, missing helpful votes
    const r3 = result.reviews[2]!;
    expect(r3.rating).toBe(3);
    expect(r3.title).toBe('Too short with few designs');
    expect(r3.helpfulVotes).toBeUndefined();

    // Review 4: 5 stars
    const r4 = result.reviews[3]!;
    expect(r4.rating).toBe(5);
    expect(r4.title).toBe('My daughter loves this book!');
    expect(r4.helpfulVotes).toBe(8);
  });

  it('detects login wall and sets reviewsRequireLogin to true when reviews are blocked', () => {
    const loginWallHtml = `
      <!DOCTYPE html>
      <html>
      <head><title>Amazon Sign In Required</title></head>
      <body>
        <div id="productTitle">Secret Competitor Book</div>
        <form name="signIn" action="https://www.amazon.com/ap/signin">
          <input type="email" name="email" />
        </form>
        <div id="reviews-login-prompt">
          <p>Please sign in to see reviews from other customers.</p>
        </div>
      </body>
      </html>
    `;

    const result = parseProductReviews(loginWallHtml, 'B09SECRET');
    expect(result.reviews).toHaveLength(0);
    expect(result.reviewsRequireLogin).toBe(true);
  });

  it('returns empty reviews and false login flag if page has no reviews and no login prompts', () => {
    const emptyPageHtml = `
      <!DOCTYPE html>
      <html>
      <body>
        <div id="productTitle">Brand New Unreviewed Book</div>
        <div id="no-reviews">No customer reviews yet.</div>
      </body>
      </html>
    `;

    const result = parseProductReviews(emptyPageHtml, 'B09BRANDNEW');
    expect(result.reviews).toHaveLength(0);
    expect(result.reviewsRequireLogin).toBe(false);
  });
});
