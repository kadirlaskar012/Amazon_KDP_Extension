// src/components/SeasonalityPredictor.tsx
// Plain utilitarian UI component for Seasonality & Holiday Trend Predictor

import React, { useState } from 'react';
import type { SeasonalityReport } from '../types';

interface SeasonalityPredictorProps {
  report: SeasonalityReport;
}

export const SeasonalityPredictor: React.FC<SeasonalityPredictorProps> = ({ report }) => {
  const [showSignals, setShowSignals] = useState(false);

  // Status color for urgency
  const urgencyColor =
    report.launchUrgency === 'optimal_now' || report.launchUrgency === 'anytime'
      ? 'var(--good)'
      : report.launchUrgency === 'preparation'
      ? 'var(--warn)'
      : 'var(--bad)';

  return (
    <div
      className="border p-2 space-y-2 text-[13px] leading-[1.4]"
      style={{
        borderColor: 'var(--line)',
        background: 'var(--bg)',
        color: 'var(--text)',
        borderRadius: '2px',
      }}
    >
      {/* Title & Type Header */}
      <div className="flex items-center justify-between pb-1 border-b" style={{ borderColor: 'var(--line)' }}>
        <div>
          <span className="font-bold">Seasonality & Holiday Predictor</span>
          <span
            className="ml-2 font-bold text-xs"
            style={{
              color: report.type === 'evergreen' ? 'var(--good)' : 'var(--warn)',
            }}
          >
            {report.typeLabel}
          </span>
        </div>

        <a
          href={report.trendsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="plain-link text-xs whitespace-nowrap"
          title="Verify 5-year historical search seasonality on Google Trends"
        >
          Verify 5Y Trends
        </a>
      </div>

      {/* 2-Column Key Seasonality Facts */}
      <table className="plain-table" style={{ width: '100%' }}>
        <tbody>
          <tr>
            <td className="font-medium" style={{ width: '38%' }}>Primary Event:</td>
            <td>{report.primaryEvent || 'None (All-Season Baseline)'}</td>
          </tr>
          <tr>
            <td className="font-medium">Peak Demand:</td>
            <td className="font-mono font-medium">{report.peakMonths}</td>
          </tr>
          <tr>
            <td className="font-medium">Recommended Launch:</td>
            <td>{report.recommendedLaunchWindow}</td>
          </tr>
          <tr>
            <td className="font-medium">Timing Status:</td>
            <td style={{ color: urgencyColor, fontWeight: 'bold' }}>
              {report.launchUrgency === 'optimal_now'
                ? 'Optimal Launch Window NOW'
                : report.launchUrgency === 'anytime'
                ? 'Year-Round Safe'
                : report.launchUrgency === 'preparation'
                ? 'Preparation & Formatting Window'
                : 'Active Peak Season In Progress'}
            </td>
          </tr>
        </tbody>
      </table>

      {/* 12-Month Projected Demand Heatmap */}
      <div>
        <div className="font-medium text-xs mb-1" style={{ color: 'var(--muted)' }}>
          12-Month Projected Demand Trajectory:
        </div>
        <div className="overflow-x-auto border" style={{ borderColor: 'var(--line)', borderRadius: '2px' }}>
          <table className="plain-table" style={{ width: '100%', textAlign: 'center', fontSize: '11px' }}>
            <thead>
              <tr>
                {report.monthlyHeatmap.map((m) => (
                  <th key={m.month} style={{ padding: '2px 4px', textAlign: 'center' }}>
                    {m.month}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                {report.monthlyHeatmap.map((m) => {
                  const textColor =
                    m.intensity === 'Peak'
                      ? 'var(--good)'
                      : m.intensity === 'High'
                      ? 'var(--good)'
                      : m.intensity === 'Med'
                      ? 'var(--warn)'
                      : 'var(--muted)';

                  return (
                    <td
                      key={m.month}
                      style={{
                        padding: '3px 2px',
                        textAlign: 'center',
                        fontWeight: m.intensity === 'Peak' ? 'bold' : 'normal',
                        color: textColor,
                      }}
                      title={`${m.month}: ${m.intensity} (${m.score}/100)`}
                    >
                      {m.intensity}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Actionable Urgency Advice */}
      <div
        className="p-1.5 text-xs border"
        style={{
          borderColor: 'var(--line)',
          background: 'var(--table-head-bg)',
          borderRadius: '2px',
        }}
      >
        <strong>KDP Strategy:</strong> {report.urgencyAdvice}
      </div>

      {/* Signals Toggle */}
      {report.signalsDetected && report.signalsDetected.length > 0 && (
        <div className="text-xs">
          <button
            onClick={() => setShowSignals(!showSignals)}
            className="plain-link text-xs"
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
          >
            {showSignals ? 'Hide Detection Signals (▲)' : `Show Detection Signals (${report.signalsDetected.length}) (▼)`}
          </button>
          {showSignals && (
            <ul className="mt-1 pl-4 list-disc space-y-0.5" style={{ color: 'var(--muted)' }}>
              {report.signalsDetected.map((sig, idx) => (
                <li key={idx}>{sig}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};
