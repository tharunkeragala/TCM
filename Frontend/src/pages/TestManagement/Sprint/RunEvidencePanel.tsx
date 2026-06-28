import { useEffect, useState } from "react";
import {
  FaCamera,
  FaCheckCircle,
  FaClipboardList,
  FaSpinner,
  FaTimes,
  FaTimesCircle,
  FaUser,
} from "react-icons/fa";
import API from "../../../services/api";
import { getToken, timeAgo } from "./utils.ts";
import type { RunStep, TestRun } from "./types.ts";

// ─── Run status config (icons as JSX here since this component renders them) ──

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

function formatDuration(ms?: number | null): string | null {
  if (!ms) return null;
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface RunEvidencePanelProps {
  run: TestRun;
  onClose: () => void;
}

export function RunEvidencePanel({ run, onClose }: RunEvidencePanelProps) {
  const [steps, setSteps] = useState<RunStep[]>(run.steps ?? []);
  const [loading, setLoading] = useState(!run.steps);
  const rs = RUN_STATUS[run.status] ?? RUN_STATUS.pending;

  useEffect(() => {
    if (run.steps) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await API.get(`/api/playwright/runs/${run.id}/steps`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        const data = res.data?.data ?? res.data;
        if (!cancelled && Array.isArray(data)) setSteps(data);
      } catch {
        if (!cancelled) setSteps([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [run]);

  return (
    <div className="fixed inset-0 z-[99999999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <FaCamera className="w-4 h-4 text-gray-400" />
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                Run #{run.id} — Evidence
              </h3>
              <p className="text-xs text-gray-400 flex items-center gap-1">
                {run.executed_by_name && (
                  <>
                    <FaUser className="w-2.5 h-2.5" />
                    {run.executed_by_name} ·{" "}
                  </>
                )}
                {timeAgo(run.started_at)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full ${rs.bg}`}
            >
              {rs.icon} {rs.label}
            </span>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label="Close evidence panel"
            >
              <FaTimes className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-gray-400">
              <FaSpinner className="animate-spin w-5 h-5 mr-2" /> Loading
              evidence…
            </div>
          ) : steps.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">
              No step evidence recorded for this run.
            </div>
          ) : (
            steps.map((step, i) => {
              const stepRs = RUN_STATUS[step.status] ?? RUN_STATUS.pending;
              const hasMeta =
                step.expected_result ||
                step.error_message ||
                step.screenshot_path;
              return (
                <div
                  key={step.id ?? i}
                  className={`rounded-xl border overflow-hidden ${
                    step.status === "failed"
                      ? "border-red-200 dark:border-red-800"
                      : "border-gray-200 dark:border-gray-700"
                  }`}
                >
                  {/* Step header */}
                  <div
                    className={`flex items-center justify-between gap-3 px-4 py-2.5 ${
                      step.status === "failed"
                        ? "bg-red-50 dark:bg-red-900/20"
                        : "bg-gray-50 dark:bg-gray-800"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-6 h-6 rounded-full bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 flex items-center justify-center text-xs font-bold text-gray-600 dark:text-gray-300 flex-shrink-0">
                        {step.step_number}
                      </span>
                      <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                        {step.action}
                      </span>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full ${stepRs.bg}`}
                    >
                      {stepRs.icon} {stepRs.label}
                    </span>
                  </div>

                  {/* Step meta */}
                  {hasMeta && (
                    <div className="px-4 py-3 space-y-2">
                      {step.expected_result && (
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          <span className="font-medium text-gray-600 dark:text-gray-300">
                            Expected:{" "}
                          </span>
                          {step.expected_result}
                        </p>
                      )}
                      {step.duration_ms != null && (
                        <p className="text-xs text-gray-400">
                          Duration: {formatDuration(step.duration_ms)}
                        </p>
                      )}
                      {step.error_message && (
                        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-2.5">
                          <p className="text-xs text-red-700 dark:text-red-300 font-mono break-all">
                            {step.error_message}
                          </p>
                        </div>
                      )}
                      {step.screenshot_path && (
                        <a
                          href={`/screenshots/${step.screenshot_path}`}
                          target="_blank"
                          rel="noreferrer"
                          className="block rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 hover:opacity-90 transition-opacity"
                        >
                          <img
                            src={`/screenshots/${step.screenshot_path}`}
                            alt={`Step ${step.step_number} screenshot`}
                            className="w-full max-h-64 object-contain bg-gray-950"
                          />
                        </a>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
