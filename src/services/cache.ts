import type { Book } from '../types';
import { getCachedBook, setCachedBook, getCachedBooks, clearCache } from '../storage';

/**
 * Cache service for caching product pages by ASIN for 24 hours
 */
export const ProductCache = {
  async get(asin: string): Promise<Book | null> {
    return getCachedBook(asin);
  },

  async set(asin: string, book: Partial<Book>): Promise<void> {
    return setCachedBook(asin, book);
  },

  async getBatch(asins: string[]): Promise<Record<string, Book>> {
    return getCachedBooks(asins);
  },

  async clear(): Promise<void> {
    return clearCache();
  },
};
