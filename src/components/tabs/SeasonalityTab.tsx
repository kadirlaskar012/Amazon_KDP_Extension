// src/components/tabs/SeasonalityTab.tsx
// Dedicated Seasonality & Holiday Trend Predictor tab.
// Supports rule-based estimate (no network) and real Google Trends CSV data (user upload).

import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { KeywordItem, Settings, SearchSnapshot } from '../../types';
import { analyzeSeasonality } from '../../services/seasonality';
import { parseTrendsCsv, aggregateMonthlyAverages, splitByYear } from '../../services/trendsCsv';
import {
  getRecentSeasonalityKeywords,
  addRecentSeasonalityKeyword,
  getTrendsCsvData,
  saveTrendsCsvData,
  clearTrendsCsvData,
  type ParsedTrendsSeries,
} from '../../storage/seasonality';
import { buildTrendsUrl } from '../../services/trends';

interface SeasonalityTabProps {
  initialQuery: string;
  snapshot?: SearchSnapshot | null;
  settings: Settings;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const INTENSITY_COLORS: Record<string, string> = {
  Peak: 'var(--good)',
  High: 'var(--good)',
  Med: 'var(--warn)',
  Low: 'var(--muted)',
};

const STRATEGY_TEXT: Record<string, string> = {
  evergreen:
    'Launch any time — this niche sells consistently year-round. Focus on keywords, cover, and early review generation. No seasonal deadline pressure.',
  holiday_spike:
    'Publish 2-3 months before the peak so Amazon has time to index your book and you can collect early reviews. Finish your content and cover at least 6 weeks before launch. Missing the window by even a month significantly reduces peak-season visibility.',
  seasonal_wave:
    'Target the early buildup period. Publish 6-8 weeks before searches start rising. Use PPC to accelerate early sales and index momentum. A late launch still sells but misses the peak.',
  annual_event:
    'This niche has a tight annual window. Plan your entire production schedule backwards from the event date. Aim to go live 45-60 days before the event for maximum organic reach.',
};

export const SeasonalityTab: React.FC<SeasonalityTabProps> = ({
  initialQuery,
  snapshot,
  settings,
}) => {
  const [keyword, setKeyword] = useState(initialQuery);
  const [activeKeyword, setActiveKeyword] = useState(initialQuery);
  const [recentKeywords, setRecentKeywords] = useState<string[]>([]);
  const [csvSeries, setCsvSeries] = useState<ParsedTrendsSeries | null>(null);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showSignals, setShowSignals] = useState(false);
  const [copyDone, setCopyDone] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const geo = settings.trends?.geo || 'US';

  // Load recent keywords on mount
  useEffect(() => {
    getRecentSeasonalityKeywords().then(setRecentKeywords);
  }, []);

  // Load stored CSV data when active keyword changes
  useEffect(() => {
    if (!activeKeyword) return;
    getTrendsCsvData(activeKeyword, geo).then((stored) => {
      setCsvSeries(stored);
      setCsvError(null);
    });
  }, [activeKeyword, geo]);

  // Sync initial query when snapshot changes
  useEffect(() => {
    if (initialQuery && !keyword) {
      setKeyword(initialQuery);
      setActiveKeyword(initialQuery);
    }
  }, [initialQuery]);

  const runCheck = useCallback(async (kw: string) => {
    const trimmed = kw.trim();
    if (!trimmed) return;
    setActiveKeyword(trimmed);
    await addRecentSeasonalityKeyword(trimmed);
    const updated = await getRecentSeasonalityKeywords();
    setRecentKeywords(updated);
    // Load CSV data for this keyword
    const stored = await getTrendsCsvData(trimmed, geo);
    setCsvSeries(stored);
    setCsvError(null);
  }, [geo]);

  const handleCheckClick = () => runCheck(keyword);
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') runCheck(keyword);
  };

  // Find top keyword from Keywords tab
  const topKeyword = (snapshot?.keywords || [])
    .slice()
    .sort((a, b) => (b.totalScore ?? 0) - (a.totalScore ?? 0))[0]?.keyword ?? '';

  const handleUseTopKeyword = () => {
    if (topKeyword) {
      setKeyword(topKeyword);
      runCheck(topKeyword);
    }
  };

  // CSV file parsing
  const handleCsvFile = async (file: File) => {
    setCsvError(null);
    const text = await file.text();
    const result = parseTrendsCsv(text, activeKeyword, geo);
    if (!result.ok) {
      setCsvError(result.error);
      return;
    }
    await saveTrendsCsvData(result.series);
    setCsvSeries(result.series);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleCsvFile(file);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleCsvFile(file);
  };

  const handleClearCsv = async () => {
    await clearTrendsCsvData(activeKeyword, geo);
    setCsvSeries(null);
    setCsvError(null);
  };

  // Compute the seasonality report (rule-based or from CSV data)
  const report = analyzeSeasonality({
    query: activeKeyword,
    books: snapshot?.books || [],
    keywords: snapshot?.keywords || [],
    geo,
  });

  // If real CSV data exists, override the monthly heatmap with calculated averages
  const csvMonthlyAverages = csvSeries ? aggregateMonthlyAverages(csvSeries) : null;
  const csvYearData = csvSeries ? splitByYear(csvSeries) : null;

  // Determine mode label
  const modeLabel = csvSeries
    ? `Real data (Google Trends, geo ${csvSeries.geo}, ${csvSeries.yearsOfData.toFixed(1)} years)`
    : 'Rule-based estimate from keyword text. Not real search data.';

  // Find peak month from CSV averages
  let csvPeakMonthLabel = '';
  if (csvMonthlyAverages) {
    const max = Math.max(...csvMonthlyAverages);
    const peakIdx = csvMonthlyAverages.indexOf(max);
    csvPeakMonthLabel = MONTH_NAMES[peakIdx] ?? '';
  }

  // Count in how many years the peak month is peak
  let csvPeakConsistency = '';
  if (csvYearData && csvPeakMonthLabel) {
    const peakIdx = MONTH_NAMES.indexOf(csvPeakMonthLabel);
    const years = Object.keys(csvYearData).map(Number);
    const peakYears = years.filter((yr) => {
      const vals = csvYearData[yr] || [];
      const max = Math.max(...vals);
      return (vals[peakIdx] ?? 0) === max || (vals[peakIdx] ?? 0) >= max * 0.85;
    });
    csvPeakConsistency = `Peak month is ${csvPeakMonthLabel} in ${peakYears.length} of ${years.length} years`;
  }

  // Confidence label
  const confidence =
    csvSeries === null
      ? 'Low (rule-based estimate)'
      : csvSeries.yearsOfData >= 3
      ? 'High (3+ years of real data)'
      : 'Medium (real data, limited years)';

  // Timing status text
  const timingText =
    report.launchUrgency === 'optimal_now'
      ? 'Optimal Launch Window NOW'
      : report.launchUrgency === 'anytime'
      ? 'Safe to launch any time'
      : report.launchUrgency === 'late'
      ? 'Peak already in progress — launch now with PPC or wait for next year'
      : 'Preparation window — start production now';

  const urgencyColor =
    report.launchUrgency === 'optimal_now' || report.launchUrgency === 'anytime'
      ? 'var(--good)'
      : report.launchUrgency === 'preparation'
      ? 'var(--warn)'
      : 'var(--bad)';

  // Copy summary
  const handleCopySummary = () => {
    const lines = [
      `Seasonality: ${activeKeyword}`,
      `Mode: ${modeLabel}`,
      `Type: ${report.typeLabel}`,
      `Primary event: ${report.primaryEvent || 'None'}`,
      `Peak months: ${csvPeakMonthLabel || report.peakMonths}`,
      `Launch window: ${report.recommendedLaunchWindow}`,
      `Timing: ${timingText}`,
      `Confidence: ${confidence}`,
      csvPeakConsistency ? csvPeakConsistency : '',
    ]
      .filter(Boolean)
      .join('\n');
    navigator.clipboard.writeText(lines).then(() => {
      setCopyDone(true);
      setTimeout(() => setCopyDone(false), 2000);
    });
  };

  // Heatmap row to display (prefer CSV data if available)
  const displayHeatmap = csvMonthlyAverages
    ? MONTH_NAMES.map((m, idx) => {
        const score = csvMonthlyAverages[idx] ?? 0;
        const max = Math.max(...csvMonthlyAverages, 1);
        let intensity: 'Low' | 'Med' | 'High' | 'Peak' = 'Low';
        const pct = score / max;
        if (pct >= 0.9) intensity = 'Peak';
        else if (pct >= 0.65) intensity = 'High';
        else if (pct >= 0.35) intensity = 'Med';
        return { month: m, score, intensity, monthIndex: idx };
      })
    : report.monthlyHeatmap;

  const trendsUrl = buildTrendsUrl(activeKeyword, geo) + '&date=today%205-y';

  return (
    <div className="p-2 space-y-3" style={{ color: 'var(--text)' }}>

      {/* ── INPUT AREA ── */}
      <div className="space-y-1.5 border border-[var(--line)] p-2">
        <div className="section-subheading">Check Keyword</div>

        <div className="flex gap-1 flex-wrap">
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type any keyword…"
            className="plain-input flex-1 min-w-0"
            style={{ minWidth: '120px' }}
          />
          <button onClick={handleCheckClick} className="plain-btn" disabled={!keyword.trim()}>
            Check
          </button>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          {topKeyword && (
            <button
              onClick={handleUseTopKeyword}
              className="plain-btn plain-btn-sm"
              title={`Fill with top keyword: "${topKeyword}"`}
            >
              Use top keyword: {topKeyword.slice(0, 30)}
            </button>
          )}

          {recentKeywords.length > 0 && (
            <select
              className="plain-select"
              style={{ fontSize: 'var(--font-small)' }}
              value=""
              onChange={(e) => {
                if (e.target.value) {
                  setKeyword(e.target.value);
                  runCheck(e.target.value);
                }
              }}
            >
              <option value="">Recent keywords…</option>
              {recentKeywords.map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {activeKeyword && (
        <>
          {/* ── HEADING LINE ── */}
          <div className="border border-[var(--line)] p-2 space-y-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="font-bold" style={{ fontSize: 'var(--font-heading)' }}>
                  {activeKeyword}
                </span>
                <span
                  className="ml-2 font-bold"
                  style={{ fontSize: 'var(--font-small)', color: report.type === 'evergreen' ? 'var(--good)' : 'var(--warn)' }}
                >
                  {report.typeLabel}
                </span>
              </div>
              <button onClick={handleCopySummary} className="plain-btn plain-btn-sm">
                {copyDone ? '✓ Copied' : 'Copy summary'}
              </button>
            </div>
            <div
              className="font-medium"
              style={{ fontSize: 'var(--font-small)', color: csvSeries ? 'var(--good)' : 'var(--muted)', fontStyle: 'italic' }}
            >
              {modeLabel}
            </div>
          </div>

          {/* ── KEY/VALUE TABLE ── */}
          <table className="plain-table">
            <tbody>
              <tr>
                <td className="font-medium" style={{ width: '40%' }}>Primary event</td>
                <td>{report.primaryEvent || 'None (all-season baseline)'}</td>
              </tr>
              <tr>
                <td className="font-medium">Peak months</td>
                <td style={{ fontFamily: 'var(--font-mono)' }}>
                  {csvPeakMonthLabel || report.peakMonths}
                </td>
              </tr>
              <tr>
                <td className="font-medium">Low months</td>
                <td style={{ fontSize: 'var(--font-small)', color: 'var(--muted)' }}>
                  {report.type === 'evergreen'
                    ? 'No significant low months'
                    : displayHeatmap
                        .filter((m) => m.intensity === 'Low')
                        .map((m) => m.month)
                        .join(', ') || '—'}
                </td>
              </tr>
              <tr>
                <td className="font-medium">Recommended launch</td>
                <td>{report.recommendedLaunchWindow}</td>
              </tr>
              <tr>
                <td className="font-medium">Timing now</td>
                <td className="font-bold" style={{ color: urgencyColor }}>
                  {timingText}
                </td>
              </tr>
              <tr>
                <td className="font-medium">Confidence</td>
                <td style={{ fontSize: 'var(--font-small)' }}>{confidence}</td>
              </tr>
              {csvPeakConsistency && (
                <tr>
                  <td className="font-medium">YoY consistency</td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--font-small)' }}>
                    {csvPeakConsistency}
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* ── 12-MONTH GRID ── */}
          <div className="space-y-1">
            <div className="section-subheading">12-Month Demand Grid</div>
            <div className="month-grid">
              {displayHeatmap.map((m) => (
                <div
                  key={m.month}
                  className="border border-[var(--line)] p-2 text-center"
                  title={`${m.month}: ${m.intensity} (score ${m.score}/100)`}
                >
                  <div className="font-bold" style={{ fontSize: 'var(--font-small)' }}>{m.month}</div>
                  <div className="font-bold" style={{ color: INTENSITY_COLORS[m.intensity] || 'var(--muted)' }}>
                    {m.intensity}
                  </div>
                  <div style={{ fontSize: 'var(--font-small)', color: 'var(--muted)' }}>{m.score}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ── YoY CHART (when real data exists) ── */}
          {csvYearData && Object.keys(csvYearData).length > 0 && (
            <div className="space-y-1">
              <div className="section-subheading">Year-over-Year Trends</div>
              {csvPeakConsistency && (
                <div style={{ fontSize: 'var(--font-small)', color: 'var(--muted)' }}>
                  {csvPeakConsistency}
                </div>
              )}
              <div className="overflow-x-auto border border-[var(--line)]">
                <table className="plain-table" style={{ minWidth: '420px' }}>
                  <thead>
                    <tr>
                      <th>Year</th>
                      {MONTH_NAMES.map((m) => (
                        <th key={m} className="text-center" style={{ width: '36px' }}>{m}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(csvYearData)
                      .sort(([a], [b]) => Number(b) - Number(a))
                      .map(([year, vals]) => {
                        const maxVal = Math.max(...(vals as number[]), 1);
                        return (
                          <tr key={year}>
                            <td className="font-bold" style={{ fontFamily: 'var(--font-mono)' }}>{year}</td>
                            {(vals as number[]).map((v, idx) => {
                              const pct = v / maxVal;
                              const color = pct >= 0.9 ? 'var(--good)' : pct >= 0.5 ? 'var(--warn)' : 'var(--muted)';
                              return (
                                <td key={idx} className="text-center" style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--font-small)', color }}>
                                  {v > 0 ? v : '—'}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── KDP STRATEGY BOX ── */}
          <div className="border border-[var(--line)] p-2 bg-[var(--table-head-bg)]">
            <div className="section-subheading mb-1">KDP Strategy</div>
            <div>{STRATEGY_TEXT[report.type] || STRATEGY_TEXT.evergreen}</div>
          </div>

          {/* ── WARNING for low data ── */}
          {csvSeries && csvSeries.yearsOfData < 2 && (
            <div className="border border-[var(--line)] p-2" style={{ borderColor: 'var(--warn)', color: 'var(--warn)' }}>
              ⚠ Only {csvSeries.yearsOfData.toFixed(1)} year(s) of data available. Confidence is limited. Consider using a wider date range in Google Trends.
            </div>
          )}

          {/* ── SIGNALS ── */}
          {report.signalsDetected.length > 0 && (
            <div style={{ fontSize: 'var(--font-small)' }}>
              <button
                className="plain-link"
                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                onClick={() => setShowSignals(!showSignals)}
              >
                {showSignals ? '▲ Hide' : '▼ Show'} detection signals ({report.signalsDetected.length})
              </button>
              {showSignals && (
                <ul className="mt-1 pl-4 list-disc space-y-0.5" style={{ color: 'var(--muted)' }}>
                  {report.signalsDetected.map((sig, i) => (
                    <li key={i}>{sig}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* ── GOOGLE TRENDS CSV SECTION ── */}
          <div className="border border-[var(--line)] p-2 space-y-2">
            <div className="section-subheading">Real Data (Google Trends CSV)</div>
            <div style={{ fontSize: 'var(--font-small)', color: 'var(--muted)' }}>
              For higher confidence, download the CSV from Google Trends and drop it here.
            </div>

            <div className="flex flex-wrap gap-2">
              <a
                href={trendsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="plain-btn"
                style={{ textDecoration: 'none' }}
              >
                Open Google Trends ↗
              </a>
              <button
                className="plain-btn"
                onClick={() => fileInputRef.current?.click()}
              >
                Upload CSV
              </button>
              {csvSeries && (
                <button className="plain-btn plain-btn-sm" onClick={handleClearCsv}>
                  Clear CSV data
                </button>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={handleFileInputChange}
            />

            {/* Drag-drop zone */}
            <div
              className="border-2 border-dashed p-4 text-center"
              style={{
                borderColor: isDragOver ? 'var(--text)' : 'var(--line)',
                background: isDragOver ? 'var(--row-hover)' : 'transparent',
                cursor: 'pointer',
                fontSize: 'var(--font-small)',
                color: 'var(--muted)',
              }}
              onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              {csvSeries
                ? `✓ Loaded: ${csvSeries.startDate} → ${csvSeries.endDate} (${csvSeries.dates.length} data points, ${csvSeries.yearsOfData.toFixed(1)} years)`
                : 'Drop the Interest over time CSV here (or click to browse)'}
            </div>

            {csvError && (
              <div className="border border-[var(--line)] p-2" style={{ color: 'var(--bad)' }}>
                ✗ {csvError}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
