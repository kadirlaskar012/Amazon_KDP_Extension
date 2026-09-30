// src/config/complaintLexicon.ts
// Configurable complaint phrases grouped by category, and rule-based suggestions for "What to do better"

export interface ComplaintCategoryConfig {
  category: string;
  phrases: string[];
  suggestion: string;
}

export const DEFAULT_COMPLAINT_LEXICON: Record<string, ComplaintCategoryConfig> = {
  'Paper quality': {
    category: 'Paper quality',
    phrases: [
      'thin paper',
      'bleed through',
      'bleeds through',
      'paper is thin',
      'ink bleeds',
      'markers bleed',
      'see through',
      'cheap paper',
      'paper quality is poor',
      'ghosting',
    ],
    suggestion:
      'Choose thicker standard/premium paper if KDP printing options permit, and add a blank or dark patterned backing page behind each design to eliminate marker bleed-through.',
  },
  'Design quality': {
    category: 'Design quality',
    phrases: [
      'small designs',
      'too simple',
      'too complicated',
      'repeated',
      'same image',
      'blurry',
      'pixelated',
      'low quality',
      'poor quality',
      'copied designs',
      'bad illustrations',
      'sloppy lines',
    ],
    suggestion:
      'Ensure high-resolution vector artwork (minimum 300 DPI) and offer varied, original illustrations with crisp, clean linework across every single page.',
  },
  'Content amount': {
    category: 'Content amount',
    phrases: [
      'too few',
      'not enough pages',
      'only a few pages',
      'too short',
      'few designs',
      'finished in minutes',
      'not many pages',
      'very few drawings',
      'barely any pages',
    ],
    suggestion:
      'Include at least 50+ rich coloring or activity pages to give buyers generous content volume and avoid complaints about short book length.',
  },
  'Layout': {
    category: 'Layout',
    phrases: [
      'one sided',
      'single sided',
      'double sided',
      'no blank page',
      'pages are cut off',
      'too close to the edge',
      'margins',
      'cut off by margin',
      'gutter',
      'printed on both sides',
    ],
    suggestion:
      'Keep illustrations strictly within safe margins (at least 0.5 inches from the gutter and outer trim) and format pages single-sided so ink does not ruin the reverse side.',
  },
  'Size/format': {
    category: 'Size/format',
    phrases: [
      'too small',
      'too big',
      'wrong size',
      'cover is flimsy',
      'binding',
      'pages fell out',
      'fell apart',
      'smaller than expected',
      'pocket sized',
    ],
    suggestion:
      'Publish in the standard 8.5 x 11 inch format for children/activity books with a sturdy glossy or matte cover and secure binding.',
  },
  'Age fit': {
    category: 'Age fit',
    phrases: [
      'too hard for',
      'too easy for',
      'not for toddlers',
      'not age appropriate',
      'frustrating for my child',
      'too detailed for kids',
      'boring for',
      'inappropriate for',
    ],
    suggestion:
      'Calibrate visual complexity strictly to your stated age target (e.g. bold 3mm outlines and basic recognizable shapes for toddlers ages 1-3).',
  },
  'Value': {
    category: 'Value',
    phrases: [
      'waste of money',
      'not worth',
      'overpriced',
      'rip off',
      'expensive for what it is',
      'not worth the price',
      'total rip-off',
    ],
    suggestion:
      'Price competitively between $5.99 and $8.99, and include bonus value (such as downloadable certificate, colored cover preview, or extra puzzles) to maximize perceived value.',
  },
  'Mismatch': {
    category: 'Mismatch',
    phrases: [
      'not as described',
      'different from picture',
      'not what I expected',
      'misleading',
      'deceptive cover',
      'inside does not match',
      'false advertising',
    ],
    suggestion:
      'Upload realistic Look-Inside and A+ Content interior sample photos on Amazon to accurately align customer expectations before purchase.',
  },
};

/**
 * Returns a list of all complaint categories with their phrases
 */
export function getAllComplaintCategories(): ComplaintCategoryConfig[] {
  return Object.values(DEFAULT_COMPLAINT_LEXICON);
}

/**
 * Gets rule-based suggestion for a category
 */
export function getSuggestionForCategory(category: string): string {
  const item = DEFAULT_COMPLAINT_LEXICON[category];
  return (
    item?.suggestion ||
    'Audit customer feedback to improve interior print quality, page layout, and design variety.'
  );
}
