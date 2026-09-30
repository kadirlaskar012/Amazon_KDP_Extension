// src/components/ApiKeyField.tsx
// Password-style input with visibility toggle and instant "Test Key" connectivity check

import React, { useState } from 'react';
import { Eye, EyeOff, Key, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { testClaudeApiKey } from '../services/aiIdeas';

interface ApiKeyFieldProps {
  apiKey: string;
  onChange: (newKey: string) => void;
  model?: string;
  className?: string;
}

export const ApiKeyField: React.FC<ApiKeyFieldProps> = ({
  apiKey,
  onChange,
  model = 'claude-sonnet-5-5',
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
          { type: 'TEST_CLAUDE_KEY', apiKey: apiKey.trim(), model },
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
        const directResult = await testClaudeApiKey(apiKey.trim(), model);
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
    <div className={`space-y-2 ${className}`}>
      <label htmlFor="claudeApiKey" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
        Anthropic Claude API Key
      </label>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Key className="w-4 h-4 absolute left-2.5 top-2.5 text-slate-400" />
          <input
            id="claudeApiKey"
            name="claudeApiKey"
            type={showKey ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder="sk-ant-api03-..."
            value={apiKey}
            onChange={(e) => {
              onChange(e.target.value);
              setTestResult(null);
            }}
            className="w-full pl-9 pr-9 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            type="button"
            onClick={() => setShowKey(!showKey)}
            title={showKey ? 'Hide key' : 'Show key'}
            className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-200 transition cursor-pointer"
          >
            {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>

        <button
          type="button"
          onClick={handleTestKey}
          disabled={testing || !apiKey.trim()}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold disabled:opacity-40 transition shadow-sm cursor-pointer shrink-0"
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

      <p className="text-[10px] text-slate-500 dark:text-slate-400">
        Stored securely in <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">chrome.storage.local</code>. Never uploaded to remote servers or exposed in web page contexts.
      </p>

      {/* Test feedback */}
      {testResult && (
        <div
          className={`p-2 rounded-lg text-[11px] flex items-center gap-2 border animate-fade-in ${
            testResult.success
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300'
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
