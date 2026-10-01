import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock chrome storage
const mockStorage: Record<string, any> = {};

(globalThis as any).chrome = {
  storage: {
    local: {
      get: vi.fn(async (keys: string[] | null) => {
        if (!keys) return { ...mockStorage };
        const result: Record<string, any> = {};
        for (const k of keys) {
          if (mockStorage[k] !== undefined) {
            result[k] = mockStorage[k];
          }
        }
        return result;
      }),
      set: vi.fn(async (items: Record<string, any>) => {
        Object.assign(mockStorage, items);
      }),
      remove: vi.fn(async (keys: string | string[]) => {
        const arr = Array.isArray(keys) ? keys : [keys];
        for (const k of arr) {
          delete mockStorage[k];
        }
      }),
    },
  },
} as any;

import {
  extractJsonFromText,
  validateIdeaResponseShape,
  generateBookIdeas,
  testGeminiApiKey,
} from '../src/services/aiIdeas';
import { buildPromptPayload } from '../src/services/aiPrompt';
import type { SearchSnapshot } from '../src/types';

describe('AI Book Idea Generator (Module J - aiIdeas.ts & aiPrompt.ts)', () => {
  const secretApiKey = 'AIzaSy_SECRET_CLASSIFIED_GEMINI_KEY_99999';

  beforeEach(() => {
    vi.clearAllMocks();
    for (const key of Object.keys(mockStorage)) {
      delete mockStorage[key];
    }
    // Set test api key in storage
    mockStorage['kdp_settings'] = {
      geminiApiKey: secretApiKey,
      geminiModel: 'gemini-flash-latest',
      ai: {
        model: 'gemini-flash-latest',
        maxTokens: 4000,
        temperature: 0.7,
        ideasCount: 10,
        timeoutMs: 5000,
      },
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const validSampleJson = {
    notes: 'Strong market for toddler activity books with low competition in mindfulness.',
    ideas: [
      {
        title: 'Mindful Animal Tracing for Kids',
        subtitle: 'Calm Motor Skill Development and Simple Drawings',
        subNiche: 'Toddler Tracing & Coloring',
        targetAudience: 'Parents of kids ages 2-4',
        sevenBackendKeywords: [
          'simple pencil control',
          'preschool drawing practice',
          'calming quiet book',
          'large print art lines',
          'early motor skills',
          'kindergarten readiness',
          'screen free pastime',
        ],
        threeCategories: [
          "Books > Children's Books > Early Learning",
          'Books > Children\'s Books > Animals',
          'Books > Crafts & Hobbies > Drawing',
        ],
        shortDescription:
          'A delightfully soothing workbook created specifically for curious toddlers learning hand-eye coordination. ' +
          'Packed with over 50 large, bold tracing activities featuring lovable friendly animals from around the globe. ' +
          'Every illustration is printed on a single side with extra margin to prevent bleed through. ' +
          'Children gain confidence through progressive exercises starting with gentle curves and advancing to full figures. ' +
          'Parents will appreciate the peaceful, screen-free engagement this activity book inspires during quiet time. ' +
          'The generous 8.5 by 11 inch format ensures ample space for beginner crayons and chubby pencils. ' +
          'Ideal for preschool prep, travel entertainment, and thoughtful gifts for creative young learners.',
        pageCount: 64,
        trimSize: '8.5 x 11 inches',
        priceSuggestion: 6.99,
        differentiationAngle: 'Focuses on calm, uncluttered line art rather than chaotic busy pages',
        contentPlan: '50 tracing pages, 1 swatch test page, 4 completion badges',
        estimatedDifficulty: 3,
        whyItCouldWork: 'Existing titles suffer complaints about overly thin paper and complex patterns',
        risks: 'Low price ceiling limits ad margin',
      },
    ],
  };

  describe('JSON Extraction and Shape Validation', () => {
    it('successfully extracts clean JSON object', () => {
      const parsed = extractJsonFromText(JSON.stringify(validSampleJson));
      expect(parsed.notes).toContain('Strong market');
      expect(parsed.ideas.length).toBe(1);
    });

    it('successfully parses JSON enclosed in markdown code fences', () => {
      const fencedWithLanguage = '```json\n' + JSON.stringify(validSampleJson) + '\n```';
      const parsed1 = extractJsonFromText(fencedWithLanguage);
      expect(parsed1.ideas[0].title).toBe('Mindful Animal Tracing for Kids');

      const genericFenced = 'Here is your research:\n```\n' + JSON.stringify(validSampleJson) + '\n```\nHope this helps!';
      const parsed2 = extractJsonFromText(genericFenced);
      expect(parsed2.ideas[0].title).toBe('Mindful Animal Tracing for Kids');
    });

    it('extracts outermost JSON braces when surrounding conversational text exists', () => {
      const conversational = 'Certainly! Below are your KDP ideas:\n' + JSON.stringify(validSampleJson) + '\nLet me know if you need changes.';
      const parsed = extractJsonFromText(conversational);
      expect(parsed.ideas.length).toBe(1);
    });

    it('throws handled friendly error when response cannot be parsed as JSON', () => {
      expect(() => extractJsonFromText('I am an AI and cannot generate books for this request.')).toThrow(
        'The AI returned an invalid format that could not be parsed as JSON.'
      );
      expect(() => extractJsonFromText('')).toThrow('Received empty response from the AI model.');
    });

    it('validates schema shape and maps defaults for missing fields', () => {
      const partialData = {
        ideas: [
          {
            title: 'Quick Sketching',
            // missing subtitle, pageCount, etc.
          },
        ],
      };
      const validated = validateIdeaResponseShape(partialData);
      expect(validated.ideas.length).toBe(1);
      expect(validated.ideas[0]!.title).toBe('Quick Sketching');
      expect(validated.ideas[0]!.pageCount).toBe(64); // default fallback
      expect(validated.ideas[0]!.priceSuggestion).toBe(6.99); // default fallback
      expect(validated.ideas[0]!.estimatedDifficulty).toBe(5);
    });
  });

  describe('API Execution & Error Handling', () => {
    it('executes generateBookIdeas successfully with mocked Gemini response', async () => {
      const mockApiResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify(validSampleJson),
                },
              ],
            },
            finishReason: 'STOP',
          },
        ],
        usageMetadata: {
          promptTokenCount: 1200,
          candidatesTokenCount: 950,
          totalTokenCount: 2150,
        },
      };

      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockApiResponse,
      });
      vi.stubGlobal('fetch', fetchSpy);

      const result = await generateBookIdeas('Sample payload text');
      expect(result.ideas.length).toBe(1);
      expect(result.ideas[0]!.title).toBe('Mindful Animal Tracing for Kids');
      expect(result.usage?.input_tokens).toBe(1200);
      expect(result.usage?.output_tokens).toBe(950);

      // Verify request payload and URL
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const firstCall = fetchSpy.mock.calls[0];
      expect(firstCall).toBeDefined();
      const [url, options] = firstCall!;
      expect(url).toContain('https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent');
      expect(url).toContain(`key=${secretApiKey}`);
      expect((options as any)?.headers?.['Content-Type']).toBe('application/json');

      const body = JSON.parse((options as any)?.body);
      expect(body.generationConfig.responseMimeType).toBe('application/json');
      expect(body.contents[0].parts[0].text).toBe('Sample payload text');
    });

    it('handles 400 / 403 Invalid API Key with user-friendly error without exposing the key', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 400,
          text: async () => '{"error": {"message": "API key not valid. Please pass a valid API key."}}',
        })
      );

      try {
        await generateBookIdeas('Payload');
        expect.unreachable('Should have thrown an error');
      } catch (err: any) {
        expect(err.message).toContain('Invalid Google Gemini API Key');
        // Ensure secret key never appears in the error
        expect(err.message).not.toContain(secretApiKey);
      }
    });

    it('handles 429 Rate Limit with retry advice when single key is configured', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 429,
          text: async () => 'Resource exhausted: quota exceeded',
        })
      );

      await expect(generateBookIdeas('Payload')).rejects.toThrow(
        /Gemini API rate limit reached/i
      );
    });

    it('automatically recovers and falls back to gemini-flash-latest when a model returns 404', async () => {
      const fetchSpy = vi.fn()
        // First call with deprecated model returns 404
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
          text: async () => 'models/gemini-old-model is not found',
        })
        // Second call with gemini-flash-latest succeeds
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            candidates: [
              {
                content: { parts: [{ text: JSON.stringify(validSampleJson) }] },
                finishReason: 'STOP',
              },
            ],
          }),
        });
      vi.stubGlobal('fetch', fetchSpy);

      const result = await generateBookIdeas('Sample prompt', undefined, {
        geminiApiKey: secretApiKey,
        geminiModel: 'gemini-old-model',
      });
      expect(result.ideas.length).toBe(1);
      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(fetchSpy.mock.calls[1]![0]).toContain('gemini-flash-latest:generateContent');
    });

    it('automatically fails over to backup API key when primary key encounters 429 quota exhaustion', async () => {
      const backupKey = 'AIzaSy_BACKUP_KEY_22222';
      mockStorage['kdp_settings'] = {
        geminiApiKey: secretApiKey,
        geminiApiKeys: [secretApiKey, backupKey],
        geminiModel: 'gemini-flash-latest',
        ai: {
          model: 'gemini-flash-latest',
          maxTokens: 4000,
          temperature: 0.7,
          ideasCount: 10,
          timeoutMs: 5000,
        },
      };

      const mockApiResponse = {
        candidates: [
          {
            content: {
              parts: [{ text: JSON.stringify(validSampleJson) }],
            },
            finishReason: 'STOP',
          },
        ],
      };

      const fetchSpy = vi.fn()
        // First call with primary key returns 429 quota exhausted
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          text: async () => 'RESOURCE_EXHAUSTED: Daily quota reached for key',
        })
        // Second call with backup key succeeds with 200 OK
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => mockApiResponse,
        });
      vi.stubGlobal('fetch', fetchSpy);

      const result = await generateBookIdeas('Sample prompt');
      expect(result.ideas.length).toBe(1);
      expect(result.ideas[0]!.title).toBe('Mindful Animal Tracing for Kids');

      // Verify that fetch was called twice: first with primary key, second with backup key
      expect(fetchSpy).toHaveBeenCalledTimes(2);
      const firstUrl = fetchSpy.mock.calls[0]![0] as string;
      const secondUrl = fetchSpy.mock.calls[1]![0] as string;
      expect(firstUrl).toContain(`key=${secretApiKey}`);
      expect(secondUrl).toContain(`key=${backupKey}`);
    });

    it('throws clear message when all configured keys encounter 429 quota exhaustion', async () => {
      const backupKey = 'AIzaSy_BACKUP_KEY_33333';
      mockStorage['kdp_settings'] = {
        geminiApiKey: secretApiKey,
        geminiApiKeys: [secretApiKey, backupKey],
        geminiModel: 'gemini-flash-latest',
        ai: {
          model: 'gemini-flash-latest',
          maxTokens: 4000,
          temperature: 0.7,
          ideasCount: 10,
          timeoutMs: 5000,
        },
      };

      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 429,
          text: async () => 'RESOURCE_EXHAUSTED',
        })
      );

      await expect(generateBookIdeas('Sample prompt')).rejects.toThrow(
        /All 2 Gemini API keys have reached their quota limit/i
      );
    });

    it('handles network abort / timeout gracefully', async () => {
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';

      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(abortError));

      await expect(generateBookIdeas('Payload')).rejects.toThrow(/timed out/i);
    });

    it('guarantees the API key is NEVER leaked in thrown errors or messages', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockRejectedValue(new Error(`Failed with key: ${secretApiKey}`))
      );

      try {
        await generateBookIdeas('Payload');
      } catch (err: any) {
        // Even if an unexpected error occurs, test that application wraps it safely
        expect(err.message).toBeDefined();
        expect(err.message).not.toContain(secretApiKey);
      }
    });

    it('tests testGeminiApiKey function with 200 OK and 400 Invalid Key', async () => {
      // 200 OK
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
        })
      );
      const okResult = await testGeminiApiKey(secretApiKey);
      expect(okResult.success).toBe(true);
      expect(okResult.message).toContain('valid and connected');

      // 400 Invalid Key
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 400,
          text: async () => 'API key not valid',
        })
      );
      const failResult = await testGeminiApiKey(secretApiKey);
      expect(failResult.success).toBe(false);
      expect(failResult.message).toContain('Invalid Gemini API Key');
    });
  });

  describe('Prompt Payload Builder (aiPrompt.ts)', () => {
    it('builds comprehensive payload when full snapshot data is available', () => {
      const snapshot: SearchSnapshot = {
        query: 'toddler coloring book',
        date: Date.now(),
        books: [
          {
            asin: 'B001',
            title: 'Happy Animals',
            author: 'Jane Doe',
            price: 6.99,
            bsrOverall: 3500,
            reviewCount: 45,
            rating: 4.5,
            pageCount: 64,
            publishDate: '2023-01-01',
            monthlySalesEstimate: 1200,
            isOpportunity: true,
            categoryRanks: [],
          },
        ],
        keywords: [
          {
            keyword: 'toddler coloring book',
            bestPosition: 1,
            inTitlesCount: 8,
            totalScore: 90,
            scoreLabel: 'high',
            isPartial: false,
          },
        ],
        categories: [
          {
            name: 'Children Animal Books',
            bookCount: 4,
            bestRankAmongTopBooks: 1,
            avgRank: 3.5,
            difficulty: 'easy',
            bsrAtTop20: 15000,
            url: 'https://amazon.com/b?node=123',
            isGeneric: false,
          },
        ],
        specs: {
          pageCount: { median: 64, min: 40, max: 100, mostCommonRange: '60-80', distribution: [] },
          trimSize: { mostCommon: '8.5 x 11 inches', count: 8, percentage: 80 },
          price: { median: 6.99, min: 4.99, max: 8.99, mostCommonPoint: 6.99, distribution: [] },
          readingAge: { mostCommon: '3-5 years', count: 5 },
          formatShare: { lowContentCount: 9, total: 10, percentage: 90 },
          recommended: {
            pageCount: 64,
            pageCountReason: 'Standard',
            trimSize: '8.5 x 11 inches',
            trimSizeReason: 'Optimal art canvas',
            priceRange: '$6.99 - $7.99',
            priceReason: 'Highest margin',
          },
        },
        reviewGap: {
          totalBooksAnalyzed: 5,
          totalNegativeReviews: 10,
          categorySummary: [],
          reviewsRequireLogin: false,
          booksRequiringLogin: 0,
          complaints: [
            {
              category: 'Paper Quality',
              phrase: 'bleed through',
              count: 6,
              bookCount: 4,
              sampleQuotes: ['Ink bleeds through'],
            },
          ],
          positivePhrases: [{ word: 'cute illustrations', count: 12, inTitlesCount: 5, percentage: 50 }],
        },
      };

      const payload = buildPromptPayload(snapshot, 'Prefer cute animals and simple outlines');
      expect(payload).toContain('Primary Niche Keyword: "toddler coloring book"');
      expect(payload).toContain('Happy Animals');
      expect(payload).toContain('Top Amazon Autocomplete Keywords');
      expect(payload).toContain('Children Animal Books');
      expect(payload).toContain('Median Page Count: 64 pages');
      expect(payload).toContain('bleed through');
      expect(payload).toContain('Prefer cute animals and simple outlines');

      // Token estimation check: characters / 4 roughly approximates tokens
      // 6000 tokens * 4 = 24,000 characters maximum
      expect(payload.length).toBeLessThan(20000);
    });

    it('substitutes "not available" for unanalyzed sections gracefully', () => {
      const minimalSnapshot: SearchSnapshot = {
        query: 'empty niche research',
        date: Date.now(),
        books: [],
      };

      const payload = buildPromptPayload(minimalSnapshot);
      expect(payload).toContain('Top books: not available');
      expect(payload).toContain('Keywords: not available (run Keywords tab first)');
      expect(payload).toContain('Categories: not available (run Categories tab first)');
      expect(payload).toContain('Specs: not available (run Specs tab first)');
      expect(payload).toContain('Reviews analysis: not available (run Reviews tab first)');
    });
  });
});
