// src/components/IdeaCard.tsx
// Rich display card for an AI-generated KDP book idea with expandable sections, warnings, and copy actions

import React, { useState } from 'react';
import type { BookIdea } from '../types';
import { TrendsLink } from './TrendsLink';
import {
  Bookmark,
  BookmarkCheck,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Trash2,
  Layers,
  Tag,
  BookOpen,
} from 'lucide-react';

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

  // Difficulty badge color
  const diff = idea.estimatedDifficulty || 5;
  const diffBadgeColor =
    diff <= 3
      ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30'
      : diff <= 6
      ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/30'
      : 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-500/30';

  return (
    <div
      className={`rounded-xl border transition-all no-horizontal-scroll ${
        isExpanded
          ? 'border-indigo-400 dark:border-indigo-500/50 bg-white dark:bg-slate-900 shadow-md'
          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs hover:border-slate-300 dark:hover:border-slate-700'
      }`}
    >
      {/* Header / Summary */}
      <div className="p-3.5 space-y-2.5">
        <div className="flex items-start justify-between gap-2.5">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
              <span
                className={`text-xs font-bold px-2 py-0.5 rounded-full border ${diffBadgeColor}`}
                title={`Estimated Competition & Production Difficulty: ${diff}/10`}
              >
                Difficulty {diff}/10
              </span>

              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/20">
                {idea.subNiche}
              </span>

              <span className="text-xs text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                {idea.targetAudience}
              </span>

              <TrendsLink keyword={idea.subNiche || idea.title} geo={geo} />
            </div>

            <h4 className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm leading-snug">
              {idea.title}
            </h4>
            {idea.subtitle && (
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-normal mt-0.5">
                {idea.subtitle}
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1 shrink-0">
            {onSave && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onSave(idea);
                }}
                className={`p-1.5 rounded-lg border transition cursor-pointer ${
                  isSaved
                    ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-500/30'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:text-slate-900 dark:hover:text-white'
                }`}
                title={isSaved ? 'Idea Saved' : 'Save Idea to Library'}
              >
                {isSaved ? <BookmarkCheck className="w-3.5 h-3.5" /> : <Bookmark className="w-3.5 h-3.5" />}
              </button>
            )}

            <button
              onClick={handleCopyTitle}
              className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
              title="Copy Title & Subtitle"
            >
              {copiedAction === 'title' ? (
                <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>

            <button
              onClick={handleCopyAll}
              className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
              title="Copy All Details as Text"
            >
              {copiedAction === 'all' ? (
                <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>

            {onRemove && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(idea);
                }}
                className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700 hover:text-rose-600 dark:hover:text-rose-400 transition cursor-pointer"
                title="Delete Idea"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Quick Specs Pill Row */}
        <div className="flex items-center gap-2.5 text-xs text-slate-600 dark:text-slate-400 font-mono pt-1.5 border-t border-slate-150 dark:border-slate-800 flex-wrap">
          <span className="font-semibold">{idea.trimSize}</span>
          <span>•</span>
          <span>{idea.pageCount} pages</span>
          <span>•</span>
          <span className="text-emerald-600 dark:text-emerald-400 font-bold">${idea.priceSuggestion?.toFixed(2)}</span>
          <span>•</span>
          <span className="text-slate-700 dark:text-slate-300 font-sans" title={idea.differentiationAngle}>
            Angle: {idea.differentiationAngle}
          </span>
        </div>

        {/* Orange Warning Badges from ideaScoring */}
        {idea.warnings && idea.warnings.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {idea.warnings.map((w, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 rounded-md bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:text-amber-300"
              >
                <AlertTriangle className="w-3 h-3 text-amber-500" />
                <span>{w}</span>
              </span>
            ))}
          </div>
        )}

        {/* Toggle details button */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full pt-1.5 flex items-center justify-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-semibold cursor-pointer"
        >
          <span>{isExpanded ? 'Hide Full Plan' : 'Show 7 Keywords, Categories & Plan'}</span>
          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Expandable Sections */}
      {isExpanded && (
        <div className="p-3.5 border-t border-slate-200 dark:border-slate-800 space-y-3 bg-slate-50 dark:bg-slate-950/60 text-xs">
          {/* 7 Backend Keywords */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1">
                <Tag className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                7 KDP Backend Keywords
              </span>
              <button
                onClick={handleCopyKeywords}
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-medium cursor-pointer"
              >
                {copiedAction === 'keywords' ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-500" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy 7 slots</span>
                  </>
                )}
              </button>
            </div>
            <div className="grid grid-cols-1 gap-1.5">
              {(idea.sevenBackendKeywords || []).map((kw, i) => (
                <div
                  key={i}
                  className="rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-2.5 py-1.5 text-xs font-mono text-slate-800 dark:text-slate-300 flex items-center justify-between"
                >
                  <span className="truncate pr-2">
                    <strong className="text-slate-400 dark:text-slate-500 mr-1.5 font-sans">Slot {i + 1}:</strong>
                    {kw}
                  </span>
                  <span className="text-xs text-slate-400 dark:text-slate-500 shrink-0">{kw.length}/50 chars</span>
                </div>
              ))}
            </div>
          </div>

          {/* 3 Categories */}
          <div>
            <span className="text-xs font-bold text-slate-900 dark:text-white block mb-1.5 flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              3 Suggested Category Paths
            </span>
            <div className="space-y-1.5">
              {(idea.threeCategories || []).map((cat, i) => (
                <div
                  key={i}
                  className="rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-300"
                >
                  <strong className="text-emerald-600 dark:text-emerald-400 mr-1.5">{i + 1}.</strong>
                  {cat}
                </div>
              ))}
            </div>
          </div>

          {/* Short Description */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1">
                <BookOpen className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                Book Description
              </span>
              <button
                onClick={handleCopyDescription}
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-medium cursor-pointer"
              >
                {copiedAction === 'description' ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-500" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy Description</span>
                  </>
                )}
              </button>
            </div>
            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
              {idea.shortDescription}
            </p>
          </div>

          {/* Content Plan */}
          <div>
            <span className="text-xs font-bold text-slate-900 dark:text-white block mb-1.5">
              Interior Content Plan & Page Layout
            </span>
            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
              {idea.contentPlan}
            </p>
          </div>

          {/* Why It Could Work & Risks */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-500/20 p-2.5 rounded-lg">
              <span className="font-bold text-emerald-800 dark:text-emerald-400 block mb-1">Why It Could Work</span>
              <p className="text-slate-700 dark:text-slate-300 leading-normal">{idea.whyItCouldWork}</p>
            </div>
            <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-500/20 p-2.5 rounded-lg">
              <span className="font-bold text-rose-800 dark:text-rose-400 block mb-1">Potential Risks</span>
              <p className="text-slate-700 dark:text-slate-300 leading-normal">{idea.risks}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
