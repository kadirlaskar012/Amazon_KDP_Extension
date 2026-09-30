// src/components/tabs/IdeasTab.tsx
// AI Book Idea Generator tab: builds prompt payloads, calls Claude via background,
// displays structured idea cards, supports iterative refinement, and manages saved ideas.

import React, { useState, useEffect } from 'react';
import type { SearchSnapshot, BookIdea, AiIdeasResponse, Settings } from '../../types';
import { buildPromptPayload } from '../../services/aiPrompt';
import { IdeaCard } from '../IdeaCard';
import { getSavedIdeas, saveIdea, removeSavedIdea } from '../../storage/ideas';
import { getSettings } from '../../storage/settings';
import {
  Sparkles,
  RefreshCw,
  Send,
  Bookmark,
  CheckCircle2,
  MinusCircle,
  AlertTriangle,
  Lightbulb,
  Search,
  Key,
} from 'lucide-react';

interface IdeasTabProps {
  snapshot?: SearchSnapshot | null;
  onUpdateSnapshotIdeas?: (ideas: BookIdea[]) => void;
}

export const IdeasTab: React.FC<IdeasTabProps> = ({ snapshot, onUpdateSnapshotIdeas }) => {
  const [activeSubTab, setActiveSubTab] = useState<'generated' | 'saved'>('generated');
  const [ideas, setIdeas] = useState<BookIdea[]>(snapshot?.ideas || []);
  const [savedIdeas, setSavedIdeas] = useState<BookIdea[]>([]);
  const [userNotes, setUserNotes] = useState<string>('');
  const [refineInstruction, setRefineInstruction] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [rawResponse, setRawResponse] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState<boolean>(false);
  const [marketNotes, setMarketNotes] = useState<string | null>(null);
  const [tokenUsage, setTokenUsage] = useState<{ input_tokens?: number; output_tokens?: number } | null>(null);
  const [savedSearchQuery, setSavedSearchQuery] = useState<string>('');
  const [settings, setSettings] = useState<Settings | null>(null);

  // Load saved ideas and settings
  const loadSaved = async () => {
    const list = await getSavedIdeas();
    setSavedIdeas(list);
    const s = await getSettings();
    setSettings(s);
  };

  useEffect(() => {
    loadSaved();
    if (snapshot?.ideas && snapshot.ideas.length > 0 && ideas.length === 0) {
      setIdeas(snapshot.ideas);
    }
  }, [snapshot]);

  // Data availability checks
  const hasBooks = Boolean(snapshot?.books && snapshot.books.length > 0);
  const hasKeywords = Boolean(snapshot?.keywords && snapshot.keywords.length > 0);
  const hasCategories = Boolean(snapshot?.categories && snapshot.categories.length > 0);
  const hasSpecs = Boolean(snapshot?.specs);
  const hasReviews = Boolean(snapshot?.reviewGap && snapshot.reviewGap.complaints.length > 0);

  const handleGenerate = async (refineText?: string) => {
    setIsGenerating(true);
    setErrorMessage(null);
    setRawResponse(null);
    setShowRaw(false);

    try {
      let promptText = buildPromptPayload(snapshot, userNotes);
      if (refineText && refineText.trim()) {
        promptText += `\n\n=== REFINEMENT INSTRUCTION ===\nRefine the previously generated ideas with this specific direction: "${refineText.trim()}". Return updated, high-value ideas conforming strictly to the required JSON schema.`;
      }

      // Delegate request to background service worker so API key remains isolated
      const response = await new Promise<{ success: boolean; result?: AiIdeasResponse; error?: string }>(
        (resolve) => {
          if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
            chrome.runtime.sendMessage(
              {
                type: 'GENERATE_AI_IDEAS',
                payloadText: promptText,
              },
              (res) => resolve(res || { success: false, error: 'No response from background worker' })
            );
          } else {
            resolve({ success: false, error: 'Extension messaging unavailable' });
          }
        }
      );

      if (!response.success || !response.result) {
        throw new Error(response.error || 'Failed to generate book ideas.');
      }

      const generated = response.result.ideas;
      setIdeas(generated);
      setMarketNotes(response.result.notes || null);
      setRawResponse(response.result.rawText || null);
      if (response.result.usage) {
        setTokenUsage(response.result.usage);
      }

      if (onUpdateSnapshotIdeas) {
        onUpdateSnapshotIdeas(generated);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error communicating with Claude API.');
    } finally {
      setIsGenerating(false);
      setRefineInstruction('');
    }
  };

  const handleSaveIdea = async (idea: BookIdea) => {
    const res = await saveIdea(idea);
    if (res.success) {
      await loadSaved();
    } else if (res.message) {
      alert(res.message);
    }
  };

  const handleRemoveSaved = async (idea: BookIdea) => {
    await removeSavedIdea(idea.id || idea.title);
    await loadSaved();
  };

  const handleDismissGenerated = (idea: BookIdea) => {
    setIdeas((prev) => prev.filter((i) => i !== idea));
  };

  const isIdeaSaved = (idea: BookIdea) => {
    return savedIdeas.some(
      (s) => s.id === idea.id || s.title.toLowerCase().trim() === idea.title.toLowerCase().trim()
    );
  };

  // Filtered saved ideas
  const filteredSaved = savedIdeas.filter((s) => {
    if (!savedSearchQuery.trim()) return true;
    const q = savedSearchQuery.toLowerCase();
    return (
      s.title.toLowerCase().includes(q) ||
      s.subNiche.toLowerCase().includes(q) ||
      s.targetAudience.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4 text-xs text-slate-300">
      {/* Sub-tab Navigation */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveSubTab('generated')}
            className={`px-3 py-1 rounded-lg font-medium transition cursor-pointer ${
              activeSubTab === 'generated'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Ideas Generator {ideas.length > 0 && `(${ideas.length})`}
          </button>

          <button
            onClick={() => setActiveSubTab('saved')}
            className={`px-3 py-1 rounded-lg font-medium transition cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === 'saved'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Bookmark className="w-3 h-3" />
            <span>Saved Library ({savedIdeas.length})</span>
          </button>
        </div>

        {activeSubTab === 'generated' && tokenUsage && (
          <span className="text-[10px] text-slate-500 font-mono">
            {tokenUsage.input_tokens || 0} in / {tokenUsage.output_tokens || 0} out tokens
          </span>
        )}
      </div>

      {activeSubTab === 'generated' ? (
        <>
          {/* Top Control Card */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3.5 shadow-lg space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <h4 className="font-semibold text-white text-xs flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  KDP Book Idea Generator (Claude AI)
                </h4>
                <span className="text-[10px] text-slate-400">
                  Model: {settings?.claudeModel || 'claude-sonnet-5-5'}
                </span>
              </div>
              <p className="text-[10px] text-slate-400">
                Transforms competitor weaknesses, customer complaints, and market gaps into 10 differentiated publishing concepts.
              </p>
            </div>

            {/* Data Readiness Chips */}
            <div className="rounded-lg bg-slate-950/70 border border-slate-800 p-2 space-y-1.5">
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                Research Data Feeds
              </div>
              <div className="flex flex-wrap gap-2 text-[10px]">
                <span className={`inline-flex items-center gap-1 ${hasBooks ? 'text-emerald-400' : 'text-slate-500'}`}>
                  {hasBooks ? <CheckCircle2 className="w-3 h-3" /> : <MinusCircle className="w-3 h-3" />}
                  <span>Search Books</span>
                </span>
                <span className={`inline-flex items-center gap-1 ${hasKeywords ? 'text-emerald-400' : 'text-slate-500'}`}>
                  {hasKeywords ? <CheckCircle2 className="w-3 h-3" /> : <MinusCircle className="w-3 h-3" />}
                  <span>Keywords</span>
                </span>
                <span className={`inline-flex items-center gap-1 ${hasCategories ? 'text-emerald-400' : 'text-slate-500'}`}>
                  {hasCategories ? <CheckCircle2 className="w-3 h-3" /> : <MinusCircle className="w-3 h-3" />}
                  <span>Categories</span>
                </span>
                <span className={`inline-flex items-center gap-1 ${hasSpecs ? 'text-emerald-400' : 'text-slate-500'}`}>
                  {hasSpecs ? <CheckCircle2 className="w-3 h-3" /> : <MinusCircle className="w-3 h-3" />}
                  <span>Specs</span>
                </span>
                <span className={`inline-flex items-center gap-1 ${hasReviews ? 'text-emerald-400' : 'text-slate-500'}`}>
                  {hasReviews ? <CheckCircle2 className="w-3 h-3" /> : <MinusCircle className="w-3 h-3" />}
                  <span>Review Complaints</span>
                </span>
              </div>

              {!hasReviews && (
                <p className="text-[10px] text-amber-400/90 pt-1">
                  💡 Tip: Run the <strong>Reviews</strong> tab first so the AI can solve specific competitor complaints (paper thickness, bleed-through, small designs).
                </p>
              )}
            </div>

            {/* Custom User Constraints Textarea */}
            <div>
              <label htmlFor="userNotes" className="block text-[11px] font-medium text-slate-300 mb-1">
                Your Skills, Constraints & Style (Optional)
              </label>
              <textarea
                id="userNotes"
                rows={2}
                placeholder="e.g., I create bold vector animal illustrations, prefer 8.5x11 inch format, target toddlers ages 1-3, English paperback only..."
                value={userNotes}
                onChange={(e) => setUserNotes(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-700 bg-slate-950 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* Action Row */}
            <div className="flex items-center justify-between pt-1">
              <span className="text-[10px] text-slate-500">
                {!settings?.claudeApiKey && (
                  <span className="text-amber-400 flex items-center gap-1">
                    <Key className="w-3 h-3" /> Add Claude API key in Options to generate
                  </span>
                )}
              </span>

              <button
                onClick={() => handleGenerate()}
                disabled={isGenerating || !hasBooks}
                className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 font-semibold text-white shadow-md hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 transition cursor-pointer"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Analyzing & Generating 10 Ideas...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{ideas.length > 0 ? 'Regenerate Ideas' : 'Generate 10 Book Ideas'}</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Error Banner with Retry & Raw Response */}
          {errorMessage && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-3 space-y-2">
              <div className="flex items-start gap-2 text-rose-300 text-xs">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div className="flex-1">{errorMessage}</div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={() => handleGenerate()}
                  className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-medium transition cursor-pointer"
                >
                  Retry Request
                </button>

                {rawResponse && (
                  <button
                    onClick={() => setShowRaw(!showRaw)}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 text-[11px] hover:bg-slate-700 transition cursor-pointer"
                  >
                    {showRaw ? 'Hide Raw Response' : 'Show Raw Response'}
                  </button>
                )}
              </div>

              {showRaw && rawResponse && (
                <pre className="p-2 rounded bg-slate-950 border border-slate-800 text-[10px] font-mono text-slate-400 overflow-x-auto max-h-48 whitespace-pre-wrap">
                  {rawResponse}
                </pre>
              )}
            </div>
          )}

          {/* Market Overview Notes from Claude */}
          {marketNotes && (
            <div className="rounded-xl border border-indigo-500/20 bg-indigo-950/20 p-3 flex items-start gap-2.5 text-indigo-300">
              <Lightbulb className="w-4 h-4 shrink-0 text-indigo-400 mt-0.5" />
              <div className="text-[11px] leading-relaxed">
                <strong>Market Observation:</strong> {marketNotes}
              </div>
            </div>
          )}

          {/* Refinement Toolbar if ideas are present */}
          {ideas.length > 0 && (
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-2.5 flex items-center gap-2">
              <input
                type="text"
                placeholder="Refine ideas (e.g., 'focus more on sensory activities' or 'make them for seniors')..."
                value={refineInstruction}
                onChange={(e) => setRefineInstruction(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && refineInstruction.trim() && !isGenerating) {
                    handleGenerate(refineInstruction);
                  }
                }}
                className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-slate-700 bg-slate-950 text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />

              <button
                onClick={() => handleGenerate(refineInstruction)}
                disabled={isGenerating || !refineInstruction.trim()}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium disabled:opacity-40 transition flex items-center gap-1 cursor-pointer shrink-0"
              >
                <Send className="w-3 h-3" />
                <span>Refine</span>
              </button>
            </div>
          )}

          {/* Generated Idea Cards List */}
          {ideas.length > 0 ? (
            <div className="space-y-3">
              {ideas.map((idea, idx) => (
                <IdeaCard
                  key={idea.id || idx}
                  idea={idea}
                  isSaved={isIdeaSaved(idea)}
                  onSave={handleSaveIdea}
                  onRemove={handleDismissGenerated}
                  geo={settings?.trends?.geo || 'US'}
                />
              ))}

              <div className="p-2.5 rounded-xl border border-slate-800 bg-slate-950/60 text-center text-[10px] text-slate-500">
                ⚠️ Rule-based note: AI ideas are suggestions. Check every title, backend keyword, and category against Amazon before publishing.
              </div>
            </div>
          ) : (
            !isGenerating && (
              <div className="rounded-xl border border-dashed border-slate-800 p-8 text-center text-slate-500 space-y-2">
                <Sparkles className="w-8 h-8 text-slate-600 mx-auto" />
                <p className="font-medium text-slate-400">No book ideas generated yet</p>
                <p className="text-[11px] text-slate-500 max-w-[280px] mx-auto">
                  Click "Generate 10 Book Ideas" above. The AI will synthesize your keywords, competitor ratings, and customer complaint data into high-opportunity book blueprints.
                </p>
              </div>
            )
          )}
        </>
      ) : (
        /* Saved Ideas Sub-Tab */
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
              <input
                type="text"
                placeholder="Search saved ideas by title, sub-niche, or audience..."
                value={savedSearchQuery}
                onChange={(e) => setSavedSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-800 bg-slate-900 text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          {filteredSaved.length > 0 ? (
            <div className="space-y-3">
              {filteredSaved.map((idea) => (
                <IdeaCard
                  key={idea.id}
                  idea={idea}
                  isSaved={true}
                  onRemove={handleRemoveSaved}
                  geo={settings?.trends?.geo || 'US'}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-800 p-8 text-center text-slate-500">
              <Bookmark className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="font-medium text-slate-400">Your Saved Ideas library is empty</p>
              <p className="text-[11px] text-slate-500 max-w-[260px] mx-auto mt-1">
                Save winning ideas from the Ideas Generator to build your personal publishing roadmap.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
