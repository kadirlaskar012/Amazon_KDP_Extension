// src/services/aiPrompt.ts
// System prompt and structured payload builder for Google Gemini KDP book idea generation

import type { SearchSnapshot } from '../types';

export const DEFAULT_KDP_SYSTEM_PROMPT = `You are a KDP (Amazon Kindle Direct Publishing) niche research assistant. Use ONLY the data provided plus general publishing knowledge. Do not invent sales numbers or BSR values. Return ONLY valid JSON, no markdown, no commentary. Follow Amazon KDP content guidelines: no brand names, trademarks, character names, celebrity names, or terms like 'best seller', 'free', 'new', 'top rated' in titles or subtitles. No keyword stuffing. Titles up to 200 characters including subtitle. Each idea must clearly differ from the others and must address at least one weakness found in the data (complaints, weak competitors, missing sub-niche, spec gap). If the data is too thin to support ideas, return an empty array and a 'notes' field explaining what data is missing.

Output MUST strictly match this JSON schema:
{
  "notes": "string explaining overall market observations and data strengths/gaps",
  "ideas": [
    {
      "title": "Main Title (catchy, keyword-optimized, no brand names or claim terms)",
      "subtitle": "Informative Subtitle (benefits, what is inside, audience target)",
      "subNiche": "Specific micro-niche within the broader market",
      "targetAudience": "Specific reader/buyer demographic",
      "sevenBackendKeywords": [
        "keyword phrase 1 (under 50 chars, no repeated words)",
        "keyword phrase 2",
        "keyword phrase 3",
        "keyword phrase 4",
        "keyword phrase 5",
        "keyword phrase 6",
        "keyword phrase 7"
      ],
      "threeCategories": [
        "Books > Children's Books > Animals > Mammals",
        "Books > Crafts, Hobbies & Home > Coloring Books",
        "Books > Education & Teaching > Early Childhood"
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
