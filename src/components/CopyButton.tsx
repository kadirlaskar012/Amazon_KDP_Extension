// src/components/CopyButton.tsx
// Self-contained, flicker-free copy button with local copied state and 150ms transition.

import React, { useState } from 'react';

interface CopyButtonProps {
  text: string | (() => string);
  defaultLabel?: string;
  copiedLabel?: string;
  className?: string;
  title?: string;
  onCopied?: () => void;
}

export const CopyButton: React.FC<CopyButtonProps> = ({
  text,
  defaultLabel = 'Copy',
  copiedLabel = 'Copied!',
  className = 'plain-btn text-[10px] px-1 py-0',
  title = 'Copy to clipboard',
  onCopied,
}) => {
  const [copied, setCopied] = useState(false);

  const fallbackCopy = (str: string) => {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = str;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    } catch {
      // silent fallback
    }
  };

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    const str = typeof text === 'function' ? text() : text;
    if (!str) return;

    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(str).catch(() => {
        fallbackCopy(str);
      });
    } else {
      fallbackCopy(str);
    }

    setCopied(true);
    if (onCopied) onCopied();
    setTimeout(() => {
      setCopied(false);
    }, 1500);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`${className} transition-opacity duration-150 cursor-pointer`}
      title={title}
    >
      <span className={`inline-block transition-opacity duration-150 ${copied ? 'text-[var(--good)] font-bold' : ''}`}>
        {copied ? copiedLabel : defaultLabel}
      </span>
    </button>
  );
};
