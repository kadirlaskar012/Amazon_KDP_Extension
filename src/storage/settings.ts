import type { Settings } from '../types';
import { DEFAULT_SETTINGS } from '../config/defaults';
import { getStorageItem, setStorageItem } from './index';

const SETTINGS_KEY = 'kdp_settings';

/**
 * Normalizes and validates Gemini model names, automatically migrating deprecated/invalid models
 */
export function normalizeGeminiModel(model?: string): string {
  if (!model) return 'gemini-flash-latest';
  const clean = model.replace(/^models\//, '').trim();
  // Automatically migrate deprecated legacy models (e.g. shutdown 2.0 series) to gemini-flash-latest
  if (
    clean.startsWith('gemini-2.0') ||
    clean.startsWith('gemini-1.') ||
    clean === 'gemini-2.5-pro' ||
    !clean
  ) {
    return 'gemini-flash-latest';
  }
  return clean;
}

/**
 * Retrieves user settings with all default fallbacks cleanly merged
 */
export async function getSettings(): Promise<Settings> {
  const saved = await getStorageItem<Partial<Settings>>(SETTINGS_KEY, {});

  // Clean and merge multiple API keys if present
  let apiKeys: string[] = [];
  if (Array.isArray(saved.geminiApiKeys)) {
    apiKeys = saved.geminiApiKeys.filter((k) => typeof k === 'string' && k.trim().length > 5);
  }
  if (saved.geminiApiKey && saved.geminiApiKey.trim()) {
    const single = saved.geminiApiKey.trim();
    if (!apiKeys.includes(single)) {
      apiKeys.unshift(single);
    }
  }

  return {
    ...DEFAULT_SETTINGS,
    ...saved,
    geminiApiKey: saved.geminiApiKey || (apiKeys.length > 0 ? apiKeys[0]! : ''),
    geminiApiKeys: apiKeys,
    geminiModel: normalizeGeminiModel(saved.geminiModel),
    weights: {
      ...DEFAULT_SETTINGS.weights,
      ...(saved.weights || {}),
    },
    thresholds: {
      ...DEFAULT_SETTINGS.thresholds,
      ...(saved.thresholds || {}),
    },
    keywordWeights: {
      ...DEFAULT_SETTINGS.keywordWeights,
      ...(saved.keywordWeights || {}),
    },
    categoryDifficulty: {
      ...DEFAULT_SETTINGS.categoryDifficulty,
      ...(saved.categoryDifficulty || {}),
    },
    printingCost: {
      ...DEFAULT_SETTINGS.printingCost,
      ...(saved.printingCost || {}),
    },
    fetchDelayMs: {
      ...DEFAULT_SETTINGS.fetchDelayMs,
      ...(saved.fetchDelayMs || {}),
    },
    bsrSalesTable:
      saved.bsrSalesTable && saved.bsrSalesTable.length > 0
        ? saved.bsrSalesTable
        : DEFAULT_SETTINGS.bsrSalesTable,
    royaltyRate: saved.royaltyRate ?? DEFAULT_SETTINGS.royaltyRate,
  };
}

/**
 * Saves updated settings to chrome.storage.local
 */
export async function saveSettings(settings: Partial<Settings>): Promise<Settings> {
  const current = await getSettings();
  const updated: Settings = {
    ...current,
    ...settings,
    weights: {
      ...current.weights,
      ...(settings.weights || {}),
    },
    thresholds: {
      ...current.thresholds,
      ...(settings.thresholds || {}),
    },
    keywordWeights: {
      ...current.keywordWeights,
      ...(settings.keywordWeights || {}),
    },
    categoryDifficulty: {
      ...current.categoryDifficulty,
      ...(settings.categoryDifficulty || {}),
    },
    printingCost: {
      ...current.printingCost,
      ...(settings.printingCost || {}),
    },
    fetchDelayMs: {
      ...current.fetchDelayMs,
      ...(settings.fetchDelayMs || {}),
    },
  };

  await setStorageItem(SETTINGS_KEY, updated);
  return updated;
}
