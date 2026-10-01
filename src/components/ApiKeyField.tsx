// src/components/ApiKeyField.tsx
// Password-style input with visibility toggle, multiple API keys support with automatic failover,
// and instant "Test Key" connectivity check for Google Gemini API.

import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, Key, CheckCircle2, AlertCircle, Loader2, ExternalLink, Plus, Trash2, Zap } from 'lucide-react';
import { testGeminiApiKey, extractAllGeminiKeys } from '../services/aiIdeas';

interface ApiKeyFieldProps {
  apiKey: string;
  apiKeys?: string[];
  onChange: (primaryKey: string, allKeys?: string[]) => void;
  model?: string;
  className?: string;
}

export const ApiKeyField: React.FC<ApiKeyFieldProps> = ({
  apiKey,
  apiKeys = [],
  onChange,
  model = 'gemini-2.0-flash',
  className = '',
}) => {
  // Combine single key and array into clean key list
  const getInitialKeys = (): string[] => {
    const list = extractAllGeminiKeys({ geminiApiKey: apiKey, geminiApiKeys: apiKeys });
    return list.length > 0 ? list : [''];
  };

  const [keys, setKeys] = useState<string[]>(getInitialKeys);
  const [visibleIndexes, setVisibleIndexes] = useState<{ [index: number]: boolean }>({});
  const [testing, setTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Sync if prop changes externally
  useEffect(() => {
    const extracted = extractAllGeminiKeys({ geminiApiKey: apiKey, geminiApiKeys: apiKeys });
    if (extracted.length > 0 && extracted.join(',') !== keys.filter(k => k.trim()).join(',')) {
      setKeys(extracted);
    }
  }, [apiKey, apiKeys]);

  const toggleVisibility = (idx: number) => {
    setVisibleIndexes((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const handleKeyChange = (index: number, val: string) => {
    const updated = [...keys];
    updated[index] = val;
    setKeys(updated);
    setTestResult(null);

    const validNonEmpty = updated.map((k) => k.trim()).filter((k) => k.length > 0);
    onChange(validNonEmpty[0] || '', validNonEmpty);
  };

  const handleAddKey = () => {
    const updated = [...keys, ''];
    setKeys(updated);
  };

  const handleRemoveKey = (index: number) => {
    if (keys.length <= 1) {
      handleKeyChange(0, '');
      return;
    }
    const updated = keys.filter((_, i) => i !== index);
    setKeys(updated);
    setTestResult(null);

    const validNonEmpty = updated.map((k) => k.trim()).filter((k) => k.length > 0);
    onChange(validNonEmpty[0] || '', validNonEmpty);
  };

  const handleTestKeys = async () => {
    const validKeys = keys.map((k) => k.trim()).filter((k) => k.length > 0);
    if (validKeys.length === 0) {
      setTestResult({
        success: false,
        message: 'Please enter at least one Google Gemini API key before testing.',
      });
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        chrome.runtime.sendMessage(
          { type: 'TEST_GEMINI_KEY', apiKey: validKeys.join(','), model },
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
        const directResult = await testGeminiApiKey(validKeys, model);
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

  const filledKeysCount = keys.filter((k) => k.trim().length > 5).length;

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200">
            Google Gemini API Key(s)
          </label>
          {filledKeysCount > 1 && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800">
              <Zap className="w-3 h-3 text-emerald-500 fill-emerald-500" />
              {filledKeysCount} Keys (Auto-Failover Active)
            </span>
          )}
        </div>
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

      {/* List of API Keys */}
      <div className="space-y-2">
        {keys.map((keyVal, idx) => {
          const isPrimary = idx === 0;
          const isVisible = Boolean(visibleIndexes[idx]);

          return (
            <div key={idx} className="flex items-center gap-2">
              <div className="relative flex-1">
                <div className="absolute left-2.5 top-2.5 flex items-center gap-1 text-slate-400">
                  <Key className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {isPrimary ? '#1' : `#${idx + 1}`}
                  </span>
                </div>
                <input
                  type={isVisible ? 'text' : 'password'}
                  autoComplete="off"
                  placeholder={isPrimary ? 'Primary Key (AIzaSy...)' : `Backup Key #${idx + 1} (Auto-failover on quota limit)`}
                  value={keyVal}
                  onChange={(e) => handleKeyChange(idx, e.target.value)}
                  className="w-full pl-14 pr-9 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => toggleVisibility(idx)}
                  title={isVisible ? 'Hide key' : 'Show key'}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
                >
                  {isVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Remove button for backup keys */}
              {!isPrimary && (
                <button
                  type="button"
                  onClick={() => handleRemoveKey(idx)}
                  title="Remove this backup key"
                  className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}

              {/* Test button on first row */}
              {isPrimary && (
                <button
                  type="button"
                  onClick={handleTestKeys}
                  disabled={testing || !keys.some((k) => k.trim().length > 0)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-semibold disabled:opacity-40 transition shadow-xs cursor-pointer shrink-0"
                >
                  {testing ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Testing...</span>
                    </>
                  ) : (
                    <span>{filledKeysCount > 1 ? 'Test All Keys' : 'Test Key'}</span>
                  )}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Add Backup Key Button & Callout */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
        <button
          type="button"
          onClick={handleAddKey}
          className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 hover:underline cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>+ Add Backup API Key (Auto-Failover)</span>
        </button>

        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          Stored securely in <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">chrome.storage.local</code>.
        </p>
      </div>

      {/* Auto-failover explanation badge */}
      <div className="p-2.5 rounded-xl border border-indigo-100 dark:border-indigo-900/40 bg-indigo-50/50 dark:bg-indigo-950/20 text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed flex items-start gap-2">
        <Zap className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
        <div>
          <strong className="text-slate-900 dark:text-white">Smart Auto-Failover:</strong> If your primary API key runs out of daily quota (HTTP 429), the extension will seamlessly switch to your backup key so your book generation never stops.
        </div>
      </div>

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
