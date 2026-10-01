// src/components/tabs/IdeasTab.tsx
// AI Book Idea Generator tab: builds prompt payloads, calls Google Gemini via background,
// displays structured idea cards, supports iterative refinement, and manages saved ideas.

import React, { useState, useEffect, useMemo } from 'react';
import type { SearchSnapshot, BookIdea, AiIdeasResponse, Settings } from '../../types';
import { buildPromptPayload } from '../../services/aiPrompt';
import { IdeaCard } from '../IdeaCard';
import { getSavedIdeas, saveIdea, removeSavedIdea } from '../../storage/ideas';
import { getSettings } from '../../storage/settings';
import { extractAllGeminiKeys } from '../../services/aiIdeas';

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
  const [isLoadingSettings, setIsLoadingSettings] = useState<boolean>(true);

  // Load saved ideas and settings asynchronously
  const loadSaved = async () => {
    try {
      const [list, s] = await Promise.all([getSavedIdeas(), getSettings()]);
      setSavedIdeas(list);
      setSettings(s);
    } catch (err) {
      console.warn('[IdeasTab] Failed to load settings or saved ideas:', err);
    } finally {
      setIsLoadingSettings(false);
    }
  };

  useEffect(() => {
    loadSaved();
    if (snapshot?.ideas && snapshot.ideas.length > 0 && ideas.length === 0) {
      setIdeas(snapshot.ideas);
    }
  }, [snapshot]);

  // Determine whether an API key is configured without racing storage loading
  const hasConfiguredKey = useMemo(() => {
    if (isLoadingSettings || !settings) return true; // While storage is reading, avoid false negative warning
    const keys = extractAllGeminiKeys({
      geminiApiKey: settings.geminiApiKey,
      geminiApiKeys: settings.geminiApiKeys,
    });
    return keys.length > 0;
  }, [isLoadingSettings, settings]);

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
      // Ensure settings are available before evaluating API key presence
      let currentSettings = settings;
      if (!currentSettings) {
        currentSettings = await getSettings();
        setSettings(currentSettings);
      }

      const keys = extractAllGeminiKeys({
        geminiApiKey: currentSettings?.geminiApiKey,
        geminiApiKeys: currentSettings?.geminiApiKeys,
      });

      if (keys.length === 0) {
        setErrorMessage('Please add your Google Gemini API key in Options or Sidebar Settings to generate AI book ideas.');
        setIsGenerating(false);
        return;
      }

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
      console.warn('[IdeasTab] Generation notice:', err?.message || err);
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
    <div className="space-y-3 text-[13px] leading-[1.4] no-horizontal-scroll">
      {/* Sub-tab Navigation: simple row of text buttons separated by | */}
      <div className="flex items-center justify-between border-b border-[var(--line)] pb-1.5 flex-wrap gap-1">
        <div className="flex items-center gap-1.5 text-xs">
          <button
            onClick={() => setActiveSubTab('generated')}
            className={`cursor-pointer ${
              activeSubTab === 'generated'
                ? 'font-bold underline text-[var(--text)]'
                : 'text-[var(--muted)] hover:text-[var(--text)]'
            }`}
          >
            Ideas Generator {ideas.length > 0 && `(${ideas.length})`}
          </button>
          <span>|</span>
          <button
            onClick={() => setActiveSubTab('saved')}
            className={`cursor-pointer ${
              activeSubTab === 'saved'
                ? 'font-bold underline text-[var(--text)]'
                : 'text-[var(--muted)] hover:text-[var(--text)]'
            }`}
          >
            Saved Library ({savedIdeas.length})
          </button>
        </div>

        {activeSubTab === 'generated' && tokenUsage && (
          <span className="text-[11px] text-[var(--muted)] font-mono">
            {tokenUsage.input_tokens || 0} in / {tokenUsage.output_tokens || 0} out tokens
          </span>
        )}
      </div>

      {activeSubTab === 'generated' ? (
        <>
          {/* Top Control Card */}
          <div className="border border-[var(--line)] p-2 space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-1">
              <span className="font-bold text-xs">
                KDP Book Idea Generator (Google Gemini AI)
              </span>
              <span className="text-[11px] text-[var(--muted)] font-mono">
                Model: {settings?.geminiModel || 'gemini-flash-latest'}
              </span>
            </div>

            {/* Data Feeds status */}
            <div className="border border-[var(--line)] p-1.5 text-xs text-[var(--muted)] space-y-0.5">
              <div className="font-bold text-[11px] uppercase">Research Data Feeds:</div>
              <div className="flex flex-wrap gap-2 text-[11px]">
                <span>Books: {hasBooks ? 'Yes' : 'No'}</span>
                <span>|</span>
                <span>Keywords: {hasKeywords ? 'Yes' : 'No'}</span>
                <span>|</span>
                <span>Categories: {hasCategories ? 'Yes' : 'No'}</span>
                <span>|</span>
                <span>Specs: {hasSpecs ? 'Yes' : 'No'}</span>
                <span>|</span>
                <span>Reviews: {hasReviews ? 'Yes' : 'No'}</span>
              </div>
            </div>

            {/* Custom User Constraints */}
            <div>
              <label htmlFor="userNotes" className="block text-xs font-bold text-[var(--muted)] mb-0.5">
                Constraints &amp; Style (Optional)
              </label>
              <textarea
                id="userNotes"
                rows={2}
                placeholder="e.g., Bold illustrations, 8.5x11 format, ages 1-3..."
                value={userNotes}
                onChange={(e) => setUserNotes(e.target.value)}
                className="plain-input w-full text-xs"
              />
            </div>

            {/* Action Row */}
            <div className="flex items-center justify-between gap-1 flex-wrap">
              <div className="text-xs text-[var(--warn)]">
                {!isLoadingSettings && !hasConfiguredKey && (
                  <span>Add Gemini API key in Settings to generate</span>
                )}
              </div>

              <button
                onClick={() => handleGenerate()}
                disabled={isGenerating || !hasBooks}
                className="plain-btn text-xs font-bold px-3 py-1"
              >
                {isGenerating
                  ? 'Analyzing & Generating 10 Ideas...'
                  : ideas.length > 0
                  ? 'Regenerate Ideas'
                  : 'Generate 10 Book Ideas'}
              </button>
            </div>
          </div>

          {/* Error Banner with Retry & Raw Response */}
          {errorMessage && (
            <div className="border border-[var(--line)] p-2 space-y-1.5 text-xs">
              <div className="text-[var(--bad)] font-medium">{errorMessage}</div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handleGenerate()}
                  className="plain-btn text-xs px-2 py-0.5"
                >
                  Retry Request
                </button>
                {rawResponse && (
                  <button
                    onClick={() => setShowRaw(!showRaw)}
                    className="plain-btn text-xs px-2 py-0.5"
                  >
                    {showRaw ? 'Hide Raw' : 'Show Raw'}
                  </button>
                )}
              </div>
              {showRaw && rawResponse && (
                <pre className="p-2 border border-[var(--line)] text-xs font-mono overflow-x-auto max-h-48 whitespace-pre-wrap">
                  {rawResponse}
                </pre>
              )}
            </div>
          )}

          {/* Market Overview Notes from Gemini */}
          {marketNotes && (
            <div className="border border-[var(--line)] p-2 text-xs">
              <strong>Market Observation:</strong> {marketNotes}
            </div>
          )}

          {/* Refinement Toolbar if ideas are present */}
          {ideas.length > 0 && (
            <div className="border border-[var(--line)] p-1.5 flex items-center gap-1.5">
              <input
                type="text"
                placeholder="Refine ideas (e.g. 'focus more on sensory activities')..."
                value={refineInstruction}
                onChange={(e) => setRefineInstruction(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && refineInstruction.trim() && !isGenerating) {
                    handleGenerate(refineInstruction);
                  }
                }}
                className="plain-input flex-1 text-xs"
              />
              <button
                onClick={() => handleGenerate(refineInstruction)}
                disabled={isGenerating || !refineInstruction.trim()}
                className="plain-btn text-xs font-bold px-2 py-1"
              >
                Refine
              </button>
            </div>
          )}

          {/* Generated Idea Cards List */}
          {ideas.length > 0 ? (
            <div className="space-y-2">
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

              <div className="p-2 border border-[var(--line)] text-center text-[11px] text-[var(--muted)]">
                Score is a rule-based estimate from the data shown, not a guarantee of sales.
              </div>
            </div>
          ) : (
            !isGenerating && (
              <div className="border border-dashed border-[var(--line)] p-4 text-center text-[var(--muted)]">
                No book ideas generated yet. Click "Generate 10 Book Ideas" above.
              </div>
            )
          )}
        </>
      ) : (
        /* Saved Ideas Sub-Tab */
        <div className="space-y-2">
          <input
            type="text"
            placeholder="Filter saved ideas..."
            value={savedSearchQuery}
            onChange={(e) => setSavedSearchQuery(e.target.value)}
            className="plain-input w-full text-xs"
          />

          {filteredSaved.length > 0 ? (
            <div className="space-y-2">
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
            <div className="border border-dashed border-[var(--line)] p-4 text-center text-[var(--muted)]">
              Your Saved Ideas library is empty.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
