// src/services/aiIdeas.ts
// Service for communicating with the Anthropic Claude API, parsing structured JSON responses,
// and validating generated KDP book ideas.

import type { BookIdea, AiIdeasResponse, Settings } from '../types';
import { getSettings } from '../storage/settings';
import { DEFAULT_KDP_SYSTEM_PROMPT } from './aiPrompt';
import { validateBatchIdeas } from './ideaScoring';

const ANTHROPIC_ENDPOINT = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

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
 * Tests an Anthropic Claude API Key with a minimal request
 */
export async function testClaudeApiKey(
  apiKey?: string,
  model: string = 'claude-sonnet-5-5'
): Promise<{ success: boolean; message: string }> {
  let keyToUse = apiKey;
  if (!keyToUse) {
    const s = await getSettings();
    keyToUse = s.claudeApiKey;
  }

  if (!keyToUse || !keyToUse.trim()) {
    return {
      success: false,
      message: 'No API key provided. Please enter your Anthropic API key.',
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(ANTHROPIC_ENDPOINT, {
      method: 'POST',
      headers: {
        'x-api-key': keyToUse.trim(),
        'anthropic-version': ANTHROPIC_VERSION,
        'anthropic-dangerous-direct-browser-access': 'true',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: model || 'claude-sonnet-5-5',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Say "OK"' }],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (res.ok) {
      return { success: true, message: 'API key is valid and connected to Claude!' };
    }

    if (res.status === 401) {
      return {
        success: false,
        message: 'Invalid API key (401 Unauthorized). Please check your key in Options.',
      };
    }

    if (res.status === 429) {
      return {
        success: false,
        message: 'Anthropic rate limit reached (429). Your key is valid, but please wait before querying.',
      };
    }

    const errText = await res.text();
    return {
      success: false,
      message: `Anthropic API error (${res.status}): ${errText.slice(0, 100)}`,
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
 * Generates KDP book ideas by calling the Anthropic Claude Messages API
 * Can be executed in background service worker or directly.
 */
export async function generateBookIdeas(
  payloadText: string,
  customSystemPrompt?: string,
  customSettings?: Partial<Settings>
): Promise<AiIdeasResponse> {
  const settings = await getSettings();
  const apiKey = (customSettings?.claudeApiKey || settings.claudeApiKey || '').trim();

  if (!apiKey) {
    throw new Error('Add your Claude API key in Options to generate AI book ideas.');
  }

  const model = customSettings?.claudeModel || settings.claudeModel || settings.ai?.model || 'claude-sonnet-5-5';
  const maxTokens = settings.ai?.maxTokens || 4000;
  const temperature = settings.ai?.temperature ?? 0.7;
  const timeoutMs = settings.ai?.timeoutMs || 60000;
  const systemPrompt = customSystemPrompt || settings.ai?.systemPrompt || DEFAULT_KDP_SYSTEM_PROMPT;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let responseText = '';
  let usage: { input_tokens?: number; output_tokens?: number } | undefined;

  try {
    const res = await fetch(ANTHROPIC_ENDPOINT, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
        'anthropic-dangerous-direct-browser-access': 'true',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        temperature,
        system: systemPrompt,
        messages: [{ role: 'user', content: payloadText }],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      if (res.status === 401) {
        throw new Error('Invalid Claude API Key (401 Unauthorized). Please check your key in Options.');
      }
      if (res.status === 429) {
        throw new Error('Claude API rate limit reached (429). Please wait a moment and click Retry.');
      }
      if (res.status >= 500) {
        throw new Error(`Anthropic server error (${res.status}). Please try again in a few moments.`);
      }
      const errBody = await res.text();
      throw new Error(`Claude API request failed with status ${res.status}: ${errBody.slice(0, 150)}`);
    }

    const data = await res.json();
    usage = data.usage;

    const contentBlock = data.content && data.content[0];
    if (contentBlock && contentBlock.text) {
      responseText = contentBlock.text;
    } else {
      throw new Error('Claude response did not contain expected content blocks.');
    }
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error(`Request timed out after ${Math.round(timeoutMs / 1000)} seconds. Please try again.`);
    }
    // Re-throw handled error without exposing API key in messages
    throw new Error(err.message || 'Network error communicating with Anthropic API.');
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
