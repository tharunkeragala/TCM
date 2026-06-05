import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { FaCode, FaPlay, FaSave } from "react-icons/fa";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import PageMeta from "../../../components/common/PageMeta";
import Alert from "../../../components/ui/alert/Alert";
import API from "../../../services/api";
import { authHeaders, formatSelector } from "./helpers";
import type { ParsedStep, TestCase } from "./types";

const SAMPLE_SCRIPT = `// Navigate to page
await page.goto('https://example.com');

// Wait for content
await page.waitForSelector('h1');

// Click or fill elements
// await page.click('#login');
// await page.fill('[name="username"]', 'demo');
`;

export default function PlaywrightEditor() {
  const { testCaseId } = useParams();
  const navigate = useNavigate();
  const [tests, setTests] = useState<TestCase[]>([]);
  const [selectedId, setSelectedId] = useState<string>(testCaseId || "");
  const [selectedCase, setSelectedCase] = useState<TestCase | null>(null);
  const [script, setScript] = useState(SAMPLE_SCRIPT);
  const [steps, setSteps] = useState<ParsedStep[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    API.get("/api/test-cases", { headers: authHeaders() })
      .then((res) => setTests(res.data.data || []))
      .catch(() => setTests([]));
  }, []);

  useEffect(() => {
    const recorded = localStorage.getItem("recordedPlaywrightScript");
    if (recorded) {
      setScript(recorded);
      localStorage.removeItem("recordedPlaywrightScript");
    }
  }, []);

  const loadCase = useCallback(async (id: string) => {
    if (!id) {
      setSelectedCase(null);
      return;
    }
    setLoading(true);
    setAlert(null);
    try {
      const res = await API.get(`/api/test-cases/${id}`, { headers: authHeaders() });
      if (res.data.success) {
        const tc: TestCase = res.data.data;
        setSelectedCase(tc);
        setScript((current) => {
          const recorded = localStorage.getItem("recordedPlaywrightScript");
          if (recorded) return recorded;
          if (current !== SAMPLE_SCRIPT && !testCaseId) return current;
          return tc.playwright_script || SAMPLE_SCRIPT;
        });
      }
    } catch (err: any) {
      setAlert({ type: "error", message: err.response?.data?.message || "Failed to load test case." });
    } finally {
      setLoading(false);
    }
  }, [testCaseId]);

  useEffect(() => {
    if (selectedId) loadCase(selectedId);
  }, [selectedId, loadCase]);

  const parseSteps = useCallback(async (value: string) => {
    try {
      const res = await API.post("/api/playwright/parse-steps", { script: value }, { headers: authHeaders() });
      setSteps(res.data.data || []);
    } catch {
      setSteps([]);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => parseSteps(script), 250);
    return () => clearTimeout(t);
  }, [script, parseSteps]);

  const canSave = useMemo(() => Boolean(selectedCase && script.trim()), [selectedCase, script]);

  const saveScript = async () => {
    if (!selectedCase) {
      setAlert({ type: "error", message: "Select a test case before saving." });
      return;
    }
    setSaving(true);
    setAlert(null);
    try {
      const payload = {
        suite_id: selectedCase.suite_id,
        title: selectedCase.title,
        preconditions: selectedCase.preconditions || "",
        priority: selectedCase.priority || "Medium",
        status: selectedCase.status || "Draft",
        steps: selectedCase.steps || [],
        playwright_script: script,
      };
      const res = await API.put(`/api/test-cases/update/${selectedCase.id}`, payload, { headers: authHeaders() });
      if (res.data.success) {
        setAlert({ type: "success", message: "Playwright script saved to test case." });
      }
    } catch (err: any) {
      setAlert({ type: "error", message: err.response?.data?.message || "Failed to save script." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageMeta title="Playwright Script Editor" description="Edit Playwright automation scripts" />
      <PageBreadcrumb pageTitle="Playwright Script Editor" />

      <div className="mt-4 space-y-4">
        {alert && <Alert variant={alert.type} title={alert.type === "success" ? "Success" : "Error"} message={alert.message} />}

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto]">
            <select
              value={selectedId}
              onChange={(e) => {
                setSelectedId(e.target.value);
                if (e.target.value) navigate(`/playwright/editor/${e.target.value}`);
              }}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            >
              <option value="">-- Select test case --</option>
              {tests.map((tc) => (
                <option key={tc.id} value={tc.id}>
                  #{tc.id} - {tc.title} {tc.project_name ? `(${tc.project_name})` : ""}
                </option>
              ))}
            </select>

            <button
              onClick={saveScript}
              disabled={!canSave || saving || loading}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              <FaSave className="h-3.5 w-3.5" /> {saving ? "Saving..." : "Save Script"}
            </button>

            {selectedCase && (
              <Link
                to={`/playwright/runner/${selectedCase.id}`}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
              >
                <FaPlay className="h-3.5 w-3.5" /> Run
              </Link>
            )}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3 dark:border-gray-700">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white"><FaCode className="text-blue-500" /> Script</h2>
              <span className="text-xs text-gray-500 dark:text-gray-400">{script.split("\n").length} lines</span>
            </div>
            <textarea
              value={script}
              onChange={(e) => setScript(e.target.value)}
              spellCheck={false}
              className="h-[620px] w-full resize-none bg-white p-5 font-mono text-sm text-gray-900 outline-none dark:bg-gray-900 dark:text-gray-100"
            />
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Parsed Steps</h3>
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-300">{steps.length}</span>
            </div>
            <div className="max-h-[620px] space-y-2 overflow-y-auto pr-1">
              {steps.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">No recognizable Playwright steps.</div>
              ) : (
                steps.map((step, index) => (
                  <div key={`${index}-${step.raw}`} className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="font-mono text-xs font-semibold text-blue-600 dark:text-blue-300">{index + 1}. {step.action}</span>
                      {step.value && <span className="max-w-[120px] truncate text-xs text-green-600 dark:text-green-400">{step.value}</span>}
                    </div>
                    <div className="break-all font-mono text-xs text-gray-500 dark:text-gray-400">{formatSelector(step.selector) || step.raw || "—"}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
