// src/components/ApiKeyField.tsx
// Plain password-style inputs with visibility toggle, multiple API keys support with automatic failover,
// and connectivity check for Google Gemini API.

import React, { useState, useEffect } from 'react';
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
  const getInitialKeys = (): string[] => {
    const list = extractAllGeminiKeys({ geminiApiKey: apiKey, geminiApiKeys: apiKeys });
    return list.length > 0 ? list : [''];
  };

  const [keys, setKeys] = useState<string[]>(getInitialKeys);
  const [visibleIndexes, setVisibleIndexes] = useState<{ [index: number]: boolean }>({});
  const [testing, setTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    const extracted = extractAllGeminiKeys({ geminiApiKey: apiKey, geminiApiKeys: apiKeys });
    if (extracted.length > 0 && extracted.join(',') !== keys.filter((k) => k.trim()).join(',')) {
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
    <div className={`space-y-2 text-[13px] leading-[1.4] ${className}`} style={{ color: 'var(--text)' }}>
      <div className="flex items-center justify-between">
        <label className="font-semibold">
          Google Gemini API Key(s)
          {filledKeysCount > 1 && (
            <span className="ml-2 font-normal text-xs" style={{ color: 'var(--good)' }}>
              ({filledKeysCount} keys configured, auto-failover enabled)
            </span>
          )}
        </label>
        <a
          href="https://aistudio.google.com/app/apikey"
          target="_blank"
          rel="noopener noreferrer"
          className="plain-link text-xs"
        >
          Get Free Key at Google AI Studio
        </a>
      </div>

      {/* List of API Keys */}
      <div className="space-y-1.5">
        {keys.map((keyVal, idx) => {
          const isPrimary = idx === 0;
          const isVisible = Boolean(visibleIndexes[idx]);

          return (
            <div key={idx} className="flex items-center gap-1.5">
              <span className="font-mono text-xs w-8" style={{ color: 'var(--muted)' }}>
                {isPrimary ? '#1' : `#${idx + 1}`}
              </span>
              <input
                type={isVisible ? 'text' : 'password'}
                autoComplete="off"
                placeholder={isPrimary ? 'Primary Key (AIzaSy...)' : `Backup Key #${idx + 1}`}
                value={keyVal}
                onChange={(e) => handleKeyChange(idx, e.target.value)}
                className="plain-input flex-1 font-mono text-xs"
              />
              <button
                type="button"
                onClick={() => toggleVisibility(idx)}
                className="plain-btn text-xs"
                title={isVisible ? 'Hide key' : 'Show key'}
              >
                {isVisible ? 'Hide' : 'Show'}
              </button>

              {!isPrimary && (
                <button
                  type="button"
                  onClick={() => handleRemoveKey(idx)}
                  className="plain-btn text-xs"
                  style={{ color: 'var(--bad)' }}
                  title="Remove this backup key"
                >
                  Delete
                </button>
              )}

              {isPrimary && (
                <button
                  type="button"
                  onClick={handleTestKeys}
                  disabled={testing || !keys.some((k) => k.trim().length > 0)}
                  className="plain-btn text-xs font-medium"
                >
                  {testing ? 'Testing...' : filledKeysCount > 1 ? 'Test All Keys' : 'Test Key'}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Add Backup Key Button */}
      <div className="flex items-center justify-between text-xs pt-1">
        <button
          type="button"
          onClick={handleAddKey}
          className="plain-link"
          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
        >
          + Add Backup API Key
        </button>

        <span style={{ color: 'var(--muted)' }}>
          Stored locally in browser storage
        </span>
      </div>

      <div className="text-xs" style={{ color: 'var(--muted)' }}>
        Note: If primary key reaches daily quota (429), the extension automatically falls back to backup keys.
      </div>

      {/* Test feedback */}
      {testResult && (
        <div
          className="p-1.5 text-xs border"
          style={{
            borderColor: testResult.success ? 'var(--good)' : 'var(--bad)',
            color: testResult.success ? 'var(--good)' : 'var(--bad)',
            borderRadius: '2px',
          }}
        >
          {testResult.message}
        </div>
      )}
    </div>
  );
};
