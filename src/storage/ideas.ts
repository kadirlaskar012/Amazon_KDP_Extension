// src/storage/ideas.ts
// Local storage service for saving, retrieving, and managing generated KDP book ideas

import type { BookIdea } from '../types';
import { getStorageItem, setStorageItem } from './index';
import { DEFAULT_AI_SETTINGS } from '../config/defaults';

const IDEAS_STORAGE_KEY = 'kdp_saved_ideas';

/**
 * Retrieves all saved book ideas from chrome.storage.local
 */
export async function getSavedIdeas(): Promise<BookIdea[]> {
  const ideas = await getStorageItem<BookIdea[]>(IDEAS_STORAGE_KEY, []);
  return Array.isArray(ideas) ? ideas : [];
}

/**
 * Saves a book idea to local storage. Enforces maxSavedIdeas limit (default 100).
 */
export async function saveIdea(
  idea: BookIdea,
  maxCapacity: number = DEFAULT_AI_SETTINGS.maxSavedIdeas
): Promise<{ success: boolean; message?: string; idea?: BookIdea }> {
  const current = await getSavedIdeas();

  // Deduplicate by title or id
  const existingIdx = current.findIndex(
    (item) =>
      (idea.id && item.id === idea.id) ||
      item.title.toLowerCase().trim() === idea.title.toLowerCase().trim()
  );

  const ideaWithMeta: BookIdea = {
    ...idea,
    id: idea.id || `idea_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: idea.createdAt || Date.now(),
  };

  if (existingIdx >= 0) {
    current[existingIdx] = ideaWithMeta;
    await setStorageItem(IDEAS_STORAGE_KEY, current);
    return {
      success: true,
      message: 'Updated existing saved idea!',
      idea: ideaWithMeta,
    };
  }

  if (current.length >= maxCapacity) {
    return {
      success: false,
      message: `Saved ideas limit reached (max ${maxCapacity}). Please remove an idea first.`,
    };
  }

  const updated = [ideaWithMeta, ...current];
  await setStorageItem(IDEAS_STORAGE_KEY, updated);

  return {
    success: true,
    message: `Saved idea: "${idea.title.slice(0, 30)}..."`,
    idea: ideaWithMeta,
  };
}

/**
 * Removes a saved idea by id or title
 */
export async function removeSavedIdea(idOrTitle: string): Promise<BookIdea[]> {
  const current = await getSavedIdeas();
  const filtered = current.filter(
    (item) => item.id !== idOrTitle && item.title.toLowerCase().trim() !== idOrTitle.toLowerCase().trim()
  );
  await setStorageItem(IDEAS_STORAGE_KEY, filtered);
  return filtered;
}

/**
 * Clears all saved ideas
 */
export async function clearSavedIdeas(): Promise<void> {
  await setStorageItem(IDEAS_STORAGE_KEY, []);
}
