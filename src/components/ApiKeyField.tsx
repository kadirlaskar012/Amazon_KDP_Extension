// src/components/ApiKeyField.tsx
// Password-style input with visibility toggle and instant "Test Key" connectivity check for Google Gemini API

import React, { useState } from 'react';
import { Eye, EyeOff, Key, CheckCircle2, AlertCircle, Loader2, ExternalLink } from 'lucide-react';
import { testGeminiApiKey } from '../services/aiIdeas';

interface ApiKeyFieldProps {
  apiKey: string;
  onChange: (newKey: string) => void;
  model?: string;
  className?: string;
}

export const ApiKeyField: React.FC<ApiKeyFieldProps> = ({
  apiKey,
  onChange,
  model = 'gemini-2.5-flash',
  className = '',
}) => {
  const [showKey, setShowKey] = useState<boolean>(false);
  const [testing, setTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleTestKey = async () => {
    if (!apiKey || !apiKey.trim()) {
      setTestResult({
        success: false,
        message: 'Please enter an API key before testing.',
      });
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        chrome.runtime.sendMessage(
          { type: 'TEST_GEMINI_KEY', apiKey: apiKey.trim(), model },
          (resp) => {
            setTesting(false);
            if (resp) {
              setTestResult(resp);
            } else {
              setTestResult({ success: false, message: 'No response from service worker.' });
            }
          }
        );
      } else {
        const directResult = await testGeminiApiKey(apiKey.trim(), model);
        setTestResult(directResult);
        setTesting(false);
      }
    } catch (err: any) {
      setTesting(false);
      setTestResult({
        success: false,
        message: err?.message || 'Failed to verify key connectivity.',
      });
    }
  };

  return (
    <div className={`space-y-2.5 ${className}`}>
      <div className="flex items-center justify-between">
        <label htmlFor="geminiApiKey" className="block text-xs font-semibold text-slate-800 dark:text-slate-200">
          Google Gemini API Key
        </label>
        <a
          href="https://aistudio.google.com/app/apikey"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-medium"
        >
          <span>Get Free Key at Google AI Studio</span>
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Key className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            id="geminiApiKey"
            name="geminiApiKey"
            type={showKey ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder="AIzaSy..."
            value={apiKey}
            onChange={(e) => {
              onChange(e.target.value);
              setTestResult(null);
            }}
            className="w-full pl-9 pr-9 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="button"
            onClick={() => setShowKey(!showKey)}
            title={showKey ? 'Hide key' : 'Show key'}
            className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
          >
            {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>

        <button
          type="button"
          onClick={handleTestKey}
          disabled={testing || !apiKey.trim()}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-semibold disabled:opacity-40 transition shadow-xs cursor-pointer shrink-0"
        >
          {testing ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Testing...</span>
            </>
          ) : (
            <span>Test Key</span>
          )}
        </button>
      </div>

      <p className="text-xs text-slate-500 dark:text-slate-400">
        Stored securely in <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">chrome.storage.local</code>. Never uploaded to remote servers or exposed in web page contexts.
      </p>

      {/* Test feedback */}
      {testResult && (
        <div
          className={`p-2.5 rounded-xl text-xs flex items-center gap-2 border animate-fade-in ${
            testResult.success
              ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-300 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300'
              : 'bg-rose-50 dark:bg-rose-500/10 border-rose-300 dark:border-rose-500/30 text-rose-800 dark:text-rose-300'
          }`}
        >
          {testResult.success ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
          )}
          <span>{testResult.message}</span>
        </div>
      )}
    </div>
  );
};
