import { describe, it, expect } from 'vitest';
import { decodeHtmlEntities, formatCleanCategoryPath } from '../src/utils/htmlEntities';

describe('htmlEntities utility', () => {
  describe('decodeHtmlEntities', () => {
    it('decodes hex entities like &#x27; and decimal entities like &#39;', () => {
      expect(decodeHtmlEntities("Children&#x27;s Books")).toBe("Children's Books");
      expect(decodeHtmlEntities("Women&#39;s Health")).toBe("Women's Health");
    });

    it('decodes named entities like &amp;, &quot;, &lt;, &gt;', () => {
      expect(decodeHtmlEntities('Arts, Music &amp; Photography')).toBe('Arts, Music & Photography');
      expect(decodeHtmlEntities('&quot;Best Sellers&quot;')).toBe('"Best Sellers"');
      expect(decodeHtmlEntities('&lt;Books&gt;')).toBe('<Books>');
    });

    it('decodes double-encoded entities', () => {
      expect(decodeHtmlEntities('Children&amp;#x27;s Books')).toBe("Children's Books");
      expect(decodeHtmlEntities('Arts &amp;amp; Crafts')).toBe('Arts & Crafts');
    });

    it('returns clean strings unchanged', () => {
      expect(decodeHtmlEntities('Coloring Books')).toBe('Coloring Books');
      expect(decodeHtmlEntities('')).toBe('');
    });
  });

  describe('formatCleanCategoryPath', () => {
    it('standardizes category paths with clean " > " separators and decoded entities', () => {
      const input = 'Books > Children&#x27;s Books > Arts, Music &amp; Photography > Art > Painting';
      const expected = "Books > Children's Books > Arts, Music & Photography > Art > Painting";
      expect(formatCleanCategoryPath(input)).toBe(expected);
    });

    it('handles messy whitespace around separators', () => {
      const input = "Books  >   Children's Books   > Activities, Crafts & Games >  Coloring Books ";
      const expected = "Books > Children's Books > Activities, Crafts & Games > Coloring Books";
      expect(formatCleanCategoryPath(input)).toBe(expected);
    });

    it('normalizes alternate separators like &gt; or ›', () => {
      const input = "Books &gt; Children's Books › Coloring Books";
      const expected = "Books > Children's Books > Coloring Books";
      expect(formatCleanCategoryPath(input)).toBe(expected);
    });

    it('handles single category name with no separator', () => {
      expect(formatCleanCategoryPath("Children&#x27;s Books")).toBe("Children's Books");
    });
  });
});
