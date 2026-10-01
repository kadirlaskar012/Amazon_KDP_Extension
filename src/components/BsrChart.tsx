// src/components/BsrChart.tsx
// Plain utilitarian LineChart for BSR history with log scale toggle and review count overlay
import React, { useState, useMemo, useRef, useEffect } from 'react';
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
  height = 160,
  className = '',
}) => {
  const [useLogScale, setUseLogScale] = useState<boolean>(false);
  const [showReviewsLine, setShowReviewsLine] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState<boolean>(false);

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

  // Ensure chart only measures and renders when the parent container has positive dimensions
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const checkSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          setIsReady(true);
          return true;
        }
      }
      return false;
    };

    if (checkSize()) return;

    if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
            setIsReady(true);
            observer.disconnect();
          }
        }
      });
      observer.observe(containerRef.current);
      return () => observer.disconnect();
    } else {
      const timer = setTimeout(() => setIsReady(true), 50);
      return () => clearTimeout(timer);
    }
  }, []);

  if (chartData.length === 0) {
    return (
      <div className={`p-3 border border-[var(--line)] text-center text-xs text-[var(--muted)] ${className}`}>
        No BSR history points recorded yet. History accumulates during daily background checks.
      </div>
    );
  }

  // Calculate domains
  const bsrValues = chartData.map((d) => d.bsr);
  const minBsr = Math.min(...bsrValues);
  const maxBsr = Math.max(...bsrValues);

  return (
    <div className={`space-y-1.5 border border-[var(--line)] bg-[var(--bg)] p-2 text-xs ${className}`}>
      {/* Controls Header */}
      <div className="flex items-center justify-between text-xs pb-1 border-b border-[var(--line)] flex-wrap gap-2">
        <span className="font-bold text-[var(--text)]">
          BSR Trajectory
        </span>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1 cursor-pointer text-[var(--muted)] text-xs">
            <input
              type="checkbox"
              checked={useLogScale}
              onChange={(e) => setUseLogScale(e.target.checked)}
              className="w-3 h-3"
            />
            <span>Log scale</span>
          </label>
          <label className="flex items-center gap-1 cursor-pointer text-[var(--muted)] text-xs">
            <input
              type="checkbox"
              checked={showReviewsLine}
              onChange={(e) => setShowReviewsLine(e.target.checked)}
              className="w-3 h-3"
            />
            <span>Reviews</span>
          </label>
        </div>
      </div>

      {/* Chart Canvas with explicit CSS height and layout safety fallback */}
      <div
        ref={containerRef}
        style={{ width: '100%', height: `${height}px`, minHeight: `${height}px` }}
        className="relative w-full overflow-hidden"
      >
        {!isReady ? (
          <div
            style={{ width: '100%', height: `${height}px` }}
            className="flex items-center justify-center text-xs text-[var(--muted)]"
          />
        ) : (
          <ResponsiveContainer
            width="100%"
            height={height}
            minWidth={200}
            minHeight={height}
            initialDimension={{ width: 340, height }}
          >
            <LineChart data={chartData} margin={{ top: 8, right: 10, left: -15, bottom: 0 }}>
            <CartesianGrid strokeDasharray="2 2" stroke="#cccccc" opacity={0.5} />
            <XAxis
              dataKey="displayDate"
              tick={{ fontSize: 10, fill: '#555555' }}
              stroke="#cccccc"
            />
            {/* Primary Y-Axis: BSR reversed (lower BSR at top) */}
            <YAxis
              yAxisId="bsr"
              reversed={true}
              scale={useLogScale ? 'log' : 'auto'}
              domain={useLogScale ? ['auto', 'auto'] : [Math.max(1, Math.floor(minBsr * 0.8)), Math.ceil(maxBsr * 1.2)]}
              tick={{ fontSize: 10, fill: '#111111' }}
              stroke="#cccccc"
              tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`)}
            />

            {/* Optional Secondary Y-Axis: Reviews */}
            {showReviewsLine && (
              <YAxis
                yAxisId="reviews"
                orientation="right"
                domain={['auto', 'auto']}
                tick={{ fontSize: 10, fill: '#1a7f37' }}
                stroke="#cccccc"
              />
            )}

            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--bg)',
                borderColor: 'var(--line)',
                borderRadius: '0px',
                fontSize: '11px',
                color: 'var(--text)',
                boxShadow: 'none',
              }}
              formatter={(val: any, name: any) => [
                name === 'bsr' ? `#${Number(val).toLocaleString()}` : val,
                name === 'bsr' ? 'BSR' : name === 'reviewCount' ? 'Reviews' : name,
              ]}
              labelFormatter={(label) => `Date: ${label}`}
            />

            <Line
              yAxisId="bsr"
              type="monotone"
              dataKey="bsr"
              stroke="#111111"
              strokeWidth={1.5}
              dot={{ r: 2, fill: '#111111' }}
              activeDot={{ r: 4 }}
              isAnimationActive={false}
            />

            {showReviewsLine && (
              <Line
                yAxisId="reviews"
                type="monotone"
                dataKey="reviewCount"
                stroke="#1a7f37"
                strokeWidth={1.5}
                strokeDasharray="3 3"
                dot={{ r: 2, fill: '#1a7f37' }}
                isAnimationActive={false}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};
