import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { FaPlay, FaRedo, FaSearch, FaChevronDown, FaArrowLeft } from "react-icons/fa";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import PageMeta from "../../../components/common/PageMeta";
import Alert from "../../../components/ui/alert/Alert";
import API from "../../../services/api";
import { authHeaders, formatSelector, screenshotUrl, statusClass } from "./helpers";
import type { PlaywrightRun, PlaywrightRunStep, TestCase } from "./types";

export default function PlaywrightPreview() {
  const { runId } = useParams();
  const navigate = useNavigate();

  const [run, setRun] = useState<PlaywrightRun | null>(null);
  const [steps, setSteps] = useState<PlaywrightRunStep[]>([]);
  const [tests, setTests] = useState<TestCase[]>([]);
  const [testSearch, setTestSearch] = useState("");
  const [showTestDropdown, setShowTestDropdown] = useState(false);
  const [selectedTestId, setSelectedTestId] = useState("");
  const [runs, setRuns] = useState<PlaywrightRun[]>([]);
  const [selectedStep, setSelectedStep] = useState<PlaywrightRunStep | null>(null);
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [stepFilter, setStepFilter] = useState<"all" | "passed" | "failed">("all");

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
          // Auto-select the test case
          if (data.run?.test_case_id) {
            setSelectedTestId(String(data.run.test_case_id));
          }
        }
      })
      .catch((err) => setAlert({ type: "error", message: err.response?.data?.message || "Failed to load run." }))
      .finally(() => setLoading(false));
  }, [runId]);

  const passed = steps.filter((s) => s.status === "passed").length;
  const failed = steps.filter((s) => s.status === "failed").length;
  const screenshot = screenshotUrl(selectedStep?.screenshot_path);

  const filteredTests = tests.filter((t) =>
    `${t.title} ${t.project_name || ""} ${t.suite_name || ""}`.toLowerCase().includes(testSearch.toLowerCase())
  );

  const filteredSteps = steps.filter((s) => {
    if (stepFilter === "passed") return s.status === "passed";
    if (stepFilter === "failed") return s.status === "failed";
    return true;
  });

  const selectedTestCase = tests.find((t) => String(t.id) === selectedTestId);

  // ── Browse / no runId view ────────────────────────────────────────────────────
  if (!runId) {
    return (
      <div>
        <PageMeta title="Playwright Reports" description="Browse Playwright test reports" />
        <PageBreadcrumb pageTitle="Playwright Reports" />

        <div className="mt-4 space-y-4">
          {/* Test case picker */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <h2 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">Select Test Case to Browse Runs</h2>
            <div className="relative">
              <div
                className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 cursor-pointer dark:border-gray-600 dark:bg-gray-800"
                onClick={() => setShowTestDropdown(!showTestDropdown)}
              >
                <FaSearch className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                <input
                  value={showTestDropdown ? testSearch : (selectedTestCase ? `#${selectedTestCase.id} — ${selectedTestCase.title}` : "")}
                  onChange={(e) => { setTestSearch(e.target.value); setShowTestDropdown(true); }}
                  onFocus={() => { setTestSearch(""); setShowTestDropdown(true); }}
                  placeholder="Search and select a test case…"
                  className="flex-1 bg-transparent text-sm text-gray-900 focus:outline-none dark:text-white"
                />
                <FaChevronDown className={`h-3 w-3 text-gray-400 transition-transform ${showTestDropdown ? "rotate-180" : ""}`} />
              </div>
              {showTestDropdown && (
                <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900 max-h-60 overflow-y-auto">
                  {filteredTests.length === 0 ? (
                    <div className="px-4 py-6 text-center text-sm text-gray-500">No test cases found.</div>
                  ) : (
                    filteredTests.map((tc) => (
                      <button
                        key={tc.id}
                        onClick={() => { setSelectedTestId(String(tc.id)); setTestSearch(""); setShowTestDropdown(false); }}
                        className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 border-b border-gray-100 dark:border-gray-700/50 last:border-0"
                      >
                        <div className="text-sm font-medium text-gray-900 dark:text-white">#{tc.id} — {tc.title}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{tc.project_name || "—"} / {tc.suite_name || "—"}</div>
                      </button>
                    ))
                  )}
                </div>
              )}
              {showTestDropdown && <div className="fixed inset-0 z-40" onClick={() => setShowTestDropdown(false)} />}
            </div>
          </div>

          {/* Run list */}
          {selectedTestId && (
            <div className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
              <div className="border-b border-gray-200 px-5 py-3 flex items-center justify-between dark:border-gray-700">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                  Run History {runs.length > 0 && <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-300">{runs.length}</span>}
                </h3>
                <Link to={`/playwright/runner/${selectedTestId}`} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700">
                  <FaPlay className="h-3 w-3" /> Run Test
                </Link>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {runs.length === 0 ? (
                  <div className="p-10 text-center text-sm text-gray-500 dark:text-gray-400">No runs found for this test case.</div>
                ) : (
                  runs.map((r) => (
                    <Link
                      key={r.id}
                      to={`/playwright/preview/${r.id}`}
                      className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
                    >
                      <div>
                        <div className="text-sm font-semibold text-gray-900 dark:text-white">Run #{r.id}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{r.created_at ? new Date(r.created_at).toLocaleString() : "—"}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        {r.duration_ms != null && <span className="text-xs text-gray-400">{r.duration_ms}ms</span>}
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusClass[r.status]}`}>{r.status}</span>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </div>
          )}

          {!selectedTestId && (
            <div className="rounded-2xl border border-dashed border-gray-300 p-12 text-center text-sm text-gray-500 dark:border-gray-700">Select a test case above to browse run history.</div>
          )}
        </div>
      </div>
    );
  }

  // ── Run detail view ───────────────────────────────────────────────────────────
  return (
    <div>
      <PageMeta title="Playwright Run Report" description="Playwright execution report" />
      <PageBreadcrumb pageTitle="Playwright Run Report" />

      <div className="mt-4 space-y-4">
        {alert && <Alert variant={alert.type} title={alert.type === "success" ? "Success" : "Error"} message={alert.message} />}
        {loading && <div className="text-sm text-gray-500 dark:text-gray-400">Loading report…</div>}

        {/* Header */}
        {run && (
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <div className="flex flex-wrap items-start gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
                    <FaArrowLeft className="h-3.5 w-3.5" />
                  </button>
                  <h2 className="text-base font-semibold text-gray-900 dark:text-white">{run.test_case_title || `Run #${run.id}`}</h2>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusClass[run.status]}`}>{run.status}</span>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 pl-5">
                  Run #{run.id} · {run.created_at ? new Date(run.created_at).toLocaleString() : "—"}
                  {run.created_by_name && ` · by ${run.created_by_name}`}
                </p>
              </div>
              <div className="flex gap-2">
                <Link to={`/playwright/runner/${run.test_case_id}`} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">
                  <FaRedo className="h-3.5 w-3.5" /> Rerun
                </Link>
                <Link to={`/playwright/editor/${run.test_case_id}`} className="inline-flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300">
                  Edit Script
                </Link>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-4 gap-3">
              <div className="rounded-xl bg-gray-50 p-3 text-center dark:bg-gray-800"><div className="text-xl font-bold text-gray-900 dark:text-white">{steps.length}</div><div className="text-xs text-gray-500">Steps</div></div>
              <div className="rounded-xl bg-green-50 p-3 text-center dark:bg-green-900/20"><div className="text-xl font-bold text-green-600">{passed}</div><div className="text-xs text-gray-500">Passed</div></div>
              <div className="rounded-xl bg-red-50 p-3 text-center dark:bg-red-900/20"><div className="text-xl font-bold text-red-600">{failed}</div><div className="text-xs text-gray-500">Failed</div></div>
              <div className="rounded-xl bg-blue-50 p-3 text-center dark:bg-blue-900/20"><div className="text-xl font-bold text-blue-600">{run.duration_ms != null ? `${run.duration_ms}ms` : "—"}</div><div className="text-xs text-gray-500">Duration</div></div>
            </div>
          </div>
        )}

        {/* Previous runs for same test case */}
        {runs.length > 0 && (
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Other Runs for This Test</h3>
            <div className="flex flex-wrap gap-2">
              {runs.map((r) => (
                <Link
                  key={r.id}
                  to={`/playwright/preview/${r.id}`}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                    String(r.id) === runId
                      ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                      : "border-gray-200 hover:bg-gray-50 text-gray-700 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${r.status === "passed" ? "bg-green-500" : r.status === "failed" ? "bg-red-500" : "bg-gray-400"}`} />
                  #{r.id}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Steps + detail */}
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          {/* Steps list */}
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-gray-900 dark:text-white">Steps</span>
                <span className="text-xs text-gray-500">{filteredSteps.length} shown</span>
              </div>
              <div className="flex gap-1">
                {(["all", "passed", "failed"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setStepFilter(f)}
                    className={`flex-1 rounded-md py-1 text-xs font-medium transition ${
                      stepFilter === f
                        ? f === "all" ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900"
                          : f === "passed" ? "bg-green-600 text-white"
                          : "bg-red-600 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400"
                    }`}
                  >
                    {f === "all" ? `All (${steps.length})` : f === "passed" ? `✓ ${passed}` : `✗ ${failed}`}
                  </button>
                ))}
              </div>
            </div>
            <div className="max-h-[580px] overflow-y-auto">
              {filteredSteps.map((step) => (
                <button
                  key={step.id}
                  onClick={() => setSelectedStep(step)}
                  className={`block w-full border-l-4 px-4 py-3 text-left transition ${
                    selectedStep?.id === step.id
                      ? "border-blue-600 bg-blue-50 dark:bg-blue-900/20"
                      : "border-transparent hover:bg-gray-50 dark:hover:bg-gray-800/60"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-semibold text-gray-900 dark:text-white truncate">{step.step_number}. {step.action}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold flex-shrink-0 ${statusClass[step.status]}`}>{step.status}</span>
                  </div>
                  <div className="mt-0.5 truncate font-mono text-xs text-gray-500 dark:text-gray-400">{formatSelector(step.selector)}</div>
                  {step.duration_ms != null && <div className="mt-0.5 text-xs text-gray-400">{step.duration_ms}ms</div>}
                </button>
              ))}
            </div>
          </div>

          {/* Step detail */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
            {!selectedStep ? (
              <div className="rounded-xl border border-dashed border-gray-300 p-12 text-center text-sm text-gray-500 dark:border-gray-700">Select a step to view details.</div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gray-100 font-mono text-sm font-bold text-gray-700 dark:bg-gray-800 dark:text-gray-300">{selectedStep.step_number}</div>
                  <div className="flex-1">
                    <h3 className="font-mono text-lg font-bold text-gray-900 dark:text-white">{selectedStep.action}</h3>
                    {selectedStep.duration_ms != null && <p className="text-xs text-gray-500 dark:text-gray-400">{selectedStep.duration_ms}ms</p>}
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass[selectedStep.status]}`}>{selectedStep.status}</span>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-800">
                    <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-gray-500">Selector</div>
                    <div className="break-all font-mono text-sm text-gray-800 dark:text-gray-200">{formatSelector(selectedStep.selector) || "—"}</div>
                  </div>
                  <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-800">
                    <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-gray-500">Value</div>
                    <div className="break-all font-mono text-sm text-gray-800 dark:text-gray-200">{selectedStep.value || "—"}</div>
                  </div>
                </div>

                {selectedStep.error_message && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
                    <div className="font-semibold mb-1">Error</div>
                    {selectedStep.error_message}
                  </div>
                )}

                {screenshot ? (
                  <div>
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Screenshot</div>
                    <div className="overflow-hidden rounded-xl border border-gray-200 bg-black dark:border-gray-700">
                      <img src={screenshot} alt={`Step ${selectedStep.step_number}`} className="w-full" />
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500 dark:border-gray-700">No screenshot for this step.</div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}