import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import {
  FaArrowLeft,
  FaClipboardList,
  FaCode,
  FaCopy,
  FaDownload,
  FaEdit,
  FaExternalLinkAlt,
  FaHistory,
  FaPlay,
  FaRedo,
  FaRegClock,
  FaSearch,
  FaTasks,
  FaTerminal,
  FaUser,
} from "react-icons/fa";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import Alert from "../../components/ui/alert/Alert";
import API from "../../services/api";
import { screenshotUrl } from "./Playwright/helpers";

type Priority = "Low" | "Medium" | "High" | "Critical" | string;
type TestCaseStatus = "Draft" | "Ready" | "Deprecated" | string;
type TabKey = "overview" | "manual" | "playwright" | "runs" | "activity";

interface TestStep {
  id?: number;
  step_number: number;
  action: string;
  expected_result?: string | null;
  created_at?: string;
  updated_at?: string;
}

interface TestCase {
  id: number;
  suite_id: number;
  title: string;
  preconditions?: string | null;
  priority: Priority;
  status: TestCaseStatus;
  suite_name?: string | null;
  project_name?: string | null;
  created_by?: number | null;
  updated_by?: number | null;
  created_by_name?: string | null;
  updated_by_name?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  steps?: TestStep[];
  playwright_script?: string | null;
}

interface RunStep {
  id: number;
  run_id?: number;
  step_number: number;
  action: string;
  selector?: string | null;
  value?: string | null;
  status: string;
  duration_ms?: number | null;
  screenshot_path?: string | null;
  error_message?: string | null;
  created_at?: string | null;
}

interface TestRun {
  id: number;
  test_case_id: number;
  status: string;
  started_at?: string | null;
  completed_at?: string | null;
  duration_ms?: number | null;
  error_message?: string | null;
  screenshot_path?: string | null;
  created_at?: string | null;
  steps?: RunStep[];
}

interface ActivityLog {
  id: number;
  action: string;
  module?: string | null;
  description?: string | null;
  user_id?: number | null;
  username?: string | null;
  created_at?: string | null;
}

const PRIORITY_COLORS: Record<string, string> = {
  Low: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
  Medium: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  High: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  Critical: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
};

const STATUS_COLORS: Record<string, string> = {
  Draft: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  Ready: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  Deprecated: "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400",
};

const RUN_STATUS_COLORS: Record<string, string> = {
  running: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  passed: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  failed: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  aborted: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  pending: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
};

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}

function formatDuration(ms?: number | null) {
  if (ms === null || ms === undefined) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function extractArray<T>(payload: any): T[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.runs)) return payload.runs;
  if (Array.isArray(payload?.logs)) return payload.logs;
  if (payload?.success && Array.isArray(payload?.data)) return payload.data;
  return [];
}

function StatusPill({
  value,
  type = "case",
}: {
  value?: string | null;
  type?: "case" | "priority" | "run";
}) {
  const map =
    type === "priority"
      ? PRIORITY_COLORS
      : type === "run"
        ? RUN_STATUS_COLORS
        : STATUS_COLORS;
  const display = value || "—";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${map[display] || "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"}`}
    >
      {display}
    </span>
  );
}

function InfoCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number | null | undefined;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {icon}
        {label}
      </div>
      <div className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">
        {value ?? "—"}
      </div>
    </div>
  );
}

function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center dark:border-gray-700 dark:bg-gray-900/40">
      <div className="text-sm font-semibold text-gray-700 dark:text-gray-200">{title}</div>
      {description && (
        <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">{description}</div>
      )}
    </div>
  );
}

export default function TestCaseDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [testCase, setTestCase] = useState<TestCase | null>(null);
  const [runs, setRuns] = useState<TestRun[]>([]);
  const [activity, setActivity] = useState<ActivityLog[]>([]);
  const [selectedRun, setSelectedRun] = useState<TestRun | null>(null);
  const [stepsLoadingRunId, setStepsLoadingRunId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [loading, setLoading] = useState(true);
  const [runsLoading, setRunsLoading] = useState(false);
  const [activityLoading, setActivityLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [running, setRunning] = useState(false);

  const testCaseId = Number(id);

  const loadTestCase = useCallback(async () => {
    if (!testCaseId || Number.isNaN(testCaseId)) {
      setError("Invalid test case ID.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await API.get(`/api/test-cases/${testCaseId}`);
      const data = res.data?.success ? res.data.data : res.data;
      setTestCase(data);
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to load test case details.");
    } finally {
      setLoading(false);
    }
  }, [testCaseId]);

  // Helper to fetch steps for a single run and merge into runs array
  const fetchStepsForRun = useCallback(async (run: TestRun): Promise<TestRun> => {
    // Already loaded — return as-is
    if (run.steps !== undefined) return run;
    try {
      const res = await API.get(`/api/playwright/runs/${run.id}/steps`);
      const steps = extractArray<RunStep>(res.data);
      return { ...run, steps };
    } catch {
      return { ...run, steps: [] };
    }
  }, []);

  const loadRuns = useCallback(async () => {
    if (!testCaseId || Number.isNaN(testCaseId)) return;
    setRunsLoading(true);
    try {
      const res = await API.get(`/api/playwright/test-cases/${testCaseId}/runs`);
      const data = extractArray<TestRun>(res.data);

      if (data.length === 0) {
        setRuns([]);
        setSelectedRun(null);
        return;
      }

      // Eagerly load steps for the first (most recent) run
      const firstWithSteps = await fetchStepsForRun(data[0]);
      const merged = [firstWithSteps, ...data.slice(1)];
      setRuns(merged);
      setSelectedRun(firstWithSteps);
    } catch {
      setRuns([]);
    } finally {
      setRunsLoading(false);
    }
  }, [testCaseId, fetchStepsForRun]);

  const loadActivity = useCallback(async () => {
    if (!testCaseId || Number.isNaN(testCaseId)) return;
    setActivityLoading(true);
    try {
      const res = await API.get(`/api/test-cases/${testCaseId}/activity`);
      setActivity(extractArray<ActivityLog>(res.data));
    } catch {
      setActivity([]);
    } finally {
      setActivityLoading(false);
    }
  }, [testCaseId]);

  useEffect(() => {
    loadTestCase();
    loadRuns();
    loadActivity();
  }, [loadActivity, loadRuns, loadTestCase]);

  // Handle clicking a run in the list — lazy-load steps if not yet fetched
  const handleSelectRun = useCallback(async (run: TestRun) => {
    if (run.steps !== undefined) {
      setSelectedRun(run);
      return;
    }
    setStepsLoadingRunId(run.id);
    try {
      const res = await API.get(`/api/playwright/runs/${run.id}/steps`);
      const steps = extractArray<RunStep>(res.data);
      const runWithSteps = { ...run, steps };
      setRuns((prev) => prev.map((r) => (r.id === run.id ? runWithSteps : r)));
      setSelectedRun(runWithSteps);
    } catch {
      setSelectedRun({ ...run, steps: [] });
    } finally {
      setStepsLoadingRunId(null);
    }
  }, []);

  const playwrightScript = testCase?.playwright_script || "";
  const manualSteps = testCase?.steps || [];
  const latestRun = runs[0];
  const failedRuns = runs.filter((r) => r.status === "failed").length;
  const passedRuns = runs.filter((r) => r.status === "passed").length;

  const screenshots = useMemo(() => {
    const allSteps = runs.flatMap((run) => run.steps || []);
    return allSteps.filter((step) => step.screenshot_path);
  }, [runs]);

  const copyScript = async () => {
    if (!playwrightScript) return;
    await navigator.clipboard.writeText(playwrightScript);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  const exportDetails = () => {
    if (!testCase) return;
    const payload = { testCase, runs, activity, exported_at: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `test-case-${testCase.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const runPlaywright = async () => {
    if (!testCase) return;
    setRunning(true);
    try {
      await API.post(`/api/playwright/test-cases/${testCase.id}/run`);
      navigate(`/playwright/runner/${testCase.id}`);
    } catch {
      navigate(`/playwright/runner/${testCase.id}`);
    } finally {
      setRunning(false);
    }
  };

  const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: "overview", label: "Overview", icon: <FaSearch className="h-3 w-3" /> },
    { key: "manual", label: "Manual Steps", icon: <FaTasks className="h-3 w-3" /> },
    { key: "playwright", label: "Playwright Script", icon: <FaCode className="h-3 w-3" /> },
    { key: "runs", label: "Runs & Evidence", icon: <FaTerminal className="h-3 w-3" /> },
    { key: "activity", label: "Activity", icon: <FaHistory className="h-3 w-3" /> },
  ];

  if (loading) {
    return (
      <div>
        <PageMeta title="Test Case Details" description="Test Case Details" />
        <PageBreadcrumb pageTitle="Test Case Details" />
        <div className="mt-6 rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400">
          Loading test case details...
        </div>
      </div>
    );
  }

  if (error || !testCase) {
    return (
      <div>
        <PageMeta title="Test Case Details" description="Test Case Details" />
        <PageBreadcrumb pageTitle="Test Case Details" />
        <div className="mt-4">
          <Alert variant="error" title="Error" message={error || "Test case not found."} />
          <button
            onClick={() => navigate("/test-cases")}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 dark:bg-gray-700 dark:hover:bg-gray-600"
          >
            <FaArrowLeft className="h-3 w-3" /> Back to Test Cases
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageMeta title={`Test Case #${testCase.id}`} description="Test case details" />
      <PageBreadcrumb pageTitle="Test Case Details" />

      <div className="mt-4 space-y-4">
        {/* Header card */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <button
                onClick={() => navigate(-1)}
                className="mb-3 inline-flex items-center gap-2 text-xs font-medium text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <FaArrowLeft className="h-3 w-3" /> Back
              </button>
              <div className="flex flex-wrap items-center gap-2">
                <FaClipboardList className="h-5 w-5 text-indigo-500" />
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">{testCase.title}</h1>
                <StatusPill value={testCase.priority} type="priority" />
                <StatusPill value={testCase.status} />
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-500 dark:text-gray-400">
                <span>Case ID: #{testCase.id}</span>
                <span>•</span>
                <span>{testCase.project_name || "No project"}</span>
                <span>•</span>
                <span>{testCase.suite_name || "No suite"}</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                to="/test-cases"
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                All Cases
              </Link>
              <Link
                to={`/playwright/editor/${testCase.id}`}
                className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-3 py-2 text-sm font-medium text-white hover:bg-purple-700"
              >
                <FaCode className="h-3 w-3" /> Script Editor
              </Link>
              <button
                onClick={runPlaywright}
                disabled={running || !playwrightScript.trim()}
                className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FaPlay className="h-3 w-3" /> {running ? "Starting..." : "Run"}
              </button>
              <button
                onClick={exportDetails}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                <FaDownload className="h-3 w-3" /> Export
              </button>
            </div>
          </div>
        </div>

        {/* Meta cards */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <InfoCard label="Created By" value={testCase.created_by_name} icon={<FaUser className="h-3 w-3" />} />
          <InfoCard label="Updated By" value={testCase.updated_by_name} icon={<FaUser className="h-3 w-3" />} />
          <InfoCard label="Created At" value={formatDate(testCase.created_at)} icon={<FaRegClock className="h-3 w-3" />} />
          <InfoCard label="Updated At" value={formatDate(testCase.updated_at)} icon={<FaRegClock className="h-3 w-3" />} />
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <InfoCard label="Manual Steps" value={manualSteps.length} icon={<FaTasks className="h-3 w-3" />} />
          <InfoCard label="Playwright Runs" value={runs.length} icon={<FaTerminal className="h-3 w-3" />} />
          <InfoCard label="Passed Runs" value={passedRuns} />
          <InfoCard label="Failed Runs" value={failedRuns} />
        </div>

        {/* Tabs */}
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="overflow-x-auto border-b border-gray-200 dark:border-gray-700">
            <div className="flex min-w-max gap-1 px-4 pt-4">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`inline-flex items-center gap-2 rounded-t-lg px-4 py-2 text-sm font-medium transition ${
                    activeTab === tab.key
                      ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                      : "text-gray-500 hover:bg-gray-50 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="p-5">
            {/* ── Overview ── */}
            {activeTab === "overview" && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Preconditions</h2>
                  <div className="mt-2 rounded-xl bg-gray-50 p-4 text-sm text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                    {testCase.preconditions?.trim() || "No preconditions defined."}
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Latest Execution</h3>
                      {latestRun && <StatusPill value={latestRun.status} type="run" />}
                    </div>
                    {latestRun ? (
                      <div className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                        <div className="flex justify-between"><span>Run ID</span><span>#{latestRun.id}</span></div>
                        <div className="flex justify-between"><span>Duration</span><span>{formatDuration(latestRun.duration_ms)}</span></div>
                        <div className="flex justify-between"><span>Started</span><span>{formatDate(latestRun.started_at || latestRun.created_at)}</span></div>
                        <button
                          onClick={() => { setSelectedRun(latestRun); setActiveTab("runs"); }}
                          className="mt-2 inline-flex items-center gap-2 text-xs font-semibold text-blue-600 hover:text-blue-700"
                        >
                          View evidence <FaExternalLinkAlt className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <EmptyState title="No Playwright runs yet" description="Run this test to generate execution evidence." />
                    )}
                  </div>
                  <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Script Health</h3>
                      <StatusPill value={playwrightScript.trim() ? "Ready" : "Draft"} />
                    </div>
                    <div className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                      <div className="flex justify-between"><span>Script lines</span><span>{playwrightScript ? playwrightScript.split("\n").length : 0}</span></div>
                      <div className="flex justify-between"><span>Manual steps</span><span>{manualSteps.length}</span></div>
                      <div className="flex justify-between"><span>Screenshots</span><span>{screenshots.length}</span></div>
                      <button
                        onClick={() => setActiveTab("playwright")}
                        className="mt-2 inline-flex items-center gap-2 text-xs font-semibold text-purple-600 hover:text-purple-700"
                      >
                        Open script <FaExternalLinkAlt className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── Manual Steps ── */}
            {activeTab === "manual" && (
              <div>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Manual Test Steps</h2>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {manualSteps.length} step{manualSteps.length !== 1 ? "s" : ""}
                  </span>
                </div>
                {manualSteps.length === 0 ? (
                  <EmptyState title="No manual steps" description="Add manual steps from the Test Cases edit form." />
                ) : (
                  <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                      <thead className="bg-gray-50 dark:bg-gray-800">
                        <tr>
                          <th className="w-20 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">#</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Action</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Expected Result</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900">
                        {manualSteps.map((step, index) => (
                          <tr key={step.id || index}>
                            <td className="px-4 py-3 text-sm font-semibold text-gray-900 dark:text-white">{step.step_number || index + 1}</td>
                            <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{step.action || "—"}</td>
                            <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{step.expected_result || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ── Playwright Script ── */}
            {activeTab === "playwright" && (
              <div className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Playwright Script</h2>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Stored against this test case as <code>playwright_script</code>.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={copyScript}
                      disabled={!playwrightScript.trim()}
                      className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                    >
                      <FaCopy className="h-3 w-3" /> {copied ? "Copied" : "Copy"}
                    </button>
                    <Link
                      to={`/playwright/editor/${testCase.id}`}
                      className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-3 py-2 text-xs font-medium text-white hover:bg-purple-700"
                    >
                      <FaEdit className="h-3 w-3" /> Full Editor
                    </Link>
                  </div>
                </div>
                {playwrightScript.trim() ? (
                  <pre className="max-h-[520px] overflow-auto rounded-xl border border-gray-200 bg-gray-950 p-4 text-xs leading-6 text-gray-100 dark:border-gray-700">
                    <code>{playwrightScript}</code>
                  </pre>
                ) : (
                  <EmptyState title="No Playwright script saved" description="Use the recorder or editor to add automation for this test case." />
                )}
              </div>
            )}

            {/* ── Runs & Evidence ── */}
            {activeTab === "runs" && (
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-[360px_1fr]">
                {/* Run list */}
                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Execution History</h2>
                    <button
                      onClick={loadRuns}
                      className="inline-flex items-center gap-2 text-xs font-semibold text-blue-600 hover:text-blue-700"
                    >
                      <FaRedo className="h-3 w-3" /> Refresh
                    </button>
                  </div>
                  {runsLoading ? (
                    <div className="rounded-xl border border-gray-200 p-4 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                      Loading runs...
                    </div>
                  ) : runs.length === 0 ? (
                    <EmptyState title="No runs found" description="Run this test to create execution history." />
                  ) : (
                    <div className="space-y-2">
                      {runs.map((run) => (
                        <button
                          key={run.id}
                          onClick={() => handleSelectRun(run)}
                          disabled={stepsLoadingRunId === run.id}
                          className={`w-full rounded-xl border p-3 text-left transition ${
                            selectedRun?.id === run.id
                              ? "border-blue-400 bg-blue-50 dark:border-blue-700 dark:bg-blue-900/20"
                              : "border-gray-200 bg-white hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:hover:bg-gray-800"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-semibold text-gray-900 dark:text-white">
                              Run #{run.id}
                              {stepsLoadingRunId === run.id && (
                                <span className="ml-2 text-xs font-normal text-gray-400"></span>
                              )}
                            </span>
                            <StatusPill value={run.status} type="run" />
                          </div>
                          <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                            {formatDate(run.started_at || run.created_at)} · {formatDuration(run.duration_ms)}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Run detail / evidence */}
                <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
                  {!selectedRun ? (
                    <EmptyState title="Select a run" description="Choose a run from the history list to view step evidence." />
                  ) : (
                    <div className="space-y-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Run #{selectedRun.id}</h3>
                            <StatusPill value={selectedRun.status} type="run" />
                          </div>
                          <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            {formatDate(selectedRun.started_at || selectedRun.created_at)} · {formatDuration(selectedRun.duration_ms)}
                          </div>
                        </div>
                        <Link
                          to={`/playwright/preview/${selectedRun.id}`}
                          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                        >
                          Open Report <FaExternalLinkAlt className="h-3 w-3" />
                        </Link>
                      </div>

                      {selectedRun.error_message && (
                        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-900/20 dark:text-red-300">
                          {selectedRun.error_message}
                        </div>
                      )}

                      {stepsLoadingRunId === selectedRun.id ? (
                        <div className="rounded-xl border border-gray-200 p-4 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                          Loading steps...
                        </div>
                      ) : selectedRun.steps && selectedRun.steps.length > 0 ? (
                        <div className="space-y-3">
                          {selectedRun.steps.map((step) => (
                            <div key={step.id} className="rounded-xl border border-gray-200 p-3 dark:border-gray-700">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                                    {step.step_number}
                                  </span>
                                  <span className="text-sm font-semibold text-gray-900 dark:text-white">{step.action}</span>
                                </div>
                                <StatusPill value={step.status} type="run" />
                              </div>
                              <div className="mt-2 grid grid-cols-1 gap-2 text-xs text-gray-500 dark:text-gray-400 sm:grid-cols-3">
                                <div>Selector: <span className="font-mono text-gray-700 dark:text-gray-300">{step.selector || "—"}</span></div>
                                <div>Value: <span className="font-mono text-gray-700 dark:text-gray-300">{step.value || "—"}</span></div>
                                <div>Duration: <span className="font-mono text-gray-700 dark:text-gray-300">{formatDuration(step.duration_ms)}</span></div>
                              </div>
                              {step.error_message && (
                                <div className="mt-2 rounded-lg bg-red-50 p-2 text-xs text-red-700 dark:bg-red-900/20 dark:text-red-300">
                                  {step.error_message}
                                </div>
                              )}
                              {step.screenshot_path && (
                                <a
                                  href={screenshotUrl(step.screenshot_path)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="mt-3 block overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700"
                                >
                                  <img
                                    src={screenshotUrl(step.screenshot_path)}
                                    alt={`Step ${step.step_number}`}
                                    className="max-h-72 w-full object-contain bg-gray-950"
                                  />
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <EmptyState
                          title="No steps recorded"
                          description="This run has no step evidence. Try opening the full report."
                        />
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Activity ── */}
            {activeTab === "activity" && (
              <div>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Activity Log</h2>
                  <button
                    onClick={loadActivity}
                    className="inline-flex items-center gap-2 text-xs font-semibold text-blue-600 hover:text-blue-700"
                  >
                    <FaRedo className="h-3 w-3" /> Refresh
                  </button>
                </div>
                {activityLoading ? (
                  <div className="rounded-xl border border-gray-200 p-4 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                    Loading activity...
                  </div>
                ) : activity.length === 0 ? (
                  <EmptyState title="No activity available" description="Add the activity endpoint to show audit trail entries here." />
                ) : (
                  <div className="space-y-3">
                    {activity.map((log) => (
                      <div key={log.id} className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex items-center gap-2">
                            <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                              {log.action}
                            </span>
                            {log.module && (
                              <span className="text-xs text-gray-500 dark:text-gray-400">{log.module}</span>
                            )}
                          </div>
                          <span className="text-xs text-gray-500 dark:text-gray-400">{formatDate(log.created_at)}</span>
                        </div>
                        <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">{log.description || "—"}</p>
                        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                          By: {log.username || log.user_id || "System"}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}