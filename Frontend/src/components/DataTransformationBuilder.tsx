/**
 * DataTransformationBuilder.tsx
 * Place at: same feature folder as PlaywrightEditor.tsx, under a `components/` subfolder
 *   e.g. .../Playwright/components/DataTransformationBuilder.tsx
 */
import React, { useState } from "react";
import { FaPlay } from "react-icons/fa";
import API from "../services/api";
import { authHeaders } from "../pages/TestManagement/Playwright/helpers";

type TransformType = "JSONPATH" | "JMESPATH" | "XPATH" | "REGEX" | "JAVASCRIPT";

export default function DataTransformationBuilder() {
  const [type, setType] = useState<TransformType>("JSONPATH");
  const [expression, setExpression] = useState("$.users[0].email");
  const [testData, setTestData] = useState('{\n  "users": [\n    { "name": "John", "email": "john@example.com" }\n  ]\n}');
  const [result, setResult] = useState("");
  const [error, setError] = useState<string | null>(null);

  const runTest = async () => {
    setError(null);
    try {
      const parsedData = JSON.parse(testData);
      const res = await API.post(
        "/api/advanced/data-drive/test-transformation",
        { data: parsedData, transformation: { type, expression } },
        { headers: authHeaders() }
      );
      setResult(JSON.stringify(res.data.data.result, null, 2));
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || "Transformation failed.");
      setResult("");
    }
  };

  const templates: Record<TransformType, string[]> = {
    JSONPATH: ["$", "$[0]", "$..email", '$[?(@.status=="active")]'],
    JMESPATH: ["length(@)", "users[0].name", "users[?status == `active`].name"],
    XPATH: ["//user[@id='123']/email/text()"],
    REGEX: ["[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}"],
    JAVASCRIPT: ["`${data.firstName} ${data.lastName}`", "data.filter(u => u.active)"],
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Data Transformation</h3>

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as TransformType)}
            className="mb-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          >
            <option>JSONPATH</option>
            <option>JMESPATH</option>
            <option>XPATH</option>
            <option>REGEX</option>
            <option>JAVASCRIPT</option>
          </select>

          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Expression</label>
          <textarea
            value={expression}
            onChange={(e) => setExpression(e.target.value)}
            className="mb-3 h-16 w-full rounded-lg border border-gray-300 p-2 font-mono text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          />

          <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Templates</label>
          <select
            onChange={(e) => e.target.value && setExpression(e.target.value)}
            className="mb-4 w-full rounded-lg border border-gray-300 px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          >
            <option value="">Select a template…</option>
            {templates[type].map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>

          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Test Data (JSON)</label>
          <textarea
            value={testData}
            onChange={(e) => setTestData(e.target.value)}
            className="h-32 w-full rounded-lg border border-gray-300 p-2 font-mono text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          />

          <button onClick={runTest} className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            <FaPlay /> Test Transformation
          </button>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Result</label>
          {error && <div className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-900/40 dark:text-red-300">{error}</div>}
          <pre className="h-80 overflow-auto rounded-lg border border-gray-200 bg-gray-50 p-3 font-mono text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">
            {result || "// Run a transformation to see the result here"}
          </pre>
        </div>
      </div>
    </div>
  );
}
