// src/components/BsrChart.tsx
// Recharts LineChart for BSR history with reversed Y-axis, log scale toggle, and review count overlay
// Fully responsive with Light/Dark mode support and clean typography

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
import { TrendingDown, TrendingUp, BarChart2 } from 'lucide-react';

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
          displayDate: h.date.length > 5 ? h.date.slice(5) : h.date, // "MM-DD"
          bsr: bsrVal,
          price: h.price,
          reviewCount: h.reviewCount,
          rating: h.rating,
        };
      });
  }, [history]);

  if (chartData.length === 0) {
    return (
      <div className={`flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-6 text-center text-slate-500 dark:text-slate-400 text-xs ${className}`}>
        <BarChart2 className="w-6 h-6 text-slate-400 mb-2 opacity-60" />
        <span className="font-semibold text-slate-700 dark:text-slate-300">No BSR history points recorded yet</span>
        <span className="text-[11px] text-slate-500 mt-1">History accumulates during daily automated background checks.</span>
      </div>
    );
  }

  // Calculate domains
  const bsrValues = chartData.map((d) => d.bsr);
  const minBsr = Math.min(...bsrValues);
  const maxBsr = Math.max(...bsrValues);

  return (
    <div className={`space-y-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-3 shadow-xs ${className}`}>
      {/* Controls Header */}
      <div className="flex items-center justify-between text-xs pb-1.5 border-b border-slate-100 dark:border-slate-800 flex-wrap gap-2">
        <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
          <BarChart2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
          BSR Trajectory
        </span>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1 cursor-pointer text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 text-xs">
            <input
              type="checkbox"
              checked={useLogScale}
              onChange={(e) => setUseLogScale(e.target.checked)}
              className="rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-indigo-600 focus:ring-0 w-3 h-3"
            />
            <span>Log scale</span>
          </label>
          <label className="flex items-center gap-1 cursor-pointer text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 text-xs">
            <input
              type="checkbox"
              checked={showReviewsLine}
              onChange={(e) => setShowReviewsLine(e.target.checked)}
              className="rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-emerald-600 focus:ring-0 w-3 h-3"
            />
            <span>Reviews</span>
          </label>
        </div>
      </div>

      {/* Chart Canvas */}
      <div style={{ width: '100%', height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 8, right: 10, left: -15, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" opacity={0.2} />
            <XAxis
              dataKey="displayDate"
              tick={{ fontSize: 10, fill: '#64748b' }}
              stroke="#cbd5e1"
            />
            {/* Primary Y-Axis: BSR reversed (lower BSR at top) */}
            <YAxis
              yAxisId="bsr"
              reversed={true}
              scale={useLogScale ? 'log' : 'auto'}
              domain={useLogScale ? ['auto', 'auto'] : [Math.max(1, Math.floor(minBsr * 0.8)), Math.ceil(maxBsr * 1.2)]}
              tick={{ fontSize: 10, fill: '#6366f1' }}
              stroke="#6366f1"
              tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`)}
            />

            {/* Optional Secondary Y-Axis: Reviews */}
            {showReviewsLine && (
              <YAxis
                yAxisId="reviews"
                orientation="right"
                stroke="#10b981"
                tick={{ fontSize: 10, fill: '#10b981' }}
                tickFormatter={(v: number) => `${v}`}
              />
            )}

            <Tooltip
              contentStyle={{
                backgroundColor: '#0f172a',
                borderColor: '#334155',
                borderRadius: '8px',
                fontSize: '11px',
                color: '#fff',
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
              stroke="#4f46e5"
              strokeWidth={2.5}
              dot={{ r: 3, fill: '#6366f1' }}
              activeDot={{ r: 5, fill: '#4338ca' }}
            />

            {/* Review count line */}
            {showReviewsLine && (
              <Line
                yAxisId="reviews"
                type="monotone"
                dataKey="reviewCount"
                stroke="#10b981"
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={false}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="flex justify-between items-center text-[10px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800">
        <span className="flex items-center gap-1 font-medium">
          <TrendingUp className="w-3 h-3 text-emerald-500" />
          Lower BSR = Higher Sales Rank
        </span>
        <span className="font-mono">{chartData.length} check(s) recorded</span>
      </div>
    </div>
  );
};
