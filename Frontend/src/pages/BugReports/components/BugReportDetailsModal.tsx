import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  FaComment,
  FaClipboardList,
  FaHistory,
  FaImage,
  FaPlus,
  FaLink,
  FaUnlink,
  FaExternalLinkAlt,
} from "react-icons/fa";
import {
  bugReportAPI,
  BugComment,
  BugHistory,
  BugReportSummary,
  BugScreenshot,
  LinkedTestCase,
  TestCaseDetails,
  TestCaseListItem,
} from "../../../services/bugReportAPI";
import useFetchWithAuth from "../../../hooks/useFetchWithAuth";

interface BugReportDetailsModalProps {
  bugId: number;
  onClose: () => void;
  onUpdate: () => void;
}

interface User {
  id: number;
  username: string;
  role_name?: string | null;
  is_active?: boolean;
}

const SEVERITY_COLORS: Record<string, string> = {
  Critical: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  High: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  Medium: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  Low: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
};

const STATUS_COLORS: Record<string, string> = {
  Open: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  "In Progress":
    "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  Reopened: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  Resolved: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  Closed: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
  Pass: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  Fail: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  Blocked: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  "No Test": "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
  "Not Tested": "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
};

function parseApiDate(value?: string | null): Date | null {
  if (!value) return null;

  /*
   * SQL Server DATETIME values in this module are written with GETDATE().
   * They represent the server's local wall-clock time.
   *
   * node-mssql can serialize a DATETIME value as an ISO string ending in "Z".
   * If that "Z" is passed directly to new Date(), the browser treats the value
   * as UTC and adds the local +05:30 offset again.
   *
   * Example:
   * Stored SQL time: 12:40 PM
   * API value:       12:40:00.000Z
   * Browser output:  06:10 PM  <-- incorrect for this database design
   *
   * For this module we therefore remove a trailing Z and parse the SQL
   * wall-clock components directly as local time.
   */
  const normalized = String(value).trim().replace(" ", "T").replace(/Z$/i, "");

  if (!normalized) return null;

  if (/[+-]\d{2}:\d{2}$/.test(normalized)) {
    const offsetDate = new Date(normalized);

    return Number.isNaN(offsetDate.getTime()) ? null : offsetDate;
  }

  const match = normalized.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?(?:\.(\d+))?$/,
  );

  if (match) {
    const [, year, month, day, hour, minute, second = "0", fraction = "0"] =
      match;

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

function InfoItem({
  label,
  value,
}: {
  label: string;
  value?: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-1 text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500">
        {label}
      </p>

      <div className="text-sm font-medium text-gray-800 dark:text-gray-200">
        {value || "—"}
      </div>
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
  const [linkedTestCases, setLinkedTestCases] = useState<LinkedTestCase[]>([]);
  const [selectedTestCaseId, setSelectedTestCaseId] = useState("");
  const [testCaseLinkLoading, setTestCaseLinkLoading] = useState(false);
  const [testCaseDetailsLoading, setTestCaseDetailsLoading] = useState(false);
  const [selectedTestCaseDetails, setSelectedTestCaseDetails] = useState<TestCaseDetails | null>(null);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<
    "overview" | "history" | "comments"
  >("overview");

  const [newComment, setNewComment] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const [selectedAssignee, setSelectedAssignee] = useState("");
  const [assignmentLoading, setAssignmentLoading] = useState(false);

  const [showIterationForm, setShowIterationForm] = useState(false);

  const [iterationData, setIterationData] = useState({
    sprint_id: "",
    status: "Pass",
    status_reason: "",
    notes: "",
  });

  const { data: sprints } = useFetchWithAuth<any[]>("/api/sprints");

  const { data: users } = useFetchWithAuth<User[]>("/api/users");

  const { data: allTestCases } = useFetchWithAuth<TestCaseListItem[]>(
    "/api/test-cases",
  );

  const assignableUsers = useMemo(() => {
    const activeUsers = (users ?? []).filter(
      (user) => user.is_active !== false,
    );

    return [...activeUsers].sort((a, b) => {
      const aDeveloper = (a.role_name || "")
        .toLowerCase()
        .includes("developer");

      const bDeveloper = (b.role_name || "")
        .toLowerCase()
        .includes("developer");

      if (aDeveloper !== bDeveloper) {
        return aDeveloper ? -1 : 1;
      }

      return a.username.localeCompare(b.username);
    });
  }, [users]);

  const availableTestCases = useMemo(() => {
    const linkedIds = new Set(
      linkedTestCases.map((item) => Number(item.test_case_id)),
    );

    return (allTestCases ?? [])
      .filter((testCase) => !linkedIds.has(Number(testCase.id)))
      .filter((testCase) => {
        if (!bug?.project_name) return true;
        return !testCase.project_name || testCase.project_name === bug.project_name;
      })
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [allTestCases, linkedTestCases, bug?.project_name]);

  const sortedHistory = useMemo(() => {
    return [...history].sort((a, b) => {
      const bTime = getDateTimestamp(b.test_date || b.created_at);

      const aTime = getDateTimestamp(a.test_date || a.created_at);

      return bTime - aTime;
    });
  }, [history]);

  const sortedComments = useMemo(() => {
    return [...comments].sort((a, b) => {
      return getDateTimestamp(b.created_at) - getDateTimestamp(a.created_at);
    });
  }, [comments]);

  useEffect(() => {
    loadBugDetails();
  }, [bugId]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;

      if (selectedTestCaseDetails) {
        setSelectedTestCaseDetails(null);
        return;
      }

      onClose();
    };

    document.addEventListener("keydown", handleEscape);

    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose, selectedTestCaseDetails]);

  const loadBugDetails = async () => {
    try {
      setLoading(true);

      const response = await bugReportAPI.getBugReportById(bugId);

      setBug(response.bug);
      setSelectedAssignee(
        response.bug?.assigned_to ? String(response.bug.assigned_to) : "",
      );
      setScreenshots(response.screenshots || []);
      setHistory(response.history || []);
      setSummary(response.summary || []);
      setLinkedTestCases(response.linkedTestCases || []);
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

      setIterationData({
        sprint_id: "",
        status: "Pass",
        status_reason: "",
        notes: "",
      });

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

  const handleAssignUser = async () => {
    if (!selectedAssignee) {
      window.alert("Please select a user to assign");
      return;
    }

    if (Number(selectedAssignee) === Number(bug?.assigned_to)) {
      return;
    }

    try {
      setAssignmentLoading(true);

      await bugReportAPI.updateBugReport(bugId, {
        assigned_to: Number(selectedAssignee),
      });

      await loadBugDetails();
      onUpdate();
    } catch (error) {
      console.error("Error assigning user:", error);

      window.alert("Failed to assign user");
    } finally {
      setAssignmentLoading(false);
    }
  };

  const handleLinkTestCase = async () => {
    if (!selectedTestCaseId) return;

    try {
      setTestCaseLinkLoading(true);

      await bugReportAPI.linkTestCase(
        bugId,
        Number(selectedTestCaseId),
      );

      setSelectedTestCaseId("");
      await loadBugDetails();
      onUpdate();
    } catch (error) {
      console.error("Error linking test case:", error);
      window.alert("Failed to link test case");
    } finally {
      setTestCaseLinkLoading(false);
    }
  };

  const handleUnlinkTestCase = async (testCaseId: number) => {
    try {
      setTestCaseLinkLoading(true);

      await bugReportAPI.unlinkTestCase(bugId, testCaseId);

      if (selectedTestCaseDetails?.id === testCaseId) {
        setSelectedTestCaseDetails(null);
      }

      await loadBugDetails();
      onUpdate();
    } catch (error) {
      console.error("Error unlinking test case:", error);
      window.alert("Failed to unlink test case");
    } finally {
      setTestCaseLinkLoading(false);
    }
  };

  const handleOpenTestCase = async (testCaseId: number) => {
    try {
      setTestCaseDetailsLoading(true);

      const response = await bugReportAPI.getTestCaseById(testCaseId);
      setSelectedTestCaseDetails(response.data || null);
    } catch (error) {
      console.error("Error loading linked test case:", error);
      window.alert("Failed to load test case details");
    } finally {
      setTestCaseDetailsLoading(false);
    }
  };

  const handleRecordIterationClick = () => {
    setActiveTab("history");
    setShowIterationForm((value) => !value);
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
        {/* Header */}
        <div className="flex-shrink-0 border-b border-gray-200 bg-gray-50 px-6 py-4 dark:border-gray-700 dark:bg-gray-800/50">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {bug.report_id}
                </h2>

                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    SEVERITY_COLORS[bug.severity] || "bg-gray-100 text-gray-600"
                  }`}
                >
                  {bug.severity}
                </span>

                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    STATUS_COLORS[bug.current_cycle_status || "Not Tested"] ||
                    "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                  }`}
                  title="Latest cycle status"
                >
                  {bug.current_cycle_status || "Not Tested"}
                </span>
              </div>

              <p className="mt-1 truncate text-sm text-gray-500 dark:text-gray-400">
                {bug.title}
              </p>
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

          {/* Tabs + Record Iteration */}
          <div className="mt-4 flex items-center justify-between gap-3 border-b border-gray-200 dark:border-gray-700">
            <div className="flex min-w-0 gap-1 overflow-x-auto">
              {[
                ["overview", "Overview"],
                ["history", `History (${history.length})`],
                ["comments", `Log (${comments.length})`],
              ].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveTab(key as typeof activeTab)}
                  className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                    activeTab === key
                      ? "border-blue-600 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-blue-600 dark:text-gray-400"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={handleRecordIterationClick}
              className="mb-1 inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
            >
              <FaPlus className="h-3 w-3" />
              Record Iteration
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {/* ================= OVERVIEW ================= */}
          {activeTab === "overview" && (
            <div className="space-y-5">
              {/* Bug Information */}
              <div className="grid grid-cols-1 gap-4 rounded-2xl border border-gray-200 p-5 sm:grid-cols-2 lg:grid-cols-4 dark:border-gray-700">
                <InfoItem label="Project" value={bug.project_name} />

                <InfoItem label="Function" value={bug.function_name} />

                <InfoItem label="Sprint" value={bug.sprint_name || "—"} />

                <div>
                  <p className="mb-1 text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500">
                    Developer
                  </p>

                  <div className="flex min-w-0 items-center gap-2">
                    <select
                      value={selectedAssignee}
                      onChange={(e) => setSelectedAssignee(e.target.value)}
                      disabled={assignmentLoading}
                      className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                    >
                      <option value="">Select user</option>

                      {assignableUsers.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.username}
                          {user.role_name ? ` - ${user.role_name}` : ""}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={handleAssignUser}
                      disabled={
                        assignmentLoading ||
                        !selectedAssignee ||
                        Number(selectedAssignee) === Number(bug.assigned_to)
                      }
                      className="inline-flex flex-shrink-0 items-center justify-center rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {assignmentLoading
                        ? "Assigning…"
                        : bug.assigned_to
                          ? "Update"
                          : "Assign"}
                    </button>
                  </div>

                  <p className="mt-1 truncate text-[11px] text-gray-400 dark:text-gray-500">
                    Current: {bug.assigned_to_name || "Unassigned"}
                  </p>
                </div>

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
                    bug.first_reported_date || bug.created_at,
                  )}
                />

                <InfoItem
                  label="Last Updated"
                  value={formatDateTime(bug.updated_at)}
                />
              </div>

              {/* Description */}
              <div className="rounded-2xl border border-gray-200 p-5 dark:border-gray-700">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                  Description / Scenario
                </p>

                <p className="whitespace-pre-wrap text-sm leading-6 text-gray-700 dark:text-gray-300">
                  {bug.description || "No description provided."}
                </p>
              </div>

              {/* Linked Test Cases */}
              <div className="rounded-2xl border border-gray-200 p-5 dark:border-gray-700">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
                      <FaLink className="h-3.5 w-3.5 text-blue-500" />
                      Linked Test Cases ({linkedTestCases.length})
                    </h3>
                    <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                      Optional. Link one or more test cases related to this bug.
                    </p>
                  </div>
                </div>

                <div className="mb-4 flex flex-col gap-2 sm:flex-row">
                  <select
                    value={selectedTestCaseId}
                    onChange={(e) => setSelectedTestCaseId(e.target.value)}
                    disabled={testCaseLinkLoading || availableTestCases.length === 0}
                    className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                  >
                    <option value="">
                      {availableTestCases.length > 0
                        ? "Select test case to link"
                        : "No additional test cases available"}
                    </option>

                    {availableTestCases.map((testCase) => (
                      <option key={testCase.id} value={testCase.id}>
                        TC-{testCase.id} - {testCase.title}
                        {testCase.suite_name ? ` (${testCase.suite_name})` : ""}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={handleLinkTestCase}
                    disabled={testCaseLinkLoading || !selectedTestCaseId}
                    className="inline-flex flex-shrink-0 items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <FaPlus className="h-3 w-3" />
                    {testCaseLinkLoading ? "Linking…" : "Link Test Case"}
                  </button>
                </div>

                {linkedTestCases.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-gray-300 px-4 py-6 text-center text-sm text-gray-400 dark:border-gray-700 dark:text-gray-500">
                    No test cases linked to this bug.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {linkedTestCases.map((testCase) => (
                      <div
                        key={testCase.link_id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 px-3 py-2.5 dark:border-gray-700"
                      >
                        <button
                          type="button"
                          onClick={() => handleOpenTestCase(testCase.test_case_id)}
                          className="min-w-0 flex-1 text-left"
                          title="Open test case"
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="flex-shrink-0 rounded bg-blue-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                              TC-{testCase.test_case_id}
                            </span>
                            <p className="truncate text-sm font-medium text-gray-800 hover:text-blue-600 dark:text-gray-200 dark:hover:text-blue-400">
                              {testCase.title}
                            </p>
                          </div>

                          <p className="mt-1 truncate text-[11px] text-gray-400 dark:text-gray-500">
                            {testCase.suite_name || "No suite"}
                            {testCase.status ? ` · ${testCase.status}` : ""}
                            {testCase.priority ? ` · ${testCase.priority}` : ""}
                            {` · ${Number(testCase.step_count || 0)} step${Number(testCase.step_count || 0) === 1 ? "" : "s"}`}
                          </p>
                        </button>

                        <div className="flex flex-shrink-0 items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenTestCase(testCase.test_case_id)}
                            disabled={testCaseDetailsLoading}
                            className="rounded-md p-2 text-blue-600 transition-colors hover:bg-blue-100 disabled:opacity-50 dark:text-blue-400 dark:hover:bg-blue-900/30"
                            title="Quick View"
                          >
                            <FaExternalLinkAlt className="h-3 w-3" />
                          </button>

                          <Link
                            to={`/test-cases/${testCase.test_case_id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="rounded-md px-2 py-1.5 text-[11px] font-medium text-indigo-600 transition-colors hover:bg-indigo-100 dark:text-indigo-400 dark:hover:bg-indigo-900/30"
                            title="Open Full Test Case View"
                          >
                            Full View
                          </Link>

                          <button
                            type="button"
                            onClick={() => handleUnlinkTestCase(testCase.test_case_id)}
                            disabled={testCaseLinkLoading}
                            className="rounded-md p-2 text-red-500 transition-colors hover:bg-red-100 disabled:opacity-50 dark:hover:bg-red-900/30"
                            title="Unlink Test Case"
                          >
                            <FaUnlink className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Screenshots */}
              {screenshots.length > 0 && (
                <div className="rounded-2xl border border-gray-200 p-5 dark:border-gray-700">
                  <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
                    <FaImage className="h-3.5 w-3.5 text-purple-500" />
                    Screenshots ({screenshots.length})
                  </h3>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {screenshots.map((screenshot) => (
                      <div
                        key={screenshot.id}
                        className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700"
                      >
                        <img
                          src={screenshot.screenshot_path}
                          alt={screenshot.screenshot_name}
                          className="h-52 w-full bg-gray-50 object-cover dark:bg-gray-800"
                        />

                        <div className="px-3 py-2">
                          <p className="truncate text-sm font-medium text-gray-800 dark:text-gray-200">
                            {screenshot.screenshot_name}
                          </p>

                          {screenshot.description && (
                            <p className="mt-1 text-xs text-gray-400">
                              {screenshot.description}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================= HISTORY ================= */}
          {activeTab === "history" && (
            <div className="space-y-4">
              {/* Record Iteration Form */}
              {showIterationForm && (
                <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-3 dark:border-blue-800 dark:bg-blue-900/10">
                  <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
                    <select
                      value={iterationData.sprint_id}
                      onChange={(e) =>
                        setIterationData({
                          ...iterationData,
                          sprint_id: e.target.value,
                        })
                      }
                      className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                    >
                      <option value="">Select Sprint</option>

                      {sprints?.map((sprint) => (
                        <option key={sprint.id} value={sprint.id}>
                          {sprint.sprint_name}
                        </option>
                      ))}
                    </select>

                    <select
                      value={iterationData.status}
                      onChange={(e) =>
                        setIterationData({
                          ...iterationData,
                          status: e.target.value,
                        })
                      }
                      className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                    >
                      {["Pass", "Fail", "Blocked", "No Test", "Reopened"].map(
                        (status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ),
                      )}
                    </select>

                    <input
                      value={iterationData.status_reason}
                      onChange={(e) =>
                        setIterationData({
                          ...iterationData,
                          status_reason: e.target.value,
                        })
                      }
                      placeholder="Reason"
                      className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                    />

                    <input
                      value={iterationData.notes}
                      onChange={(e) =>
                        setIterationData({
                          ...iterationData,
                          notes: e.target.value,
                        })
                      }
                      placeholder="Additional notes"
                      className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                    />
                  </div>

                  <div className="mt-2.5 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowIterationForm(false)}
                      className="rounded-lg bg-gray-100 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300"
                    >
                      Cancel
                    </button>

                    <button
                      type="button"
                      onClick={handleRecordIteration}
                      disabled={actionLoading}
                      className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      {actionLoading ? "Recording…" : "Record"}
                    </button>
                  </div>
                </div>
              )}

              {/* Sprint Summary */}
              {summary.length > 0 && (
                <div className="rounded-2xl border border-gray-200 p-3 dark:border-gray-700">
                  <h3 className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">
                    Sprint Summary
                  </h3>

                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-xs">
                      <thead className="text-gray-400 dark:text-gray-500">
                        <tr>
                          <th className="px-2 py-1.5 font-medium">Sprint</th>

                          <th className="px-2 py-1.5 font-medium">Pass</th>

                          <th className="px-2 py-1.5 font-medium">Fail</th>

                          <th className="px-2 py-1.5 font-medium">Blocked</th>

                          <th className="px-2 py-1.5 font-medium">No Test</th>

                          <th className="px-2 py-1.5 font-medium">Latest</th>
                        </tr>
                      </thead>

                      <tbody>
                        {summary.map((item) => (
                          <tr
                            key={item.id}
                            className="border-t border-gray-100 dark:border-gray-800"
                          >
                            <td className="px-2 py-1.5 font-medium text-gray-800 dark:text-gray-200">
                              {item.sprint_name || `Sprint ${item.sprint_id}`}
                            </td>

                            <td className="px-2 py-1.5 text-green-600">
                              {item.pass_count}
                            </td>

                            <td className="px-2 py-1.5 text-red-600">
                              {item.fail_count}
                            </td>

                            <td className="px-2 py-1.5 text-amber-600">
                              {item.blocked_count}
                            </td>

                            <td className="px-2 py-1.5 text-gray-500">
                              {item.no_test_count}
                            </td>

                            <td className="px-2 py-1.5">
                              <span
                                className={`rounded-full px-2 py-0.5 font-semibold ${
                                  STATUS_COLORS[item.latest_status || ""] ||
                                  "bg-gray-100 text-gray-600"
                                }`}
                              >
                                {item.latest_status || "—"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Bug Iteration History */}
              <div>
                <h3 className="mb-2.5 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
                  <FaHistory className="h-3.5 w-3.5 text-blue-500" />
                  Bug Iteration History
                </h3>

                {history.length === 0 ? (
                  <p className="py-8 text-center text-sm italic text-gray-400">
                    No iteration history yet.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {sortedHistory.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-start gap-2.5 rounded-xl border border-gray-200 px-3 py-2 dark:border-gray-700"
                      >
                        <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                          C{item.cycle_number}
                        </span>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                              {item.sprint_name || `Cycle ${item.cycle_number}`}
                            </p>

                            <span
                              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                STATUS_COLORS[item.status] ||
                                "bg-gray-100 text-gray-600"
                              }`}
                            >
                              {item.status}
                            </span>
                          </div>

                          {item.status_reason && (
                            <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-300">
                              {item.status_reason}
                            </p>
                          )}

                          {item.notes && (
                            <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
                              {item.notes}
                            </p>
                          )}

                          <p className="mt-0.5 text-[10px] text-gray-400">
                            Tested by {item.tested_by_name || "Unknown"} ·{" "}
                            {formatDateTime(item.test_date || item.created_at)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================= COMMENTS ================= */}
          {activeTab === "comments" && (
            <div className="space-y-4">
              {
                <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
                  <FaClipboardList className="h-3.5 w-3.5 text-blue-500" />
                  Log ({comments.length})
                </h3>
              }

              {/* Add Comment */}
              {
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
                    type="button"
                    onClick={handleAddComment}
                    disabled={actionLoading || !newComment.trim()}
                    className="self-end rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {actionLoading ? "Adding…" : "Add"}
                  </button>
                </div>
              }

              {/* Comments List */}
              {comments.length === 0 ? (
                <p className="py-8 text-center text-sm italic text-gray-400">
                  No log entries yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {sortedComments.map((comment) => (
                    <div
                      key={comment.id}
                      className="rounded-xl border border-gray-200 px-4 py-3 dark:border-gray-700"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                            {comment.commented_by_name || "System"}
                          </p>

                          {comment.is_system && (
                            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                              System
                            </span>
                          )}
                        </div>

                        <span className="text-[11px] text-gray-400">
                          {formatDateTime(comment.created_at)}
                        </span>
                      </div>

                      <p className="mt-2 whitespace-pre-wrap text-sm text-gray-600 dark:text-gray-300">
                        {comment.comment}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-shrink-0 justify-end border-t border-gray-200 bg-gray-50 px-6 py-4 dark:border-gray-700 dark:bg-gray-800/50">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
          >
            Close
          </button>
        </div>
      </div>

      {selectedTestCaseDetails && (
        <div className="fixed inset-0 z-[1000000] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
          <div className="flex max-h-[86vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-900">
            <div className="flex flex-shrink-0 items-start justify-between gap-4 border-b border-gray-200 bg-gray-50 px-6 py-4 dark:border-gray-700 dark:bg-gray-800/50">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded bg-blue-100 px-2 py-0.5 font-mono text-xs font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                    TC-{selectedTestCaseDetails.id}
                  </span>
                  {selectedTestCaseDetails.status && (
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                      {selectedTestCaseDetails.status}
                    </span>
                  )}
                  {selectedTestCaseDetails.priority && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                      {selectedTestCaseDetails.priority}
                    </span>
                  )}
                </div>

                <h3 className="mt-2 truncate text-lg font-semibold text-gray-900 dark:text-white">
                  {selectedTestCaseDetails.title}
                </h3>
                <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                  {selectedTestCaseDetails.project_name || "Unknown Project"}
                  {selectedTestCaseDetails.suite_name
                    ? ` · ${selectedTestCaseDetails.suite_name}`
                    : ""}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedTestCaseDetails(null)}
                className="text-xl font-bold text-gray-400 transition-colors hover:text-gray-600 dark:hover:text-gray-200"
                aria-label="Close test case"
              >
                &times;
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              <div className="mb-5 rounded-xl border border-gray-200 p-4 dark:border-gray-700">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                  Preconditions
                </p>
                <p className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">
                  {selectedTestCaseDetails.preconditions || "No preconditions."}
                </p>
              </div>

              <div>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                    Test Steps ({selectedTestCaseDetails.steps?.length || 0})
                  </h4>
                </div>

                {!selectedTestCaseDetails.steps?.length ? (
                  <div className="rounded-xl border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-400 dark:border-gray-700">
                    No test steps available.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
                    <table className="min-w-full text-left text-sm">
                      <thead className="bg-gray-100 text-xs uppercase tracking-wide text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                        <tr>
                          <th className="px-4 py-3">#</th>
                          <th className="px-4 py-3">Action</th>
                          <th className="px-4 py-3">Expected Result</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900">
                        {selectedTestCaseDetails.steps.map((step) => (
                          <tr key={step.id}>
                            <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-400">
                              {step.step_number}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200">
                              {step.action}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                              {step.expected_result || "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-shrink-0 justify-end gap-2 border-t border-gray-200 bg-gray-50 px-6 py-4 dark:border-gray-700 dark:bg-gray-800/50">
              <Link
                to={`/test-cases/${selectedTestCaseDetails.id}`}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
              >
                <FaExternalLinkAlt className="h-3 w-3" />
                Open Full View
              </Link>

              <button
                type="button"
                onClick={() => setSelectedTestCaseDetails(null)}
                className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
