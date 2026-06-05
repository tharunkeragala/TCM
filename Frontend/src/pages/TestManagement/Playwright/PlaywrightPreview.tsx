import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { FaPlay, FaRedo } from "react-icons/fa";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import PageMeta from "../../../components/common/PageMeta";
import Alert from "../../../components/ui/alert/Alert";
import API from "../../../services/api";
import { authHeaders, formatSelector, screenshotUrl, statusClass } from "./helpers";
import type { PlaywrightRun, PlaywrightRunStep, TestCase } from "./types";

export default function PlaywrightPreview() {
  const { runId } = useParams();
  const [run, setRun] = useState<PlaywrightRun | null>(null);
  const [steps, setSteps] = useState<PlaywrightRunStep[]>([]);
  const [tests, setTests] = useState<TestCase[]>([]);
  const [selectedTestId, setSelectedTestId] = useState("");
  const [runs, setRuns] = useState<PlaywrightRun[]>([]);
  const [selectedStep, setSelectedStep] = useState<PlaywrightRunStep | null>(null);
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    API.get("/api/test-cases", { headers: authHeaders() })
      .then((res) => setTests(res.data.data || []))
      .catch(() => setTests([]));
  }, []);

  useEffect(() => {
    if (!selectedTestId) return;
    API.get(`/api/playwright/test-cases/${selectedTestId}/runs`, { headers: authHeaders() })
      .then((res) => setRuns(res.data.data || []))
      .catch(() => setRuns([]));
  }, [selectedTestId]);

  useEffect(() => {
    if (!runId) return;
    setLoading(true);
    setAlert(null);
    API.get(`/api/playwright/runs/${runId}`, { headers: authHeaders() })
      .then((res) => {
        if (res.data.success) {
          const data = res.data.data;
          setRun(data.run);
          setSteps(data.steps || []);
          setSelectedStep((data.steps || [])[0] || null);
        }
      })
      .catch((err) => setAlert({ type: "error", message: err.response?.data?.message || "Failed to load run." }))
      .finally(() => setLoading(false));
  }, [runId]);

  const passed = steps.filter((s) => s.status === "passed").length;
  const failed = steps.filter((s) => s.status === "failed").length;
  const screenshot = screenshotUrl(selectedStep?.screenshot_path);

  if (!runId) {
    return (
      <div>
        <PageMeta title="Playwright Reports" description="Browse Playwright test reports" />
        <PageBreadcrumb pageTitle="Playwright Reports" />
        <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Select Test Case</label>
          <select
            value={selectedTestId}
            onChange={(e) => setSelectedTestId(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          >
            <option value="">-- Select test case --</option>
            {tests.map((tc) => (
              <option key={tc.id} value={tc.id}>#{tc.id} - {tc.title}</option>
            ))}
          </select>

          <div className="mt-5 space-y-2">
            {runs.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-300 p-10 text-center text-sm text-gray-500 dark:border-gray-700">Select a test case to browse run history.</div>
            ) : (
              runs.map((r) => (
                <Link key={r.id} to={`/playwright/preview/${r.id}`} className="flex items-center justify-between rounded-xl border border-gray-200 p-4 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800">
                  <div>
                    <div className="text-sm font-semibold text-gray-900 dark:text-white">Run #{r.id}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{r.created_at ? new Date(r.created_at).toLocaleString() : "—"}</div>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusClass[r.status]}`}>{r.status}</span>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageMeta title="Playwright Run Report" description="Playwright execution report" />
      <PageBreadcrumb pageTitle="Playwright Run Report" />

      <div className="mt-4 space-y-4">
        {alert && <Alert variant={alert.type} title={alert.type === "success" ? "Success" : "Error"} message={alert.message} />}
        {loading && <div className="text-sm text-gray-500 dark:text-gray-400">Loading report...</div>}

        {run && (
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{run.test_case_title || `Run #${run.id}`}</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">Run #{run.id} • {run.created_at ? new Date(run.created_at).toLocaleString() : "—"}</p>
              </div>
              <span className={`ml-auto rounded-full px-3 py-1 text-xs font-semibold ${statusClass[run.status]}`}>{run.status}</span>
              <Link to={`/playwright/runner/${run.test_case_id}`} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"><FaRedo className="h-3.5 w-3.5" /> Rerun</Link>
            </div>
            <div className="mt-4 grid grid-cols-4 gap-3">
              <div className="rounded-xl bg-gray-50 p-3 text-center dark:bg-gray-800"><div className="text-lg font-bold text-gray-900 dark:text-white">{steps.length}</div><div className="text-xs text-gray-500">Steps</div></div>
              <div className="rounded-xl bg-green-50 p-3 text-center dark:bg-green-900/20"><div className="text-lg font-bold text-green-600">{passed}</div><div className="text-xs text-gray-500">Passed</div></div>
              <div className="rounded-xl bg-red-50 p-3 text-center dark:bg-red-900/20"><div className="text-lg font-bold text-red-600">{failed}</div><div className="text-xs text-gray-500">Failed</div></div>
              <div className="rounded-xl bg-blue-50 p-3 text-center dark:bg-blue-900/20"><div className="text-lg font-bold text-blue-600">{run.duration_ms || 0}ms</div><div className="text-xs text-gray-500">Duration</div></div>
            </div>
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <div className="border-b border-gray-200 px-4 py-3 text-sm font-semibold text-gray-900 dark:border-gray-700 dark:text-white">Steps</div>
            <div className="max-h-[680px] overflow-y-auto">
              {steps.map((step) => (
                <button key={step.id} onClick={() => setSelectedStep(step)} className={`block w-full border-l-4 px-4 py-3 text-left transition ${selectedStep?.id === step.id ? "border-blue-600 bg-blue-50 dark:bg-blue-900/20" : "border-transparent hover:bg-gray-50 dark:hover:bg-gray-800/60"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-semibold text-gray-900 dark:text-white">{step.step_number}. {step.action}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusClass[step.status]}`}>{step.status}</span>
                  </div>
                  <div className="mt-1 truncate font-mono text-xs text-gray-500 dark:text-gray-400">{formatSelector(step.selector)}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
            {!selectedStep ? (
              <div className="rounded-xl border border-dashed border-gray-300 p-10 text-center text-sm text-gray-500 dark:border-gray-700">Select a step.</div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 font-mono text-sm font-bold text-gray-700 dark:bg-gray-800 dark:text-gray-300">{selectedStep.step_number}</div>
                  <div>
                    <h3 className="font-mono text-lg font-bold text-gray-900 dark:text-white">{selectedStep.action}</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{selectedStep.duration_ms || 0}ms</p>
                  </div>
                  <span className={`ml-auto rounded-full px-2 py-0.5 text-xs font-semibold ${statusClass[selectedStep.status]}`}>{selectedStep.status}</span>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-800"><div className="mb-1 text-xs uppercase tracking-wide text-gray-500">Selector</div><div className="break-all font-mono text-sm text-gray-800 dark:text-gray-200">{formatSelector(selectedStep.selector) || "—"}</div></div>
                  <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-800"><div className="mb-1 text-xs uppercase tracking-wide text-gray-500">Value</div><div className="break-all font-mono text-sm text-gray-800 dark:text-gray-200">{selectedStep.value || "—"}</div></div>
                </div>

                {selectedStep.error_message && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">{selectedStep.error_message}</div>}

                {screenshot ? (
                  <div>
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Screenshot</div>
                    <div className="overflow-hidden rounded-xl border border-gray-200 bg-black dark:border-gray-700">
                      <img src={screenshot} alt={`Step ${selectedStep.step_number}`} className="w-full" />
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-gray-300 p-10 text-center text-sm text-gray-500 dark:border-gray-700">No screenshot for this step.</div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
