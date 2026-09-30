// src/services/aiIdeas.ts
// Service for communicating with the Google Gemini API (latest models: gemini-2.5-flash, gemini-2.5-pro),
// parsing structured JSON responses, and validating generated KDP book ideas.

import type { BookIdea, AiIdeasResponse, Settings } from '../types';
import { getSettings } from '../storage/settings';
import { DEFAULT_KDP_SYSTEM_PROMPT } from './aiPrompt';
import { validateBatchIdeas } from './ideaScoring';

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

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
 * Tests a Google Gemini API Key with a minimal request
 */
export async function testGeminiApiKey(
  apiKey?: string,
  model: string = 'gemini-2.5-flash'
): Promise<{ success: boolean; message: string }> {
  let keyToUse = apiKey;
  if (!keyToUse) {
    const s = await getSettings();
    keyToUse = s.geminiApiKey;
  }

  if (!keyToUse || !keyToUse.trim()) {
    return {
      success: false,
      message: 'No API key provided. Please enter your Google Gemini API key.',
    };
  }

  const cleanModel = model.replace(/^models\//, '') || 'gemini-2.5-flash';
  const url = `${GEMINI_BASE_URL}/${cleanModel}:generateContent?key=${encodeURIComponent(keyToUse.trim())}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: 'Hello' }],
          },
        ],
        generationConfig: {
          maxOutputTokens: 5,
        },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (res.ok) {
      return { success: true, message: 'API key is valid and connected to Google Gemini!' };
    }

    if (res.status === 400 || res.status === 403) {
      return {
        success: false,
        message: 'Invalid Gemini API Key (400/403). Please verify your key at Google AI Studio.',
      };
    }

    if (res.status === 429) {
      return {
        success: false,
        message: 'Gemini rate limit reached (429). Your key is valid, but please wait a moment before querying.',
      };
    }

    const errText = await res.text();
    return {
      success: false,
      message: `Gemini API error (${res.status}): ${errText.slice(0, 100)}`,
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      return { success: false, message: 'Request timed out after 15 seconds.' };
    }
    return { success: false, message: `Connection failed: ${err?.message || 'Network error'}` };
  }
}

/**
 * Generates KDP book ideas by calling the Google Gemini generateContent API.
 * Uses structured JSON mode (responseMimeType: "application/json") and system instructions.
 */
export async function generateBookIdeas(
  payloadText: string,
  customSystemPrompt?: string,
  customSettings?: Partial<Settings>
): Promise<AiIdeasResponse> {
  const settings = await getSettings();
  const apiKey = (
    customSettings?.geminiApiKey ||
    settings.geminiApiKey ||
    ''
  ).trim();

  if (!apiKey) {
    throw new Error('Add your Google Gemini API key in Options to generate AI book ideas.');
  }

  const model = (
    customSettings?.geminiModel ||
    settings.geminiModel ||
    settings.ai?.model ||
    'gemini-2.5-flash'
  ).replace(/^models\//, '');

  const maxTokens = settings.ai?.maxTokens || 8192;
  const temperature = settings.ai?.temperature ?? 0.7;
  const timeoutMs = settings.ai?.timeoutMs || 60000;
  const systemPrompt = customSystemPrompt || settings.ai?.systemPrompt || DEFAULT_KDP_SYSTEM_PROMPT;

  const url = `${GEMINI_BASE_URL}/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

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
      if (res.status === 400 || res.status === 403) {
        throw new Error('Invalid Google Gemini API Key. Please verify your API key in Options.');
      }
      if (res.status === 429) {
        throw new Error('Gemini API rate limit reached (429). Please wait a moment and click Retry.');
      }
      if (res.status >= 500) {
        throw new Error(`Google Gemini server error (${res.status}). Please try again in a few moments.`);
      }
      const errBody = await res.text();
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
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error(`Request timed out after ${Math.round(timeoutMs / 1000)} seconds. Please try again.`);
    }
    const cleanMsg = (err?.message || 'Network error communicating with Google Gemini API.')
      .replace(new RegExp(apiKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '[REDACTED]');
    throw new Error(cleanMsg);
  }

  // Parse JSON
  const parsedJson = extractJsonFromText(responseText);
  const shaped = validateIdeaResponseShape(parsedJson);

  // Validate ideas locally for KDP compliance & sanity checks
  const validatedIdeas = validateBatchIdeas(shaped.ideas, settings.ai?.forbiddenWords);

  return {
    notes: shaped.notes,
    ideas: validatedIdeas,
    rawText: responseText,
    usage,
  };
}
