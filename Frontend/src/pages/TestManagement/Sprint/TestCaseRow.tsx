import { useCallback, useEffect, useRef, useState } from "react";
import {
  FaCamera,
  FaCheckCircle,
  FaChevronDown,
  FaChevronRight,
  FaClipboardList,
  FaExclamationTriangle,
  FaExternalLinkAlt,
  FaHistory,
  FaPlay,
  FaSpinner,
  FaTimesCircle,
  FaTrash,
} from "react-icons/fa";
import Alert from "../../../components/ui/alert/Alert";
import API from "../../../services/api";
import type { BoardSuite, SprintTestCase, TestRun } from "./types.ts";
import {
  getToken,
  PRIORITY_DOT,
  STATUS_COLORS,
  timeAgo,
  formatDuration,
} from "./utils.ts";
import type { TestCaseDetailData } from "../TestCaseDetailModal";
import { RunEvidencePanel } from "./RunEvidencePanel";

// ─── Run status config (with JSX icons) ──────────────────────────────────────

const RUN_STATUS: Record<
  string,
  { bg: string; icon: React.ReactNode; label: string }
> = {
  passed: {
    bg: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
    icon: <FaCheckCircle className="w-3 h-3" />,
    label: "PASSED",
  },
  failed: {
    bg: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
    icon: <FaTimesCircle className="w-3 h-3" />,
    label: "FAILED",
  },
  running: {
    bg: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    icon: <FaSpinner className="w-3 h-3 animate-spin" />,
    label: "RUNNING",
  },
  pending: {
    bg: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
    icon: <FaClipboardList className="w-3 h-3" />,
    label: "PENDING",
  },
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface TestCaseRowProps {
  tc: SprintTestCase;
  suite: BoardSuite;
  sprintId: number;
  isExpanded: boolean;
  onToggle: () => void;
  onUnlink: () => void;
  onViewDetail: (testCase: TestCaseDetailData) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TestCaseRow({
  tc,
  suite,
  sprintId,
  isExpanded,
  onToggle,
  onUnlink,
  onViewDetail,
}: TestCaseRowProps) {
  const [runs, setRuns] = useState<TestRun[]>(tc.runs ?? []);
  const [runsLoading, setRunsLoading] = useState(false);
  // FIX: Track whether we've already fetched to avoid re-fetching on every
  //      expand. Using a ref (not state) so it doesn't trigger re-renders.
  const runsFetchedRef = useRef(!!tc.runs);
  const [executing, setExecuting] = useState(false);
  const [execAlert, setExecAlert] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [activeTab, setActiveTab] = useState<"steps" | "runs">("steps");
  const [viewRun, setViewRun] = useState<TestRun | null>(null);

  const latestRun = tc.latest_run ?? runs[0] ?? null;

  // FIX: fetchRuns was listed as a dep of the useEffect below, but
  //      useCallback re-creates it when `runsLoading` changes → infinite loop.
  //      Using a ref guard instead of `runsLoading` state in the dep array.
  const fetchingRef = useRef(false);
  const fetchRuns = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setRunsLoading(true);
    try {
      const res = await API.get(
  `/api/playwright/test-cases/${tc.id}/runs`,
  {
    params: {
      sprint_id: sprintId,
    },
    headers: {
      Authorization: `Bearer ${getToken()}`,
    },
  }
);
      const data = res.data?.data ?? res.data;
      if (Array.isArray(data)) setRuns(data);
    } catch {
      // Silent — runs tab will show empty state
    } finally {
      setRunsLoading(false);
      fetchingRef.current = false;
      runsFetchedRef.current = true;
    }
  }, [tc.id, sprintId]); // tc.id is stable; no loop risk

  useEffect(() => {
    if (isExpanded && !runsFetchedRef.current) {
      fetchRuns();
    }
  }, [isExpanded, fetchRuns]);

  const handleExecute = async () => {
    setExecuting(true);
    setExecAlert(null);
    try {
      await API.post(
        `/api/playwright/test-cases/${tc.id}/run`,
        {},
        { headers: { Authorization: `Bearer ${getToken()}` } },
      );
      setExecAlert({ type: "success", message: "Test execution started!" });
      // Refresh runs after a brief delay to let the run record appear
      setTimeout(() => {
        runsFetchedRef.current = false;
        fetchRuns();
      }, 3000);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : ((err as { response?: { data?: { message?: string } } })?.response
              ?.data?.message ?? "Execution failed.");
      setExecAlert({ type: "error", message: msg });
    } finally {
      setExecuting(false);
    }
  };

  const rs = latestRun
    ? (RUN_STATUS[latestRun.status] ?? RUN_STATUS.pending)
    : null;

  return (
    <>
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* ── Row header ── */}
        <div
          role="button"
          tabIndex={0}
          onClick={onToggle}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onToggle();
            }
          }}
          className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-400 select-none ${
            isExpanded
              ? "bg-blue-50 dark:bg-blue-900/20"
              : "hover:bg-gray-50 dark:hover:bg-gray-800"
          }`}
        >
          <span className="text-gray-400 flex-shrink-0">
            {isExpanded ? (
              <FaChevronDown className="w-2.5 h-2.5" />
            ) : (
              <FaChevronRight className="w-2.5 h-2.5" />
            )}
          </span>
          <span
            className={`w-2 h-2 rounded-full flex-shrink-0 ${
              PRIORITY_DOT[tc.priority] ?? "bg-gray-400"
            }`}
          />
          <span className="flex-1 text-sm font-medium text-gray-900 dark:text-white truncate">
            {tc.title}
          </span>
          {rs && (
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full flex-shrink-0 ${rs.bg}`}
            >
              {rs.icon} {rs.label}
            </span>
          )}
          <span
            className={`px-2 py-0.5 text-xs font-semibold rounded-full flex-shrink-0 ${
              STATUS_COLORS[tc.status] ?? ""
            }`}
          >
            {tc.status}
          </span>
          {/* Action buttons — stop click propagation so they don't expand the row */}
          <div
            className="flex items-center gap-1 flex-shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => onViewDetail(tc)}
              className="p-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
              title="Open full details"
              aria-label="Open full test case details"
            >
              <FaExternalLinkAlt className="w-3 h-3" />
            </button>
            <button
              onClick={onUnlink}
              className="p-1.5 rounded-md hover:bg-red-100 dark:hover:bg-red-900/30 text-red-400 hover:text-red-600 transition-colors"
              title="Unlink test case"
              aria-label="Unlink test case from sprint"
            >
              <FaTrash className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* ── Expanded body ── */}
        {isExpanded && (
          <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
            {/* Tab bar */}
            <div className="flex items-center gap-1 px-4 pt-3 pb-0 border-b border-gray-100 dark:border-gray-800">
              {(["steps", "runs"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-t-md transition-colors border-b-2 ${
                    activeTab === tab
                      ? "text-blue-600 dark:text-blue-400 border-blue-500"
                      : "text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-700 dark:hover:text-gray-300"
                  }`}
                >
                  {tab === "steps"
                    ? `Test Steps (${tc.steps.length})`
                    : `Runs & Evidence (${runs.length})`}
                </button>
              ))}
              <div className="ml-auto mb-1">
                <button
                  onClick={handleExecute}
                  disabled={executing}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-green-600 hover:bg-green-700 disabled:opacity-60 rounded-lg transition-colors"
                  aria-label="Execute this test case"
                >
                  {executing ? (
                    <FaSpinner className="w-3 h-3 animate-spin" />
                  ) : (
                    <FaPlay className="w-3 h-3" />
                  )}
                  {executing ? "Executing…" : "Execute"}
                </button>
              </div>
            </div>

            <div className="p-4">
              {execAlert && (
                <div className="mb-3">
                  <Alert
                    variant={execAlert.type}
                    title={execAlert.type === "success" ? "Execution" : "Error"}
                    message={execAlert.message}
                  />
                </div>
              )}

              {/* ── Steps tab ── */}
              {activeTab === "steps" && (
                <>
                  {tc.preconditions && (
                    <div className="mb-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                      <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide mb-0.5">
                        Preconditions
                      </p>
                      <p className="text-xs text-amber-800 dark:text-amber-300">
                        {tc.preconditions}
                      </p>
                    </div>
                  )}
                  {tc.owning_suite_id !== suite.suite_id && (
                    <div className="mb-3 flex items-start gap-2 p-2.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                      <FaExclamationTriangle className="w-3.5 h-3.5 text-blue-500 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-blue-700 dark:text-blue-300">
                        Owned by suite <strong>"{tc.owning_suite_name}"</strong>{" "}
                        — tracked here for sprint only.
                      </p>
                    </div>
                  )}
                  {tc.steps.length === 0 ? (
                    <p className="text-xs text-gray-400 italic py-2">
                      No steps defined.
                    </p>
                  ) : (
                    <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50 dark:bg-gray-800">
                          <tr>
                            <th className="text-left py-2 px-3 w-8 text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wide">
                              #
                            </th>
                            <th className="text-left py-2 px-3 text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wide">
                              Action
                            </th>
                            <th className="text-left py-2 px-3 text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wide">
                              Expected Result
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                          {tc.steps.map((step) => (
                            <tr
                              key={step.step_number}
                              className="hover:bg-gray-50 dark:hover:bg-gray-800/50"
                            >
                              <td className="py-2 px-3 text-gray-400 font-mono">
                                {step.step_number}
                              </td>
                              <td className="py-2 px-3 text-gray-700 dark:text-gray-300">
                                {step.action}
                              </td>
                              <td className="py-2 px-3 text-gray-500 dark:text-gray-400">
                                {step.expected_result || "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}

              {/* ── Runs tab ── */}
              {activeTab === "runs" && (
                <div>
                  {runsLoading ? (
                    <div className="flex items-center gap-2 text-sm text-gray-400 py-4 justify-center">
                      <FaSpinner className="animate-spin w-4 h-4" /> Loading
                      runs…
                    </div>
                  ) : runs.length === 0 ? (
                    <div className="text-center py-6 text-xs text-gray-400 border border-dashed border-gray-300 dark:border-gray-700 rounded-lg">
                      No executions yet.{" "}
                      <button
                        onClick={handleExecute}
                        className="text-blue-500 hover:underline"
                      >
                        Run it now
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {runs.map((run) => {
                        const r = RUN_STATUS[run.status] ?? RUN_STATUS.pending;
                        return (
                          <div
                            key={run.id}
                            className="flex items-center justify-between gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full flex-shrink-0 ${r.bg}`}
                              >
                                {r.icon} {r.label}
                              </span>
                              <div className="min-w-0">
                                <p className="text-xs font-medium text-gray-800 dark:text-gray-200">
                                  Run #{run.id}
                                </p>
                                <p className="text-[10px] text-gray-400">
                                  {run.executed_by_name &&
                                    `${run.executed_by_name} · `}
                                  {timeAgo(run.started_at)}
                                  {run.duration_ms &&
                                    ` · ${formatDuration(run.duration_ms)}`}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {run.error_message && (
                                <span title={run.error_message}>
                                  <FaExclamationTriangle className="w-3 h-3 text-red-400" />
                                </span>
                              )}
                              <button
                                onClick={() => setViewRun(run)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-semibold text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-700 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                              >
                                <FaCamera className="w-2.5 h-2.5" /> Evidence
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <button
                    onClick={() => {
                      runsFetchedRef.current = false;
                      fetchRuns();
                    }}
                    className="mt-2 text-xs text-blue-500 hover:underline flex items-center gap-1"
                  >
                    <FaHistory className="w-3 h-3" /> Refresh runs
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Evidence modal — rendered outside the row to avoid z-index nesting */}
      {viewRun && (
        <RunEvidencePanel run={viewRun} onClose={() => setViewRun(null)} />
      )}
    </>
  );
}
