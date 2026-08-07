/**
 * AISuggestions.tsx
 * Place at: same feature folder as PlaywrightEditor.tsx, under a `components/` subfolder
 *   e.g. .../Playwright/components/AISuggestions.tsx
 */
import React, { useState } from "react";
import { FaLightbulb, FaSync } from "react-icons/fa";
import API from "../services/api";
import { authHeaders } from "../pages/TestManagement/Playwright/helpers";

interface Suggestion {
  title?: string;
  description?: string;
  assertion?: string;
  code?: string;
  confidence?: "HIGH" | "MEDIUM" | "LOW" | string;
  reason?: string;
}

interface Props {
  testCaseId: number | string;
  script: string;
}

const TABS = [
  { id: "assertions", label: "Missing Assertions" },
  { id: "refactoring", label: "Refactoring Tips" },
];

export default function AISuggestions({ testCaseId, script }: Props) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("assertions");
  const [error, setError] = useState<string | null>(null);

  const generateSuggestions = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await API.post(
        "/api/advanced/ai/suggestions",
        { testCaseId, script, suggestionType: activeTab },
        { headers: authHeaders() }
      );
      setSuggestions(res.data.data?.suggestions || []);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to generate suggestions.");
    } finally {
      setLoading(false);
    }
  };

  const dismiss = (idx: number) => setSuggestions(suggestions.filter((_, i) => i !== idx));

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FaLightbulb className="text-yellow-500" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">AI Suggestions</h3>
        </div>
        <button
          onClick={generateSuggestions}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          <FaSync className={loading ? "animate-spin" : ""} /> Generate
        </button>
      </div>

      <div className="mb-4 flex gap-2 border-b border-gray-200 dark:border-gray-700">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`border-b-2 px-4 py-2 text-sm font-medium ${activeTab === tab.id ? "border-blue-600 text-blue-600" : "border-transparent text-gray-600 hover:text-gray-900 dark:text-gray-400"}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/40 dark:text-red-300">{error}</div>}

      <div className="space-y-3">
        {suggestions.length === 0 && !loading && (
          <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">Click "Generate" to get AI-powered suggestions.</p>
        )}

        {suggestions.map((s, idx) => (
          <div key={idx} className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/30">
            <div className="mb-2 flex items-start justify-between gap-3">
              <div className="flex-1">
                <h4 className="mb-1 font-medium text-gray-900 dark:text-white">{s.title || s.assertion || "Suggestion"}</h4>
                {s.reason && <p className="mb-2 text-sm text-gray-700 dark:text-gray-300">{s.reason}</p>}
                {s.description && <p className="mb-2 text-sm text-gray-700 dark:text-gray-300">{s.description}</p>}
                {(s.code || s.assertion) && (
                  <pre className="mb-2 overflow-x-auto rounded bg-gray-900 p-3 text-xs text-green-400">{s.code || s.assertion}</pre>
                )}
              </div>
              {s.confidence && (
                <span
                  className={`rounded px-2 py-1 text-xs font-medium ${
                    s.confidence === "HIGH" ? "bg-green-200 text-green-800" : s.confidence === "MEDIUM" ? "bg-yellow-200 text-yellow-800" : "bg-gray-200 text-gray-800"
                  }`}
                >
                  {s.confidence}
                </span>
              )}
            </div>
            <button onClick={() => dismiss(idx)} className="rounded bg-gray-300 px-3 py-1 text-xs text-gray-700 hover:bg-gray-400 dark:bg-gray-700 dark:text-gray-200">
              Dismiss
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
