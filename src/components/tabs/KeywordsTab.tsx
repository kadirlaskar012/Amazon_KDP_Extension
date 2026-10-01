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
      showCopyToast(`Found ${items.length} keyword suggestions`);
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
    if (checkingKeyword) return;
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
    copyToClipboard(text, `Copied ${filteredKeywords.length} keywords`);
  };

  const handleCopyTop20 = () => {
    if (keywords.length === 0) return;
    const top20 = keywords.slice(0, 20).map((k) => k.keyword).join(', ');
    copyToClipboard(top20, 'Copied top 20 keywords');
  };

  const handleCopy7BackendSlots = () => {
    if (keywords.length === 0) return;
    const slots = generate7BackendKeywordSlots(keywords, seedInput);
    if (slots.length === 0) {
      showCopyToast('No suitable keywords found for slots.');
      return;
    }
    const text = slots.join('\n');
    copyToClipboard(text, `Copied ${slots.length} backend keyword slots`);
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
    copyToClipboard(tsv, 'Copied table as TSV');
  };

  const handleCopyTitleWords = (words: typeof titleAnalysis.unigrams, label: string) => {
    if (words.length === 0) return;
    const text = words.map((w) => `${w.word} (${w.inTitlesCount}/10)`).join(', ');
    copyToClipboard(text, `Copied ${label}`);
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
    copyToClipboard(text, 'Copied 7 Golden Keywords');
  };

  return (
    <div className="space-y-3 no-horizontal-scroll" style={{ color: 'var(--text)' }}>
      {/* Toast Notification */}
      {copyFeedback && (
        <div className="p-1 border border-[var(--line)] bg-[var(--bg)]" style={{ color: 'var(--good)', fontSize: 'var(--font-small)' }}>
          {copyFeedback}
        </div>
      )}

      {/* Top 7 Golden Target Keywords: Plain table (no yellow background) */}
      {golden7Keywords.length > 0 && (
        <div className="border border-[var(--line)] p-2 space-y-1.5">
          <div className="flex items-center justify-between flex-wrap gap-1">
            <span className="section-subheading">
              Top 7 Golden Target Keywords (KDP Slots)
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={handleCopyGolden7}
                className="plain-btn plain-btn-sm"
                title="Copy all 7 keywords on separate lines"
              >
                Copy All 7 Slots
              </button>
              <button
                onClick={handleCopy7BackendSlots}
                className="plain-btn plain-btn-sm"
                title="Group into 7 lines <= 50 chars"
              >
                &le;50-Char Format
              </button>
            </div>
          </div>
          <div className="table-scroll-x">
            <table className="plain-table table-sticky-first" style={{ minWidth: '380px' }}>
              <thead>
                <tr>
                  <th className="text-center" style={{ width: '28px' }}>#</th>
                  <th>Keyword</th>
                  <th className="text-center" style={{ width: '64px' }}>Titles</th>
                  <th className="text-right" style={{ width: '64px' }}>Score</th>
                  <th className="text-center" style={{ width: '48px' }}>Copy</th>
                </tr>
              </thead>
              <tbody>
                {golden7Keywords.map((item, idx) => (
                  <tr key={item.keyword}>
                    <td className="text-center" style={{ fontFamily: 'var(--font-mono)' }}>{idx + 1}</td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold truncate" title={item.keyword}>
                          {item.keyword}
                        </span>
                        <TrendsLink keyword={item.keyword} geo={settings?.trends?.geo || 'US'} />
                      </div>
                    </td>
                    <td className="text-center" style={{ fontFamily: 'var(--font-mono)' }}>
                      {item.inTitlesCount}/{snapshot?.books?.length || 10}
                    </td>
                    <td className="text-right font-bold" style={{ fontFamily: 'var(--font-mono)', color: 'var(--good)' }}>
                      {item.totalScore}
                    </td>
                    <td className="text-center">
                      <button
                        onClick={() => copyToClipboard(item.keyword, `Copied: "${item.keyword}"`)}
                        className="plain-btn plain-btn-sm"
                      >
                        Copy
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Seed Keyword Area: plain label + text input + [Find Keywords] button + checkbox */}
      <div className="border border-[var(--line)] p-2 space-y-2">
        <label className="block font-bold uppercase" style={{ fontSize: 'var(--font-small)', color: 'var(--muted)' }}>
          Seed Keyword
        </label>
        <div className="flex gap-1.5">
          <input
            type="text"
            value={seedInput}
            onChange={(e) => setSeedInput(e.target.value)}
            placeholder="e.g. toddler coloring book"
            className="plain-input flex-1"
            onKeyDown={(e) => e.key === 'Enter' && handleFindKeywords()}
          />
          <button
            onClick={handleFindKeywords}
            disabled={isLoading || !seedInput.trim()}
            className="plain-btn font-bold"
          >
            {isLoading ? 'Searching...' : 'Find Keywords'}
          </button>
        </div>

        <div className="flex items-center justify-between flex-wrap gap-1" style={{ fontSize: 'var(--font-small)', color: 'var(--muted)' }}>
          <label className="flex items-center gap-1 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeDigits}
              onChange={(e) => setIncludeDigits(e.target.checked)}
              className="cursor-pointer"
            />
            <span>Include 0-9 suffixes (37 total queries)</span>
          </label>
          <span>{keywords.length} suggestions cached</span>
        </div>

        {/* Progress Bar: simple progress bar */}
        {isLoading && progress && (
          <div className="space-y-1">
            <div className="flex justify-between" style={{ fontSize: 'var(--font-small)', color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
              <span className="truncate max-w-[240px]">{progress.message}</span>
              <span>{Math.round((progress.current / progress.total) * 100)}%</span>
            </div>
            <div className="h-[6px] w-full bg-[#e0e0e0] dark:bg-[#333333]">
              <div
                className="h-full bg-[var(--text)] transition-all duration-200"
                style={{ width: `${Math.min(100, Math.round((progress.current / progress.total) * 100))}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Action / Export Buttons in one wrapped row: no colors */}
      {keywords.length > 0 && (
        <div className="flex flex-wrap gap-1">
          <button onClick={handleCopy7BackendSlots} className="plain-btn plain-btn-sm" title="Group into 7 lines <= 50 chars, no duplicate words">Copy 7 KDP Slots</button>
          <button onClick={handleCopyTop20} className="plain-btn plain-btn-sm">Copy Top 20</button>
          <button
            onClick={() => {
              const top5 = keywords.slice(0, 5).map((k) => k.keyword);
              if (top5.length > 0) {
                const compareUrl = buildCompareUrl(top5, settings?.trends?.geo || 'US');
                window.open(compareUrl, '_blank', 'noopener,noreferrer');
              }
            }}
            className="plain-btn plain-btn-sm"
            title="Compare search volume on Google Trends for top 5 keywords"
          >
            Compare Top 5
          </button>
          <button onClick={handleCopyAll} className="plain-btn plain-btn-sm">Copy All ({filteredKeywords.length})</button>
          <button onClick={handleCopyTsv} className="plain-btn plain-btn-sm">Copy TSV</button>
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
            className="plain-input flex-1"
          />
          <label className="flex items-center gap-1 cursor-pointer select-none" style={{ fontSize: 'var(--font-small)', color: 'var(--muted)' }}>
            <input
              type="checkbox"
              checked={highOnly}
              onChange={(e) => setHighOnly(e.target.checked)}
              className="cursor-pointer"
            />
            <span>High only</span>
          </label>
        </div>
      )}

      {/* Keywords Table: Columns: # | Keyword | Pos | Titles | BSR | Score | Copy */}
      {keywords.length > 0 ? (
        <div className="border border-[var(--line)]">
          <div className="max-h-[380px] overflow-y-auto no-horizontal-scroll">
            <table className="plain-table table-sticky-first" style={{ minWidth: '420px' }}>
              <thead>
                <tr>
                  <th className="text-center" style={{ width: '28px' }}>#</th>
                  <th>Keyword</th>
                  <th className="text-center" style={{ width: '40px' }} title="Lowest position in autocomplete">Pos</th>
                  <th className="text-center" style={{ width: '54px' }} title="Present in X of top 10 titles">Titles</th>
                  <th className="text-center" style={{ width: '72px' }} title="Average BSR of top 5 results">BSR</th>
                  <th className="text-right" style={{ width: '72px' }}>Score</th>
                  <th className="text-center" style={{ width: '48px' }}>Copy</th>
                </tr>
              </thead>
              <tbody>
                {filteredKeywords.map((k, idx) => {
                  const isCheckingThis = checkingKeyword === k.keyword;

                  return (
                    <tr key={k.keyword}>
                      <td className="text-center" style={{ fontFamily: 'var(--font-mono)' }}>{idx + 1}</td>
                      <td>
                        <div className="flex items-center gap-1">
                          <span className="truncate" style={{ maxWidth: '140px' }} title={k.keyword}>
                            {k.keyword}
                          </span>
                          <TrendsLink keyword={k.keyword} geo={settings?.trends?.geo || 'US'} />
                        </div>
                      </td>
                      <td className="text-center" style={{ fontFamily: 'var(--font-mono)', color: 'var(--muted)' }}>
                        #{k.bestPosition}
                      </td>
                      <td className="text-center" style={{ fontFamily: 'var(--font-mono)' }}>
                        {k.inTitlesCount}/10
                      </td>
                      <td className="text-center">
                        {isCheckingThis ? (
                          <span style={{ fontSize: 'var(--font-small)', color: 'var(--muted)' }}>Wait</span>
                        ) : k.avgBsr ? (
                          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--good)' }}>
                            #{k.avgBsr.toLocaleString()}
                          </span>
                        ) : (
                          <button
                            onClick={() => handleCheckBsr(k)}
                            disabled={Boolean(checkingKeyword)}
                            className="plain-btn plain-btn-sm"
                          >
                            Check
                          </button>
                        )}
                      </td>
                      <td className="text-right font-bold" style={{ fontFamily: 'var(--font-mono)' }}>
                        <span
                          style={{
                            color: k.scoreLabel === 'high'
                              ? 'var(--good)'
                              : k.scoreLabel === 'medium'
                              ? 'var(--warn)'
                              : 'var(--muted)',
                          }}
                          title={k.isPartial ? 'Partial score (BSR not checked)' : 'Full score'}
                        >
                          {k.totalScore} {k.scoreLabel === 'high' ? '(High)' : k.scoreLabel === 'medium' ? '(Med)' : '(Low)'}{k.isPartial ? '*' : ''}
                        </span>
                      </td>
                      <td className="text-center">
                        <button
                          onClick={() => copyToClipboard(k.keyword, `Copied: "${k.keyword}"`)}
                          className="plain-btn plain-btn-sm"
                        >
                          Copy
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div
            className="p-1.5 border-t border-[var(--line)] bg-[var(--bg)] flex justify-between items-center"
            style={{ fontSize: 'var(--font-small)', color: 'var(--muted)' }}
          >
            <span>* Click "Check" to fetch top 5 BSR for full score.</span>
            <span>{filteredKeywords.length} of {keywords.length} items</span>
          </div>
        </div>
      ) : (
        <div className="border border-dashed border-[var(--line)] p-4 text-center" style={{ color: 'var(--muted)' }}>
          No keywords found yet. Click "Find Keywords" above.
        </div>
      )}

      {/* Top 10 Title Word Frequency: plain bordered tables */}
      <div className="border border-[var(--line)] p-2 space-y-2">
        <div>
          <div className="section-subheading">Top 10 Title Word Frequency</div>
          <div style={{ fontSize: 'var(--font-small)', color: 'var(--muted)' }}>
            High-frequency words across {titleAnalysis.totalTitlesAnalyzed} titles
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {/* Unigrams */}
          <div className="border border-[var(--line)] p-1.5 space-y-1">
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-1">
              <span className="font-bold" style={{ fontSize: 'var(--font-small)' }}>Top Words</span>
              <button
                onClick={() => handleCopyTitleWords(titleAnalysis.unigrams, 'unigram words')}
                className="plain-link"
                style={{ fontSize: 'var(--font-small)' }}
              >
                Copy
              </button>
            </div>
            <div className="max-h-[140px] overflow-y-auto space-y-0.5" style={{ fontSize: 'var(--font-small)' }}>
              {titleAnalysis.unigrams.length > 0 ? (
                titleAnalysis.unigrams.slice(0, 15).map((u) => (
                  <div key={u.word} className="flex justify-between items-center">
                    <span className="truncate" style={{ maxWidth: '100px' }} title={u.word}>
                      {u.word}
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--muted)' }}>
                      {u.inTitlesCount}/10
                    </span>
                  </div>
                ))
              ) : (
                <div style={{ color: 'var(--muted)' }}>None found</div>
              )}
            </div>
          </div>

          {/* Bigrams */}
          <div className="border border-[var(--line)] p-1.5 space-y-1">
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-1">
              <span className="font-bold" style={{ fontSize: 'var(--font-small)' }}>2-Word Phrases</span>
              <button
                onClick={() => handleCopyTitleWords(titleAnalysis.bigrams, 'bigram phrases')}
                className="plain-link"
                style={{ fontSize: 'var(--font-small)' }}
              >
                Copy
              </button>
            </div>
            <div className="max-h-[140px] overflow-y-auto space-y-0.5" style={{ fontSize: 'var(--font-small)' }}>
              {titleAnalysis.bigrams.length > 0 ? (
                titleAnalysis.bigrams.slice(0, 15).map((b) => (
                  <div key={b.word} className="flex justify-between items-center">
                    <span className="truncate" style={{ maxWidth: '100px' }} title={b.word}>
                      {b.word}
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--muted)' }}>
                      {b.inTitlesCount}/10
                    </span>
                  </div>
                ))
              ) : (
                <div style={{ color: 'var(--muted)' }}>None found</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
