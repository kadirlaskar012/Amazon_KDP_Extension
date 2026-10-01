// src/components/WatchButton.tsx
// Plain HTML button to add/remove a book from the watchlist
import React, { useState, useEffect } from 'react';
import type { Book } from '../types';
import { isBookWatched, addToWatchlist, removeFromWatchlist } from '../services/watchlist';

interface WatchButtonProps {
  book: Partial<Book> & { asin: string; title: string };
  size?: 'sm' | 'md';
  showLabel?: boolean;
  className?: string;
  onWatchChange?: (isWatched: boolean) => void;
}

export const WatchButton: React.FC<WatchButtonProps> = ({
  book,
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

  return (
    <button
      onClick={handleToggle}
      disabled={isProcessing}
      title={watched ? 'Remove from Watchlist' : 'Add to Watchlist (Track Daily BSR)'}
      className={`plain-btn ${watched ? 'font-bold' : ''} ${className}`}
    >
      {watched ? 'Watching' : 'Watch'}
    </button>
  );
};
