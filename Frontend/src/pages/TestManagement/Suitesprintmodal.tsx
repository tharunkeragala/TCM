import { useCallback, useEffect, useRef, useState } from "react";
import {
  FaLayerGroup,
  FaLink,
  FaPaperPlane,
  FaPlay,
  FaPlus,
  FaSearch,
  FaSpinner,
  FaStop,
  FaTimes,
  FaUserPlus,
} from "react-icons/fa";
import Alert from "../../components/ui/alert/Alert";
import API from "../../services/api";
import { ActivityFeed } from "./Sprint/ActivityFeed";
import { TestCaseRow } from "./Sprint/TestCaseRow";
import { useBatchExecution } from "./Sprint/useBatchExecution";
import { AssignUsersModal } from "./Sprint/AssignUsersModal";
import {
  CreateTestCaseModal,
  LinkExistingModal,
} from "./Sprint/TestCaseModals";
import type {
  BoardSuite,
  CaseRunStatus,
  SprintAssignee,
  SprintComment,
  SprintTestCase,
  TestRun,
} from "./Sprint/types.ts";
import { BOARD_STATUS_DISPLAY, getToken, timeAgo } from "./Sprint/utils.ts";
import TestCaseDetailModal, {
  type TestCaseDetailData,
} from "./TestCaseDetailModal";

// ─── Props ────────────────────────────────────────────────────────────────────

interface SuiteSprintModalProps {
  sprintId: number;
  sprintName?: string;
  suite: BoardSuite;
  onClose: () => void;
  onBoardChanged: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SuiteSprintModal({
  sprintId,
  sprintName,
  suite,
  onClose,
  onBoardChanged,
}: SuiteSprintModalProps) {
  const [cases, setCases] = useState<SprintTestCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [detailCase, setDetailCase] = useState<TestCaseDetailData | null>(null);

  // boardStatus is READ-ONLY in the modal — auto-updated by WS from backend
  const [boardStatus, setBoardStatus] = useState(suite.board_status);

  const [showCreate, setShowCreate] = useState(false);
  const [showLink, setShowLink] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [alert, setAlert] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [removing, setRemoving] = useState(false);
  const [activeRightTab, setActiveRightTab] = useState<
    "details" | "activity" | "comments"
  >("details");
  const [assignees, setAssignees] = useState<SprintAssignee[]>([]);
  const [comments, setComments] = useState<SprintComment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [postingComment, setPostingComment] = useState(false);
  const [searchCases, setSearchCases] = useState("");
  const commentRef = useRef<HTMLTextAreaElement>(null);

  // ── Data loaders ──────────────────────────────────────────────────────────

  const loadCases = useCallback(async () => {
    setLoading(true);
    try {
      const res = await API.get(
        `/api/sprints/${sprintId}/suites/${suite.suite_id}/test-cases`,
        { headers: { Authorization: `Bearer ${getToken()}` } },
      );
      if (res.data.success) {
        setCases(res.data.data);
        // Auto-expand first case when nothing is expanded yet
        if (res.data.data.length > 0 && expandedId === null) {
          setExpandedId(res.data.data[0].id);
        }
      }
    } catch {
      setAlert({ type: "error", message: "Failed to load test cases." });
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sprintId, suite.suite_id]);
  // NOTE: intentionally omitting `expandedId` — we only want to auto-expand
  // on the first load, not on every reload triggered by batch completion.

  const loadAssignees = useCallback(async () => {
    try {
      const res = await API.get(`/api/sprints/${sprintId}/assignees`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = res.data?.data ?? res.data;
      if (Array.isArray(data)) setAssignees(data);
    } catch {
      // Silent — assignees section will show empty state
    }
  }, [sprintId]);

  const loadComments = useCallback(async () => {
    try {
      const res = await API.get(`/api/sprints/${sprintId}/comments`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = res.data?.data ?? res.data;
      if (Array.isArray(data)) setComments(data);
    } catch {
      // Silent
    }
  }, [sprintId]);

  useEffect(() => {
    loadCases();
    loadAssignees();
    loadComments();
  }, [loadCases, loadAssignees, loadComments]);

  // ── Batch execution ───────────────────────────────────────────────────────

  const handleBatchComplete = useCallback(
    (_finalStatus: string) => {
      loadCases();
      onBoardChanged();
    },
    [loadCases, onBoardChanged],
  );

  const {
    batch,
    caseStatuses,
    starting,
    stopping,
    isRunning,
    percent: batchPercent,
    executeAll,
    stopExecution,
  } = useBatchExecution(sprintId, suite.suite_id, handleBatchComplete);

  const getLiveStatus = (tcId: number): CaseRunStatus | null => {
    if (!batch) return null;
    return caseStatuses.find((c) => c.test_case_id === tcId) ?? null;
  };

  // ── WebSocket listener for board status updates ───────────────────────────

  useEffect(() => {
    const ws = (window as { __tcmWS?: WebSocket }).__tcmWS;
    if (!ws) return;

    const handler = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data as string) as {
          type: string;
          suiteId: number;
          sprintId: number;
          board_status: string;
        };
        if (
          msg.type === "suite_board_status_changed" &&
          Number(msg.suiteId) === suite.suite_id &&
          Number(msg.sprintId) === sprintId
        ) {
          setBoardStatus(msg.board_status);
          onBoardChanged();
        }
      } catch {
        // Malformed WS message — ignore
      }
    };

    ws.addEventListener("message", handler);
    return () => ws.removeEventListener("message", handler);
  }, [suite.suite_id, sprintId, onBoardChanged]);

  // ── Keyboard: Escape closes modal (but not sub-modals) ───────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        e.key === "Escape" &&
        !showCreate &&
        !showLink &&
        !showAssign &&
        !detailCase
      )
        onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, showCreate, showLink, showAssign, detailCase]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleUnlink = async (testCaseId: number) => {
    try {
      await API.delete(
        `/api/sprints/${sprintId}/suites/${suite.suite_id}/test-cases/${testCaseId}`,
        { headers: { Authorization: `Bearer ${getToken()}` } },
      );
      setCases((prev) => prev.filter((c) => c.id !== testCaseId));
      if (expandedId === testCaseId) setExpandedId(null);
      onBoardChanged();
    } catch {
      setAlert({ type: "error", message: "Failed to unlink test case." });
    }
  };

  const handleRemoveSuite = async () => {
    if (
      !window.confirm(`Remove "${suite.suite_name}" from this sprint's board?`)
    )
      return;
    setRemoving(true);
    try {
      await API.delete(`/api/sprints/${sprintId}/suites/${suite.suite_id}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      onBoardChanged();
      onClose();
    } catch {
      setAlert({ type: "error", message: "Failed to remove suite." });
      setRemoving(false);
    }
  };

  const handleRemoveAssignee = async (userId: number) => {
    try {
      await API.delete(`/api/sprints/${sprintId}/assignees/${userId}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      loadAssignees();
    } catch {
      setAlert({ type: "error", message: "Failed to remove assignee." });
    }
  };

  const handlePostComment = async () => {
    if (!newComment.trim()) return;
    setPostingComment(true);
    try {
      await API.post(
        `/api/sprints/${sprintId}/comments`,
        { comment: newComment.trim() },
        { headers: { Authorization: `Bearer ${getToken()}` } },
      );
      setNewComment("");
      loadComments();
    } catch {
      setAlert({ type: "error", message: "Failed to post comment." });
    } finally {
      setPostingComment(false);
    }
  };

  // ── Derived values ────────────────────────────────────────────────────────

  const filteredCases = cases.filter(
    (c) =>
      !searchCases || c.title.toLowerCase().includes(searchCases.toLowerCase()),
  );

  const passedCount = batch
    ? batch.passed_cases
    : cases.filter((c) => c.latest_run?.status === "passed").length;
  const failedCount = batch
    ? batch.failed_cases
    : cases.filter((c) => c.latest_run?.status === "failed").length;
  const progress =
    cases.length > 0 ? Math.round((passedCount / cases.length) * 100) : 0;

  const bsDisplay =
    BOARD_STATUS_DISPLAY[boardStatus] ?? BOARD_STATUS_DISPLAY["To Do"];

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden border border-gray-200 dark:border-gray-700">
        {/* ── Top bar ── */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-200 dark:border-gray-700 flex-shrink-0 bg-white dark:bg-gray-900">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-1.5 rounded-lg bg-purple-100 dark:bg-purple-900/30">
              <FaLayerGroup className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="min-w-0">
              {suite.project_name && (
                <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wide font-semibold">
                  {suite.project_name} / Suite
                </p>
              )}
              <h2 className="text-base font-bold text-gray-900 dark:text-white truncate">
                {suite.suite_name}
              </h2>
            </div>
            {sprintName && (
              <span className="hidden sm:inline-flex items-center px-2 py-0.5 text-[10px] font-semibold rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 flex-shrink-0">
                {sprintName}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setShowAssign(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <FaUserPlus className="w-3 h-3" /> Assign
            </button>
            <button
              onClick={() => setShowLink(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <FaLink className="w-3 h-3" /> Link
            </button>
            <button
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              <FaPlus className="w-3 h-3" /> Create
            </button>
            <button
              onClick={onClose}
              title="Close (Esc)"
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ml-1"
              aria-label="Close modal"
            >
              <FaTimes className="w-4 h-4" />
            </button>
          </div>
        </div>

        {alert && (
          <div className="px-5 pt-3 flex-shrink-0">
            <Alert
              variant={alert.type}
              title={alert.type === "success" ? "Success" : "Error"}
              message={alert.message}
            />
          </div>
        )}

        {/* ── Body ── */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-[1fr_300px]">
          {/* ─ Left: test cases ─ */}
          <div className="overflow-y-auto p-5 border-r border-gray-100 dark:border-gray-800">
            {/* Execute All + Progress */}
            <div className="mb-4 p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">
                    {isRunning
                      ? `Running… ${batch?.completed_cases ?? 0} / ${batch?.total_cases ?? cases.length}`
                      : "Execution Progress"}
                  </span>
                  {batch && !isRunning && (
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        batch.status === "passed"
                          ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                          : batch.status === "failed"
                            ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                            : batch.status === "partial"
                              ? "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300"
                              : batch.status === "cancelled"
                                ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300"
                                : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {batch.status === "passed"
                        ? "✓ ALL PASSED"
                        : batch.status === "failed"
                          ? "✗ ALL FAILED"
                          : batch.status === "partial"
                            ? "⚠ PARTIAL"
                            : batch.status === "cancelled"
                              ? "⏹ CANCELLED"
                              : batch.status.toUpperCase()}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-800 dark:text-gray-200">
                    {isRunning ? `${batchPercent}%` : `${progress}%`}
                  </span>
                  {cases.length > 0 &&
                    (isRunning ? (
                      <button
                        onClick={stopExecution}
                        disabled={stopping}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors disabled:opacity-60 bg-red-600 hover:bg-red-700 text-white"
                        title="Stop after current test case finishes"
                      >
                        {stopping ? (
                          <FaSpinner className="w-3 h-3 animate-spin" />
                        ) : (
                          <FaStop className="w-3 h-3" />
                        )}
                        {stopping ? "Stopping…" : "Stop"}
                      </button>
                    ) : (
                      <button
                        onClick={executeAll}
                        disabled={starting}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-green-600 hover:bg-green-700 disabled:opacity-60 rounded-lg transition-colors"
                      >
                        {starting ? (
                          <>
                            <FaSpinner className="w-3 h-3 animate-spin" />{" "}
                            Starting…
                          </>
                        ) : (
                          <>
                            <FaPlay className="w-3 h-3" /> Execute All
                          </>
                        )}
                      </button>
                    ))}
                </div>
              </div>

              {/* Progress bar */}
              <div className="h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    isRunning
                      ? "bg-gradient-to-r from-blue-500 to-blue-400 animate-pulse"
                      : batch?.status === "failed"
                        ? "bg-gradient-to-r from-red-500 to-red-400"
                        : batch?.status === "partial"
                          ? "bg-gradient-to-r from-orange-500 to-yellow-400"
                          : batch?.status === "cancelled"
                            ? "bg-gradient-to-r from-yellow-500 to-yellow-400"
                            : "bg-gradient-to-r from-green-500 to-emerald-400"
                  }`}
                  style={{ width: `${isRunning ? batchPercent : progress}%` }}
                />
              </div>

              {/* Stats row */}
              <div className="flex items-center gap-3 mt-1.5 text-[10px] text-gray-400">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  {passedCount} passed
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                  {failedCount} failed
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-gray-400" />
                  {isRunning
                    ? (batch?.total_cases ?? 0) - (batch?.completed_cases ?? 0)
                    : cases.length - passedCount - failedCount}{" "}
                  pending
                </span>
                {isRunning && (
                  <span className="flex items-center gap-1 ml-auto text-blue-500">
                    <FaSpinner className="w-2.5 h-2.5 animate-spin" />
                    Sequential execution in progress…
                  </span>
                )}
              </div>
            </div>

            {/* Search bar */}
            <div className="flex items-center gap-2 mb-3">
              <div className="relative flex-1">
                <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
                <input
                  value={searchCases}
                  onChange={(e) => setSearchCases(e.target.value)}
                  placeholder={`Search ${cases.length} test cases…`}
                  className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <span className="text-xs font-semibold text-gray-400 flex-shrink-0 px-2 py-1.5 bg-gray-100 dark:bg-gray-800 rounded-lg">
                {filteredCases.length} / {cases.length}
              </span>
            </div>

            {/* Test case list */}
            {loading ? (
              <div className="flex items-center justify-center py-12 text-gray-400">
                <FaSpinner className="animate-spin w-5 h-5 mr-2" /> Loading test
                cases…
              </div>
            ) : filteredCases.length === 0 ? (
              <div className="text-sm text-gray-500 dark:text-gray-400 py-10 text-center border border-dashed border-gray-300 dark:border-gray-700 rounded-xl">
                {cases.length === 0 ? (
                  <>
                    No test cases yet.{" "}
                    <button
                      onClick={() => setShowCreate(true)}
                      className="text-blue-500 hover:underline"
                    >
                      Create one
                    </button>{" "}
                    or{" "}
                    <button
                      onClick={() => setShowLink(true)}
                      className="text-blue-500 hover:underline"
                    >
                      link existing
                    </button>
                    .
                  </>
                ) : (
                  "No cases match your search."
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredCases.map((tc) => {
                  const live = getLiveStatus(tc.id);

                  // Build a synthetic latest_run from live batch status
                  const liveRun: TestRun | undefined = live?.run_status
                    ? {
                        id: 0,
                        status: live.run_status,
                        duration_ms: live.duration_ms ?? undefined,
                        error_message: live.error_message ?? undefined,
                      }
                    : undefined;

                  // Left strip color indicates per-case batch status
                  const stripColor = batch
                    ? live?.run_status === "passed"
                      ? "bg-green-500"
                      : live?.run_status === "failed"
                        ? "bg-red-500"
                        : live?.run_status === "running"
                          ? "bg-blue-500 animate-pulse"
                          : "bg-gray-200 dark:bg-gray-700"
                    : "";

                  return (
                    <div key={tc.id} className="relative pl-1">
                      {batch && (
                        <div
                          className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-xl transition-colors duration-300 ${stripColor}`}
                        />
                      )}
                      <TestCaseRow
                        tc={{ ...tc, latest_run: liveRun ?? tc.latest_run }}
                        suite={suite}
                        sprintId={sprintId}
                        isExpanded={expandedId === tc.id}
                        onToggle={() =>
                          setExpandedId((p) => (p === tc.id ? null : tc.id))
                        }
                        onUnlink={() => handleUnlink(tc.id)}
                        onViewDetail={() =>
                          setDetailCase(tc as unknown as TestCaseDetailData)
                        }
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ─ Right: sidebar ─ */}
          <div className="overflow-y-auto flex flex-col bg-gray-50/50 dark:bg-gray-800/20">
            {/* Tabs */}
            <div className="flex border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex-shrink-0">
              {(["details", "activity", "comments"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveRightTab(tab)}
                  className={`flex-1 py-2.5 text-xs font-semibold capitalize transition-colors border-b-2 ${
                    activeRightTab === tab
                      ? "text-blue-600 dark:text-blue-400 border-blue-500 bg-blue-50/50 dark:bg-blue-900/10"
                      : "text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-700 dark:hover:text-gray-300"
                  }`}
                >
                  {tab}
                  {tab === "comments" && comments.length > 0 && (
                    <span className="ml-1 inline-flex items-center justify-center w-4 h-4 text-[9px] font-bold bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 rounded-full">
                      {comments.length}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* ── Details tab ── */}
              {activeRightTab === "details" && (
                <>
                  {/* Board Status — read-only display */}
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">
                      Board Status
                    </p>
                    <div
                      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold ${bsDisplay.pill}`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full flex-shrink-0 ${bsDisplay.dot}`}
                      />
                      {bsDisplay.label}
                      {isRunning && bsDisplay.label === "In Progress" && (
                        <FaSpinner className="w-2.5 h-2.5 animate-spin ml-1 opacity-70" />
                      )}
                    </div>
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1.5">
                      Automatically updated as tests run.
                    </p>
                  </div>

                  {/* Assignees */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                        Assignees
                      </p>
                      <button
                        onClick={() => setShowAssign(true)}
                        className="text-[10px] text-blue-500 hover:text-blue-600 font-semibold flex items-center gap-0.5"
                      >
                        <FaPlus className="w-2.5 h-2.5" /> Add
                      </button>
                    </div>
                    {assignees.length === 0 ? (
                      <button
                        onClick={() => setShowAssign(true)}
                        className="text-[10px] text-gray-400 border border-dashed border-gray-300 dark:border-gray-700 rounded-lg px-3 py-1.5 hover:border-blue-400 hover:text-blue-500 transition-colors"
                      >
                        + Assign users
                      </button>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {assignees.map((a) => (
                          <span
                            key={a.id}
                            className="inline-flex items-center gap-1.5 pl-1 pr-1.5 py-0.5 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-700 dark:text-gray-300 shadow-sm group"
                          >
                            <span className="w-4 h-4 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0">
                              {a.username.charAt(0).toUpperCase()}
                            </span>
                            {a.username}
                            <button
                              onClick={() => handleRemoveAssignee(a.id)}
                              className="ml-0.5 text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
                              title={`Remove ${a.username}`}
                              aria-label={`Remove ${a.username}`}
                            >
                              <FaTimes className="w-2 h-2" />
                            </button>
                          </span>
                        ))}
                        <button
                          onClick={() => setShowAssign(true)}
                          className="inline-flex items-center gap-1 pl-2 pr-2.5 py-0.5 rounded-full border border-dashed border-gray-300 dark:border-gray-600 text-[10px] text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-colors"
                        >
                          <FaPlus className="w-2 h-2" /> Add
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Suite details */}
                  <div className="space-y-3 pt-2 border-t border-gray-200 dark:border-gray-700">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1">
                        Project
                      </p>
                      <p className="text-sm text-gray-800 dark:text-gray-200">
                        {suite.project_name || "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1">
                        Suite Status
                      </p>
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full ${
                          suite.is_active
                            ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                            : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            suite.is_active ? "bg-green-500" : "bg-red-500"
                          }`}
                        />
                        {suite.is_active ? "Active" : "Inactive"}
                      </span>
                    </div>
                    {suite.description && (
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1">
                          Description
                        </p>
                        <p className="text-xs text-gray-600 dark:text-gray-300">
                          {suite.description}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Stats grid */}
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                    {[
                      { label: "Total Cases", value: cases.length },
                      { label: "Passed", value: passedCount },
                      { label: "Failed", value: failedCount },
                      { label: "Coverage", value: `${progress}%` },
                    ].map(({ label, value }) => (
                      <div
                        key={label}
                        className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-2.5 text-center"
                      >
                        <p className="text-base font-bold text-gray-900 dark:text-white">
                          {value}
                        </p>
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          {label}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Remove suite CTA */}
                  <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                    <button
                      onClick={handleRemoveSuite}
                      disabled={removing}
                      className="w-full py-2 text-xs font-medium text-red-500 hover:text-red-700 disabled:opacity-60 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    >
                      {removing ? "Removing…" : "Remove suite from sprint"}
                    </button>
                  </div>
                </>
              )}

              {/* ── Activity tab ── */}
              {activeRightTab === "activity" && (
                <ActivityFeed sprintId={sprintId} />
              )}

              {/* ── Comments tab ── */}
              {activeRightTab === "comments" && (
                <div className="flex flex-col h-full">
                  <div className="flex-1 space-y-3 mb-3">
                    {comments.length === 0 ? (
                      <p className="text-xs text-gray-400 italic text-center py-6">
                        No comments yet. Start the conversation.
                      </p>
                    ) : (
                      comments.map((c) => (
                        <div key={c.id} className="flex gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                            {(c.created_by_name ?? "?").charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-2">
                              <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                                {c.created_by_name ?? "Unknown"}
                              </span>
                              <span className="text-[10px] text-gray-400">
                                {timeAgo(c.created_at)}
                              </span>
                            </div>
                            <div className="mt-1 px-3 py-2 rounded-xl rounded-tl-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
                              {c.comment}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-3 flex-shrink-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">
                      Add a comment
                    </p>
                    <textarea
                      ref={commentRef}
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && (e.metaKey || e.ctrlKey))
                          handlePostComment();
                      }}
                      placeholder="Add a comment… (Ctrl+Enter to submit)"
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    />
                    <div className="flex justify-end mt-2">
                      <button
                        onClick={handlePostComment}
                        disabled={postingComment || !newComment.trim()}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition-colors"
                      >
                        {postingComment ? (
                          <FaSpinner className="w-3 h-3 animate-spin" />
                        ) : (
                          <FaPaperPlane className="w-3 h-3" />
                        )}
                        {postingComment ? "Posting…" : "Comment"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Sub-modals ── */}
      {showCreate && (
        <CreateTestCaseModal
          sprintId={sprintId}
          suiteId={suite.suite_id}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            loadCases();
            onBoardChanged();
          }}
        />
      )}
      {showLink && (
        <LinkExistingModal
          sprintId={sprintId}
          suiteId={suite.suite_id}
          onClose={() => setShowLink(false)}
          onLinked={() => {
            loadCases();
            onBoardChanged();
          }}
        />
      )}
      {showAssign && (
        <AssignUsersModal
          sprintId={sprintId}
          currentAssignees={assignees}
          onClose={() => setShowAssign(false)}
          onUpdated={loadAssignees}
        />
      )}
      {detailCase && (
        <TestCaseDetailModal
          testCase={detailCase}
          currentSuiteId={suite.suite_id}
          projectName={suite.project_name}
          suiteName={suite.suite_name}
          sprintName={sprintName}
          onClose={() => setDetailCase(null)}
        />
      )}
    </div>
  );
}
