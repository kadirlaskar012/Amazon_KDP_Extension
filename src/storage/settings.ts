import type { Settings } from '../types';
import { DEFAULT_SETTINGS } from '../config/defaults';
import { getStorageItem, setStorageItem } from './index';

const SETTINGS_KEY = 'kdp_settings';

/**
 * Retrieves user settings with all default fallbacks cleanly merged
 */
export async function getSettings(): Promise<Settings> {
  const saved = await getStorageItem<Partial<Settings>>(SETTINGS_KEY, {});

  return {
    ...DEFAULT_SETTINGS,
    ...saved,
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
