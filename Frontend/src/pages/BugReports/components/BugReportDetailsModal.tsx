import { useEffect, useMemo, useState } from "react";
import { FaComment, FaHistory, FaImage, FaPlus } from "react-icons/fa";
import {
  bugReportAPI,
  BugComment,
  BugHistory,
  BugReportSummary,
  BugScreenshot,
} from "../../../services/bugReportAPI";
import useFetchWithAuth from "../../../hooks/useFetchWithAuth";

interface BugReportDetailsModalProps {
  bugId: number;
  onClose: () => void;
  onUpdate: () => void;
}

const SEVERITY_COLORS: Record<string, string> = {
  Critical: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  High: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  Medium: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  Low: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
};

const STATUS_COLORS: Record<string, string> = {
  Open: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  "In Progress": "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  Reopened: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  Resolved: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  Closed: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
  Pass: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  Fail: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  Blocked: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  "No Test": "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
};

function parseApiDate(value?: string | null): Date | null {
  if (!value) return null;

  // SQL Server can return:
  // 2026-09-02T15:30:45.123
  // 2026-09-02 15:30:45.123
  // 2026-09-02T10:00:45.123Z
  const normalized = String(value).trim().replace(" ", "T");

  if (!normalized) return null;

  // If API explicitly gives a timezone, allow JS to perform
  // the correct timezone conversion.
  const hasTimezone =
    /Z$/i.test(normalized) ||
    /[+-]\d{2}:\d{2}$/.test(normalized);

  if (hasTimezone) {
    const date = new Date(normalized);

    return Number.isNaN(date.getTime()) ? null : date;
  }

  // SQL DATETIME / DATETIME2 commonly arrives without timezone.
  // Parse each part manually so JavaScript does not unexpectedly
  // change the stored time.
  const match = normalized.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?(?:\.(\d+))?$/
  );

  if (match) {
    const [
      ,
      year,
      month,
      day,
      hour,
      minute,
      second = "0",
      fraction = "0",
    ] = match;

    const milliseconds = Number((fraction + "000").slice(0, 3));

    const date = new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second),
      milliseconds,
    );

    return Number.isNaN(date.getTime()) ? null : date;
  }

  const fallback = new Date(normalized);

  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function formatDateTime(value?: string | null) {
  const date = parseApiDate(value);

  if (!date) return "—";

  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function getDateTimestamp(value?: string | null) {
  return parseApiDate(value)?.getTime() ?? 0;
}

function InfoItem({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500">{label}</p>
      <div className="text-sm font-medium text-gray-800 dark:text-gray-200">{value || "—"}</div>
    </div>
  );
}

export default function BugReportDetailsModal({
  bugId,
  onClose,
  onUpdate,
}: BugReportDetailsModalProps) {
  const [bug, setBug] = useState<any>(null);
  const [screenshots, setScreenshots] = useState<BugScreenshot[]>([]);
  const [history, setHistory] = useState<BugHistory[]>([]);
  const [summary, setSummary] = useState<BugReportSummary[]>([]);
  const [comments, setComments] = useState<BugComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "history" | "comments">("overview");
  const [newComment, setNewComment] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [showIterationForm, setShowIterationForm] = useState(false);
  const [iterationData, setIterationData] = useState({
    sprint_id: "",
    status: "Pass",
    status_reason: "",
    notes: "",
  });

  const { data: sprints } = useFetchWithAuth<any[]>("/api/sprints");
  const sortedHistory = useMemo(() => {
  return [...history].sort((a, b) => {
    const bTime = getDateTimestamp(b.test_date || b.created_at);
    const aTime = getDateTimestamp(a.test_date || a.created_at);

    return bTime - aTime;
  });
}, [history]);

const sortedComments = useMemo(() => {
  return [...comments].sort((a, b) => {
    return (
      getDateTimestamp(b.created_at) -
      getDateTimestamp(a.created_at)
    );
  });
}, [comments]);

  useEffect(() => {
    loadBugDetails();
  }, [bugId]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  const loadBugDetails = async () => {
    try {
      setLoading(true);
      const response = await bugReportAPI.getBugReportById(bugId);
      setBug(response.bug);
      setScreenshots(response.screenshots || []);
      setHistory(response.history || []);
      setSummary(response.summary || []);
      setComments(response.comments || []);
    } catch (error) {
      console.error("Error loading bug details:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    try {
      setActionLoading(true);
      await bugReportAPI.addBugComment(bugId, newComment.trim());
      setNewComment("");
      await loadBugDetails();
    } catch (error) {
      console.error("Error adding comment:", error);
      window.alert("Failed to add comment");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRecordIteration = async () => {
    if (!iterationData.sprint_id || !iterationData.status) {
      window.alert("Please select sprint and status");
      return;
    }

    try {
      setActionLoading(true);
      await bugReportAPI.recordBugIteration(bugId, {
        ...iterationData,
        sprint_id: Number(iterationData.sprint_id),
      });
      setIterationData({ sprint_id: "", status: "Pass", status_reason: "", notes: "" });
      setShowIterationForm(false);
      await loadBugDetails();
      onUpdate();
    } catch (error) {
      console.error("Error recording iteration:", error);
      window.alert("Failed to record iteration");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm">
        <div className="w-full max-w-xl rounded-2xl bg-white py-14 text-center text-sm text-gray-400 shadow-2xl dark:bg-gray-900">
          Loading bug details…
        </div>
      </div>
    );
  }

  if (!bug) return null;

  return (
    <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-900">
        <div className="flex-shrink-0 border-b border-gray-200 bg-gray-50 px-6 py-4 dark:border-gray-700 dark:bg-gray-800/50">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{bug.report_id}</h2>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${SEVERITY_COLORS[bug.severity] || "bg-gray-100 text-gray-600"}`}>
                  {bug.severity}
                </span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_COLORS[bug.status] || "bg-gray-100 text-gray-600"}`}>
                  {bug.status}
                </span>
              </div>
              <p className="mt-1 truncate text-sm text-gray-500 dark:text-gray-400">{bug.title}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-xl font-bold text-gray-400 transition-colors hover:text-gray-600 dark:hover:text-gray-200"
              aria-label="Close"
            >
              &times;
            </button>
          </div>

          <div className="mt-4 flex gap-1 overflow-x-auto border-b border-gray-200 dark:border-gray-700">
            {[
              ["overview", "Overview"],
              ["history", `History (${history.length})`],
              ["comments", `Comments (${comments.length})`],
            ].map(([key, label]) => (
              <button
                key={key}
                onClick={() => setActiveTab(key as typeof activeTab)}
                className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors ${activeTab === key ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-blue-600 dark:text-gray-400"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {activeTab === "overview" && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 gap-4 rounded-2xl border border-gray-200 p-5 sm:grid-cols-2 lg:grid-cols-4 dark:border-gray-700">
  <InfoItem label="Project" value={bug.project_name} />
  <InfoItem label="Function" value={bug.function_name} />
  <InfoItem label="Sprint" value={bug.sprint_name || "—"} />
  <InfoItem
    label="Assigned To"
    value={bug.assigned_to_name || "Unassigned"}
  />

  <InfoItem label="Priority" value={bug.priority} />
  <InfoItem label="Environment" value={bug.environment || "—"} />
  <InfoItem
    label="Affected Version"
    value={bug.affected_version || "—"}
  />
  <InfoItem
    label="Reported By"
    value={bug.reported_by_name || "—"}
  />

  <InfoItem
    label="First Reported"
    value={formatDateTime(
      bug.first_reported_date || bug.created_at
    )}
  />

  <InfoItem
    label="Last Updated"
    value={formatDateTime(bug.updated_at)}
  />
</div>

              <div className="rounded-2xl border border-gray-200 p-5 dark:border-gray-700">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Description / Scenario</p>
                <p className="whitespace-pre-wrap text-sm leading-6 text-gray-700 dark:text-gray-300">
                  {bug.description || "No description provided."}
                </p>
              </div>

              {screenshots.length > 0 && (
                <div className="rounded-2xl border border-gray-200 p-5 dark:border-gray-700">
                  <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
                    <FaImage className="h-3.5 w-3.5 text-purple-500" /> Screenshots ({screenshots.length})
                  </h3>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {screenshots.map((screenshot) => (
                      <div key={screenshot.id} className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
                        <img
                          src={screenshot.screenshot_path}
                          alt={screenshot.screenshot_name}
                          className="h-52 w-full bg-gray-50 object-cover dark:bg-gray-800"
                        />
                        <div className="px-3 py-2">
                          <p className="truncate text-sm font-medium text-gray-800 dark:text-gray-200">{screenshot.screenshot_name}</p>
                          {screenshot.description && (
                            <p className="mt-1 text-xs text-gray-400">{screenshot.description}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "history" && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
                  <FaHistory className="h-3.5 w-3.5 text-blue-500" /> Bug Iteration History
                </h3>
                <button
                  onClick={() => setShowIterationForm((value) => !value)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
                >
                  <FaPlus className="h-3 w-3" /> Record Iteration
                </button>
              </div>

              {showIterationForm && (
                <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-4 dark:border-blue-800 dark:bg-blue-900/10">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <select
                      value={iterationData.sprint_id}
                      onChange={(e) => setIterationData({ ...iterationData, sprint_id: e.target.value })}
                      className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                    >
                      <option value="">Select Sprint</option>
                      {sprints?.map((sprint) => (
                        <option key={sprint.id} value={sprint.id}>{sprint.sprint_name}</option>
                      ))}
                    </select>
                    <select
                      value={iterationData.status}
                      onChange={(e) => setIterationData({ ...iterationData, status: e.target.value })}
                      className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                    >
                      {['Pass', 'Fail', 'Blocked', 'No Test', 'Reopened'].map((status) => <option key={status}>{status}</option>)}
                    </select>
                    <input
                      value={iterationData.status_reason}
                      onChange={(e) => setIterationData({ ...iterationData, status_reason: e.target.value })}
                      placeholder="Reason"
                      className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                    />
                    <input
                      value={iterationData.notes}
                      onChange={(e) => setIterationData({ ...iterationData, notes: e.target.value })}
                      placeholder="Additional notes"
                      className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                    />
                  </div>
                  <div className="mt-3 flex justify-end gap-2">
                    <button onClick={() => setShowIterationForm(false)} className="rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300">Cancel</button>
                    <button onClick={handleRecordIteration} disabled={actionLoading} className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">{actionLoading ? "Recording…" : "Record"}</button>
                  </div>
                </div>
              )}

              {summary.length > 0 && (
                <div className="rounded-2xl border border-gray-200 p-4 dark:border-gray-700">
                  <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">Sprint Summary</h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-xs">
                      <thead className="text-gray-400 dark:text-gray-500">
                        <tr>
                          <th className="px-2 py-2 font-medium">Sprint</th>
                          <th className="px-2 py-2 font-medium">Pass</th>
                          <th className="px-2 py-2 font-medium">Fail</th>
                          <th className="px-2 py-2 font-medium">Blocked</th>
                          <th className="px-2 py-2 font-medium">No Test</th>
                          <th className="px-2 py-2 font-medium">Latest</th>
                        </tr>
                      </thead>
                      <tbody>
                        {summary.map((item) => (
                          <tr key={item.id} className="border-t border-gray-100 dark:border-gray-800">
                            <td className="px-2 py-2 font-medium text-gray-800 dark:text-gray-200">{item.sprint_name || `Sprint ${item.sprint_id}`}</td>
                            <td className="px-2 py-2 text-green-600">{item.pass_count}</td>
                            <td className="px-2 py-2 text-red-600">{item.fail_count}</td>
                            <td className="px-2 py-2 text-amber-600">{item.blocked_count}</td>
                            <td className="px-2 py-2 text-gray-500">{item.no_test_count}</td>
                            <td className="px-2 py-2"><span className={`rounded-full px-2 py-0.5 font-semibold ${STATUS_COLORS[item.latest_status || ""] || "bg-gray-100 text-gray-600"}`}>{item.latest_status || "—"}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {history.length === 0 ? (
                <p className="py-8 text-center text-sm italic text-gray-400">No iteration history yet.</p>
              ) : (
                <div className="space-y-2">
                  {sortedHistory.map((item) => (
                    <div key={item.id} className="flex items-start gap-3 rounded-xl border border-gray-200 px-4 py-3 dark:border-gray-700">
                      <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] text-gray-500 dark:bg-gray-800 dark:text-gray-400">C{item.cycle_number}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{item.sprint_name || `Cycle ${item.cycle_number}`}</p>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_COLORS[item.status] || "bg-gray-100 text-gray-600"}`}>{item.status}</span>
                        </div>
                        {item.status_reason && <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{item.status_reason}</p>}
                        {item.notes && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{item.notes}</p>}
                        <p className="mt-1 text-[11px] text-gray-400">
  Tested by {item.tested_by_name || "Unknown"} ·{" "}
  {formatDateTime(item.test_date || item.created_at)}
</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "comments" && (
            <div className="space-y-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
                <FaComment className="h-3.5 w-3.5 text-blue-500" /> Comments ({comments.length})
              </h3>

              <div className="flex gap-2">
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                      e.preventDefault();
                      handleAddComment();
                    }
                  }}
                  rows={2}
                  placeholder="Add a comment… (Ctrl/Cmd + Enter to save)"
                  className="flex-1 resize-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                />
                <button
                  onClick={handleAddComment}
                  disabled={actionLoading || !newComment.trim()}
                  className="self-end rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {actionLoading ? "Adding…" : "Add"}
                </button>
              </div>

              {comments.length === 0 ? (
                <p className="py-8 text-center text-sm italic text-gray-400">No comments yet.</p>
              ) : (
                <div className="space-y-2">
                  {sortedComments.map((comment) => (
                    <div key={comment.id} className="rounded-xl border border-gray-200 px-4 py-3 dark:border-gray-700">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{comment.commented_by_name || "System"}</p>
                          {comment.is_system && <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-900 dark:text-blue-300">System</span>}
                        </div>
                       <span className="text-[11px] text-gray-400">
  {formatDateTime(comment.created_at)}
</span>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-gray-600 dark:text-gray-300">{comment.comment}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-shrink-0 justify-end border-t border-gray-200 bg-gray-50 px-6 py-4 dark:border-gray-700 dark:bg-gray-800/50">
          <button onClick={onClose} className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600">Close</button>
        </div>
      </div>
    </div>
  );
}
