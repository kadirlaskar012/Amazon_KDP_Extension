import { describe, it, expect } from 'vitest';
import { scoreAndValidateIdea, validateBatchIdeas, countWords } from '../src/services/ideaScoring';
import type { BookIdea } from '../src/types';

describe('AI Idea Scoring & Validation (ideaScoring.ts)', () => {
  const createBaseIdea = (overrides: Partial<BookIdea> = {}): BookIdea => ({
    id: 'test_idea_1',
    createdAt: Date.now(),
    title: 'Mindful Animal Coloring Book for Kids',
    subtitle: 'Relaxing Fun Illustrations for Toddlers and Preschoolers',
    subNiche: 'Toddler Animal Coloring',
    targetAudience: 'Parents of kids ages 3-5',
    sevenBackendKeywords: [
      'cute wildlife illustrations',
      'gentle relaxation for youngsters',
      'easy tracing pages',
      'calming art activity',
      'preschool safari sketches',
      'large print pencil practice',
      'stress relief creative play',
    ],
    threeCategories: [
      "Books > Children's Books > Animals",
      'Books > Crafts, Hobbies & Home > Coloring Books',
      'Books > Education & Teaching > Early Childhood',
    ],
    shortDescription:
      'Give your little ones hours of creative enjoyment with this thoughtfully designed mindful animal coloring book. ' +
      'Every single page features bold, thick lines that make coloring stress-free and accessible for tiny hands. ' +
      'Inside this premium edition, children will discover 50 hand-crafted animal portraits ranging from cuddly woodland creatures to cheerful safari friends. ' +
      'Each drawing is printed single-sided on high-quality paper stock to prevent messy marker bleed-through and protect the next page. ' +
      'Coloring promotes fine motor skill development, improves focus, and encourages screen-free relaxation after a busy day at preschool. ' +
      'Whether preparing for bedtime or quiet afternoon play, this charming book provides the ideal balance of entertainment and learning. ' +
      'Measuring 8.5 by 11 inches, it offers ample space for budding artists to express their unique imagination freely. ' +
      'A wonderful birthday gift or holiday stocking stuffer that parents, grandparents, teachers, and educators will truly appreciate and recommend for young creative learners everywhere today.',
    pageCount: 64,
    trimSize: '8.5 x 11 inches',
    priceSuggestion: 6.99,
    differentiationAngle: 'Single-sided pages with bold thick outlines specifically sized for toddlers',
    contentPlan: '50 full-page animal illustrations with blank backing pages, color testing swatch page, certificate of completion',
    estimatedDifficulty: 3,
    whyItCouldWork: 'High demand in toddler coloring with recurring customer complaints about thin bleed-through pages',
    risks: 'Seasonal spikes around holidays require steady evergreen marketing',
    ...overrides,
  });

  it('verifies word counting utility accurately', () => {
    expect(countWords('')).toBe(0);
    expect(countWords('   ')).toBe(0);
    expect(countWords('One two three four five')).toBe(5);
    expect(countWords('Multiple   spaces\nand\rnewlines')).toBe(4);
  });

  it('passes a clean, compliant idea with zero warnings', () => {
    const idea = createBaseIdea();
    const warnings = scoreAndValidateIdea(idea);
    expect(warnings).toEqual([]);
  });

  it('detects forbidden and trademarked claim words (case-insensitive)', () => {
    const forbidden1 = createBaseIdea({
      title: 'BEST SELLER Dinosaur Coloring Book',
    });
    const warnings1 = scoreAndValidateIdea(forbidden1);
    expect(warnings1.some((w) => w.includes('Contains forbidden/trademarked words'))).toBe(true);
    expect(warnings1.some((w) => w.toLowerCase().includes('best seller'))).toBe(true);

    const forbidden2 = createBaseIdea({
      title: 'Awesome Disney Princess Inspired Activity Book',
    });
    const warnings2 = scoreAndValidateIdea(forbidden2);
    expect(warnings2.some((w) => w.toLowerCase().includes('disney'))).toBe(true);

    const forbidden3 = createBaseIdea({
      subtitle: 'Includes #1 Top Rated Free Bonus Pages Inside',
    });
    const warnings3 = scoreAndValidateIdea(forbidden3);
    expect(warnings3.some((w) => w.toLowerCase().includes('#1') || w.toLowerCase().includes('top rated') || w.toLowerCase().includes('free'))).toBe(true);
  });

  it('enforces title + subtitle length boundary at 200 characters', () => {
    // 200 chars exactly (title: 150, subtitle: 48 + ': ' (2) = 200)
    const exactTitle = 'A'.repeat(150);
    const exactSubtitle = 'B'.repeat(48); // `${exactTitle}: ${exactSubtitle}`.length = 200
    const idea200 = createBaseIdea({
      title: exactTitle,
      subtitle: exactSubtitle,
    });
    const warnings200 = scoreAndValidateIdea(idea200);
    expect(warnings200.some((w) => w.includes('exceeds 200 characters'))).toBe(false);

    // 201 chars (title: 150, subtitle: 49 + ': ' (2) = 201)
    const overSubtitle = 'B'.repeat(49);
    const idea201 = createBaseIdea({
      title: exactTitle,
      subtitle: overSubtitle,
    });
    const warnings201 = scoreAndValidateIdea(idea201);
    expect(warnings201.some((w) => w.includes('exceeds 200 characters'))).toBe(true);
  });

  it('validates exactly 7 backend keywords and checks 50-character limit', () => {
    // Only 5 keywords
    const ideaFewKeywords = createBaseIdea({
      sevenBackendKeywords: ['kw1', 'kw2', 'kw3', 'kw4', 'kw5'],
    });
    const warningsFew = scoreAndValidateIdea(ideaFewKeywords);
    expect(warningsFew.some((w) => w.includes('found 5 slots instead of exactly 7'))).toBe(true);

    // One slot > 50 characters
    const ideaLongKeyword = createBaseIdea({
      sevenBackendKeywords: [
        'kw1',
        'kw2',
        'kw3',
        'kw4',
        'kw5',
        'kw6',
        'this is an excessively long keyword phrase that definitely goes way over the maximum limit of fifty characters',
      ],
    });
    const warningsLong = scoreAndValidateIdea(ideaLongKeyword);
    expect(warningsLong.some((w) => w.includes('exceed the 50-character limit'))).toBe(true);
  });

  it('flags backend keywords that repeat words already in the title', () => {
    const idea = createBaseIdea({
      title: 'Mindful Animal Coloring Book',
      sevenBackendKeywords: [
        'animal fun activities', // repeats "animal" from title
        'creative sketches',
        'kid art projects',
        'pencil practice',
        'quiet hour fun',
        'preschool motor skills',
        'weekend crafts',
      ],
    });
    const warnings = scoreAndValidateIdea(idea);
    expect(warnings.some((w) => w.includes('repeat words already in the title'))).toBe(true);
  });

  it('checks description word count boundaries (149/150, 200/201)', () => {
    // 149 words -> warning (too short)
    const words149 = Array(149).fill('word').join(' ');
    const idea149 = createBaseIdea({ shortDescription: words149 });
    const warnings149 = scoreAndValidateIdea(idea149);
    expect(warnings149.some((w) => w.includes('shorter than recommended'))).toBe(true);

    // 150 words -> valid lower bound
    const words150 = Array(150).fill('word').join(' ');
    const idea150 = createBaseIdea({ shortDescription: words150 });
    const warnings150 = scoreAndValidateIdea(idea150);
    expect(warnings150.some((w) => w.includes('shorter than recommended'))).toBe(false);
    expect(warnings150.some((w) => w.includes('longer than recommended'))).toBe(false);

    // 200 words -> valid upper bound
    const words200 = Array(200).fill('word').join(' ');
    const idea200 = createBaseIdea({ shortDescription: words200 });
    const warnings200 = scoreAndValidateIdea(idea200);
    expect(warnings200.some((w) => w.includes('longer than recommended'))).toBe(false);

    // 201 words -> warning (too long)
    const words201 = Array(201).fill('word').join(' ');
    const idea201 = createBaseIdea({ shortDescription: words201 });
    const warnings201 = scoreAndValidateIdea(idea201);
    expect(warnings201.some((w) => w.includes('longer than recommended'))).toBe(true);
  });

  it('detects duplicate or highly identical titles across a batch', () => {
    const ideaA = createBaseIdea({ id: 'a', title: 'Toddler Coloring Adventure' });
    const ideaB = createBaseIdea({ id: 'b', title: 'Toddler Coloring Adventure' }); // exact same title
    const ideaC = createBaseIdea({ id: 'c', title: 'Unique Mazes and Dot to Dot' });

    const batch = validateBatchIdeas([ideaA, ideaB, ideaC]);
    expect(batch[0]!.warnings?.some((w) => w.includes('Duplicate'))).toBe(true);
    expect(batch[1]!.warnings?.some((w) => w.includes('Duplicate'))).toBe(true);
    expect(batch[2]!.warnings?.some((w) => w.includes('Duplicate'))).toBe(false);
  });
});
