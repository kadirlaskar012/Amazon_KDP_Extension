// src/components/tabs/KeywordsTab.tsx
// Keywords Finder Tab: Autocomplete research, scoring, title word frequency, and KDP backend slots

import React, { useState, useMemo, useRef } from 'react';
import type { SearchSnapshot, KeywordItem, Settings } from '../../types';
import { fetchAutocompleteKeywords, checkKeywordBsr, type AutocompleteProgress } from '../../services/autocomplete';
import { generate7BackendKeywordSlots } from '../../services/keywordScore';
import { analyzeTitles } from '../../services/titleAnalysis';
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

  // Keywords state (from snapshot if available, or newly fetched)
  const [keywords, setKeywords] = useState<KeywordItem[]>(snapshot?.keywords || []);
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

  // Keep keywords in sync if snapshot changes externally
  React.useEffect(() => {
    if (snapshot?.keywords && snapshot.keywords.length > 0) {
      setKeywords(snapshot.keywords);
    }
    if (snapshot?.query && !seedInput) {
      setSeedInput(snapshot.query);
    }
  }, [snapshot]);

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

  return (
    <div className="space-y-4 text-xs text-slate-300">
      {/* Toast Notification */}
      {copyFeedback && (
        <div className="fixed bottom-4 right-4 z-50 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white shadow-xl animate-fade-in">
          ✓ {copyFeedback}
        </div>
      )}

      {/* Top Search Controls */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3 shadow-lg">
        <label className="block mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Seed Keyword
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={seedInput}
            onChange={(e) => setSeedInput(e.target.value)}
            placeholder="e.g. toddler coloring book"
            className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            onKeyDown={(e) => e.key === 'Enter' && handleFindKeywords()}
          />
          <button
            onClick={handleFindKeywords}
            disabled={isLoading || !seedInput.trim()}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 font-medium text-white shadow hover:bg-indigo-500 disabled:opacity-50 transition"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                <span>Searching</span>
              </>
            ) : (
              <span>Find Keywords</span>
            )}
          </button>
        </div>

        <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={includeDigits}
              onChange={(e) => setIncludeDigits(e.target.checked)}
              className="rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-0"
            />
            <span>Include 0-9 suffixes (37 total requests)</span>
          </label>
          <span className="text-slate-500">{keywords.length} suggestions cached</span>
        </div>

        {/* Progress Bar */}
        {isLoading && progress && (
          <div className="mt-3 space-y-1.5">
            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
              <span className="truncate max-w-[240px]">{progress.message}</span>
              <span>{Math.round((progress.current / progress.total) * 100)}%</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-slate-950 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 transition-all duration-300"
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
            className="rounded-lg bg-emerald-600/20 border border-emerald-500/40 px-2.5 py-1 text-[11px] font-medium text-emerald-300 hover:bg-emerald-600/30 transition flex items-center gap-1"
            title="Group into 7 lines ≤ 50 chars, no duplicate words"
          >
            📋 Copy 7 KDP Slots
          </button>
          <button
            onClick={handleCopyTop20}
            className="rounded-lg bg-indigo-600/20 border border-indigo-500/40 px-2 py-1 text-[11px] font-medium text-indigo-300 hover:bg-indigo-600/30 transition"
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
            className="rounded-lg bg-purple-600/20 border border-purple-500/40 px-2 py-1 text-[11px] font-medium text-purple-300 hover:bg-purple-600/30 transition flex items-center gap-1"
            title="Compare search volume on Google Trends for top 5 keywords"
          >
            📈 Compare Top 5 (Trends)
          </button>
          <button
            onClick={handleCopyAll}
            className="rounded-lg bg-slate-800 border border-slate-700 px-2 py-1 text-[11px] font-medium text-slate-300 hover:bg-slate-700 transition"
          >
            Copy All ({filteredKeywords.length})
          </button>
          <button
            onClick={handleCopyTsv}
            className="rounded-lg bg-slate-800 border border-slate-700 px-2 py-1 text-[11px] font-medium text-slate-300 hover:bg-slate-700 transition"
          >
            Copy as TSV
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
            className="flex-1 rounded-lg border border-slate-800 bg-slate-900/60 px-2.5 py-1 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
          />
          <label className="flex items-center gap-1.5 text-[11px] text-slate-300 whitespace-nowrap cursor-pointer">
            <input
              type="checkbox"
              checked={highOnly}
              onChange={(e) => setHighOnly(e.target.checked)}
              className="rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-0"
            />
            <span>High only</span>
          </label>
        </div>
      )}

      {/* Keywords Table */}
      {keywords.length > 0 ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 overflow-hidden shadow-lg">
          <div className="max-h-[360px] overflow-y-auto overflow-x-auto">
            <table className="w-full text-left text-[11px]">
              <thead className="sticky top-0 bg-slate-950 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-2 px-2.5">Keyword</th>
                  <th className="py-2 px-1 text-center" title="Lowest position in autocomplete suggestions">Pos</th>
                  <th className="py-2 px-1 text-center" title="Present in X of top 10 titles">Titles</th>
                  <th className="py-2 px-1.5 text-center" title="Average BSR of top 5 results">BSR</th>
                  <th className="py-2 px-2 text-right">Score</th>
                  <th className="py-2 px-1 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredKeywords.map((k) => {
                  const isCheckingThis = checkingKeyword === k.keyword;
                  const trendsUrl = `https://trends.google.com/trends/explore?q=${encodeURIComponent(k.keyword)}&geo=US`;

                  return (
                    <tr key={k.keyword} className="hover:bg-slate-800/30 transition-colors">
                      {/* Keyword + Trends link */}
                      <td className="py-2 px-2.5 font-medium text-white max-w-[150px] truncate">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate" title={k.keyword}>
                            {k.keyword}
                          </span>
                          <TrendsLink keyword={k.keyword} geo={settings?.trends?.geo || 'US'} />
                        </div>
                      </td>

                      {/* Best Position */}
                      <td className="py-2 px-1 text-center text-slate-400 font-mono">
                        #{k.bestPosition}
                      </td>

                      {/* In Top Titles */}
                      <td className="py-2 px-1 text-center text-slate-300 font-mono">
                        {k.inTitlesCount}/10
                      </td>

                      {/* BSR Check or Value */}
                      <td className="py-2 px-1.5 text-center">
                        {isCheckingThis ? (
                          <span className="inline-flex items-center gap-1 text-[10px] text-indigo-400">
                            <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                            </svg>
                            Wait
                          </span>
                        ) : k.avgBsr ? (
                          <span className="font-mono text-emerald-400" title={`Score: ${k.bsrScore}`}>
                            #{k.avgBsr.toLocaleString()}
                          </span>
                        ) : (
                          <button
                            onClick={() => handleCheckBsr(k)}
                            disabled={Boolean(checkingKeyword)}
                            className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300 hover:bg-indigo-600 hover:text-white transition disabled:opacity-40"
                          >
                            Check
                          </button>
                        )}
                      </td>

                      {/* Total Score + Badge */}
                      <td className="py-2 px-2 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                              k.scoreLabel === 'high'
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                : k.scoreLabel === 'medium'
                                ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                                : 'bg-slate-800 text-slate-400 border border-slate-700'
                            }`}
                            title={k.isPartial ? 'Partial score (BSR not checked)' : 'Full score'}
                          >
                            {k.totalScore}
                            {k.isPartial && '*'}
                          </span>
                        </div>
                      </td>

                      {/* Copy single keyword */}
                      <td className="py-2 px-1 text-center">
                        <button
                          onClick={() => copyToClipboard(k.keyword, `Copied "${k.keyword}"`)}
                          className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition"
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
          <div className="p-2 border-t border-slate-800 bg-slate-950/80 text-[10px] text-slate-500 flex justify-between items-center">
            <span>* Partial score: Click "Check" to fetch top 5 BSR for accurate ranking.</span>
            <span>{filteredKeywords.length} of {keywords.length} items</span>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-800 p-6 text-center text-slate-500">
          <p className="font-medium text-slate-400">No keywords found yet</p>
          <p className="text-[11px] mt-1">
            Click "Find Keywords" above to scan Amazon suggestions across A-Z suffixes.
          </p>
        </div>
      )}

      {/* Second Panel: Title Word & Bigram Frequency */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3 shadow-lg space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-semibold text-white text-xs">Top 10 Title Word Frequency</h4>
            <p className="text-[10px] text-slate-400">
              High-frequency words stripped of stopwords across {titleAnalysis.totalTitlesAnalyzed} titles
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {/* Unigrams */}
          <div className="rounded-lg border border-slate-800 bg-slate-950 p-2">
            <div className="flex items-center justify-between mb-1.5 pb-1 border-b border-slate-800">
              <span className="font-semibold text-[10px] uppercase text-indigo-400">Top Words</span>
              <button
                onClick={() => handleCopyTitleWords(titleAnalysis.unigrams, 'unigram words')}
                className="text-[10px] text-slate-400 hover:text-white"
              >
                Copy
              </button>
            </div>
            <div className="max-h-[140px] overflow-y-auto space-y-1">
              {titleAnalysis.unigrams.length > 0 ? (
                titleAnalysis.unigrams.slice(0, 15).map((u) => (
                  <div key={u.word} className="flex justify-between items-center text-[10px]">
                    <span className="text-slate-300 truncate max-w-[100px]" title={u.word}>
                      {u.word}
                    </span>
                    <span className="font-mono text-slate-500">
                      {u.inTitlesCount}/10
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-[10px] text-slate-600">No title words found</div>
              )}
            </div>
          </div>

          {/* Bigrams */}
          <div className="rounded-lg border border-slate-800 bg-slate-950 p-2">
            <div className="flex items-center justify-between mb-1.5 pb-1 border-b border-slate-800">
              <span className="font-semibold text-[10px] uppercase text-indigo-400">2-Word Phrases</span>
              <button
                onClick={() => handleCopyTitleWords(titleAnalysis.bigrams, 'bigram phrases')}
                className="text-[10px] text-slate-400 hover:text-white"
              >
                Copy
              </button>
            </div>
            <div className="max-h-[140px] overflow-y-auto space-y-1">
              {titleAnalysis.bigrams.length > 0 ? (
                titleAnalysis.bigrams.slice(0, 15).map((b) => (
                  <div key={b.word} className="flex justify-between items-center text-[10px]">
                    <span className="text-slate-300 truncate max-w-[100px]" title={b.word}>
                      {b.word}
                    </span>
                    <span className="font-mono text-slate-500">
                      {b.inTitlesCount}/10
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-[10px] text-slate-600">No phrases found</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
