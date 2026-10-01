// src/services/aiPrompt.ts
// System prompt and structured payload builder for Google Gemini KDP book idea generation

import type { SearchSnapshot } from '../types';

export const DEFAULT_KDP_SYSTEM_PROMPT = `You are an elite Amazon KDP (Kindle Direct Publishing) niche strategist and data analyst. Your mission is to generate 90-100% accurate, highly profitable, and publish-ready book ideas strictly based on the competitor data, customer complaint gaps, and search keyword metrics provided.

STRICT AMAZON KDP COMPLIANCE RULES (MANDATORY):
1. ZERO TRADEMARK INFRINGEMENT: Absolutely NO brand names, trademarks, cartoon/anime characters, or celebrity names (e.g. Disney, Marvel, Barbie, Pokemon, Lego, Crayola, Bluey, Cocomelon, Minecraft, etc.).
2. ZERO PROHIBITED CLAIMS: Never use terms like "best seller", "bestseller", "#1", "top rated", "free", "guaranteed", "unlimited" anywhere in titles or subtitles (Amazon policy violation).
3. NATURAL TITLE FORMULA:
   - Title: Crisp, memorable, commercial main title (under 60 characters).
   - Subtitle: High-converting descriptive subtitle stating exact audience benefits, contents, and specifications (e.g. "50 Bold & Easy Animal Designs for Motor Skill Fun | Ages 2-4").
   - Title + Subtitle combined MUST NOT exceed 190 characters. No keyword stuffing.
4. EXACT SPECS & COMMERCIAL VIABILITY:
   - Trim Size: Align with market standards (e.g. 8.5 x 11 in for coloring/workbooks; 6 x 9 in for journals/planners).
   - Page Count: Align with competitor medians (never recommend unrealistic page counts).
   - Price: Calculate realistic retail price ensuring healthy KDP printing royalty margin ($5.99 - $9.99).
5. 7 BACKEND SEARCH KEYWORDS:
   - Must be 7 distinct high-intent search phrases.
   - Do NOT repeat words that are already in the Title or Subtitle (Amazon indexes title words automatically).
   - No punctuation, no filler words ("a", "the", "for").
6. 3 ACCURATE KDP CATEGORIES:
   - Must follow Amazon KDP's 3-level BISAC hierarchy (e.g. Books > Children's Books > Activities, Crafts & Games > Activity Books > Coloring Books).
7. SOLVE REAL CUSTOMER COMPLAINTS (DIFFERENTIATION):
   - Every idea MUST directly fix at least one weakness or complaint revealed in competitor negative reviews (e.g. single-sided printing with dark backings to stop marker bleed-through, thick heavy outlines for small toddler hands, generous 0.5-inch inner margins for flat binding).

Output MUST strictly match this JSON schema (return ONLY valid JSON):
{
  "notes": "string explaining overall market observations, demand strength, and unserved buyer segments",
  "ideas": [
    {
      "title": "Main Title (catchy, keyword-optimized, no brand names or claim terms)",
      "subtitle": "Informative Subtitle (benefits, what is inside, audience target)",
      "subNiche": "Specific micro-niche within the broader market",
      "targetAudience": "Specific reader/buyer demographic",
      "sevenBackendKeywords": [
        "keyword phrase 1 (no words from title/subtitle, high intent)",
        "keyword phrase 2",
        "keyword phrase 3",
        "keyword phrase 4",
        "keyword phrase 5",
        "keyword phrase 6",
        "keyword phrase 7"
      ],
      "threeCategories": [
        "Books > Category > Subcategory",
        "Books > Category > Subcategory",
        "Books > Category > Subcategory"
      ],
      "shortDescription": "Natural language book description (150 to 200 words) describing the interior, benefits, and specifications without false claims.",
      "pageCount": 64,
      "trimSize": "8.5 x 11 inches",
      "priceSuggestion": 6.99,
      "differentiationAngle": "Specific competitor weakness addressed (e.g. single-sided pages to prevent bleed-through, larger designs for toddlers)",
      "contentPlan": "Detailed interior breakdown: illustration count, layout style, bonus features (e.g., test color page, blank page backing)",
      "estimatedDifficulty": 4,
      "whyItCouldWork": "Data-backed rationale citing competitor BSRs, keyword demand, or review complaints",
      "risks": "Potential market risks (e.g. seasonality, crowding, print cost margin)"
    }
  ]
}`;

/**
 * Builds a compact, structured text payload from the current SearchSnapshot
 * Truncates long text to keep the prompt well under 6,000 tokens.
 */
export function buildPromptPayload(
  snapshot: SearchSnapshot | null | undefined,
  userNotes?: string
): string {
  const lines: string[] = [];

  // 1. Search Query & Date
  const query = snapshot?.query || 'Unknown Niche';
  const dateStr = snapshot?.date ? new Date(snapshot.date).toISOString().split('T')[0] : 'Today';
  lines.push(`=== 1. SEARCH QUERY & DATE ===`);
  lines.push(`Primary Niche Keyword: "${query}"`);
  lines.push(`Research Date: ${dateStr}\n`);

  // 2. Niche Score & 5-Factor Breakdown
  lines.push(`=== 2. NICHE SCORE & BREAKDOWN ===`);
  if (snapshot?.scores) {
    const s = snapshot.scores;
    lines.push(`Total Score: ${s.total}/100 (Label: ${s.label.toUpperCase()})`);
    lines.push(`Verdict: ${s.verdict}`);
    if (s.breakdown) {
      lines.push(
        `- Demand: ${s.breakdown.demand.points}/${s.breakdown.demand.maxPoints} (${s.breakdown.demand.explanation})`
      );
      lines.push(
        `- Competition Gap: ${s.breakdown.competitionGap.points}/${s.breakdown.competitionGap.maxPoints} (${s.breakdown.competitionGap.explanation})`
      );
      lines.push(
        `- Weak Competitors: ${s.breakdown.weakCompetitors.points}/${s.breakdown.weakCompetitors.maxPoints} (${s.breakdown.weakCompetitors.explanation})`
      );
      lines.push(
        `- Profit Potential: ${s.breakdown.profit.points}/${s.breakdown.profit.maxPoints} (${s.breakdown.profit.explanation})`
      );
      lines.push(
        `- New Entrant Friendly: ${s.breakdown.newEntrant.points}/${s.breakdown.newEntrant.maxPoints} (${s.breakdown.newEntrant.explanation})`
      );
    }
    if (s.warnings && s.warnings.length > 0) {
      lines.push(`Warnings: ${s.warnings.join('; ')}`);
    }
  } else {
    lines.push(`Niche score: not available (search page not fully scanned)`);
  }
  lines.push('');

  // 3. Top 10 Books
  lines.push(`=== 3. TOP 10 COMPETITOR BOOKS ===`);
  const books = (snapshot?.books || []).slice(0, 10);
  if (books.length > 0) {
    books.forEach((b, idx) => {
      const bsr = b.bsrOverall ? `#${b.bsrOverall.toLocaleString()}` : 'N/A';
      const price = b.price !== undefined ? `$${b.price.toFixed(2)}` : 'N/A';
      const reviews = b.reviewCount !== undefined ? `${b.reviewCount} reviews` : 'N/A';
      const rating = b.rating !== undefined ? `★${b.rating.toFixed(1)}` : 'N/A';
      const pages = b.pageCount ? `${b.pageCount}p` : 'N/A';
      const pub = b.publishDate || 'N/A';
      const sales = b.monthlySalesEstimate ? `~${b.monthlySalesEstimate}/mo` : 'N/A';
      const opp = b.isOpportunity ? '[WEAK COMPETITOR OPPORTUNITY]' : '';

      lines.push(
        `${idx + 1}. "${b.title}" (ASIN: ${b.asin}) | BSR: ${bsr} | Price: ${price} | ${reviews} | ${rating} | ${pages} | Pub: ${pub} | Est. Sales: ${sales} ${opp}`
      );
    });
  } else {
    lines.push(`Top books: not available`);
  }
  lines.push('');

  // 4. Top 25 Keywords
  lines.push(`=== 4. KEYWORDS & TITLE N-GRAMS ===`);
  const keywords = (snapshot?.keywords || []).slice(0, 25);
  if (keywords.length > 0) {
    const kwSummary = keywords
      .map(
        (k) =>
          `"${k.keyword}" (Pos #${k.bestPosition}, Score: ${k.totalScore}/100, In ${k.inTitlesCount} titles)`
      )
      .join(', ');
    lines.push(`Top Amazon Autocomplete Keywords: ${kwSummary}`);
  } else {
    lines.push(`Keywords: not available (run Keywords tab first)`);
  }
  lines.push('');

  // 5. Category Stats & Checked Difficulties
  lines.push(`=== 5. CATEGORIES & DIFFICULTY ===`);
  const categories = snapshot?.categories || [];
  if (categories.length > 0) {
    categories.slice(0, 8).forEach((c) => {
      const diff = c.difficulty ? `Difficulty: ${c.difficulty.toUpperCase()}` : 'Difficulty: unchecked';
      const bsrTop20 = c.bsrAtTop20 ? `(Top 20 BSR cutoff: #${c.bsrAtTop20.toLocaleString()})` : '';
      lines.push(`- ${c.name} | Found in ${c.bookCount} books | Best rank: #${c.bestRankAmongTopBooks} | ${diff} ${bsrTop20}`);
    });
  } else {
    lines.push(`Categories: not available (run Categories tab first)`);
  }
  lines.push('');

  // 6. Specs Summary & Recommended Spec
  lines.push(`=== 6. BOOK SPECIFICATIONS ===`);
  if (snapshot?.specs) {
    const sp = snapshot.specs;
    lines.push(
      `- Median Page Count: ${sp.pageCount.median} pages (Range: ${sp.pageCount.min} - ${sp.pageCount.max}p, Most common: ${sp.pageCount.mostCommonRange})`
    );
    lines.push(
      `- Trim Size: ${sp.trimSize.mostCommon} (${sp.trimSize.percentage}% of competitors)`
    );
    lines.push(
      `- Median Price: $${sp.price.median.toFixed(2)} (Common point: $${sp.price.mostCommonPoint.toFixed(2)})`
    );
    lines.push(`- Format Share: ${sp.formatShare.percentage}% Low/No-Content`);
    if (sp.recommended) {
      lines.push(
        `- Recommended Spec: ${sp.recommended.pageCount} pages (${sp.recommended.pageCountReason}), ${sp.recommended.trimSize} (${sp.recommended.trimSizeReason}), Price ${sp.recommended.priceRange} (${sp.recommended.priceReason})`
      );
    }
  } else {
    lines.push(`Specs: not available (run Specs tab first)`);
  }
  lines.push('');

  // 7. Customer Review Gap & Complaints
  lines.push(`=== 7. CUSTOMER REVIEW GAP & COMPLAINTS ===`);
  if (snapshot?.reviewGap) {
    const rg = snapshot.reviewGap;
    lines.push(
      `Based on ${rg.totalNegativeReviews} negative reviews across ${rg.totalBooksAnalyzed} competitor books:`
    );

    if (rg.complaints && rg.complaints.length > 0) {
      lines.push(`Top Customer Complaints to Solve:`);
      rg.complaints.slice(0, 15).forEach((c) => {
        const quote = c.sampleQuotes && c.sampleQuotes[0] ? ` - Quote: "${c.sampleQuotes[0]}"` : '';
        lines.push(`  * [${c.category}] "${c.phrase}" (mentioned ${c.count}x across ${c.bookCount} books)${quote}`);
      });
    }

    if (rg.positivePhrases && rg.positivePhrases.length > 0) {
      const posStr = rg.positivePhrases.slice(0, 10).map((p) => `"${p.word}" (${p.count}x)`).join(', ');
      lines.push(`What Customers Love (Keep These Elements): ${posStr}`);
    }
  } else {
    lines.push(`Reviews analysis: not available (run Reviews tab first)`);
  }
  lines.push('');

  // 8. User Notes & Custom Constraints
  lines.push(`=== 8. CREATOR NOTES & CONSTRAINTS ===`);
  if (userNotes && userNotes.trim()) {
    lines.push(`User constraints / preferences: "${userNotes.trim()}"`);
  } else {
    lines.push(`None specified (general English paperback KDP publishing)`);
  }

  return lines.join('\n');
}
