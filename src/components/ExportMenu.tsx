// src/components/ExportMenu.tsx
// Plain HTML utilitarian export dropdown menu
import React, { useState, useRef, useEffect } from 'react';
import type { SearchSnapshot, WatchlistItem, BookIdea, ExportSettings } from '../types';
import {
  buildSearchResultsCsv,
  buildKeywordsCsv,
  buildCategoriesCsv,
  buildSpecsCsv,
  buildReviewsCsv,
  buildWatchlistCsv,
  buildAiIdeasCsv,
  buildFullResearchPackCsv,
  buildExportFileName,
  downloadFile,
  exportSnapshotJson,
  parseImportSnapshotJson,
} from '../services/exporter';

interface ExportMenuProps {
  snapshot?: SearchSnapshot | null;
  watchlist?: WatchlistItem[];
  ideas?: BookIdea[];
  exportSettings?: ExportSettings;
  onImportSnapshot?: (imported: SearchSnapshot) => void;
}

export const ExportMenu: React.FC<ExportMenuProps> = ({
  snapshot,
  watchlist = [],
  ideas = [],
  exportSettings,
  onImportSnapshot,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2500);
  };

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const hasBooks = Boolean(snapshot?.books && snapshot.books.length > 0);
  const hasKeywords = Boolean(snapshot?.keywords && snapshot.keywords.length > 0);
  const hasCategories = Boolean(snapshot?.categories && snapshot.categories.length > 0);
  const hasSpecs = Boolean(snapshot?.specs);
  const hasReviews = Boolean(snapshot?.reviewGap && snapshot.reviewGap.complaints.length > 0);
  const hasWatchlist = watchlist.length > 0;
  const hasIdeas = ideas.length > 0;

  const handleExport = (kind: string) => {
    setIsOpen(false);
    const query = snapshot?.query || 'niche';

    switch (kind) {
      case 'search_results':
        if (!hasBooks) return;
        downloadFile(
          buildSearchResultsCsv(snapshot!.books, query, exportSettings),
          buildExportFileName('search_results', query)
        );
        showToast('Exported search results CSV');
        break;

      case 'keywords':
        if (!hasKeywords) return;
        downloadFile(
          buildKeywordsCsv(snapshot!.keywords!, exportSettings),
          buildExportFileName('keywords', query)
        );
        showToast('Exported keywords CSV');
        break;

      case 'categories':
        if (!hasCategories) return;
        downloadFile(
          buildCategoriesCsv(snapshot!.categories!, exportSettings),
          buildExportFileName('categories', query)
        );
        showToast('Exported categories CSV');
        break;

      case 'specs':
        if (!hasSpecs) return;
        downloadFile(
          buildSpecsCsv(snapshot!.specs!, exportSettings),
          buildExportFileName('specs', query)
        );
        showToast('Exported specs CSV');
        break;

      case 'reviews':
        if (!hasReviews) return;
        downloadFile(
          buildReviewsCsv(snapshot!.reviewGap!, exportSettings),
          buildExportFileName('reviews', query)
        );
        showToast('Exported review complaints CSV');
        break;

      case 'watchlist':
        if (!hasWatchlist) return;
        downloadFile(
          buildWatchlistCsv(watchlist, exportSettings),
          buildExportFileName('watchlist', 'kdp')
        );
        showToast('Exported watchlist CSV');
        break;

      case 'ai_ideas':
        if (!hasIdeas) return;
        downloadFile(
          buildAiIdeasCsv(ideas, exportSettings),
          buildExportFileName('ai_ideas', query)
        );
        showToast('Exported AI book ideas CSV');
        break;

      case 'full_pack':
        if (!snapshot) return;
        downloadFile(
          buildFullResearchPackCsv(
            snapshot,
            watchlist,
            ideas,
            exportSettings
          ),
          buildExportFileName('full_pack', query)
        );
        showToast('Exported Complete Research Pack CSV');
        break;

      case 'json_export':
        if (!snapshot) return;
        exportSnapshotJson(snapshot);
        showToast('Exported JSON snapshot');
        break;
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = String(event.target?.result || '');
        const imported = parseImportSnapshotJson(text);
        if (onImportSnapshot) {
          onImportSnapshot(imported);
          showToast(`Imported snapshot "${imported.query}"`);
        }
      } catch (err: any) {
        alert(`Failed to import JSON snapshot: ${err?.message || 'Invalid format'}`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="relative inline-block text-left" ref={menuRef}>
      {toastMsg && (
        <div className="fixed bottom-4 right-4 z-50 bg-[var(--bg)] border border-[var(--line)] px-2.5 py-1 text-xs text-[var(--good)] font-bold">
          {toastMsg}
        </div>
      )}

      {/* Hidden file input for JSON import */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileInputChange}
        accept=".json,application/json"
        className="hidden"
      />

      {/* Dropdown Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        title="Export Data & Download Reports"
        className="plain-btn"
      >
        Export ▼
      </button>

      {/* Plain Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-0.5 w-56 border border-[var(--line)] bg-[var(--bg)] text-[var(--text)] z-[9999999] text-xs font-sans divide-y divide-[var(--line)]">
          {/* Complete Pack Option */}
          <div className="p-1">
            <button
              onClick={() => handleExport('full_pack')}
              disabled={!hasBooks}
              className="w-full text-left px-2 py-1 flex items-center justify-between hover:bg-[var(--row-hover)] font-bold text-[var(--text)] disabled:opacity-40 cursor-pointer"
            >
              <span>Full Research Pack (CSV)</span>
              <span className="text-[10px] text-[var(--muted)]">[All]</span>
            </button>
          </div>

          {/* Section CSVs */}
          <div className="p-1 space-y-0.5">
            <button
              onClick={() => handleExport('search_results')}
              disabled={!hasBooks}
              className="w-full text-left px-2 py-1 flex items-center justify-between hover:bg-[var(--row-hover)] text-[var(--text)] disabled:opacity-40 cursor-pointer"
            >
              <span>Books & Metrics</span>
              <span className="text-[10px] text-[var(--muted)]">{snapshot?.books?.length || 0}</span>
            </button>

            <button
              onClick={() => handleExport('keywords')}
              disabled={!hasKeywords}
              className="w-full text-left px-2 py-1 flex items-center justify-between hover:bg-[var(--row-hover)] text-[var(--text)] disabled:opacity-40 cursor-pointer"
            >
              <span>Keywords</span>
              <span className="text-[10px] text-[var(--muted)]">{snapshot?.keywords?.length || 0}</span>
            </button>

            <button
              onClick={() => handleExport('categories')}
              disabled={!hasCategories}
              className="w-full text-left px-2 py-1 flex items-center justify-between hover:bg-[var(--row-hover)] text-[var(--text)] disabled:opacity-40 cursor-pointer"
            >
              <span>Categories</span>
              <span className="text-[10px] text-[var(--muted)]">{snapshot?.categories?.length || 0}</span>
            </button>

            <button
              onClick={() => handleExport('specs')}
              disabled={!hasSpecs}
              className="w-full text-left px-2 py-1 flex items-center justify-between hover:bg-[var(--row-hover)] text-[var(--text)] disabled:opacity-40 cursor-pointer"
            >
              <span>Specs Summary</span>
              <span className="text-[10px] text-[var(--muted)]">{hasSpecs ? 'Ready' : 'N/A'}</span>
            </button>

            <button
              onClick={() => handleExport('reviews')}
              disabled={!hasReviews}
              className="w-full text-left px-2 py-1 flex items-center justify-between hover:bg-[var(--row-hover)] text-[var(--text)] disabled:opacity-40 cursor-pointer"
            >
              <span>Complaints & Signals</span>
              <span className="text-[10px] text-[var(--muted)]">{snapshot?.reviewGap?.complaints?.length || 0}</span>
            </button>

            <button
              onClick={() => handleExport('ai_ideas')}
              disabled={!hasIdeas}
              className="w-full text-left px-2 py-1 flex items-center justify-between hover:bg-[var(--row-hover)] text-[var(--text)] disabled:opacity-40 cursor-pointer"
            >
              <span>AI Book Ideas</span>
              <span className="text-[10px] text-[var(--muted)]">{ideas.length}</span>
            </button>

            <button
              onClick={() => handleExport('watchlist')}
              disabled={!hasWatchlist}
              className="w-full text-left px-2 py-1 flex items-center justify-between hover:bg-[var(--row-hover)] text-[var(--text)] disabled:opacity-40 cursor-pointer"
            >
              <span>Watchlist Tracker</span>
              <span className="text-[10px] text-[var(--muted)]">{watchlist.length}</span>
            </button>
          </div>

          {/* Backup & Restore JSON */}
          <div className="p-1 space-y-0.5">
            <button
              onClick={() => handleExport('json_export')}
              disabled={!snapshot}
              className="w-full text-left px-2 py-1 flex items-center justify-between hover:bg-[var(--row-hover)] text-[var(--text)] disabled:opacity-40 cursor-pointer"
            >
              <span>Backup Snapshot (JSON)</span>
            </button>

            <button
              onClick={() => {
                setIsOpen(false);
                fileInputRef.current?.click();
              }}
              className="w-full text-left px-2 py-1 flex items-center justify-between hover:bg-[var(--row-hover)] text-[var(--text)] cursor-pointer"
            >
              <span>Import Snapshot (JSON)</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
