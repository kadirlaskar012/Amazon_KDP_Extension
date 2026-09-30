import React from 'react';
import { AlertTriangle, ExternalLink, Play } from 'lucide-react';

interface CaptchaAlertProps {
  url?: string;
  onResume: () => void;
}

export const CaptchaAlert: React.FC<CaptchaAlertProps> = ({ url, onResume }) => {
  const handleOpenAmazon = () => {
    window.open(url || 'https://www.amazon.com', '_blank');
  };

  return (
    <div className="m-3 p-3.5 rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200">
      <div className="flex items-start gap-2.5">
        <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
        <div className="text-xs leading-relaxed space-y-2">
          <p className="font-semibold text-amber-700 dark:text-amber-300">
            Amazon asked for verification, open Amazon and solve it, then resume.
          </p>
          <p className="opacity-90">
            The background fetch queue was immediately stopped to protect your account and IP.
          </p>
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleOpenAmazon}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-medium text-[11px] shadow-sm transition"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Open Amazon Verification
            </button>
            <button
              onClick={onResume}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 text-white font-medium text-[11px] shadow-sm transition"
            >
              <Play className="w-3.5 h-3.5" />
              Resume Queue
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
