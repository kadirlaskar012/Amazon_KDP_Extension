import React, { useState, useMemo, useRef } from 'react';
import type { SearchSnapshot, KeywordItem, Settings } from '../../types';
import { fetchAutocompleteKeywords, checkKeywordBsr, type AutocompleteProgress } from '../../services/autocomplete';
import { generate7BackendKeywordSlots } from '../../services/keywordScore';
import { analyzeTitles, extractNicheKeywordsFromBooks } from '../../services/titleAnalysis';
import { TrendsLink } from '../TrendsLink';
import { buildCompareUrl } from '../../services/trends';

interface KeywordsTabProps {
  snapshot?: SearchSnapshot | null;
  settings: Settings;
  onUpdateSnapshotKeywords?: (keywords: KeywordItem[]) => void;
  onCaptchaEncountered?: (url?: string) => void;
}

export const KeywordsTab: React.FC<KeywordsTabProps> = ({
  snapshot,
  settings,
  onUpdateSnapshotKeywords,
  onCaptchaEncountered,
}) => {
  // Seed query from snapshot or default empty
  const initialSeed = snapshot?.query || '';
  const [seedInput, setSeedInput] = useState<string>(initialSeed);
  const [includeDigits, setIncludeDigits] = useState<boolean>(false);

  // Automatically extract niche keywords directly from the ranking books on the current search page
  const pageExtracted = useMemo(() => {
    return extractNicheKeywordsFromBooks(snapshot?.books || [], snapshot?.query || '', settings.keywordWeights);
  }, [snapshot?.books, snapshot?.query, settings.keywordWeights]);

  // Keywords state (from snapshot if available, or auto-extracted from current page, or newly fetched)
  const [keywords, setKeywords] = useState<KeywordItem[]>(() => {
    if (snapshot?.keywords && snapshot.keywords.length > 0) return snapshot.keywords;
    return pageExtracted.allExtractedKeywords;
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [progress, setProgress] = useState<AutocompleteProgress | null>(null);

  // Active BSR check tracking (limit to 1 active check at a time)
  const [checkingKeyword, setCheckingKeyword] = useState<string | null>(null);

  // Filter state
  const [filterText, setFilterText] = useState<string>('');
  const [highOnly, setHighOnly] = useState<boolean>(false);

  // Copy feedback state
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  // Keep keywords in sync if snapshot changes externally or auto-fill with extracted keywords
  React.useEffect(() => {
    if (snapshot?.keywords && snapshot.keywords.length > 0) {
      setKeywords(snapshot.keywords);
    } else if (pageExtracted.allExtractedKeywords.length > 0 && keywords.length === 0) {
      setKeywords(pageExtracted.allExtractedKeywords);
    }
    if (snapshot?.query && !seedInput) {
      setSeedInput(snapshot.query);
    }
  }, [snapshot, pageExtracted.allExtractedKeywords]);

  // Title word & bigram frequency analysis from top 10 snapshot books
  const titleAnalysis = useMemo(() => {
    const topBooks = (snapshot?.books || []).slice(0, 10);
    return analyzeTitles(topBooks);
  }, [snapshot?.books]);

  // Filtered & sorted keywords
  const filteredKeywords = useMemo(() => {
    return keywords.filter((k) => {
      if (highOnly && k.scoreLabel !== 'high') return false;
      if (filterText && !k.keyword.toLowerCase().includes(filterText.toLowerCase())) return false;
      return true;
    });
  }, [keywords, filterText, highOnly]);

  const showCopyToast = (msg: string) => {
    setCopyFeedback(msg);
    setTimeout(() => setCopyFeedback(null), 2500);
  };

  // Find keywords action
  const handleFindKeywords = async () => {
    const trimmed = seedInput.trim();
    if (!trimmed) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setIsLoading(true);
    setProgress({ current: 0, total: 27, message: 'Initiating autocomplete search...' });

    try {
      const items = await fetchAutocompleteKeywords(trimmed, {
        includeDigits,
        books: snapshot?.books,
        weights: settings.keywordWeights,
        signal: abortControllerRef.current.signal,
        onProgress: (p) => setProgress(p),
      });

      setKeywords(items);
      if (onUpdateSnapshotKeywords) {
        onUpdateSnapshotKeywords(items);
      }
      showCopyToast(`Found ${items.length} keyword suggestions!`);
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('[KeywordsTab] Search error:', err);
      }
    } finally {
      setIsLoading(false);
      setProgress(null);
    }
  };

  // Check individual keyword BSR
  const handleCheckBsr = async (item: KeywordItem) => {
    if (checkingKeyword) return; // Only 1 at a time
    setCheckingKeyword(item.keyword);

    try {
      const updated = await checkKeywordBsr(item, settings.keywordWeights, snapshot?.books?.length || 10);
      const nextList = keywords.map((k) => (k.keyword === item.keyword ? updated : k));
      setKeywords(nextList);
      if (onUpdateSnapshotKeywords) {
        onUpdateSnapshotKeywords(nextList);
      }
      showCopyToast(`Updated BSR for "${item.keyword}"`);
    } catch (err: any) {
      if (err.message === 'CAPTCHA_DETECTED') {
        if (onCaptchaEncountered) onCaptchaEncountered();
      } else {
        console.warn('[KeywordsTab] Failed to check BSR:', err);
      }
    } finally {
      setCheckingKeyword(null);
    }
  };

  // Copy helpers
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    showCopyToast(label);
  };

  const handleCopyAll = () => {
    if (filteredKeywords.length === 0) return;
    const text = filteredKeywords.map((k) => k.keyword).join('\n');
    copyToClipboard(text, `Copied ${filteredKeywords.length} keywords!`);
  };

  const handleCopyTop20 = () => {
    if (keywords.length === 0) return;
    const top20 = keywords.slice(0, 20).map((k) => k.keyword).join(', ');
    copyToClipboard(top20, 'Copied top 20 keywords!');
  };

  const handleCopy7BackendSlots = () => {
    if (keywords.length === 0) return;
    const slots = generate7BackendKeywordSlots(keywords, seedInput);
    if (slots.length === 0) {
      showCopyToast('No suitable keywords found for slots.');
      return;
    }
    const text = slots.join('\n');
    copyToClipboard(text, `Copied ${slots.length} backend keyword slots!`);
  };

  const handleCopyTsv = () => {
    if (filteredKeywords.length === 0) return;
    const headers = ['Keyword', 'Best Position', 'In Top 10 Titles', 'Avg BSR', 'BSR Score', 'Total Score', 'Score Label', 'Is Partial'];
    const rows = filteredKeywords.map((k) => [
      k.keyword,
      k.bestPosition,
      `${k.inTitlesCount}/10`,
      k.avgBsr ? k.avgBsr : 'N/A',
      k.bsrScore !== null && k.bsrScore !== undefined ? k.bsrScore : 'N/A',
      k.totalScore,
      k.scoreLabel,
      k.isPartial ? 'Yes' : 'No',
    ]);
    const tsv = [headers.join('\t'), ...rows.map((r) => r.join('\t'))].join('\n');
    copyToClipboard(tsv, 'Copied table as TSV!');
  };

  const handleCopyTitleWords = (words: typeof titleAnalysis.unigrams, label: string) => {
    if (words.length === 0) return;
    const text = words.map((w) => `${w.word} (${w.inTitlesCount}/10)`).join(', ');
    copyToClipboard(text, `Copied ${label}!`);
  };

  // Top 7 Golden Target Keywords for KDP Backend Slots
  const golden7Keywords = useMemo(() => {
    if (pageExtracted.top7GoldenKeywords.length > 0) {
      return pageExtracted.top7GoldenKeywords;
    }
    if (keywords.length > 0) {
      return [...keywords].sort((a, b) => b.totalScore - a.totalScore).slice(0, 7);
    }
    return [];
  }, [pageExtracted.top7GoldenKeywords, keywords]);

  const handleCopyGolden7 = () => {
    if (golden7Keywords.length === 0) return;
    const text = golden7Keywords.map((k) => k.keyword).join('\n');
    copyToClipboard(text, 'Copied 7 Golden Keywords (line-by-line)!');
  };

  return (
    <div className="space-y-4 text-xs font-sans text-slate-700 dark:text-slate-200 no-horizontal-scroll">
      {/* Toast Notification */}
      {copyFeedback && (
        <div className="fixed bottom-4 right-4 z-50 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white shadow-xl animate-fade-in">
          ✓ {copyFeedback}
        </div>
      )}

      {/* 🌟 Top 7 Golden Target Keywords (KDP 7 Backend Slots Hero Card) */}
      {golden7Keywords.length > 0 && (
        <div className="rounded-xl border border-amber-300 dark:border-amber-600/40 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-yellow-500/10 dark:from-amber-950/40 dark:via-slate-900 dark:to-yellow-950/30 p-3.5 shadow-sm space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-200 dark:border-amber-800/40 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="text-xl">🌟</span>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                    Top 7 Golden Target Keywords
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/30">
                    KDP 7 Backend Slots
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                  Directly mined from top-selling books on page for &quot;{snapshot?.query || seedInput || 'Niche'}&quot;. Ready for KDP metadata.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={handleCopyGolden7}
                className="rounded-lg bg-gradient-to-r from-amber-500 to-yellow-500 px-2.5 py-1 text-xs font-bold text-slate-950 shadow-xs hover:from-amber-600 hover:to-yellow-600 transition flex items-center gap-1 cursor-pointer"
                title="Copy all 7 keywords on separate lines"
              >
                📋 Copy All 7 Slots
              </button>
              <button
                onClick={handleCopy7BackendSlots}
                className="rounded-lg bg-white/90 dark:bg-slate-800 border border-amber-300 dark:border-amber-700/60 px-2.5 py-1 text-xs font-semibold text-amber-800 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-slate-700 transition flex items-center gap-1 cursor-pointer"
                title="Group into 7 lines ≤ 50 chars, no duplicate words"
              >
                ⚡ ≤50-Char Format
              </button>
            </div>
          </div>

          {/* 7 Slots List */}
          <div className="grid grid-cols-1 gap-1.5">
            {golden7Keywords.map((item, idx) => (
              <div
                key={item.keyword}
                className="flex items-center justify-between p-2 rounded-lg bg-white/90 dark:bg-slate-950/70 border border-amber-200/80 dark:border-amber-900/40 shadow-2xs hover:border-amber-400 dark:hover:border-amber-600 transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 text-[11px] font-black flex items-center justify-center border border-amber-500/30">
                    {idx + 1}
                  </span>
                  <span className="font-bold text-xs text-slate-900 dark:text-white truncate" title={item.keyword}>
                    {item.keyword}
                  </span>
                  <TrendsLink keyword={item.keyword} geo={settings?.trends?.geo || 'US'} />
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <span
                    className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                    title="Number of top 10 books with this keyword in title"
                  >
                    {item.inTitlesCount}/{snapshot?.books?.length || 10} titles
                  </span>
                  <span
                    className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700/60"
                    title="Overall keyword opportunity score"
                  >
                    Score: {item.totalScore}
                  </span>
                  <button
                    onClick={() => copyToClipboard(item.keyword, `Copied Slot ${idx + 1}: "${item.keyword}"`)}
                    className="text-slate-400 hover:text-amber-600 dark:hover:text-amber-300 p-1 rounded hover:bg-amber-100 dark:hover:bg-amber-950/60 transition cursor-pointer"
                    title={`Copy slot ${idx + 1}`}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Search Controls */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 shadow-xs">
        <label className="block mb-1.5 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
          Seed Keyword
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={seedInput}
            onChange={(e) => setSeedInput(e.target.value)}
            placeholder="e.g. toddler coloring book"
            className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            onKeyDown={(e) => e.key === 'Enter' && handleFindKeywords()}
          />
          <button
            onClick={handleFindKeywords}
            disabled={isLoading || !seedInput.trim()}
            className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 transition cursor-pointer"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                <span>Searching...</span>
              </>
            ) : (
              <span>Find Keywords</span>
            )}
          </button>
        </div>

        <div className="mt-2.5 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeDigits}
              onChange={(e) => setIncludeDigits(e.target.checked)}
              className="rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-0"
            />
            <span>Include 0-9 suffixes (37 total queries)</span>
          </label>
          <span className="font-medium text-slate-600 dark:text-slate-400">{keywords.length} suggestions cached</span>
        </div>

        {/* Progress Bar */}
        {isLoading && progress && (
          <div className="mt-3 space-y-1.5">
            <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 font-mono">
              <span className="truncate max-w-[240px]">{progress.message}</span>
              <span>{Math.round((progress.current / progress.total) * 100)}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-300"
                style={{ width: `${Math.min(100, Math.round((progress.current / progress.total) * 100))}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Action / Export Buttons */}
      {keywords.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={handleCopy7BackendSlots}
            className="rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700/60 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition flex items-center gap-1 cursor-pointer"
            title="Group into 7 lines ≤ 50 chars, no duplicate words"
          >
            📋 Copy 7 KDP Slots
          </button>
          <button
            onClick={handleCopyTop20}
            className="rounded-lg bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-300 dark:border-indigo-700/60 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition cursor-pointer"
          >
            Copy Top 20
          </button>
          <button
            onClick={() => {
              const top5 = keywords.slice(0, 5).map((k) => k.keyword);
              if (top5.length > 0) {
                const compareUrl = buildCompareUrl(top5, settings?.trends?.geo || 'US');
                window.open(compareUrl, '_blank', 'noopener,noreferrer');
              }
            }}
            className="rounded-lg bg-purple-50 dark:bg-purple-950/40 border border-purple-300 dark:border-purple-700/60 px-2.5 py-1.5 text-xs font-semibold text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/60 transition flex items-center gap-1 cursor-pointer"
            title="Compare search volume on Google Trends for top 5 keywords"
          >
            📈 Compare Top 5
          </button>
          <button
            onClick={handleCopyAll}
            className="rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
          >
            Copy All ({filteredKeywords.length})
          </button>
          <button
            onClick={handleCopyTsv}
            className="rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
          >
            Copy TSV
          </button>
        </div>
      )}

      {/* Filter Row */}
      {keywords.length > 0 && (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Filter keywords..."
            className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:border-indigo-500 focus:outline-none"
          />
          <label className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300 font-medium whitespace-nowrap cursor-pointer select-none">
            <input
              type="checkbox"
              checked={highOnly}
              onChange={(e) => setHighOnly(e.target.checked)}
              className="rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-0"
            />
            <span>High only</span>
          </label>
        </div>
      )}

      {/* Keywords Table */}
      {keywords.length > 0 ? (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
          <div className="max-h-[380px] overflow-y-auto no-horizontal-scroll">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700 uppercase tracking-wider text-[10px] select-none">
                <tr>
                  <th className="py-2.5 px-3">Keyword</th>
                  <th className="py-2.5 px-1.5 text-center" title="Lowest position in autocomplete suggestions">Pos</th>
                  <th className="py-2.5 px-1.5 text-center" title="Present in X of top 10 titles">Titles</th>
                  <th className="py-2.5 px-2 text-center" title="Average BSR of top 5 results">BSR</th>
                  <th className="py-2.5 px-2 text-right">Score</th>
                  <th className="py-2.5 px-1.5 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredKeywords.map((k) => {
                  const isCheckingThis = checkingKeyword === k.keyword;

                  return (
                    <tr key={k.keyword} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      {/* Keyword + Trends link */}
                      <td className="py-2 px-3 font-semibold text-slate-900 dark:text-slate-100 max-w-[160px] truncate">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate" title={k.keyword}>
                            {k.keyword}
                          </span>
                          <TrendsLink keyword={k.keyword} geo={settings?.trends?.geo || 'US'} />
                        </div>
                      </td>

                      {/* Best Position */}
                      <td className="py-2 px-1.5 text-center text-slate-500 dark:text-slate-400 font-mono">
                        #{k.bestPosition}
                      </td>

                      {/* In Top Titles */}
                      <td className="py-2 px-1.5 text-center text-slate-700 dark:text-slate-300 font-mono font-medium">
                        {k.inTitlesCount}/10
                      </td>

                      {/* BSR Check or Value */}
                      <td className="py-2 px-2 text-center">
                        {isCheckingThis ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-indigo-500 font-medium">
                            <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                            </svg>
                            Wait
                          </span>
                        ) : k.avgBsr ? (
                          <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-xs" title={`Score: ${k.bsrScore}`}>
                            #{k.avgBsr.toLocaleString()}
                          </span>
                        ) : (
                          <button
                            onClick={() => handleCheckBsr(k)}
                            disabled={Boolean(checkingKeyword)}
                            className="rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:text-slate-300 hover:bg-indigo-600 hover:text-white transition disabled:opacity-40 cursor-pointer"
                          >
                            Check
                          </button>
                        )}
                      </td>

                      {/* Total Score + Badge */}
                      <td className="py-2 px-2 text-right">
                        <span
                          className={`inline-block rounded-md px-2 py-0.5 text-xs font-bold ${
                            k.scoreLabel === 'high'
                              ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700/60'
                              : k.scoreLabel === 'medium'
                              ? 'bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700/60'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                          }`}
                          title={k.isPartial ? 'Partial score (BSR not checked)' : 'Full score'}
                        >
                          {k.totalScore}
                          {k.isPartial && '*'}
                        </span>
                      </td>

                      {/* Copy single keyword */}
                      <td className="py-2 px-1.5 text-center">
                        <button
                          onClick={() => copyToClipboard(k.keyword, `Copied "${k.keyword}"`)}
                          className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                          title="Copy keyword"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="p-2.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs text-slate-500 dark:text-slate-400 flex justify-between items-center">
            <span>* Click "Check" to fetch top 5 BSR for full score.</span>
            <span className="font-mono">{filteredKeywords.length} of {keywords.length} items</span>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-800 p-6 text-center text-slate-500 bg-slate-50/50 dark:bg-slate-900/50">
          <p className="font-semibold text-slate-700 dark:text-slate-300 text-sm">No keywords found yet</p>
          <p className="text-xs mt-1 text-slate-500 dark:text-slate-400">
            Click "Find Keywords" above to scan Amazon suggestions across A-Z suffixes.
          </p>
        </div>
      )}

      {/* Second Panel: Title Word & Bigram Frequency */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">Top 10 Title Word Frequency</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              High-frequency words stripped of stopwords across {titleAnalysis.totalTitlesAnalyzed} titles
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          {/* Unigrams */}
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 p-2.5">
            <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-slate-200 dark:border-slate-700">
              <span className="font-bold text-xs uppercase text-indigo-600 dark:text-indigo-400">Top Words</span>
              <button
                onClick={() => handleCopyTitleWords(titleAnalysis.unigrams, 'unigram words')}
                className="text-xs font-medium text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-300 cursor-pointer"
              >
                Copy
              </button>
            </div>
            <div className="max-h-[160px] overflow-y-auto space-y-1.5">
              {titleAnalysis.unigrams.length > 0 ? (
                titleAnalysis.unigrams.slice(0, 15).map((u) => (
                  <div key={u.word} className="flex justify-between items-center text-xs">
                    <span className="text-slate-800 dark:text-slate-200 font-medium truncate max-w-[120px]" title={u.word}>
                      {u.word}
                    </span>
                    <span className="font-mono text-slate-500 dark:text-slate-400 font-semibold">
                      {u.inTitlesCount}/10
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-xs text-slate-400">No title words found</div>
              )}
            </div>
          </div>

          {/* Bigrams */}
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 p-2.5">
            <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-slate-200 dark:border-slate-700">
              <span className="font-bold text-xs uppercase text-indigo-600 dark:text-indigo-400">2-Word Phrases</span>
              <button
                onClick={() => handleCopyTitleWords(titleAnalysis.bigrams, 'bigram phrases')}
                className="text-xs font-medium text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-300 cursor-pointer"
              >
                Copy
              </button>
            </div>
            <div className="max-h-[160px] overflow-y-auto space-y-1.5">
              {titleAnalysis.bigrams.length > 0 ? (
                titleAnalysis.bigrams.slice(0, 15).map((b) => (
                  <div key={b.word} className="flex justify-between items-center text-xs">
                    <span className="text-slate-800 dark:text-slate-200 font-medium truncate max-w-[120px]" title={b.word}>
                      {b.word}
                    </span>
                    <span className="font-mono text-slate-500 dark:text-slate-400 font-semibold">
                      {b.inTitlesCount}/10
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-xs text-slate-400">No phrases found</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
