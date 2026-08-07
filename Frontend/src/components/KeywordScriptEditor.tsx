/**
 * KeywordScriptEditor.tsx
 * Place at: same feature folder as PlaywrightEditor.tsx, under a `components/` subfolder
 *   e.g. .../Playwright/components/KeywordScriptEditor.tsx
 *
 * Lets a user write a tab-separated keyword script (Keyword | Locator | Value),
 * run it against a start URL, and/or convert it to raw Playwright code.
 */
import React, { useEffect, useState } from "react";
import { FaPlay, FaExchangeAlt } from "react-icons/fa";
import API from "../services/api";
import { authHeaders } from "../pages/TestManagement/Playwright/helpers";

const SAMPLE_KEYWORD_SCRIPT = `Navigate\t\thttps://example.com
WaitForElement\t#login-button\t
Click\t\t#login-button
Type\t\t#username\tadmin@example.com
Type\t\t#password\tsecurePassword123
Click\t\t#submit-button
VerifyPageTitle\t\tDashboard`;

interface Props {
  testCaseId?: number | string;
  onConvert?: (playwrightCode: string) => void;
}

export default function KeywordScriptEditor({ onConvert }: Props) {
  const [script, setScript] = useState(SAMPLE_KEYWORD_SCRIPT);
  const [startUrl, setStartUrl] = useState("");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [results, setResults] = useState<any[]>([]);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    API.get("/api/advanced/keywords/available", { headers: authHeaders() })
      .then((res) => setKeywords(res.data.data?.built_in || []))
      .catch(() => setKeywords([]));
  }, []);

  const runScript = async () => {
    setRunning(true);
    setMessage(null);
    try {
      const res = await API.post("/api/advanced/keywords/execute", { script, startUrl }, { headers: authHeaders() });
      setResults(res.data.data?.results || []);
    } catch (err: any) {
      setMessage(err.response?.data?.error || "Execution failed.");
    } finally {
      setRunning(false);
    }
  };

  const convertToPlaywright = async () => {
    try {
      const res = await API.post("/api/advanced/keywords/convert-to-playwright", { script }, { headers: authHeaders() });
      if (res.data.success && onConvert) onConvert(res.data.data.code);
      else if (res.data.success) setMessage("Converted (see console).");
      if (res.data.success) console.log(res.data.data.code);
    } catch (err: any) {
      setMessage(err.response?.data?.error || "Conversion failed.");
    }
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Keyword-Driven Script</h3>

      {message && <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/40 dark:text-red-300">{message}</div>}

      <div className="grid gap-4 lg:grid-cols-[1fr_240px]">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Script (tab-separated: Keyword&nbsp;&nbsp;Locator&nbsp;&nbsp;Value)
          </label>
          <textarea
            value={script}
            onChange={(e) => setScript(e.target.value)}
            spellCheck={false}
            className="h-64 w-full resize-none rounded-lg border border-gray-300 p-3 font-mono text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          />

          <div className="mt-3 flex items-center gap-3">
            <input
              value={startUrl}
              onChange={(e) => setStartUrl(e.target.value)}
              placeholder="https://your-app.example.com (optional start URL)"
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            />
            <button onClick={runScript} disabled={running} className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60">
              <FaPlay /> {running ? "Running…" : "Run"}
            </button>
            <button onClick={convertToPlaywright} className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
              <FaExchangeAlt /> To Playwright
            </button>
          </div>

          {results.length > 0 && (
            <div className="mt-4 max-h-56 space-y-1 overflow-y-auto rounded-lg border border-gray-200 p-3 dark:border-gray-700">
              {results.map((r, i) => (
                <div key={i} className={`text-xs ${r.status === "passed" ? "text-green-600" : "text-red-600"}`}>
                  {i + 1}. {r.keyword} — {r.status} {r.duration_ms ? `(${r.duration_ms}ms)` : ""} {r.error ? `— ${r.error}` : ""}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
          <h4 className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">Available Keywords</h4>
          <div className="max-h-72 space-y-1 overflow-y-auto text-xs text-gray-600 dark:text-gray-400">
            {keywords.map((k) => (
              <div key={k} className="font-mono">{k}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
