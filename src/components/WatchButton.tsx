// src/components/WatchButton.tsx
// Reusable toggle button for adding/removing a book from the watchlist

import React, { useState, useEffect } from 'react';
import type { Book } from '../types';
import { isBookWatched, addToWatchlist, removeFromWatchlist } from '../services/watchlist';
import { Bookmark, BookmarkCheck } from 'lucide-react';

interface WatchButtonProps {
  book: Partial<Book> & { asin: string; title: string };
  size?: 'sm' | 'md';
  showLabel?: boolean;
  className?: string;
  onWatchChange?: (isWatched: boolean) => void;
}

export const WatchButton: React.FC<WatchButtonProps> = ({
  book,
  size = 'sm',
  showLabel = true,
  className = '',
  onWatchChange,
}) => {
  const [watched, setWatched] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    if (book.asin) {
      isBookWatched(book.asin).then((res) => {
        if (isMounted) setWatched(res);
      });
    }
    return () => {
      isMounted = false;
    };
  }, [book.asin]);

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (isProcessing || !book.asin) return;

    setIsProcessing(true);
    try {
      if (watched) {
        await removeFromWatchlist(book.asin);
        setWatched(false);
        if (onWatchChange) onWatchChange(false);
      } else {
        const result = await addToWatchlist(book);
        if (result.success) {
          setWatched(true);
          if (onWatchChange) onWatchChange(true);
        } else if (result.message) {
          alert(result.message);
        }
      }
    } catch (err) {
      console.warn('[WatchButton] Error toggling watchlist:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const isSmall = size === 'sm';

  return (
    <button
      onClick={handleToggle}
      disabled={isProcessing}
      title={watched ? 'Remove from Watchlist' : 'Add to Watchlist (Track Daily BSR)'}
      className={`inline-flex items-center gap-1 rounded-lg transition-all font-medium cursor-pointer ${
        watched
          ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25'
          : 'bg-slate-800/80 text-slate-300 border border-slate-700/80 hover:bg-slate-700 hover:text-white'
      } ${isSmall ? 'px-2 py-0.5 text-[11px]' : 'px-3 py-1.5 text-xs'} ${className}`}
    >
      {watched ? (
        <BookmarkCheck className={isSmall ? 'w-3.5 h-3.5 text-amber-400' : 'w-4 h-4 text-amber-400'} />
      ) : (
        <Bookmark className={isSmall ? 'w-3.5 h-3.5 text-slate-400' : 'w-4 h-4 text-slate-400'} />
      )}
      {showLabel && (
        <span>{watched ? 'Watching' : 'Watch'}</span>
      )}
    </button>
  );
};
