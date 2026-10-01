// tests/categoryAnalysis.test.ts
import { describe, it, expect } from 'vitest';
import {
  analyzeCategories,
  evaluateCategoryDifficulty,
  getRecommendedCategoryPicks,
  isGenericCategory,
  formatKdpCategoryPath,
  inferNicheCategories,
} from '../src/services/categoryAnalysis';
import type { Book, CategoryStat } from '../src/types';

describe('categoryAnalysis service', () => {
  it('accurately identifies generic categories', () => {
    expect(isGenericCategory('Books')).toBe(true);
    expect(isGenericCategory("Children's Books")).toBe(true);
    expect(isGenericCategory('Education & Teaching')).toBe(true);
    expect(isGenericCategory("Children's Dinosaur Books")).toBe(false);
    expect(isGenericCategory('Early Childhood Education')).toBe(false);
  });

  it('aggregates counts, best ranks, average ranks, and sorts by bookCount desc', () => {
    const mockBooks: Book[] = [
      {
        asin: 'B01',
        title: 'Book 1',
        author: 'Author 1',
        categoryRanks: [
          { name: "Children's Activity Books", category: "Children's Activity Books", rank: 5, url: '/cat/activity' },
          { name: 'Books', category: 'Books', rank: 1200, url: '/cat/books' },
        ],
      },
      {
        asin: 'B02',
        title: 'Book 2',
        author: 'Author 2',
        categoryRanks: [
          { name: "Children's Activity Books", category: "Children's Activity Books", rank: 12, url: '/cat/activity' },
          { name: 'Coloring Books for Grown-Ups', category: 'Coloring Books for Grown-Ups', rank: 3, url: '/cat/grownups' },
        ],
      },
      {
        asin: 'B03',
        title: 'Book 3',
        author: 'Author 3',
        categoryRanks: [
          { name: "Children's Activity Books", category: "Children's Activity Books", rank: 2, url: '/cat/activity' },
        ],
      },
    ];

    const results = analyzeCategories(mockBooks);

    expect(results.length).toBe(3);

    // "Children's Activity Books" appeared in 3 books, best rank #2, avg rank (5+12+2)/3 = 6
    const activityCat = results[0]!;
    expect(activityCat.name).toBe("Children's Activity Books");
    expect(activityCat.bookCount).toBe(3);
    expect(activityCat.bestRankAmongTopBooks).toBe(2);
    expect(activityCat.avgRank).toBe(6);
    expect(activityCat.isGeneric).toBe(false);

    // "Books" generic check
    const booksCat = results.find((c) => c.name === 'Books');
    expect(booksCat).toBeDefined();
    expect(booksCat?.isGeneric).toBe(true);
  });

  it('evaluates category difficulty based on Top 20 BSR thresholds', () => {
    // Thresholds: easyMinBsrAtTop20: 50000, mediumMinBsrAtTop20: 15000
    const easyResult = evaluateCategoryDifficulty(60000);
    expect(easyResult?.difficulty).toBe('easy');
    expect(easyResult?.difficultyText).toContain('Low competition');

    const mediumResult = evaluateCategoryDifficulty(25000);
    expect(mediumResult?.difficulty).toBe('medium');
    expect(mediumResult?.difficultyText).toContain('Moderate competition');

    const hardResult = evaluateCategoryDifficulty(8000);
    expect(hardResult?.difficulty).toBe('hard');
    expect(hardResult?.difficultyText).toContain('High competition');

    expect(evaluateCategoryDifficulty(null)).toBeNull();
  });

  it('recommends picks preferring non-generic categories, bookCount >= 2, and lower difficulty', () => {
    const categories: CategoryStat[] = [
      {
        name: 'Books',
        url: '/books',
        bookCount: 8,
        bestRankAmongTopBooks: 1,
        avgRank: 10,
        isGeneric: true,
      },
      {
        name: "Children's Dinosaur Books",
        url: '/dinos',
        bookCount: 4,
        bestRankAmongTopBooks: 3,
        avgRank: 8,
        isGeneric: false,
        difficulty: 'easy',
      },
      {
        name: "Children's Coloring Books",
        url: '/coloring',
        bookCount: 5,
        bestRankAmongTopBooks: 2,
        avgRank: 6,
        isGeneric: false,
        difficulty: 'medium',
      },
      {
        name: 'Super High Competition General Books',
        url: '/general',
        bookCount: 1,
        bestRankAmongTopBooks: 50,
        avgRank: 50,
        isGeneric: false,
        difficulty: 'hard',
      },
    ];

    const picks = getRecommendedCategoryPicks(categories, 2);

    expect(picks.length).toBe(2);
    // Should prefer the non-generic categories with bookCount >= 2 and easy/medium difficulty
    const recommendedNames = picks.map((p) => p.category.name);
    expect(recommendedNames).toContain("Children's Dinosaur Books");
    expect(recommendedNames).toContain("Children's Coloring Books");
    expect(recommendedNames).not.toContain('Books'); // Generic excluded or scored lower
  });

  it('formats full 3-level KDP category hierarchy paths accurately', () => {
    expect(formatKdpCategoryPath('Coloring Books')).toBe(
      "Books > Crafts, Hobbies & Home > Crafts & Hobbies > Coloring Books for Grown-Ups > Coloring Books"
    );
    expect(formatKdpCategoryPath("Children's Coloring Books")).toBe(
      "Books > Children's Books > Activities, Crafts & Games > Activity Books > Coloring Books"
    );
    expect(formatKdpCategoryPath("Children's Activity Books")).toBe(
      "Books > Children's Books > Activities, Crafts & Games > Activity Books"
    );
  });

  it('infers realistic KDP categories when competitors have no category ranks yet', () => {
    const mockBooks: Book[] = [
      {
        asin: 'B01',
        title: 'Toddler Coloring Book: 50 Easy Animal Designs',
        author: 'Author 1',
        bsrOverall: 3500,
        categoryRanks: [],
      },
      {
        asin: 'B02',
        title: 'My First Toddler Coloring Book: Fun with Numbers, Letters, Shapes',
        author: 'Author 2',
        bsrOverall: 5200,
        categoryRanks: [],
      },
    ];

    const inferred = inferNicheCategories(mockBooks, 'toddler coloring book');
    expect(inferred.length).toBeGreaterThanOrEqual(3);

    const names = inferred.map((c) => c.name);
    expect(names).toContain('Coloring Books for Kids');
    expect(names).toContain("Children's Activity Books");

    // Must have complete KDP breadcrumb paths
    const coloringCat = inferred.find((c) => c.name === 'Coloring Books for Kids')!;
    expect(coloringCat.path).toContain("Books > Children's Books > Activities, Crafts & Games > Activity Books > Coloring Books");
    expect(coloringCat.bestSellerTargetBsr).toBeDefined();
    expect(coloringCat.dailySalesForNo1).toBeDefined();

    // Fallback in analyzeCategories
    const results = analyzeCategories(mockBooks, undefined, 'toddler coloring book');
    expect(results.length).toBeGreaterThanOrEqual(3);
  });
});
