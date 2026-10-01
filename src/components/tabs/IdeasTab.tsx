// src/components/tabs/IdeasTab.tsx
// AI Book Idea Generator tab: builds prompt payloads, calls Google Gemini via background,
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
      if (response.result.usage) {
        setTokenUsage(response.result.usage);
      }
      if (response.result.rawText) {
        setRawResponse(response.result.rawText);
      }

      if (onUpdateSnapshotIdeas) {
        onUpdateSnapshotIdeas(generated);
      }
    } catch (err: any) {
      console.error('[IdeasTab] Generation error:', err);
      setErrorMessage(err.message || 'Error occurred while contacting AI service.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveIdea = async (idea: BookIdea) => {
    await saveIdea(idea);
    await loadSaved();
  };

  const handleRemoveSaved = async (idea: BookIdea) => {
    if (idea.id) {
      await removeSavedIdea(idea.id);
      await loadSaved();
    }
  };

  const handleDismissGenerated = (ideaToDismiss: BookIdea) => {
    const next = ideas.filter((i) => i.id !== ideaToDismiss.id);
    setIdeas(next);
    if (onUpdateSnapshotIdeas) {
      onUpdateSnapshotIdeas(next);
    }
  };

  const isIdeaSaved = (idea: BookIdea) => {
    return savedIdeas.some((s) => s.id === idea.id || s.title === idea.title);
  };

  const filteredSaved = savedIdeas.filter((idea) => {
    if (!savedSearchQuery.trim()) return true;
    const q = savedSearchQuery.toLowerCase();
    return (
      idea.title.toLowerCase().includes(q) ||
      idea.subNiche?.toLowerCase().includes(q) ||
      idea.targetAudience?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4 text-xs font-sans text-slate-700 dark:text-slate-200 no-horizontal-scroll">
      {/* Sub-tab Navigation */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2.5">
        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
          <button
            onClick={() => setActiveSubTab('generated')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeSubTab === 'generated'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Ideas Generator {ideas.length > 0 && `(${ideas.length})`}
          </button>

          <button
            onClick={() => setActiveSubTab('saved')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === 'saved'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Bookmark className="w-3.5 h-3.5" />
            <span>Saved Library ({savedIdeas.length})</span>
          </button>
        </div>

        {activeSubTab === 'generated' && tokenUsage && (
          <span className="text-xs text-slate-500 font-mono">
            {tokenUsage.input_tokens || 0} in / {tokenUsage.output_tokens || 0} out tokens
          </span>
        )}
      </div>

      {activeSubTab === 'generated' ? (
        <>
          {/* Top Control Card */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 shadow-xs space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <h4 className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  KDP Book Idea Generator (Google Gemini AI)
                </h4>
                <span className="text-xs text-slate-500 font-mono">
                  Model: {settings?.geminiModel || 'gemini-2.0-flash'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Transforms competitor weaknesses, customer complaints, and market gaps into 10 differentiated publishing concepts.
              </p>
            </div>

            {/* Data Readiness Chips */}
            <div className="rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 p-2.5 space-y-2">
              <div className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                Research Data Feeds
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className={`inline-flex items-center gap-1 font-medium ${hasBooks ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'}`}>
                  {hasBooks ? <CheckCircle2 className="w-3.5 h-3.5" /> : <MinusCircle className="w-3.5 h-3.5" />}
                  <span>Search Books</span>
                </span>
                <span className={`inline-flex items-center gap-1 font-medium ${hasKeywords ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'}`}>
                  {hasKeywords ? <CheckCircle2 className="w-3.5 h-3.5" /> : <MinusCircle className="w-3.5 h-3.5" />}
                  <span>Keywords</span>
                </span>
                <span className={`inline-flex items-center gap-1 font-medium ${hasCategories ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'}`}>
                  {hasCategories ? <CheckCircle2 className="w-3.5 h-3.5" /> : <MinusCircle className="w-3.5 h-3.5" />}
                  <span>Categories</span>
                </span>
                <span className={`inline-flex items-center gap-1 font-medium ${hasSpecs ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'}`}>
                  {hasSpecs ? <CheckCircle2 className="w-3.5 h-3.5" /> : <MinusCircle className="w-3.5 h-3.5" />}
                  <span>Specs</span>
                </span>
                <span className={`inline-flex items-center gap-1 font-medium ${hasReviews ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'}`}>
                  {hasReviews ? <CheckCircle2 className="w-3.5 h-3.5" /> : <MinusCircle className="w-3.5 h-3.5" />}
                  <span>Review Complaints</span>
                </span>
              </div>

              {!hasReviews && (
                <p className="text-xs text-amber-700 dark:text-amber-400 pt-1">
                  💡 Tip: Run the <strong>Reviews</strong> tab first so the AI can solve specific competitor complaints (paper thickness, bleed-through, small designs).
                </p>
              )}
            </div>

            {/* Custom User Constraints Textarea */}
            <div>
              <label htmlFor="userNotes" className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1">
                Your Skills, Constraints & Style (Optional)
              </label>
              <textarea
                id="userNotes"
                rows={2}
                placeholder="e.g., I create bold vector animal illustrations, prefer 8.5x11 inch format, target toddlers ages 1-3, English paperback only..."
                value={userNotes}
                onChange={(e) => setUserNotes(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Action Row */}
            <div className="flex items-center justify-between pt-1 gap-2">
              <span className="text-xs text-slate-500">
                {!(settings?.geminiApiKey || (settings?.geminiApiKeys && settings.geminiApiKeys.length > 0)) && (
                  <span className="text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
                    <Key className="w-3.5 h-3.5" /> Add Gemini API key in Options to generate
                  </span>
                )}
              </span>

              <button
                onClick={() => handleGenerate()}
                disabled={isGenerating || !hasBooks}
                className="shrink-0 flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 transition cursor-pointer"
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
            <div className="rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-950/20 p-3.5 space-y-2">
              <div className="flex items-start gap-2 text-rose-800 dark:text-rose-300 text-xs">
                <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <div className="flex-1 font-medium">{errorMessage}</div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={() => handleGenerate()}
                  className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition cursor-pointer"
                >
                  Retry Request
                </button>

                {rawResponse && (
                  <button
                    onClick={() => setShowRaw(!showRaw)}
                    className="px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium hover:bg-slate-300 dark:hover:bg-slate-700 transition cursor-pointer"
                  >
                    {showRaw ? 'Hide Raw Response' : 'Show Raw Response'}
                  </button>
                )}
              </div>

              {showRaw && rawResponse && (
                <pre className="p-3 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-xs font-mono text-slate-800 dark:text-slate-400 overflow-x-auto max-h-48 whitespace-pre-wrap">
                  {rawResponse}
                </pre>
              )}
            </div>
          )}

          {/* Market Overview Notes from Gemini */}
          {marketNotes && (
            <div className="rounded-xl border border-indigo-200 dark:border-indigo-500/20 bg-indigo-50/60 dark:bg-indigo-950/20 p-3.5 flex items-start gap-2.5 text-indigo-900 dark:text-indigo-300">
              <Lightbulb className="w-4 h-4 shrink-0 text-indigo-600 dark:text-indigo-400 mt-0.5" />
              <div className="text-xs leading-relaxed">
                <strong>Market Observation:</strong> {marketNotes}
              </div>
            </div>
          )}

          {/* Refinement Toolbar if ideas are present */}
          {ideas.length > 0 && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-2.5 flex items-center gap-2 shadow-xs">
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
                className="flex-1 px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />

              <button
                onClick={() => handleGenerate(refineInstruction)}
                disabled={isGenerating || !refineInstruction.trim()}
                className="px-3.5 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-semibold disabled:opacity-40 transition flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
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

              <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-center text-xs text-slate-500 dark:text-slate-400">
                ⚠️ Rule-based note: AI ideas are suggestions. Check every title, backend keyword, and category against Amazon before publishing.
              </div>
            </div>
          ) : (
            !isGenerating && (
              <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-800 bg-white/50 dark:bg-slate-900/40 p-8 text-center text-slate-500 dark:text-slate-400 space-y-2">
                <Sparkles className="w-8 h-8 text-slate-400 dark:text-slate-600 mx-auto" />
                <p className="font-bold text-slate-700 dark:text-slate-300 text-xs sm:text-sm">No book ideas generated yet</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-[280px] mx-auto">
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
              <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Search saved ideas by title, sub-niche, or audience..."
                value={savedSearchQuery}
                onChange={(e) => setSavedSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-800 bg-white/50 dark:bg-slate-900/40 p-8 text-center text-slate-500 dark:text-slate-400">
              <Bookmark className="w-8 h-8 text-slate-400 dark:text-slate-600 mx-auto mb-2" />
              <p className="font-bold text-slate-700 dark:text-slate-300 text-xs sm:text-sm">Your Saved Ideas library is empty</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-[260px] mx-auto mt-1">
                Save winning ideas from the Ideas Generator to build your personal publishing roadmap.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
