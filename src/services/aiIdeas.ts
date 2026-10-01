// src/services/aiIdeas.ts
// Service for communicating with the Google Gemini API (latest official models: gemini-flash-latest, gemini-3.1-flash-lite, gemini-2.5-flash),
// parsing structured JSON responses, multi-key automatic failover, and validating generated KDP book ideas.

import type { BookIdea, AiIdeasResponse, Settings } from '../types';
import { getSettings, normalizeGeminiModel } from '../storage/settings';
import { DEFAULT_KDP_SYSTEM_PROMPT } from './aiPrompt';
import { validateBatchIdeas } from './ideaScoring';

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

/**
 * Extracts and deduplicates all valid Gemini API keys from settings or string input
 */
export function extractAllGeminiKeys(
  input?: Partial<Settings> | Settings | string | string[]
): string[] {
  if (!input) return [];

  const keys: string[] = [];

  if (typeof input === 'string') {
    const splits = input.split(/[\n,;]+/);
    for (const s of splits) {
      if (s.trim().length > 5) keys.push(s.trim());
    }
  } else if (Array.isArray(input)) {
    for (const item of input) {
      if (typeof item === 'string' && item.trim().length > 5) {
        keys.push(item.trim());
      }
    }
  } else if (typeof input === 'object') {
    if (Array.isArray(input.geminiApiKeys)) {
      for (const k of input.geminiApiKeys) {
        if (typeof k === 'string' && k.trim().length > 5) {
          keys.push(k.trim());
        }
      }
    }
    if (typeof input.geminiApiKey === 'string' && input.geminiApiKey.trim()) {
      const splits = input.geminiApiKey.split(/[\n,;]+/);
      for (const s of splits) {
        if (s.trim().length > 5) keys.push(s.trim());
      }
    }
  }

  return Array.from(new Set(keys));
}

/**
 * Extracts and parses JSON from raw LLM output, stripping markdown code fences if present
 */
export function extractJsonFromText(rawText: string): any {
  if (!rawText || !rawText.trim()) {
    throw new Error('Received empty response from the AI model.');
  }

  let text = rawText.trim();

  // Strip markdown code fences if present
  if (text.includes('```json')) {
    const start = text.indexOf('```json') + 7;
    const end = text.lastIndexOf('```');
    if (end > start) {
      text = text.slice(start, end).trim();
    }
  } else if (text.includes('```')) {
    const start = text.indexOf('```') + 3;
    const end = text.lastIndexOf('```');
    if (end > start) {
      text = text.slice(start, end).trim();
    }
  }

  // Attempt direct parse first
  try {
    return JSON.parse(text);
  } catch {
    // If text has preamble or postscript, isolate outermost { ... }
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      const candidate = text.slice(firstBrace, lastBrace + 1);
      return JSON.parse(candidate);
    }
    throw new Error('The AI returned an invalid format that could not be parsed as JSON.');
  }
}

/**
 * Validates the parsed object against the required BookIdea schema
 */
export function validateIdeaResponseShape(data: any): { notes?: string; ideas: BookIdea[] } {
  if (!data || typeof data !== 'object') {
    throw new Error('Parsed response is not a valid JSON object.');
  }

  const notes = typeof data.notes === 'string' ? data.notes : '';
  const rawIdeas = Array.isArray(data.ideas) ? data.ideas : [];

  if (rawIdeas.length === 0 && !notes) {
    throw new Error('The AI response contained no book ideas and no explanatory notes.');
  }

  const ideas: BookIdea[] = rawIdeas.map((raw: any, index: number) => {
    return {
      id: `idea_${Date.now()}_${index}`,
      createdAt: Date.now(),
      title: String(raw.title || `Book Idea #${index + 1}`).trim(),
      subtitle: String(raw.subtitle || '').trim(),
      subNiche: String(raw.subNiche || 'General Niche').trim(),
      targetAudience: String(raw.targetAudience || 'General Audience').trim(),
      sevenBackendKeywords: Array.isArray(raw.sevenBackendKeywords)
        ? raw.sevenBackendKeywords.map((k: any) => String(k).trim())
        : [],
      threeCategories: Array.isArray(raw.threeCategories)
        ? raw.threeCategories.map((c: any) => String(c).trim())
        : [],
      shortDescription: String(raw.shortDescription || '').trim(),
      pageCount: Number(raw.pageCount) || 64,
      trimSize: String(raw.trimSize || '8.5 x 11 inches').trim(),
      priceSuggestion: Number(raw.priceSuggestion) || 6.99,
      differentiationAngle: String(raw.differentiationAngle || '').trim(),
      contentPlan: String(raw.contentPlan || '').trim(),
      estimatedDifficulty: Math.max(1, Math.min(10, Number(raw.estimatedDifficulty) || 5)),
      whyItCouldWork: String(raw.whyItCouldWork || '').trim(),
      risks: String(raw.risks || '').trim(),
    };
  });

  return { notes, ideas };
}

/**
 * Tests Google Gemini API Key(s) with a minimal request and supports auto-fallback on 404
 */
export async function testGeminiApiKey(
  apiKeyOrKeys?: string | string[],
  model: string = 'gemini-flash-latest'
): Promise<{ success: boolean; message: string }> {
  let keysToTest: string[] = [];

  if (apiKeyOrKeys) {
    keysToTest = extractAllGeminiKeys(apiKeyOrKeys);
  } else {
    const s = await getSettings();
    keysToTest = extractAllGeminiKeys(s);
  }

  if (keysToTest.length === 0) {
    return {
      success: false,
      message: 'No API key provided. Please enter at least one Google Gemini API key.',
    };
  }

  let cleanModel = normalizeGeminiModel(model);

  const testSingleKey = async (key: string, targetModel: string) => {
    const url = `${GEMINI_BASE_URL}/${targetModel}:generateContent?key=${encodeURIComponent(key.trim())}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: 'ping' }] }],
          generationConfig: { maxOutputTokens: 5 },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        return { ok: true, status: res.status };
      }

      // If 404 on model, test fallback to gemini-flash-latest
      if (res.status === 404 && targetModel !== 'gemini-flash-latest') {
        const fallbackRes = await fetch(
          `${GEMINI_BASE_URL}/gemini-flash-latest:generateContent?key=${encodeURIComponent(key.trim())}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ role: 'user', parts: [{ text: 'ping' }] }],
              generationConfig: { maxOutputTokens: 5 },
            }),
          }
        );
        if (fallbackRes.ok) {
          cleanModel = 'gemini-flash-latest';
          return { ok: true, status: fallbackRes.status };
        }
      }

      const errText = await res.text();
      return { ok: false, status: res.status, errText };
    } catch (err: any) {
      clearTimeout(timeoutId);
      return { ok: false, status: 0, errText: err?.message || 'Network error' };
    }
  };

  // Test primary key first
  const primaryResult = await testSingleKey(keysToTest[0]!, cleanModel);
  if (!primaryResult.ok) {
    if (primaryResult.status === 400 || primaryResult.status === 403) {
      return {
        success: false,
        message: 'Invalid Gemini API Key (400/403). Please verify your key at Google AI Studio.',
      };
    }
    if (primaryResult.status === 429) {
      return {
        success: false,
        message: 'Gemini rate limit / quota reached (429) for Primary Key. Auto-failover will switch to backup keys during generation.',
      };
    }
    return {
      success: false,
      message: `Gemini API error (${primaryResult.status}): ${(primaryResult.errText || '').slice(0, 100)}`,
    };
  }

  // If multiple keys, test remaining backup keys
  if (keysToTest.length > 1) {
    let validCount = 1;
    for (let i = 1; i < keysToTest.length; i++) {
      const res = await testSingleKey(keysToTest[i]!, cleanModel);
      if (res.ok) validCount++;
    }

    if (validCount === keysToTest.length) {
      return {
        success: true,
        message: `All ${keysToTest.length} API keys are valid and connected to Google Gemini (${cleanModel})! Auto-Failover is ready.`,
      };
    }
    return {
      success: true,
      message: `${validCount} of ${keysToTest.length} API keys are valid (${cleanModel}). Invalid keys will be skipped during auto-failover.`,
    };
  }

  return {
    success: true,
    message: `API key is valid and connected to Google Gemini (${cleanModel})!`,
  };
}

/**
 * Generates KDP book ideas by calling the Google Gemini generateContent API.
 * Uses structured JSON mode and supports automatic failover across multiple API keys on 429 quota exhaustion.
 */
export async function generateBookIdeas(
  payloadText: string,
  customSystemPrompt?: string,
  customSettings?: Partial<Settings>
): Promise<AiIdeasResponse> {
  const settings = await getSettings();
  const allKeys = extractAllGeminiKeys(customSettings || settings);

  if (allKeys.length === 0) {
    throw new Error('Please add your Google Gemini API key in Options or Sidebar Settings to generate AI book ideas.');
  }

  let model = normalizeGeminiModel(
    customSettings?.geminiModel ||
    settings.geminiModel ||
    settings.ai?.model
  );

  const maxTokens = settings.ai?.maxTokens || 4000;
  const temperature = settings.ai?.temperature ?? 0.7;
  const timeoutMs = settings.ai?.timeoutMs || 60000;
  const systemPrompt = customSystemPrompt || settings.ai?.systemPrompt || DEFAULT_KDP_SYSTEM_PROMPT;

  let lastError: Error | null = null;
  let usedKeyIndex = 0;

  for (let keyIdx = 0; keyIdx < allKeys.length; keyIdx++) {
    const currentKey = allKeys[keyIdx]!;
    usedKeyIndex = keyIdx;

    const url = `${GEMINI_BASE_URL}/${model}:generateContent?key=${encodeURIComponent(currentKey)}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    let responseText = '';
    let usage: { input_tokens?: number; output_tokens?: number } | undefined;

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: systemPrompt }],
          },
          contents: [
            {
              role: 'user',
              parts: [{ text: payloadText }],
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature,
            maxOutputTokens: maxTokens,
          },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const errBody = await res.text();
        const isQuotaOrRateLimit =
          res.status === 429 ||
          errBody.includes('RESOURCE_EXHAUSTED') ||
          errBody.includes('quota') ||
          errBody.includes('rate limit') ||
          errBody.includes('Too Many Requests');

        const isInvalidKey =
          res.status === 400 ||
          res.status === 403 ||
          errBody.includes('API_KEY_INVALID') ||
          errBody.includes('not valid');

        const isModel404 =
          res.status === 404 &&
          (errBody.includes('not found') || errBody.includes('no longer available'));

        // If model returned 404, fallback to gemini-flash-latest and retry this key!
        if (isModel404 && model !== 'gemini-flash-latest') {
          console.warn(`[Gemini AI] Model ${model} returned 404. Falling back to gemini-flash-latest...`);
          model = 'gemini-flash-latest';
          keyIdx--; // retry with same key
          continue;
        }

        // Automatic Failover: If quota exceeded (429) or invalid key, switch to next available key in the list!
        if ((isQuotaOrRateLimit || isInvalidKey) && keyIdx < allKeys.length - 1) {
          console.warn(
            `[Gemini AI] Key #${keyIdx + 1} quota reached or failed (HTTP ${res.status}). Automatically failing over to Backup Key #${keyIdx + 2}...`
          );
          continue;
        }

        if (isInvalidKey) {
          throw new Error('Invalid Google Gemini API Key. Please verify your API key in Options.');
        }
        if (isQuotaOrRateLimit) {
          throw new Error(
            allKeys.length > 1
              ? `All ${allKeys.length} Gemini API keys have reached their quota limit (429). Please wait a moment or add another key.`
              : 'Gemini API rate limit reached (429). You can add a backup API key in Settings for automatic failover, or wait a moment and retry.'
          );
        }
        if (res.status >= 500) {
          throw new Error(`Google Gemini server error (${res.status}). Please try again in a few moments.`);
        }
        throw new Error(`Gemini API request failed with status ${res.status}: ${errBody.slice(0, 150)}`);
      }

      const data = await res.json();
      if (data.usageMetadata) {
        usage = {
          input_tokens: data.usageMetadata.promptTokenCount,
          output_tokens: data.usageMetadata.candidatesTokenCount,
        };
      }

      const candidate = data.candidates && data.candidates[0];
      const candidatePart = candidate?.content?.parts && candidate.content.parts[0];
      if (candidatePart && candidatePart.text) {
        responseText = candidatePart.text;
      } else {
        throw new Error('Gemini response did not contain expected content parts.');
      }

      // Parse JSON
      const parsedJson = extractJsonFromText(responseText);
      const shaped = validateIdeaResponseShape(parsedJson);

      // Validate ideas locally for KDP compliance & sanity checks
      const validatedIdeas = validateBatchIdeas(shaped.ideas, settings.ai?.forbiddenWords);

      const notesSuffix =
        usedKeyIndex > 0
          ? ` (Auto-Failover: Switched to Backup Key #${usedKeyIndex + 1} after primary key quota was reached)`
          : '';

      return {
        notes: shaped.notes ? `${shaped.notes}${notesSuffix}` : (notesSuffix.trim() || undefined),
        ideas: validatedIdeas,
        rawText: responseText,
        usage,
      };
    } catch (err: any) {
      clearTimeout(timeoutId);
      lastError = err;

      // If user aborted or timeout, don't keep rotating
      if (err.name === 'AbortError') {
        throw new Error(`Request timed out after ${Math.round(timeoutMs / 1000)} seconds. Please try again.`);
      }

      const errMsg = err?.message || '';
      const isQuota = errMsg.includes('429') || errMsg.includes('quota') || errMsg.includes('rate limit');
      if (isQuota && keyIdx < allKeys.length - 1) {
        console.warn(`[Gemini AI] Key #${keyIdx + 1} quota exhausted. Auto-switching to Key #${keyIdx + 2}...`);
        continue;
      }

      if (keyIdx >= allKeys.length - 1) {
        const cleanMsg = errMsg.replace(
          new RegExp(currentKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
          '[REDACTED]'
        );
        throw new Error(cleanMsg);
      }
    }
  }

  throw lastError || new Error('Failed to generate ideas with Gemini API.');
}
