import { useEffect, useState } from "react";
import { Link } from "react-router";
import { FaTimes, FaExternalLinkAlt, FaClipboardList, FaHistory } from "react-icons/fa";
import Alert from "../../components/ui/alert/Alert";
import API from "../../services/api";

const getToken = () => localStorage.getItem("token") || sessionStorage.getItem("token");

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

interface TestStep {
  step_number: number;
  action: string;
  expected_result: string;
}

export interface TestCaseDetailData {
  id: number;
  title: string;
  priority: string;
  status: string;
  preconditions?: string;
  owning_suite_id?: number;
  owning_suite_name?: string;
  linked_by_name?: string;
  linked_at?: string;
  steps: TestStep[];
}

interface ActivityEntry {
  id?: number;
  action?: string;
  description?: string;
  performed_by_name?: string;
  performed_by?: string;
  username?: string;
  created_at?: string;
  performed_at?: string;
  timestamp?: string;
}

export default function TestCaseDetailModal({
  testCase,
  currentSuiteId,
  projectName,
  suiteName,
  sprintName,
  onClose,
}: {
  testCase: TestCaseDetailData;
  currentSuiteId?: number;
  projectName?: string;
  suiteName?: string;
  sprintName?: string;
  onClose: () => void;
}) {
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [activityError, setActivityError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setActivityLoading(true);
      setActivityError(null);
      try {
        const res = await API.get(`/api/test-cases/${testCase.id}/activity`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        const rows = res.data?.data ?? res.data;
        if (!cancelled && Array.isArray(rows)) setActivity(rows);
      } catch {
        if (!cancelled) setActivityError("Couldn't load activity history.");
      } finally {
        if (!cancelled) setActivityLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [testCase.id]);

  const formatTimestamp = (entry: ActivityEntry) => {
    const raw = entry.created_at || entry.performed_at || entry.timestamp;
    if (!raw) return null;
    const d = new Date(raw);
    return isNaN(d.getTime()) ? raw : d.toLocaleString();
  };

  const formatActor = (entry: ActivityEntry) =>
    entry.performed_by_name || entry.performed_by || entry.username || "Someone";

  const formatDescription = (entry: ActivityEntry) =>
    entry.description || entry.action || "Updated this test case";

  return (
    <div className="fixed inset-0 z-[9999999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500 min-w-0">
            {projectName && <span className="truncate">{projectName}</span>}
            {projectName && suiteName && <span>/</span>}
            {suiteName && <span className="truncate">{suiteName}</span>}
            <span className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 font-mono text-[10px] flex-shrink-0">
              TC-{testCase.id}
            </span>
          </div>
          <div className="flex items-center gap-4 flex-shrink-0">
            <Link
              to={`/test-cases/${testCase.id}`}
              target="_blank"
              className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 flex items-center gap-1.5"
              title="Open full page in a new tab"
            >
              <FaExternalLinkAlt className="w-3 h-3" /> Full page
            </Link>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl font-bold"
            >
              <FaTimes />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-[1fr_300px]">
          {/* Left: title, steps, activity */}
          <div className="overflow-y-auto p-6 border-r border-gray-100 dark:border-gray-800 space-y-6">
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{testCase.title}</h1>

            {testCase.owning_suite_id !== undefined &&
              currentSuiteId !== undefined &&
              testCase.owning_suite_id !== currentSuiteId && (
                <Alert
                  variant="warning"
                  title="Tracked here only"
                  message={`Owned by suite "${testCase.owning_suite_name}" — included in this sprint board for tracking purposes only.`}
                />
              )}

            {testCase.preconditions && (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1.5">
                  Preconditions
                </h3>
                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                  {testCase.preconditions}
                </p>
              </div>
            )}

            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-2">
                Test Steps ({testCase.steps.length})
              </h3>
              {testCase.steps.length === 0 ? (
                <p className="text-sm text-gray-400 dark:text-gray-500 italic">No steps defined.</p>
              ) : (
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 uppercase text-xs">
                      <tr>
                        <th className="text-left py-2 px-3 w-10">#</th>
                        <th className="text-left py-2 px-3">Action</th>
                        <th className="text-left py-2 px-3">Expected Result</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {testCase.steps.map((step) => (
                        <tr key={step.step_number}>
                          <td className="py-2.5 px-3 text-gray-400 align-top">{step.step_number}</td>
                          <td className="py-2.5 px-3 text-gray-700 dark:text-gray-300 align-top">{step.action}</td>
                          <td className="py-2.5 px-3 text-gray-500 dark:text-gray-400 align-top">
                            {step.expected_result || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white mb-3">
                <FaHistory className="w-3.5 h-3.5 text-gray-400" /> Activity
              </h3>

              {activityLoading ? (
                <p className="text-sm text-gray-400 dark:text-gray-500">Loading…</p>
              ) : activityError ? (
                <p className="text-sm text-gray-400 dark:text-gray-500">{activityError}</p>
              ) : activity.length === 0 ? (
                <p className="text-sm text-gray-400 dark:text-gray-500 italic">No activity recorded yet.</p>
              ) : (
                <ul className="space-y-3">
                  {activity.map((entry, i) => {
                    const ts = formatTimestamp(entry);
                    return (
                      <li key={entry.id ?? i} className="text-sm">
                        <p className="text-gray-700 dark:text-gray-300">
                          <span className="font-medium text-gray-900 dark:text-white">{formatActor(entry)}</span>{" "}
                          {formatDescription(entry)}
                        </p>
                        {ts && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{ts}</p>}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          {/* Right: details sidebar */}
          <div className="overflow-y-auto p-5 bg-gray-50/50 dark:bg-gray-800/30 space-y-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1.5">
                Status
              </p>
              <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded-full ${STATUS_COLORS[testCase.status] || ""}`}>
                {testCase.status}
              </span>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1.5">
                Priority
              </p>
              <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded-full ${PRIORITY_COLORS[testCase.priority] || ""}`}>
                {testCase.priority}
              </span>
            </div>

            {suiteName && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1">
                  Suite
                </p>
                <div className="flex items-center gap-1.5 text-sm text-gray-800 dark:text-gray-200">
                  <FaClipboardList className="w-3 h-3 text-purple-500 flex-shrink-0" />
                  {suiteName}
                </div>
              </div>
            )}

            {projectName && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1">
                  Project
                </p>
                <p className="text-sm text-gray-800 dark:text-gray-200">{projectName}</p>
              </div>
            )}

            {sprintName && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1">
                  Sprint
                </p>
                <p className="text-sm text-gray-800 dark:text-gray-200">{sprintName}</p>
              </div>
            )}

            {testCase.linked_by_name && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1">
                  Linked By
                </p>
                <p className="text-sm text-gray-800 dark:text-gray-200">{testCase.linked_by_name}</p>
                {testCase.linked_at && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                    {new Date(testCase.linked_at).toLocaleString()}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}