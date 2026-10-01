import React, { useState } from 'react';
import type { BookIdea } from '../types';
import { TrendsLink } from './TrendsLink';

interface IdeaCardProps {
  idea: BookIdea;
  isSaved?: boolean;
  onSave?: (idea: BookIdea) => void;
  onRemove?: (idea: BookIdea) => void;
  geo?: string;
}

export const IdeaCard: React.FC<IdeaCardProps> = ({
  idea,
  isSaved = false,
  onSave,
  onRemove,
  geo = 'US',
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [copiedAction, setCopiedAction] = useState<string | null>(null);

  const showCopyToast = (label: string) => {
    setCopiedAction(label);
    setTimeout(() => setCopiedAction(null), 2000);
  };

  const handleCopyTitle = (e: React.MouseEvent) => {
    e.stopPropagation();
    const full = idea.subtitle ? `${idea.title}: ${idea.subtitle}` : idea.title;
    navigator.clipboard.writeText(full);
    showCopyToast('title');
  };

  const handleCopyKeywords = (e: React.MouseEvent) => {
    e.stopPropagation();
    const kwText = (idea.sevenBackendKeywords || []).join('\n');
    navigator.clipboard.writeText(kwText);
    showCopyToast('keywords');
  };

  const handleCopyDescription = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(idea.shortDescription);
    showCopyToast('description');
  };

  const handleCopyAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    const fullSummary = [
      `TITLE: ${idea.title}`,
      `SUBTITLE: ${idea.subtitle}`,
      `SUB-NICHE: ${idea.subNiche}`,
      `TARGET AUDIENCE: ${idea.targetAudience}`,
      `PRICE: $${idea.priceSuggestion?.toFixed(2)} | PAGES: ${idea.pageCount} | TRIM: ${idea.trimSize}`,
      `DIFFICULTY: ${idea.estimatedDifficulty}/10`,
      `DIFFERENTIATION: ${idea.differentiationAngle}`,
      '',
      `7 BACKEND KEYWORDS:`,
      ...(idea.sevenBackendKeywords || []).map((k, i) => `  ${i + 1}. ${k}`),
      '',
      `3 CATEGORIES:`,
      ...(idea.threeCategories || []).map((c, i) => `  ${i + 1}. ${c}`),
      '',
      `DESCRIPTION:`,
      idea.shortDescription,
      '',
      `CONTENT PLAN:`,
      idea.contentPlan,
      '',
      `WHY IT COULD WORK:`,
      idea.whyItCouldWork,
      `RISKS:`,
      idea.risks,
    ].join('\n');

    navigator.clipboard.writeText(fullSummary);
    showCopyToast('all');
  };

  const diff = idea.estimatedDifficulty || 5;

  return (
    <div className="border border-[var(--line)] bg-[var(--bg)] p-2 space-y-2 text-[13px] leading-[1.4] no-horizontal-scroll">
      {/* Header / Summary */}
      <div className="space-y-1.5">
        <div className="flex items-start justify-between gap-1 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap text-xs">
              <span
                className={`font-bold ${
                  diff <= 3
                    ? 'text-[var(--good)]'
                    : diff <= 6
                    ? 'text-[var(--warn)]'
                    : 'text-[var(--bad)]'
                }`}
                title={`Difficulty: ${diff}/10`}
              >
                Difficulty {diff}/10
              </span>
              <span>|</span>
              <span className="font-semibold">{idea.subNiche}</span>
              <span>|</span>
              <span className="text-[var(--muted)]">{idea.targetAudience}</span>
              <TrendsLink keyword={idea.subNiche || idea.title} geo={geo} />
            </div>

            <div className="font-bold text-xs mt-1">
              {idea.title}
            </div>
            {idea.subtitle && (
              <div className="text-xs text-[var(--muted)]">
                {idea.subtitle}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1 shrink-0 flex-wrap">
            {onSave && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onSave(idea);
                }}
                className={`plain-btn text-[11px] px-1.5 py-0.5 ${isSaved ? 'font-bold' : ''}`}
                title={isSaved ? 'Idea Saved' : 'Save Idea to Library'}
              >
                {isSaved ? 'Saved' : 'Save'}
              </button>
            )}

            <button
              onClick={handleCopyTitle}
              className="plain-btn text-[11px] px-1.5 py-0.5"
              title="Copy Title"
            >
              {copiedAction === 'title' ? 'Copied' : 'Title'}
            </button>

            <button
              onClick={handleCopyAll}
              className="plain-btn text-[11px] px-1.5 py-0.5"
              title="Copy All Details"
            >
              {copiedAction === 'all' ? 'Copied' : 'All'}
            </button>

            {onRemove && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(idea);
                }}
                className="plain-btn text-[11px] px-1.5 py-0.5"
                title="Delete Idea"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Quick Specs Row */}
        <div className="text-xs text-[var(--muted)] font-mono pt-1 border-t border-[var(--line)] flex items-center gap-1.5 flex-wrap">
          <span>{idea.trimSize}</span>
          <span>|</span>
          <span>{idea.pageCount}p</span>
          <span>|</span>
          <span className="font-bold text-[var(--good)]">${idea.priceSuggestion?.toFixed(2)}</span>
          <span>|</span>
          <span className="font-sans">Angle: {idea.differentiationAngle}</span>
        </div>

        {/* Warnings from ideaScoring */}
        {idea.warnings && idea.warnings.length > 0 && (
          <div className="text-xs text-[var(--warn)] pt-0.5">
            Warnings: {idea.warnings.join(', ')}
          </div>
        )}

        {/* Toggle details button */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="plain-btn w-full text-xs py-0.5 font-bold"
        >
          {isExpanded ? 'Hide Details ▲' : 'Show 7 Keywords, Categories & Plan ▼'}
        </button>
      </div>

      {/* Expandable Sections */}
      {isExpanded && (
        <div className="pt-2 border-t border-[var(--line)] space-y-2 text-xs">
          {/* 7 Backend Keywords */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-bold">7 KDP Backend Keywords</span>
              <button
                onClick={handleCopyKeywords}
                className="plain-link text-xs"
              >
                {copiedAction === 'keywords' ? 'Copied' : 'Copy 7 slots'}
              </button>
            </div>
            <table className="plain-table w-full text-xs">
              <thead>
                <tr>
                  <th className="w-12">Slot</th>
                  <th>Keyword</th>
                  <th className="w-16 text-right">Chars</th>
                </tr>
              </thead>
              <tbody>
                {(idea.sevenBackendKeywords || []).map((kw, i) => (
                  <tr key={i}>
                    <td className="text-center font-mono">#{i + 1}</td>
                    <td className="font-mono">{kw}</td>
                    <td className="text-right font-mono text-[var(--muted)]">{kw.length}/50</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 3 Categories */}
          <div className="space-y-1">
            <span className="font-bold">3 Suggested Category Paths</span>
            <div className="border border-[var(--line)] p-1.5 space-y-0.5">
              {(idea.threeCategories || []).map((cat, i) => (
                <div key={i} className="text-xs">
                  <strong>{i + 1}.</strong> {cat}
                </div>
              ))}
            </div>
          </div>

          {/* Short Description */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-bold">Book Description</span>
              <button
                onClick={handleCopyDescription}
                className="plain-link text-xs"
              >
                {copiedAction === 'description' ? 'Copied' : 'Copy'}
              </button>
            </div>
            <div className="border border-[var(--line)] p-1.5 text-xs text-[var(--muted)]">
              {idea.shortDescription}
            </div>
          </div>

          {/* Content Plan */}
          <div className="space-y-1">
            <span className="font-bold">Interior Content Plan &amp; Layout</span>
            <div className="border border-[var(--line)] p-1.5 text-xs text-[var(--muted)]">
              {idea.contentPlan}
            </div>
          </div>

          {/* Why It Could Work & Risks */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div className="border border-[var(--line)] p-1.5">
              <span className="font-bold text-[var(--good)] block mb-0.5">Why It Could Work</span>
              <div className="text-[var(--muted)]">{idea.whyItCouldWork}</div>
            </div>
            <div className="border border-[var(--line)] p-1.5">
              <span className="font-bold text-[var(--bad)] block mb-0.5">Potential Risks</span>
              <div className="text-[var(--muted)]">{idea.risks}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
