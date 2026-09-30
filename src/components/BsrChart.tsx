// src/components/BsrChart.tsx
// Recharts LineChart for BSR history with reversed Y-axis, log scale toggle, and review count overlay

import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import type { HistoryPoint } from '../types';

interface BsrChartProps {
  history: HistoryPoint[];
  height?: number;
  className?: string;
}

export const BsrChart: React.FC<BsrChartProps> = ({
  history,
  height = 180,
  className = '',
}) => {
  const [useLogScale, setUseLogScale] = useState<boolean>(false);
  const [showReviewsLine, setShowReviewsLine] = useState<boolean>(false);

  // Format chart data points
  const chartData = useMemo(() => {
    if (!history || history.length === 0) return [];
    return history
      .filter((h) => typeof (h.bsrOverall ?? h.bsr) === 'number' && (h.bsrOverall ?? h.bsr)! > 0)
      .map((h) => {
        const bsrVal = (h.bsrOverall ?? h.bsr)!;
        return {
          date: h.date,
          displayDate: h.date.slice(5), // "MM-DD"
          bsr: bsrVal,
          price: h.price,
          reviewCount: h.reviewCount,
          rating: h.rating,
        };
      });
  }, [history]);

  if (chartData.length === 0) {
    return (
      <div className={`flex items-center justify-center rounded-lg border border-dashed border-slate-800 p-6 text-center text-slate-500 text-xs ${className}`}>
        No BSR history points recorded yet. History accumulates during daily checks.
      </div>
    );
  }

  // Calculate domains
  const bsrValues = chartData.map((d) => d.bsr);
  const minBsr = Math.min(...bsrValues);
  const maxBsr = Math.max(...bsrValues);

  return (
    <div className={`space-y-2 rounded-xl border border-slate-800 bg-slate-950 p-3 shadow-lg ${className}`}>
      {/* Controls Header */}
      <div className="flex items-center justify-between text-[11px] pb-1 border-b border-slate-800/80">
        <span className="font-semibold text-white">BSR Trajectory</span>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 cursor-pointer text-slate-400 hover:text-slate-200">
            <input
              type="checkbox"
              checked={useLogScale}
              onChange={(e) => setUseLogScale(e.target.checked)}
              className="rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-0 w-3 h-3"
            />
            <span className="text-[10px]">Log scale</span>
          </label>
          <label className="flex items-center gap-1 cursor-pointer text-slate-400 hover:text-slate-200">
            <input
              type="checkbox"
              checked={showReviewsLine}
              onChange={(e) => setShowReviewsLine(e.target.checked)}
              className="rounded border-slate-700 bg-slate-900 text-emerald-600 focus:ring-0 w-3 h-3"
            />
            <span className="text-[10px]">Reviews line</span>
          </label>
        </div>
      </div>

      {/* Chart Canvas */}
      <div style={{ width: '100%', height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 8, right: 10, left: -15, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.6} />
            <XAxis
              dataKey="displayDate"
              tick={{ fontSize: 9, fill: '#64748b' }}
              stroke="#334155"
            />
            {/* Primary Y-Axis: BSR reversed (lower BSR at top) */}
            <YAxis
              yAxisId="bsr"
              reversed={true}
              scale={useLogScale ? 'log' : 'auto'}
              domain={useLogScale ? ['auto', 'auto'] : [Math.max(1, Math.floor(minBsr * 0.8)), Math.ceil(maxBsr * 1.2)]}
              tick={{ fontSize: 9, fill: '#818cf8' }}
              stroke="#4338ca"
              tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`)}
            />

            {/* Optional Secondary Y-Axis: Reviews */}
            {showReviewsLine && (
              <YAxis
                yAxisId="reviews"
                orientation="right"
                stroke="#10b981"
                tick={{ fontSize: 9, fill: '#34d399' }}
                tickFormatter={(v: number) => `${v}`}
              />
            )}

            <Tooltip
              contentStyle={{
                backgroundColor: '#090d16',
                borderColor: '#1e293b',
                borderRadius: '8px',
                fontSize: '11px',
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
              }}
              formatter={(value: any, name: any) => {
                if (name === 'bsr') return [`#${Number(value).toLocaleString()}`, 'BSR Rank'];
                if (name === 'reviewCount') return [Number(value).toLocaleString(), 'Reviews'];
                return [value, name];
              }}
              labelFormatter={(label: any) => `Date: ${label}`}
            />

            {/* BSR Line */}
            <Line
              yAxisId="bsr"
              type="monotone"
              dataKey="bsr"
              stroke="#6366f1"
              strokeWidth={2}
              dot={{ r: 2.5, fill: '#818cf8' }}
              activeDot={{ r: 5, fill: '#a5b4fc' }}
            />

            {/* Review count line */}
            {showReviewsLine && (
              <Line
                yAxisId="reviews"
                type="monotone"
                dataKey="reviewCount"
                stroke="#10b981"
                strokeWidth={1.5}
                strokeDasharray="4 4"
                dot={false}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="flex justify-between text-[9px] text-slate-500 pt-1">
        <span>↑ Top = Better BSR (Reversed Axis)</span>
        <span>{chartData.length} recorded daily check(s)</span>
      </div>
    </div>
  );
};
