// src/components/ExportMenu.tsx
// Header dropdown menu for exporting research datasets, full packs, and JSON backups

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
import { Download, FileText, Upload, ChevronDown } from 'lucide-react';

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
        showToast('Exported search results CSV!');
        break;

      case 'keywords':
        if (!hasKeywords) return;
        downloadFile(
          buildKeywordsCsv(snapshot!.keywords!, exportSettings),
          buildExportFileName('keywords', query)
        );
        showToast('Exported keywords CSV!');
        break;

      case 'categories':
        if (!hasCategories) return;
        downloadFile(
          buildCategoriesCsv(snapshot!.categories!, exportSettings),
          buildExportFileName('categories', query)
        );
        showToast('Exported categories CSV!');
        break;

      case 'specs':
        if (!hasSpecs) return;
        downloadFile(
          buildSpecsCsv(snapshot!.specs!, exportSettings),
          buildExportFileName('specs', query)
        );
        showToast('Exported specifications CSV!');
        break;

      case 'reviews':
        if (!hasReviews) return;
        downloadFile(
          buildReviewsCsv(snapshot!.reviewGap!, exportSettings),
          buildExportFileName('reviews', query)
        );
        showToast('Exported review complaints CSV!');
        break;

      case 'watchlist':
        if (!hasWatchlist) return;
        downloadFile(
          buildWatchlistCsv(watchlist, exportSettings),
          buildExportFileName('watchlist', query)
        );
        showToast('Exported watchlist CSV!');
        break;

      case 'ai_ideas':
        if (!hasIdeas) return;
        downloadFile(
          buildAiIdeasCsv(ideas, exportSettings),
          buildExportFileName('ai_ideas', query)
        );
        showToast('Exported AI book ideas CSV!');
        break;

      case 'full_pack':
        if (!snapshot) return;
        downloadFile(
          buildFullResearchPackCsv(snapshot, watchlist, ideas, exportSettings),
          buildExportFileName('full_pack', query)
        );
        showToast('Exported complete research pack CSV!');
        break;

      case 'json_export':
        if (!snapshot) return;
        exportSnapshotJson(snapshot);
        showToast('Exported snapshot JSON!');
        break;

      default:
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
          showToast(`Imported snapshot "${imported.query}"!`);
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
        <div className="fixed bottom-4 right-4 z-50 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white shadow-xl animate-fade-in">
          ✓ {toastMsg}
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
        className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer"
      >
        <Download className="w-3.5 h-3.5 text-indigo-500" />
        <span>Export</span>
        <ChevronDown className="w-3 h-3 opacity-60" />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-1 w-60 rounded-xl bg-slate-900 border border-slate-700 shadow-2xl py-1 z-[9999999] text-xs font-sans animate-fade-in divide-y divide-slate-800">
          {/* Complete Pack Option */}
          <div className="p-1">
            <button
              onClick={() => handleExport('full_pack')}
              disabled={!hasBooks}
              className="w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between hover:bg-indigo-600/20 text-indigo-300 hover:text-indigo-200 disabled:opacity-40 transition cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-indigo-400" />
                <span className="font-semibold">Full Research Pack (CSV)</span>
              </div>
              <span className="text-[9px] bg-indigo-500/20 px-1.5 py-0.5 rounded text-indigo-300 font-mono">
                All
              </span>
            </button>
          </div>

          {/* Section CSVs */}
          <div className="p-1 space-y-0.5">
            <button
              onClick={() => handleExport('search_results')}
              disabled={!hasBooks}
              className="w-full text-left px-2.5 py-1 rounded-lg flex items-center justify-between hover:bg-slate-800 text-slate-300 disabled:opacity-40 transition cursor-pointer"
            >
              <span>Books & Metrics</span>
              <span className="text-[10px] text-slate-500">{snapshot?.books?.length || 0}</span>
            </button>

            <button
              onClick={() => handleExport('keywords')}
              disabled={!hasKeywords}
              className="w-full text-left px-2.5 py-1 rounded-lg flex items-center justify-between hover:bg-slate-800 text-slate-300 disabled:opacity-40 transition cursor-pointer"
            >
              <span>Keywords</span>
              <span className="text-[10px] text-slate-500">{snapshot?.keywords?.length || 0}</span>
            </button>

            <button
              onClick={() => handleExport('categories')}
              disabled={!hasCategories}
              className="w-full text-left px-2.5 py-1 rounded-lg flex items-center justify-between hover:bg-slate-800 text-slate-300 disabled:opacity-40 transition cursor-pointer"
            >
              <span>Categories</span>
              <span className="text-[10px] text-slate-500">{snapshot?.categories?.length || 0}</span>
            </button>

            <button
              onClick={() => handleExport('specs')}
              disabled={!hasSpecs}
              className="w-full text-left px-2.5 py-1 rounded-lg flex items-center justify-between hover:bg-slate-800 text-slate-300 disabled:opacity-40 transition cursor-pointer"
            >
              <span>Specs Summary</span>
              <span className="text-[10px] text-slate-500">{hasSpecs ? 'Ready' : 'N/A'}</span>
            </button>

            <button
              onClick={() => handleExport('reviews')}
              disabled={!hasReviews}
              className="w-full text-left px-2.5 py-1 rounded-lg flex items-center justify-between hover:bg-slate-800 text-slate-300 disabled:opacity-40 transition cursor-pointer"
            >
              <span>Complaints & Signals</span>
              <span className="text-[10px] text-slate-500">{snapshot?.reviewGap?.complaints?.length || 0}</span>
            </button>

            <button
              onClick={() => handleExport('ai_ideas')}
              disabled={!hasIdeas}
              className="w-full text-left px-2.5 py-1 rounded-lg flex items-center justify-between hover:bg-slate-800 text-slate-300 disabled:opacity-40 transition cursor-pointer"
            >
              <span>AI Book Ideas</span>
              <span className="text-[10px] text-slate-500">{ideas.length}</span>
            </button>

            <button
              onClick={() => handleExport('watchlist')}
              disabled={!hasWatchlist}
              className="w-full text-left px-2.5 py-1 rounded-lg flex items-center justify-between hover:bg-slate-800 text-slate-300 disabled:opacity-40 transition cursor-pointer"
            >
              <span>Watchlist Tracker</span>
              <span className="text-[10px] text-slate-500">{watchlist.length}</span>
            </button>
          </div>

          {/* Backup & Restore JSON */}
          <div className="p-1 space-y-0.5">
            <button
              onClick={() => handleExport('json_export')}
              disabled={!snapshot}
              className="w-full text-left px-2.5 py-1 rounded-lg flex items-center gap-2 hover:bg-slate-800 text-slate-300 disabled:opacity-40 transition cursor-pointer"
            >
              <Download className="w-3 h-3 text-slate-400" />
              <span>Backup Snapshot (JSON)</span>
            </button>

            <button
              onClick={() => {
                setIsOpen(false);
                fileInputRef.current?.click();
              }}
              className="w-full text-left px-2.5 py-1 rounded-lg flex items-center gap-2 hover:bg-slate-800 text-slate-300 transition cursor-pointer"
            >
              <Upload className="w-3 h-3 text-slate-400" />
              <span>Import Snapshot (JSON)</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
