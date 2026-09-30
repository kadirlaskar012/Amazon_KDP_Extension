// src/config/forbiddenWords.ts
// Forbidden terms and brand words that violate Amazon KDP metadata guidelines or trademark policies

export const DEFAULT_FORBIDDEN_WORDS: string[] = [
  // Amazon prohibited promotional / claim terms
  'best seller',
  'bestseller',
  'best-seller',
  'free',
  'new',
  'top rated',
  'top-rated',
  '#1',
  'number one',
  'number 1',
  'most popular',
  'guaranteed',
  'unlimited',
  'bonus',

  // Major trademarked brands commonly infringing on KDP
  'disney',
  'marvel',
  'barbie',
  'pokemon',
  'pokémon',
  'lego',
  'crayola',
  'harry potter',
  'star wars',
  'minecraft',
  'roblox',
  'peppa pig',
  'bluey',
  'paw patrol',
  'cocomelon',
  'nickelodeon',
  'sanrio',
  'hello kitty',
  'dr. seuss',
  'dr seuss',
];

/**
 * Checks a title and subtitle for forbidden words or brand trademarks
 */
export function checkForbiddenWords(text: string, forbiddenList: string[] = DEFAULT_FORBIDDEN_WORDS): string[] {
  if (!text) return [];
  const lower = text.toLowerCase();
  const violations: string[] = [];

  for (const word of forbiddenList) {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Match whole word or exact phrase boundaries
    const regex = new RegExp(`\\b${escaped}\\b`, 'i');
    if (regex.test(lower)) {
      violations.push(word);
    }
  }

  return violations;
}
