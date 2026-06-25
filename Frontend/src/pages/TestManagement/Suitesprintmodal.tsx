import { useCallback, useEffect, useRef, useState } from "react";
import {
  FaTimes,
  FaPlus,
  FaLink,
  FaExternalLinkAlt,
  FaTrash,
  FaClipboardList,
  FaSearch,
  FaPlay,
  FaCheckCircle,
  FaTimesCircle,
  FaSpinner,
  FaChevronDown,
  FaChevronRight,
  FaUserPlus,
  FaUser,
  FaComment,
  FaPaperPlane,
  FaHistory,
  FaCamera,
  FaLayerGroup,
  FaEdit,
  FaExclamationTriangle,
  FaEllipsisH,
} from "react-icons/fa";
import Alert from "../../components/ui/alert/Alert";
import API from "../../services/api";
import TestCaseDetailModal, { TestCaseDetailData } from "./TestCaseDetailModal";

const getToken = () => localStorage.getItem("token") || sessionStorage.getItem("token");

// ─── Color maps ──────────────────────────────────────────────────────────────
const PRIORITY_COLORS: Record<string, string> = {
  Low: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
  Medium: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  High: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  Critical: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
};

const PRIORITY_DOT: Record<string, string> = {
  Low: "bg-gray-400",
  Medium: "bg-blue-500",
  High: "bg-orange-500",
  Critical: "bg-red-500",
};

const STATUS_COLORS: Record<string, string> = {
  Draft: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  Ready: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  Deprecated: "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400",
};

const RUN_STATUS: Record<string, { bg: string; icon: JSX.Element; label: string }> = {
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

const BOARD_STATUSES = ["To Do", "In Progress", "Done"] as const;

// ─── Types ───────────────────────────────────────────────────────────────────
interface TestStep {
  step_number: number;
  action: string;
  expected_result: string;
}

interface RunStep {
  id?: number;
  step_number: number;
  action: string;
  expected_result?: string;
  status: string;
  duration_ms?: number;
  screenshot_path?: string;
  error_message?: string;
}

interface TestRun {
  id: number;
  status: string;
  started_at?: string;
  completed_at?: string;
  duration_ms?: number;
  error_message?: string;
  executed_by_name?: string;
  steps?: RunStep[];
}

interface SprintTestCase {
  id: number;
  title: string;
  priority: string;
  status: string;
  preconditions?: string;
  owning_suite_id: number;
  owning_suite_name?: string;
  linked_by_name?: string;
  linked_at?: string;
  steps: TestStep[];
  runs?: TestRun[];
  latest_run?: TestRun;
}

interface BoardSuite {
  sprint_suite_id: number;
  suite_id: number;
  suite_name: string;
  description?: string;
  is_active: boolean;
  project_name?: string;
  board_status: string;
}

interface SprintAssignee {
  id: number;
  username: string;
  full_name?: string;
  role?: string;
}

interface SprintComment {
  id: number;
  comment: string;
  created_by_name?: string;
  created_at: string;
}

interface AvailableUser {
  id: number;
  username: string;
  full_name?: string;
}

const emptyStep = (): TestStep => ({ step_number: 1, action: "", expected_result: "" });

function formatDuration(ms?: number | null) {
  if (!ms) return null;
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function timeAgo(dateStr?: string) {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ─── Link Existing Modal ─────────────────────────────────────────────────────
function LinkExistingModal({
  sprintId, suiteId, onClose, onLinked,
}: { sprintId: number; suiteId: number; onClose: () => void; onLinked: () => void }) {
  const [options, setOptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [linkingId, setLinkingId] = useState<number | null>(null);
  const [alert, setAlert] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  useEffect(() => {
    (async () => {
      try {
        const res = await API.get(`/api/sprints/${sprintId}/suites/${suiteId}/available-test-cases`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        if (res.data.success) setOptions(res.data.data);
      } catch {
        setAlert({ type: "error", message: "Failed to load available test cases." });
      } finally {
        setLoading(false);
      }
    })();
  }, [sprintId, suiteId]);

  const filtered = options.filter((o) =>
    !search || `${o.title} ${o.suite_name || ""}`.toLowerCase().includes(search.toLowerCase()),
  );

  const handleLink = async (testCaseId: number) => {
    setLinkingId(testCaseId);
    setAlert(null);
    try {
      const res = await API.post(
        `/api/sprints/${sprintId}/suites/${suiteId}/test-cases/link`,
        { test_case_id: testCaseId },
        { headers: { Authorization: `Bearer ${getToken()}` } },
      );
      if (res.data.success) {
        setOptions((prev) => prev.filter((o) => o.id !== testCaseId));
        onLinked();
      }
    } catch (err: any) {
      setAlert({ type: "error", message: err.response?.data?.message || "Failed to link test case." });
    } finally {
      setLinkingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6 max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Link Existing Test Case</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <FaTimes className="w-4 h-4" />
          </button>
        </div>
        {alert && <div className="mb-3"><Alert variant={alert.type} title={alert.type === "success" ? "Success" : "Error"} message={alert.message} /></div>}
        <div className="relative mb-3">
          <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search test cases…"
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 pl-9 pr-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex-1 overflow-y-auto -mx-2 px-2 space-y-1.5">
          {loading ? (
            <p className="text-sm text-gray-500 py-6 text-center">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-gray-500 py-6 text-center">No test cases available to link.</p>
          ) : filtered.map((tc) => (
            <div key={tc.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{tc.title}</p>
                <p className="text-xs text-gray-400">{tc.suite_name}{tc.project_name ? ` · ${tc.project_name}` : ""}</p>
              </div>
              <button onClick={() => handleLink(tc.id)} disabled={linkingId === tc.id}
                className="flex-shrink-0 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg transition-colors">
                {linkingId === tc.id ? "Linking…" : "Link"}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Create Test Case Modal ──────────────────────────────────────────────────
function CreateTestCaseModal({
  sprintId, suiteId, onClose, onCreated,
}: { sprintId: number; suiteId: number; onClose: () => void; onCreated: () => void }) {
  const [formData, setFormData] = useState({ title: "", preconditions: "", priority: "Medium", status: "Draft" });
  const [steps, setSteps] = useState<TestStep[]>([emptyStep()]);
  const [submitting, setSubmitting] = useState(false);
  const [alert, setAlert] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleSave = async () => {
    if (!formData.title.trim()) return setAlert({ type: "error", message: "Title is required." });
    setSubmitting(true);
    setAlert(null);
    try {
      const res = await API.post(`/api/sprints/${sprintId}/suites/${suiteId}/test-cases`,
        { ...formData, steps }, { headers: { Authorization: `Bearer ${getToken()}` } });
      if (res.data.success) {
        setAlert({ type: "success", message: "Test case created!" });
        setTimeout(() => { onClose(); onCreated(); }, 700);
      }
    } catch (err: any) {
      setAlert({ type: "error", message: err.response?.data?.message || "Failed to create." });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Create Test Case</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"><FaTimes className="w-4 h-4" /></button>
        </div>
        {alert && <div className="mb-3"><Alert variant={alert.type} title={alert.type === "success" ? "Success" : "Error"} message={alert.message} /></div>}
        <div className="mb-3">
          <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1.5">Title <span className="text-red-500">*</span></label>
          <input type="text" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder="e.g. Verify login with valid credentials"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="mb-3">
          <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1.5">Preconditions</label>
          <textarea value={formData.preconditions} onChange={(e) => setFormData({ ...formData, preconditions: e.target.value })}
            placeholder="Environment, prerequisites…" rows={2}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1.5">Priority</label>
            <select value={formData.priority} onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {["Low", "Medium", "High", "Critical"].map((p) => <option key={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1.5">Status</label>
            <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {["Draft", "Ready", "Deprecated"].map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Test Steps</label>
            <button onClick={() => setSteps((p) => [...p, { step_number: p.length + 1, action: "", expected_result: "" }])}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium">
              <FaPlus className="w-3 h-3" /> Add Step
            </button>
          </div>
          <div className="space-y-2">
            {steps.map((step, i) => (
              <div key={i} className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-gray-500">Step {i + 1}</span>
                  {steps.length > 1 && (
                    <button onClick={() => setSteps((p) => p.filter((_, idx) => idx !== i).map((s, idx) => ({ ...s, step_number: idx + 1 })))}
                      className="text-xs text-red-500 hover:text-red-700">Remove</button>
                  )}
                </div>
                <input type="text" value={step.action} placeholder="Action *"
                  onChange={(e) => setSteps((p) => p.map((s, idx) => idx === i ? { ...s, action: e.target.value } : s))}
                  className="w-full mb-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input type="text" value={step.expected_result} placeholder="Expected Result"
                  onChange={(e) => setSteps((p) => p.map((s, idx) => idx === i ? { ...s, expected_result: e.target.value } : s))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={submitting} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg transition-colors">
            {submitting ? "Creating…" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Assign Users Modal ──────────────────────────────────────────────────────
function AssignUsersModal({
  sprintId, currentAssignees, onClose, onUpdated,
}: { sprintId: number; currentAssignees: SprintAssignee[]; onClose: () => void; onUpdated: () => void }) {
  const [users, setUsers] = useState<AvailableUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [alert, setAlert] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const assignedIds = new Set(currentAssignees.map((a) => a.id));

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  useEffect(() => {
    (async () => {
      try {
        const res = await API.get("/api/users", { headers: { Authorization: `Bearer ${getToken()}` } });
        const data = res.data?.data ?? res.data;
        if (Array.isArray(data)) setUsers(data);
      } catch {
        setAlert({ type: "error", message: "Failed to load users." });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = users.filter((u) =>
    !search || `${u.username} ${u.full_name || ""}`.toLowerCase().includes(search.toLowerCase()),
  );

  const handleToggle = async (userId: number, isAssigned: boolean) => {
    setTogglingId(userId);
    setAlert(null);
    try {
      if (isAssigned) {
        await API.delete(`/api/sprints/${sprintId}/assignees/${userId}`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
      } else {
        await API.post(`/api/sprints/${sprintId}/assignees`, { user_id: userId }, {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
      }
      onUpdated();
    } catch (err: any) {
      setAlert({ type: "error", message: err.response?.data?.message || "Failed to update assignment." });
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Manage Assignees</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"><FaTimes className="w-4 h-4" /></button>
        </div>
        {alert && <div className="mb-3"><Alert variant={alert.type} title={alert.type === "success" ? "Success" : "Error"} message={alert.message} /></div>}
        <div className="relative mb-3">
          <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search users…"
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 pl-9 pr-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex-1 overflow-y-auto space-y-1.5">
          {loading ? (
            <p className="text-sm text-gray-500 py-6 text-center">Loading…</p>
          ) : filtered.map((u) => {
            const assigned = assignedIds.has(u.id);
            return (
              <div key={u.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                    {(u.full_name || u.username).charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{u.full_name || u.username}</p>
                    <p className="text-xs text-gray-400">{u.username}</p>
                  </div>
                </div>
                <button onClick={() => handleToggle(u.id, assigned)} disabled={togglingId === u.id}
                  className={`flex-shrink-0 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors disabled:opacity-60 ${
                    assigned
                      ? "bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40 border border-red-200 dark:border-red-800"
                      : "bg-blue-600 text-white hover:bg-blue-700"
                  }`}>
                  {togglingId === u.id ? "…" : assigned ? "Remove" : "Assign"}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Run Evidence Panel ───────────────────────────────────────────────────────
function RunEvidencePanel({ run, onClose }: { run: TestRun; onClose: () => void }) {
  const [steps, setSteps] = useState<RunStep[]>(run.steps || []);
  const [loading, setLoading] = useState(!run.steps);
  const rs = RUN_STATUS[run.status] || RUN_STATUS.pending;

  useEffect(() => {
    if (run.steps) return;
    (async () => {
      try {
        const res = await API.get(`/api/playwright/runs/${run.id}/steps`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        const data = res.data?.data ?? res.data;
        if (Array.isArray(data)) setSteps(data);
      } catch {
        setSteps([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [run]);

  return (
    <div className="fixed inset-0 z-[99999999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <FaCamera className="w-4 h-4 text-gray-400" />
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Run #{run.id} — Evidence</h3>
              <p className="text-xs text-gray-400">{run.executed_by_name && `Executed by ${run.executed_by_name} · `}{timeAgo(run.started_at)}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full ${rs.bg}`}>
              {rs.icon} {rs.label}
            </span>
            <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
              <FaTimes className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-gray-400">
              <FaSpinner className="animate-spin w-5 h-5 mr-2" /> Loading evidence…
            </div>
          ) : steps.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">No step evidence recorded for this run.</div>
          ) : steps.map((step, i) => {
            const stepRs = RUN_STATUS[step.status] || RUN_STATUS.pending;
            return (
              <div key={step.id ?? i} className={`rounded-xl border overflow-hidden ${
                step.status === "failed" ? "border-red-200 dark:border-red-800" : "border-gray-200 dark:border-gray-700"
              }`}>
                <div className={`flex items-center justify-between gap-3 px-4 py-2.5 ${
                  step.status === "failed" ? "bg-red-50 dark:bg-red-900/20" : "bg-gray-50 dark:bg-gray-800"
                }`}>
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-full bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 flex items-center justify-center text-xs font-bold text-gray-600 dark:text-gray-300 flex-shrink-0">
                      {step.step_number}
                    </span>
                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{step.action}</span>
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full ${stepRs.bg}`}>
                    {stepRs.icon} {stepRs.label}
                  </span>
                </div>
                {(step.expected_result || step.error_message || step.screenshot_path) && (
                  <div className="px-4 py-3 space-y-2">
                    {step.expected_result && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        <span className="font-medium text-gray-600 dark:text-gray-300">Expected: </span>
                        {step.expected_result}
                      </p>
                    )}
                    {step.duration_ms && (
                      <p className="text-xs text-gray-400">Duration: {formatDuration(step.duration_ms)}</p>
                    )}
                    {step.error_message && (
                      <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-2.5">
                        <p className="text-xs text-red-700 dark:text-red-300 font-mono">{step.error_message}</p>
                      </div>
                    )}
                    {step.screenshot_path && (
                      <a href={`/screenshots/${step.screenshot_path}`} target="_blank" rel="noreferrer"
                        className="block rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 hover:opacity-90 transition-opacity">
                        <img src={`/screenshots/${step.screenshot_path}`} alt={`Step ${step.step_number} screenshot`}
                          className="w-full max-h-64 object-contain bg-gray-950" />
                      </a>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Test Case Row (expanded) ─────────────────────────────────────────────────
function TestCaseRow({
  tc, suite, sprintId, isExpanded, onToggle, onUnlink, onViewDetail,
}: {
  tc: SprintTestCase;
  suite: BoardSuite;
  sprintId: number;
  isExpanded: boolean;
  onToggle: () => void;
  onUnlink: () => void;
  onViewDetail: () => void;
}) {
  const [runs, setRuns] = useState<TestRun[]>(tc.runs || []);
  const [runsLoading, setRunsLoading] = useState(false);
  const [runsFetched, setRunsFetched] = useState(!!tc.runs);
  const [executing, setExecuting] = useState(false);
  const [execAlert, setExecAlert] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [activeTab, setActiveTab] = useState<"steps" | "runs">("steps");
  const [viewRun, setViewRun] = useState<TestRun | null>(null);

  const latestRun = runs[0];

  const fetchRuns = useCallback(async () => {
    if (runsLoading) return;
    setRunsLoading(true);
    try {
      const res = await API.get(`/api/playwright/test-cases/${tc.id}/runs`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = res.data?.data ?? res.data;
      if (Array.isArray(data)) setRuns(data);
    } catch {
      /* silent */
    } finally {
      setRunsLoading(false);
      setRunsFetched(true);
    }
  }, [tc.id, runsLoading]);

  useEffect(() => {
    if (isExpanded && !runsFetched) fetchRuns();
  }, [isExpanded, runsFetched, fetchRuns]);

  const handleExecute = async () => {
    setExecuting(true);
    setExecAlert(null);
    try {
      const res = await API.post(`/api/playwright/test-cases/${tc.id}/run`, {}, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      setExecAlert({ type: "success", message: "Test execution started!" });
      // Poll for completion or refetch after 3s
      setTimeout(() => {
        setRunsFetched(false);
        fetchRuns();
      }, 3000);
    } catch (err: any) {
      setExecAlert({ type: "error", message: err.response?.data?.message || "Execution failed." });
    } finally {
      setExecuting(false);
    }
  };

  const rs = latestRun ? (RUN_STATUS[latestRun.status] || RUN_STATUS.pending) : null;

  return (
    <>
      {/* Row header */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div
          role="button"
          tabIndex={0}
          onClick={onToggle}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle(); } }}
          className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-400 select-none ${
            isExpanded ? "bg-blue-50 dark:bg-blue-900/20" : "hover:bg-gray-50 dark:hover:bg-gray-800"
          }`}
        >
          {/* Chevron */}
          <span className="text-gray-400 flex-shrink-0">
            {isExpanded ? <FaChevronDown className="w-2.5 h-2.5" /> : <FaChevronRight className="w-2.5 h-2.5" />}
          </span>

          {/* Priority dot */}
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${PRIORITY_DOT[tc.priority] || "bg-gray-400"}`} />

          {/* Title */}
          <span className="flex-1 text-sm font-medium text-gray-900 dark:text-white truncate">{tc.title}</span>

          {/* Latest run badge */}
          {rs && (
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full flex-shrink-0 ${rs.bg}`}>
              {rs.icon} {rs.label}
            </span>
          )}

          <span className={`px-2 py-0.5 text-xs font-semibold rounded-full flex-shrink-0 ${STATUS_COLORS[tc.status]}`}>{tc.status}</span>

          {/* Actions */}
          <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
            <button onClick={onViewDetail} className="p-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors" title="Full details">
              <FaExternalLinkAlt className="w-3 h-3" />
            </button>
            <button onClick={onUnlink} className="p-1.5 rounded-md hover:bg-red-100 dark:hover:bg-red-900/30 text-red-400 hover:text-red-600 transition-colors" title="Unlink">
              <FaTrash className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Expanded content */}
        {isExpanded && (
          <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
            {/* Sub-tabs */}
            <div className="flex items-center gap-1 px-4 pt-3 pb-0 border-b border-gray-100 dark:border-gray-800">
              {(["steps", "runs"] as const).map((tab) => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-t-md transition-colors border-b-2 ${
                    activeTab === tab
                      ? "text-blue-600 dark:text-blue-400 border-blue-500"
                      : "text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-700 dark:hover:text-gray-300"
                  }`}>
                  {tab === "steps" ? `Test Steps (${tc.steps.length})` : `Runs & Evidence (${runs.length})`}
                </button>
              ))}

              {/* Execute button */}
              <div className="ml-auto mb-1">
                <button onClick={handleExecute} disabled={executing}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-green-600 hover:bg-green-700 disabled:opacity-60 rounded-lg transition-colors">
                  {executing ? <FaSpinner className="w-3 h-3 animate-spin" /> : <FaPlay className="w-3 h-3" />}
                  {executing ? "Executing…" : "Execute"}
                </button>
              </div>
            </div>

            <div className="p-4">
              {execAlert && (
                <div className="mb-3">
                  <Alert variant={execAlert.type} title={execAlert.type === "success" ? "Execution" : "Error"} message={execAlert.message} />
                </div>
              )}

              {/* Steps tab */}
              {activeTab === "steps" && (
                <>
                  {tc.preconditions && (
                    <div className="mb-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                      <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide mb-0.5">Preconditions</p>
                      <p className="text-xs text-amber-800 dark:text-amber-300">{tc.preconditions}</p>
                    </div>
                  )}
                  {tc.owning_suite_id !== suite.suite_id && (
                    <div className="mb-3 flex items-start gap-2 p-2.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                      <FaExclamationTriangle className="w-3.5 h-3.5 text-blue-500 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-blue-700 dark:text-blue-300">
                        Owned by suite <strong>"{tc.owning_suite_name}"</strong> — tracked here for sprint only.
                      </p>
                    </div>
                  )}
                  {tc.steps.length === 0 ? (
                    <p className="text-xs text-gray-400 italic py-2">No steps defined.</p>
                  ) : (
                    <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50 dark:bg-gray-800">
                          <tr>
                            <th className="text-left py-2 px-3 w-8 text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wide">#</th>
                            <th className="text-left py-2 px-3 text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wide">Action</th>
                            <th className="text-left py-2 px-3 text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wide">Expected Result</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                          {tc.steps.map((step) => (
                            <tr key={step.step_number} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                              <td className="py-2 px-3 text-gray-400 font-mono">{step.step_number}</td>
                              <td className="py-2 px-3 text-gray-700 dark:text-gray-300">{step.action}</td>
                              <td className="py-2 px-3 text-gray-500 dark:text-gray-400">{step.expected_result || "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}

              {/* Runs tab */}
              {activeTab === "runs" && (
                <div>
                  {runsLoading ? (
                    <div className="flex items-center gap-2 text-sm text-gray-400 py-4 justify-center">
                      <FaSpinner className="animate-spin w-4 h-4" /> Loading runs…
                    </div>
                  ) : runs.length === 0 ? (
                    <div className="text-center py-6 text-xs text-gray-400 border border-dashed border-gray-300 dark:border-gray-700 rounded-lg">
                      No executions yet.{" "}
                      <button onClick={handleExecute} className="text-blue-500 hover:underline">Run it now</button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {runs.map((run) => {
                        const r = RUN_STATUS[run.status] || RUN_STATUS.pending;
                        return (
                          <div key={run.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full flex-shrink-0 ${r.bg}`}>
                                {r.icon} {r.label}
                              </span>
                              <div className="min-w-0">
                                <p className="text-xs font-medium text-gray-800 dark:text-gray-200">Run #{run.id}</p>
                                <p className="text-[10px] text-gray-400">
                                  {run.executed_by_name && `${run.executed_by_name} · `}
                                  {timeAgo(run.started_at)}
                                  {run.duration_ms && ` · ${formatDuration(run.duration_ms)}`}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {run.error_message && (
                                <span title={run.error_message}><FaExclamationTriangle className="w-3 h-3 text-red-400" /></span>
                              )}
                              <button onClick={() => setViewRun(run)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-semibold text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-700 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
                                <FaCamera className="w-2.5 h-2.5" /> Evidence
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <button onClick={() => { setRunsFetched(false); fetchRuns(); }}
                    className="mt-2 text-xs text-blue-500 hover:underline flex items-center gap-1">
                    <FaHistory className="w-3 h-3" /> Refresh runs
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {viewRun && <RunEvidencePanel run={viewRun} onClose={() => setViewRun(null)} />}
    </>
  );
}

// ─── Main SuiteSprintModal ────────────────────────────────────────────────────
export default function SuiteSprintModal({
  sprintId, sprintName, suite, onClose, onBoardChanged,
}: {
  sprintId: number;
  sprintName?: string;
  suite: BoardSuite;
  onClose: () => void;
  onBoardChanged: () => void;
}) {
  const [cases, setCases] = useState<SprintTestCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [detailCase, setDetailCase] = useState<TestCaseDetailData | null>(null);
  const [boardStatus, setBoardStatus] = useState(suite.board_status);
  const [showCreate, setShowCreate] = useState(false);
  const [showLink, setShowLink] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [alert, setAlert] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [removing, setRemoving] = useState(false);
  const [activeRightTab, setActiveRightTab] = useState<"details" | "activity" | "comments">("details");
  const [assignees, setAssignees] = useState<SprintAssignee[]>([]);
  const [comments, setComments] = useState<SprintComment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [postingComment, setPostingComment] = useState(false);
  const [searchCases, setSearchCases] = useState("");
  const commentRef = useRef<HTMLTextAreaElement>(null);

  // ESC to close (only when no sub-modal is open)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !showCreate && !showLink && !showAssign && !detailCase) {
        onClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, showCreate, showLink, showAssign, detailCase]);

  const loadCases = async () => {
    setLoading(true);
    try {
      const res = await API.get(`/api/sprints/${sprintId}/suites/${suite.suite_id}/test-cases`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.data.success) {
        setCases(res.data.data);
        if (res.data.data.length > 0 && expandedId === null) {
          setExpandedId(res.data.data[0].id);
        }
      }
    } catch {
      setAlert({ type: "error", message: "Failed to load test cases." });
    } finally {
      setLoading(false);
    }
  };

  const loadAssignees = async () => {
    try {
      const res = await API.get(`/api/sprints/${sprintId}/assignees`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = res.data?.data ?? res.data;
      if (Array.isArray(data)) setAssignees(data);
    } catch { /* silent */ }
  };

  const loadComments = async () => {
    try {
      const res = await API.get(`/api/sprints/${sprintId}/comments`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = res.data?.data ?? res.data;
      if (Array.isArray(data)) setComments(data);
    } catch { /* silent */ }
  };

  useEffect(() => {
    loadCases();
    loadAssignees();
    loadComments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sprintId, suite.suite_id]);

  const handleBoardStatusChange = async (value: string) => {
    setBoardStatus(value);
    try {
      await API.put(`/api/sprints/${sprintId}/suites/${suite.suite_id}/board-status`,
        { board_status: value }, { headers: { Authorization: `Bearer ${getToken()}` } });
      onBoardChanged();
    } catch {
      setAlert({ type: "error", message: "Failed to update board status." });
    }
  };

  const handleUnlink = async (testCaseId: number) => {
    try {
      await API.delete(`/api/sprints/${sprintId}/suites/${suite.suite_id}/test-cases/${testCaseId}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      setCases((prev) => prev.filter((c) => c.id !== testCaseId));
      if (expandedId === testCaseId) setExpandedId(null);
      onBoardChanged();
    } catch {
      setAlert({ type: "error", message: "Failed to unlink test case." });
    }
  };

  const handleRemoveSuite = async () => {
    if (!window.confirm(`Remove "${suite.suite_name}" from this sprint's board?`)) return;
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

  const handlePostComment = async () => {
    if (!newComment.trim()) return;
    setPostingComment(true);
    try {
      await API.post(`/api/sprints/${sprintId}/comments`,
        { comment: newComment.trim() },
        { headers: { Authorization: `Bearer ${getToken()}` } });
      setNewComment("");
      loadComments();
    } catch {
      setAlert({ type: "error", message: "Failed to post comment." });
    } finally {
      setPostingComment(false);
    }
  };

  const filteredCases = cases.filter((c) =>
    !searchCases || c.title.toLowerCase().includes(searchCases.toLowerCase()),
  );

  const passedCount = cases.filter((c) => c.latest_run?.status === "passed").length;
  const failedCount = cases.filter((c) => c.latest_run?.status === "failed").length;
  const progress = cases.length > 0 ? Math.round((passedCount / cases.length) * 100) : 0;

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
              <h2 className="text-base font-bold text-gray-900 dark:text-white truncate">{suite.suite_name}</h2>
            </div>
            {sprintName && (
              <span className="hidden sm:inline-flex items-center px-2 py-0.5 text-[10px] font-semibold rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 flex-shrink-0">
                {sprintName}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Action buttons */}
            <button onClick={() => setShowAssign(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors">
              <FaUserPlus className="w-3 h-3" /> Assign
            </button>
            <button onClick={() => setShowLink(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors">
              <FaLink className="w-3 h-3" /> Link
            </button>
            <button onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
              <FaPlus className="w-3 h-3" /> Create
            </button>
            <button onClick={onClose} title="Close (Esc)"
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ml-1">
              <FaTimes className="w-4 h-4" />
            </button>
          </div>
        </div>

        {alert && (
          <div className="px-5 pt-3 flex-shrink-0">
            <Alert variant={alert.type} title={alert.type === "success" ? "Success" : "Error"} message={alert.message} />
          </div>
        )}

        {/* ── Body ── */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-[1fr_300px]">

          {/* Left: test cases */}
          <div className="overflow-y-auto p-5 border-r border-gray-100 dark:border-gray-800">

            {/* Progress bar */}
            {cases.length > 0 && (
              <div className="mb-4 p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">Execution Progress</span>
                  <span className="text-xs font-bold text-gray-800 dark:text-gray-200">{progress}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-green-500 to-emerald-400 transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="flex items-center gap-3 mt-1.5 text-[10px] text-gray-400">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" />{passedCount} passed</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" />{failedCount} failed</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-400" />{cases.length - passedCount - failedCount} pending</span>
                </div>
              </div>
            )}

            {/* Search + count */}
            <div className="flex items-center gap-2 mb-3">
              <div className="relative flex-1">
                <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
                <input value={searchCases} onChange={(e) => setSearchCases(e.target.value)}
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
                <FaSpinner className="animate-spin w-5 h-5 mr-2" /> Loading test cases…
              </div>
            ) : filteredCases.length === 0 ? (
              <div className="text-sm text-gray-500 dark:text-gray-400 py-10 text-center border border-dashed border-gray-300 dark:border-gray-700 rounded-xl">
                {cases.length === 0 ? (
                  <>No test cases yet.{" "}<button onClick={() => setShowCreate(true)} className="text-blue-500 hover:underline">Create one</button> or{" "}<button onClick={() => setShowLink(true)} className="text-blue-500 hover:underline">link existing</button>.</>
                ) : "No cases match your search."}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredCases.map((tc) => (
                  <TestCaseRow
                    key={tc.id}
                    tc={tc}
                    suite={suite}
                    sprintId={sprintId}
                    isExpanded={expandedId === tc.id}
                    onToggle={() => setExpandedId((p) => (p === tc.id ? null : tc.id))}
                    onUnlink={() => handleUnlink(tc.id)}
                    onViewDetail={() => setDetailCase(tc)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Right: details sidebar */}
          <div className="overflow-y-auto flex flex-col bg-gray-50/50 dark:bg-gray-800/20">

            {/* Right tabs */}
            <div className="flex border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex-shrink-0">
              {(["details", "activity", "comments"] as const).map((tab) => (
                <button key={tab} onClick={() => setActiveRightTab(tab)}
                  className={`flex-1 py-2.5 text-xs font-semibold capitalize transition-colors border-b-2 ${
                    activeRightTab === tab
                      ? "text-blue-600 dark:text-blue-400 border-blue-500 bg-blue-50/50 dark:bg-blue-900/10"
                      : "text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-700 dark:hover:text-gray-300"
                  }`}>
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
                  {/* Board Status */}
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">Board Status</p>
                    <div className="flex gap-1.5">
                      {BOARD_STATUSES.map((s) => (
                        <button key={s} onClick={() => handleBoardStatusChange(s)}
                          className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                            boardStatus === s
                              ? s === "Done"
                                ? "bg-green-600 text-white border-green-600"
                                : s === "In Progress"
                                  ? "bg-blue-600 text-white border-blue-600"
                                  : "bg-gray-700 text-white border-gray-700 dark:bg-gray-200 dark:text-gray-900 dark:border-gray-200"
                              : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500"
                          }`}>
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Assignees */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">Assignees</p>
                      <button onClick={() => setShowAssign(true)} className="text-[10px] text-blue-500 hover:text-blue-600 font-semibold flex items-center gap-0.5">
                        <FaPlus className="w-2.5 h-2.5" /> Add
                      </button>
                    </div>
                    {assignees.length === 0 ? (
                      <button onClick={() => setShowAssign(true)}
                        className="w-full py-2 text-xs text-gray-400 border border-dashed border-gray-300 dark:border-gray-700 rounded-lg hover:border-blue-400 hover:text-blue-500 transition-colors">
                        + Assign users
                      </button>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {assignees.map((a) => (
                          <div key={a.id} className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm">
                            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-[9px] font-bold">
                              {(a.full_name || a.username).charAt(0).toUpperCase()}
                            </div>
                            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{a.full_name || a.username}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Suite details */}
                  <div className="space-y-3 pt-2 border-t border-gray-200 dark:border-gray-700">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1">Project</p>
                      <p className="text-sm text-gray-800 dark:text-gray-200">{suite.project_name || "—"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1">Suite Status</p>
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full ${
                        suite.is_active
                          ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                          : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${suite.is_active ? "bg-green-500" : "bg-red-500"}`} />
                        {suite.is_active ? "Active" : "Inactive"}
                      </span>
                    </div>
                    {suite.description && (
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1">Description</p>
                        <p className="text-xs text-gray-600 dark:text-gray-300">{suite.description}</p>
                      </div>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                    {[
                      { label: "Total Cases", value: cases.length },
                      { label: "Passed", value: passedCount },
                      { label: "Failed", value: failedCount },
                      { label: "Coverage", value: `${progress}%` },
                    ].map(({ label, value }) => (
                      <div key={label} className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-2.5 text-center">
                        <p className="text-base font-bold text-gray-900 dark:text-white">{value}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">{label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Remove suite */}
                  <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                    <button onClick={handleRemoveSuite} disabled={removing}
                      className="w-full py-2 text-xs font-medium text-red-500 hover:text-red-700 disabled:opacity-60 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                      {removing ? "Removing…" : "Remove suite from sprint"}
                    </button>
                  </div>
                </>
              )}

              {/* ── Activity tab ── */}
              {activeRightTab === "activity" && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">Recent Activity</p>
                  <div className="space-y-3">
                    {cases.flatMap((c) => (c.runs || []).map((r) => ({ tc: c, run: r }))).length === 0 ? (
                      <p className="text-xs text-gray-400 italic text-center py-6">No activity recorded yet.</p>
                    ) : (
                      cases.flatMap((c) => (c.runs || []).slice(0, 2).map((r) => {
                        const rs = RUN_STATUS[r.status] || RUN_STATUS.pending;
                        return (
                          <div key={`${c.id}-${r.id}`} className="flex gap-2.5">
                            <div className={`mt-0.5 p-1 rounded-full flex-shrink-0 ${r.status === "passed" ? "bg-green-100 dark:bg-green-900/30" : "bg-red-100 dark:bg-red-900/30"}`}>
                              <span className="text-xs">{rs.icon}</span>
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs text-gray-700 dark:text-gray-300">
                                <span className="font-medium">{r.executed_by_name || "System"}</span> ran{" "}
                                <span className="text-gray-500 truncate inline-block max-w-[120px] align-bottom">{c.title}</span>
                              </p>
                              <p className="text-[10px] text-gray-400">{timeAgo(r.started_at)}</p>
                            </div>
                          </div>
                        );
                      }))
                    )}
                  </div>
                </div>
              )}

              {/* ── Comments tab ── */}
              {activeRightTab === "comments" && (
                <div className="flex flex-col h-full">
                  <div className="flex-1 space-y-3 mb-3">
                    {comments.length === 0 ? (
                      <p className="text-xs text-gray-400 italic text-center py-6">No comments yet. Start the conversation.</p>
                    ) : comments.map((c) => (
                      <div key={c.id} className="flex gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                          {(c.created_by_name || "?").charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2">
                            <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">{c.created_by_name || "Unknown"}</span>
                            <span className="text-[10px] text-gray-400">{timeAgo(c.created_at)}</span>
                          </div>
                          <div className="mt-1 px-3 py-2 rounded-xl rounded-tl-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
                            {c.comment}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Comment composer */}
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-3 flex-shrink-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">Add a comment</p>
                    <textarea ref={commentRef} value={newComment} onChange={(e) => setNewComment(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handlePostComment(); }}
                      placeholder="Add a comment… (Ctrl+Enter to submit)"
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    />
                    <div className="flex justify-end mt-2">
                      <button onClick={handlePostComment} disabled={postingComment || !newComment.trim()}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition-colors">
                        {postingComment ? <FaSpinner className="w-3 h-3 animate-spin" /> : <FaPaperPlane className="w-3 h-3" />}
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

      {/* Sub-modals */}
      {showCreate && (
        <CreateTestCaseModal sprintId={sprintId} suiteId={suite.suite_id}
          onClose={() => setShowCreate(false)}
          onCreated={() => { loadCases(); onBoardChanged(); }} />
      )}
      {showLink && (
        <LinkExistingModal sprintId={sprintId} suiteId={suite.suite_id}
          onClose={() => setShowLink(false)}
          onLinked={() => { loadCases(); onBoardChanged(); }} />
      )}
      {showAssign && (
        <AssignUsersModal sprintId={sprintId} currentAssignees={assignees}
          onClose={() => setShowAssign(false)}
          onUpdated={() => { loadAssignees(); }} />
      )}
      {detailCase && (
        <TestCaseDetailModal testCase={detailCase} currentSuiteId={suite.suite_id}
          projectName={suite.project_name} suiteName={suite.suite_name}
          sprintName={sprintName} onClose={() => setDetailCase(null)} />
      )}
    </div>
  );
}