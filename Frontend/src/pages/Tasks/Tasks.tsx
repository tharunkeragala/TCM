import { useState, useEffect, useRef } from "react";
import {
  FaEdit,
  FaTrash,
  FaEye,
  FaPlus,
  FaBell,
  FaChevronDown,
  FaChevronUp,
  FaFilter,
  FaSearch,
  FaClock,
  FaUser,
  FaTag,
  FaCalendarAlt,
  FaPaperclip,
  FaCheckCircle,
  FaSpinner,
  FaPauseCircle,
  FaTimesCircle,
  FaExclamationCircle,
} from "react-icons/fa";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import Alert from "../../components/ui/alert/Alert";
import useFetchWithAuth from "../../hooks/useFetchWithAuth";
import API from "../../services/api";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { formatDateTime } from "../../utils/dateUtils";
import type { JSX } from "react";

// ─── Date Utilities ───────────────────────────────────────────────────────────
function formatDate(value: string | null | undefined): string {
  if (!value) return "Not set";
  const datePart = value.trim().substring(0, 10);
  const [yyyy, mm, dd] = datePart.split("-");
  if (!yyyy || !mm || !dd) return "Not set";
  return `${dd}/${mm}/${yyyy}`;
}

function toLocalDateString(date: Date | null): string {
  if (!date) return "";
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface User {
  id: number;
  username: string;
  email?: string;
}

interface Project {
  id: number;
  project_name: string;
}

interface TestSuite {
  id: number;
  suite_name: string;
  project_id: number;
}

interface TaskAssignment {
  id: number;
  user_id: number;
  role: "Owner" | "Assignee" | "Watcher";
  username: string;
  email?: string;
}

interface TaskComment {
  id: number;
  comment: string;
  is_system: boolean;
  created_by: number | null;
  created_by_name: string | null;
  created_at: string;
}

interface TaskProgress {
  id: number;
  comment: string;
  created_by: number;
  created_by_name: string;
  created_at: string;
}

interface ETAHistory {
  id: number;
  old_eta: string | null;
  new_eta: string;
  reason: string;
  updated_by_name: string;
  updated_at: string;
}

interface Task {
  id: number;
  title: string;
  description: string;
  status: "Pending" | "In Progress" | "On Hold" | "Completed" | "Cancelled";
  priority: "Low" | "Medium" | "High";
  start_date: string | null;
  due_date: string | null;
  project_id: number | null;
  suite_id: number | null;
  tags: string | null;
  created_by: number;
  created_by_name?: string;
  updated_by_name?: string;
  project_name?: string;
  suite_name?: string;
  assignees?: string;
  comment_count?: number;
  assignments?: TaskAssignment[];
  comments?: TaskComment[];
  progress?: TaskProgress[];
  eta_history?: ETAHistory[];
  created_at?: string;
  updated_at?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { color: string; icon: JSX.Element }> = {
  Pending: {
    color:
      "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
    icon: <FaClock className="w-3 h-3" />,
  },
  "In Progress": {
    color: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    icon: <FaSpinner className="w-3 h-3" />,
  },
  "On Hold": {
    color:
      "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
    icon: <FaPauseCircle className="w-3 h-3" />,
  },
  Completed: {
    color:
      "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
    icon: <FaCheckCircle className="w-3 h-3" />,
  },
  Cancelled: {
    color: "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400",
    icon: <FaTimesCircle className="w-3 h-3" />,
  },
};

const PRIORITY_CONFIG: Record<string, string> = {
  Low: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
  Medium: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  High: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG["Pending"];
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-full ${cfg.color}`}
    >
      {cfg.icon}
      {status}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  return (
    <span
      className={`px-2 py-1 text-xs font-semibold rounded-full ${PRIORITY_CONFIG[priority] || ""}`}
    >
      {priority}
    </span>
  );
}

function TagList({ tags }: { tags: string | null }) {
  if (!tags) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {tags.split(",").map((t, i) => (
        <span
          key={i}
          className="px-2 py-0.5 text-xs rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 flex items-center gap-1"
        >
          <FaTag className="w-2.5 h-2.5" />
          {t.trim()}
        </span>
      ))}
    </div>
  );
}

function isOverdue(due_date: string | null, status: string) {
  if (!due_date || status === "Completed" || status === "Cancelled")
    return false;
  return new Date(due_date) < new Date();
}

// ─── Reminder Badge (compact, sits in the View modal top bar) ────────────────

function ReminderBadge({
  taskId,
  onToast,
}: {
  taskId: number;
  onToast: (msg: string) => void;
}) {
  const [reminder, setReminder] = useState<{
    remind_before: number;
    remind_unit: string;
    is_recurring: boolean;
    remind_at: string;
    is_sent: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPopover, setShowPopover] = useState(false);
  const [reminderData, setReminderData] = useState({
    remind_before: "7",
    remind_unit: "days",
    is_recurring: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close popover on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setShowPopover(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Fetch on mount
  useEffect(() => {
    const fetchReminder = async () => {
      setLoading(true);
      try {
        const token =
          localStorage.getItem("token") || sessionStorage.getItem("token");
        const res = await API.get(`/api/tasks/${taskId}/latestreminders`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.data.success) {
          setReminder(res.data.reminder);
          if (res.data.reminder) {
            setReminderData({
              remind_before: String(res.data.reminder.remind_before),
              remind_unit: res.data.reminder.remind_unit,
              is_recurring: res.data.reminder.is_recurring,
            });
          }
        }
      } catch {
        setReminder(null);
      } finally {
        setLoading(false);
      }
    };
    fetchReminder();
  }, [taskId]);

  const handleSave = async () => {
    setSubmitting(true);
    try {
      const token =
        localStorage.getItem("token") || sessionStorage.getItem("token");
      await API.post(`/api/tasks/${taskId}/reminders`, reminderData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      // Re-fetch updated reminder
      const res = await API.get(`/api/tasks/${taskId}/latestreminders`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data.success) setReminder(res.data.reminder);
      setShowPopover(false);
      onToast(
        reminder
          ? `Updated to ${reminderData.remind_before} ${reminderData.remind_unit} before due date`
          : `Set for ${reminderData.remind_before} ${reminderData.remind_unit} before due date`,
      );
    } catch {
      onToast("Failed to save reminder.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div ref={ref} className="relative">
      {/* Badge button */}
      <button
        onClick={() => setShowPopover(!showPopover)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
          loading
            ? "border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500"
            : reminder
              ? reminder.is_sent
                ? "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400"
                : "border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400"
              : "border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-blue-300 hover:text-blue-600"
        }`}
      >
        <FaBell className="w-3 h-3" />
        {loading ? (
          <span>...</span>
        ) : reminder ? (
          <span>
            {reminder.remind_before} {reminder.remind_unit}
            {reminder.is_sent && " ✓"}
            {reminder.is_recurring && " 🔁"}
          </span>
        ) : (
          <span>Remind</span>
        )}
      </button>

      {/* Popover */}
      {showPopover && (
        <div className="absolute right-0 top-full mt-2 z-50 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl p-3 space-y-3">
          {/* Current reminder info */}
          {reminder && (
            <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg px-2.5 py-2">
              <FaBell className="w-3 h-3 text-blue-500 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">
                  {reminder.remind_before} {reminder.remind_unit} before due
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
                  {formatDate(reminder.remind_at)}
                  {reminder.is_sent && (
                    <span className="ml-1 text-green-500">✓ Sent</span>
                  )}
                </p>
              </div>
            </div>
          )}

          {/* Warning if updating */}
          {reminder && (
            <p className="text-xs text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-800 rounded-lg px-2 py-1.5">
              ⚠️ Saving will replace the current reminder.
            </p>
          )}

          {/* Form */}
          <div className="flex gap-2">
            <input
              type="number"
              min={1}
              value={reminderData.remind_before}
              onChange={(e) =>
                setReminderData({
                  ...reminderData,
                  remind_before: e.target.value,
                })
              }
              className="w-16 px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <select
              value={reminderData.remind_unit}
              onChange={(e) =>
                setReminderData({
                  ...reminderData,
                  remind_unit: e.target.value,
                })
              }
              className="flex-1 px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="hours">Hours</option>
              <option value="days">Days</option>
              <option value="months">Months</option>
            </select>
          </div>

          <label className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={reminderData.is_recurring}
              onChange={(e) =>
                setReminderData({
                  ...reminderData,
                  is_recurring: e.target.checked,
                })
              }
              className="rounded border-gray-300"
            />
            Recurring
          </label>

          <div className="flex gap-2 pt-1">
            <button
              onClick={() => setShowPopover(false)}
              className="flex-1 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={submitting}
              className="flex-1 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg"
            >
              {submitting ? "..." : reminder ? "Update" : "Set"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Accordion Task Row ───────────────────────────────────────────────────────

function TaskAccordionRow({
  task,
  onEdit,
  onDelete,
  onView,
}: {
  task: Task;
  onEdit: (t: Task) => void;
  onDelete: (t: Task) => void;
  onView: (t: Task) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [detail, setDetail] = useState<Task | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const overdue = isOverdue(task.due_date, task.status);

  const handleExpand = async () => {
    if (!expanded && !detail) {
      setLoadingDetail(true);
      try {
        const token =
          localStorage.getItem("token") || sessionStorage.getItem("token");
        const res = await API.get(`/api/tasks/${task.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.data.success) setDetail(res.data.data);
      } catch {}
      setLoadingDetail(false);
    }
    setExpanded(!expanded);
  };

  return (
    <div
  className={`rounded-xl border transition-all duration-200 ${
    overdue
      ? "border-red-300 dark:border-red-700 bg-red-50 dark:bg-gray-900 hover:border-red-400 dark:hover:border-red-600"
      : expanded
        ? "border-blue-400 dark:border-blue-600 bg-blue-50 dark:bg-gray-800"
        : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 hover:border-blue-400 dark:hover:border-blue-600 hover:bg-blue-50 dark:hover:bg-gray-800"
  } shadow-sm hover:shadow-md`}
>
  {/* Header row */}
  <div
    className={`flex items-center gap-4 px-5 py-4 cursor-pointer select-none rounded-t-xl transition-colors duration-200 ${
      expanded
        ? "bg-blue-100 dark:bg-blue-900/30"
        : "hover:bg-gray-100 dark:hover:bg-gray-800/60"
    }`}
    onClick={handleExpand}
  >
    <button className="text-gray-500 dark:text-gray-400 flex-shrink-0">
      {expanded ? (
        <FaChevronUp className="w-4 h-4" />
      ) : (
        <FaChevronDown className="w-4 h-4" />
      )}
    </button>

    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-semibold text-gray-900 dark:text-white truncate">
          {task.title}
        </span>
        {overdue && (
          <span className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400 font-semibold">
            <FaExclamationCircle className="w-4 h-4" />
            Overdue
          </span>
        )}
      </div>
      {task.tags && <TagList tags={task.tags} />}
    </div>

    <div className="hidden md:flex items-center gap-4 flex-shrink-0">
      {task.project_name && (
        <span className="text-xs font-medium text-blue-700 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30 px-2.5 py-1 rounded-full">
          {task.project_name}
        </span>
      )}
      <PriorityBadge priority={task.priority} />
      <StatusBadge status={task.status} />
      {task.due_date && (
        <span
          className={`flex items-center gap-1.5 text-xs font-medium ${overdue ? "text-red-600 dark:text-red-400" : "text-gray-600 dark:text-gray-400"}`}
        >
          <FaCalendarAlt className="w-4 h-4" />
          {formatDate(task.due_date)}
        </span>
      )}
      {task.assignees && (
        <span className="flex items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-400">
          <FaUser className="w-4 h-4" />
          {task.assignees}
        </span>
      )}
      {(task.comment_count ?? 0) > 0 && (
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
          💬 {task.comment_count}
        </span>
      )}
    </div>

    <div
      className="flex items-center gap-4 flex-shrink-0"
      onClick={(e) => e.stopPropagation()}
    >
      <FaEye
        className="cursor-pointer text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 w-4 h-4 transition-colors"
        onClick={() => onView(task)}
      />
      <FaEdit
        className="cursor-pointer text-blue-500 hover:text-blue-700 dark:hover:text-blue-400 w-4 h-4 transition-colors"
        onClick={() => onEdit(task)}
      />
      <FaTrash
        className="cursor-pointer text-red-500 hover:text-red-700 dark:hover:text-red-400 w-4 h-4 transition-colors"
        onClick={() => onDelete(task)}
      />
    </div>
  </div>

  {expanded && (
    <div className="border-t border-gray-200 dark:border-gray-700 px-5 py-5">
      {loadingDetail ? (
        <div className="text-sm text-gray-500 dark:text-gray-400 py-2">
          Loading...
        </div>
      ) : detail ? (
        <AccordionDetail detail={detail} />
      ) : null}
    </div>
  )}
</div>
  );
}

function AccordionDetail({ detail }: { detail: Task }) {
  return (
    <div className="space-y-4">
      {detail.description && (
        <div className="border-l-2 border-blue-400 dark:border-gray-700 pl-3">
          <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide mb-2">
            Description
          </p>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            {detail.description}
          </p>
        </div>
      )}
      {detail.comments &&
        detail.comments.filter((c) => !c.is_system).length > 0 && (
          <div className="border-l-2 border-blue-400 dark:border-gray-700 pl-3">
            <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide mb-2">
              Latest Comments
            </p>
            <div className="space-y-2">
              {detail.comments
                .filter((c) => !c.is_system)
                .slice(0, 3)
                .map((c) => (
                  <div key={c.id} className="flex gap-2">
                    <div className="w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-xs font-bold text-gray-600 dark:text-gray-400 flex-shrink-0">
                      {c.created_by_name?.[0]?.toUpperCase() || "?"}
                    </div>
                    <div>
                      <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                        {c.created_by_name}
                      </span>
                      <span className="text-xs text-gray-400 dark:text-gray-500 ml-1">
                        {formatDateTime(c.created_at)}
                      </span>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                        {c.comment}
                      </p>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

      <div className="flex gap-4 pt-4">
        {detail.assignments && detail.assignments.length > 0 && (
          <div className="border-l-2 border-blue-400 dark:border-gray-700 pl-3">
            <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide mb-2">
              Participants
            </p>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
              {detail.assignments
                .filter((a) => a.role !== "Owner")
                .map((a) => (
                  <div key={a.id} className="flex items-center gap-2 min-w-0">
  <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-xs font-bold text-blue-700 dark:text-blue-300 flex-shrink-0">
    {a.username?.[0]?.toUpperCase()}
  </div>
  <span className="text-xs text-gray-700 dark:text-gray-300 truncate">
    {a.username}
  </span>
  <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">
    ({a.role})
  </span>
</div>
                ))}
            </div>
          </div>
        )}

        {detail.eta_history && detail.eta_history.length > 0 && (
          <div className="border-l-2 border-blue-400 dark:border-gray-700 pl-3">
            <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide mb-2">
              ETA History
            </p>
            <div className="space-y-1">
              {detail.eta_history.map((e) => (
                <div
                  key={e.id}
                  className="text-xs text-gray-600 dark:text-gray-400"
                >
                  <span className="line-through text-gray-400">
                    {e.old_eta ? formatDate(e.old_eta) : "—"}
                  </span>
                  {" → "}
                  <span className="font-medium text-gray-800 dark:text-gray-200">
                    {formatDate(e.new_eta)}
                  </span>
                  <span className="text-gray-400 ml-1">({e.reason})</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {detail.progress && detail.progress.length > 0 && (
          <div className="border-l-2 border-blue-400 dark:border-gray-700 pl-3">
            <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide mb-2">
              Recent Progress
            </p>
            <div className="space-y-1">
              {detail.progress.slice(0, 3).map((p) => (
                <div
                  key={p.id}
                  className="text-xs text-gray-600 dark:text-gray-400"
                >
                  <div className="flex flex-col">
  <span>{p.comment}</span>
  <span className="text-gray-400 dark:text-gray-500">
    {formatDateTime(p.created_at)}
  </span>
</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {detail.comments &&
        detail.comments.filter((c) => c.is_system).length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide mb-2">
              Activity Log
            </p>
            <div className="space-y-1 border-l-2 border-blue-400 dark:border-gray-700 pl-3">
              {detail.comments
                .filter((c) => c.is_system)
                .slice(0, 5)
                .map((c) => (
                  <div
                    key={c.id}
                    className="text-xs text-gray-500 dark:text-gray-400"
                  >
                    <div className="flex flex-col">
  <span>{c.comment}</span>
  <span className="text-gray-400 dark:text-gray-600">
    {formatDateTime(c.created_at)}
  </span>
</div>
                  </div>
                ))}
            </div>
          </div>
        )}
    </div>
  );
}

// ─── Multi-Select User Dropdown ───────────────────────────────────────────────

function UserMultiSelect({
  label,
  users,
  selected,
  onChange,
}: {
  label: string;
  users: User[];
  selected: number[];
  onChange: (ids: number[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const toggle = (id: number) => {
    onChange(
      selected.includes(id)
        ? selected.filter((x) => x !== id)
        : [...selected, id],
    );
  };

  const selectedNames = users
    .filter((u) => selected.includes(u.id))
    .map((u) => u.username)
    .join(", ");

  return (
    <div ref={ref} className="relative">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {label}
      </label>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm text-left focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-between"
      >
        <span className={selected.length === 0 ? "text-gray-400" : ""}>
          {selected.length === 0 ? `Select ${label}` : selectedNames}
        </span>
        <FaChevronDown className="w-3 h-3 text-gray-400 flex-shrink-0" />
      </button>
      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-xl max-h-48 overflow-y-auto">
          {users.map((u) => (
            <label
              key={u.id}
              className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selected.includes(u.id)}
                onChange={() => toggle(u.id)}
                className="rounded border-gray-300"
              />
              <div>
                <p className="text-sm text-gray-900 dark:text-white">
                  {u.username}
                </p>
                {u.email && <p className="text-xs text-gray-400">{u.email}</p>}
              </div>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Tasks() {
  const {
    data: tasks,
    loading,
    error,
  } = useFetchWithAuth<Task[]>("/api/tasks");
  const { data: projects } = useFetchWithAuth<Project[]>("/api/projects");
  const { data: allSuites } = useFetchWithAuth<TestSuite[]>("/api/test-suites");
  const { data: users } = useFetchWithAuth<User[]>("/api/dropdown/users");

  // Filters
  const [filterStatus, setFilterStatus] = useState(
  () => new URLSearchParams(window.location.search).get("status") ?? ""
);
  const [filterPriority, setFilterPriority] = useState("");
  const [filterAssignedMe, setFilterAssignedMe] = useState(false);
  const [search, setSearch] = useState("");

  // Create/Edit modal
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formAlert, setFormAlert] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    priority: "Medium" as Task["priority"],
    start_date: "",
    due_date: "",
    project_id: "",
    suite_id: "",
    tags: "",
  });
  const [assignees, setAssignees] = useState<number[]>([]);
  const [watchers, setWatchers] = useState<number[]>([]);
  const [selectedProjectFilter, setSelectedProjectFilter] = useState("");

  // Delete modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingTask, setDeletingTask] = useState<Task | null>(null);
  const [deleteAlert, setDeleteAlert] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [deletingInProgress, setDeletingInProgress] = useState(false);

  // View modal
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewingTask, setViewingTask] = useState<Task | null>(null);
  const [viewLoading, setViewLoading] = useState(false);

  // Reminder toast
  const [reminderToast, setReminderToast] = useState<string | null>(null);

  // Status change
  const [statusTask, setStatusTask] = useState<Task | null>(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [newStatus, setNewStatus] = useState("");
  const [statusSubmitting, setStatusSubmitting] = useState(false);
  const [statusAlert, setStatusAlert] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // ETA extension
  const [showETAModal, setShowETAModal] = useState(false);
  const [etaTask, setEtaTask] = useState<Task | null>(null);
  const [etaData, setEtaData] = useState({ new_eta: "", reason: "" });
  const [etaSubmitting, setEtaSubmitting] = useState(false);
  const [etaAlert, setEtaAlert] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const filteredSuites = allSuites?.filter((s) =>
    selectedProjectFilter
      ? String(s.project_id) === selectedProjectFilter
      : true,
  );

  const displayedTasks = (tasks || []).filter((t) => {
    if (filterStatus && t.status !== filterStatus) return false;
    if (filterPriority && t.priority !== filterPriority) return false;
    if (
      search &&
      !t.title.toLowerCase().includes(search.toLowerCase()) &&
      !(t.description || "").toLowerCase().includes(search.toLowerCase())
    )
      return false;
    return true;
  });

  // ── Toast helper ─────────────────────────────────────────────────────────────
  const showReminderToast = (msg: string) => {
    setReminderToast(msg);
    setTimeout(() => setReminderToast(null), 4000);
  };

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      priority: "Medium",
      start_date: "",
      due_date: "",
      project_id: "",
      suite_id: "",
      tags: "",
    });
    setAssignees([]);
    setWatchers([]);
    setSelectedProjectFilter("");
    setFormAlert(null);
  };

  const handleSave = async () => {
    if (!formData.title.trim()) {
      setFormAlert({ type: "error", message: "Title is required." });
      return;
    }
    setSubmitting(true);
    setFormAlert(null);
    try {
      const token =
        localStorage.getItem("token") || sessionStorage.getItem("token");
      const payload = {
        ...formData,
        project_id: formData.project_id || null,
        suite_id: formData.suite_id || null,
        start_date: formData.start_date || null,
        due_date: formData.due_date || null,
        assignees,
        watchers,
      };
      const url = editingTask
        ? `/api/tasks/update/${editingTask.id}`
        : "/api/tasks/create";
      const method = editingTask ? API.put : API.post;
      const res = await method(url, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data.success) {
        setFormAlert({
          type: "success",
          message: editingTask ? "Task updated!" : "Task created!",
        });
        setTimeout(() => {
          setShowModal(false);
          resetForm();
          setEditingTask(null);
          window.location.reload();
        }, 1200);
      }
    } catch (err: any) {
      setFormAlert({
        type: "error",
        message: err.response?.data?.message || "Operation failed.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async (task: Task) => {
    try {
      const token =
        localStorage.getItem("token") || sessionStorage.getItem("token");
      const res = await API.get(`/api/tasks/${task.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data.success) {
        const full: Task = res.data.data;
        setEditingTask(full);
        const suite = allSuites?.find((s) => s.id === full.suite_id);
        setSelectedProjectFilter(
          suite
            ? String(suite.project_id)
            : full.project_id
              ? String(full.project_id)
              : "",
        );
        setFormData({
          title: full.title,
          description: full.description || "",
          priority: full.priority,
          start_date: full.start_date ? full.start_date.substring(0, 10) : "",
          due_date: full.due_date ? full.due_date.substring(0, 10) : "",
          project_id: full.project_id ? String(full.project_id) : "",
          suite_id: full.suite_id ? String(full.suite_id) : "",
          tags: full.tags || "",
        });
        setAssignees(
          (full.assignments || [])
            .filter((a) => a.role === "Assignee")
            .map((a) => a.user_id),
        );
        setShowModal(true);
      }
    } catch {
      setEditingTask(task);
      setShowModal(true);
    }
  };

  const handleView = async (task: Task) => {
    setViewLoading(true);
    setShowViewModal(true);
    try {
      const token =
        localStorage.getItem("token") || sessionStorage.getItem("token");
      const res = await API.get(`/api/tasks/${task.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data.success) setViewingTask(res.data.data);
    } catch {
      setViewingTask(task);
    } finally {
      setViewLoading(false);
    }
  };

  const handleDeleteClick = (task: Task) => {
    setDeletingTask(task);
    setDeleteAlert(null);
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingTask) return;
    setDeletingInProgress(true);
    setDeleteAlert(null);
    try {
      const token =
        localStorage.getItem("token") || sessionStorage.getItem("token");
      await API.delete(`/api/tasks/delete/${deletingTask.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setDeleteAlert({
        type: "success",
        message: "Task deleted successfully.",
      });
      setTimeout(() => {
        setShowDeleteModal(false);
        setDeletingTask(null);
        window.location.reload();
      }, 1200);
    } catch (err: any) {
      setDeleteAlert({
        type: "error",
        message: err.response?.data?.message || "Failed to delete task.",
      });
    } finally {
      setDeletingInProgress(false);
    }
  };

  const handleStatusChange = async () => {
    if (!statusTask || !newStatus) return;
    setStatusSubmitting(true);
    setStatusAlert(null);
    try {
      const token =
        localStorage.getItem("token") || sessionStorage.getItem("token");
      await API.put(
        `/api/tasks/status/${statusTask.id}`,
        { status: newStatus },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setStatusAlert({ type: "success", message: "Status updated!" });
      setTimeout(() => {
        setShowStatusModal(false);
        setStatusTask(null);
        window.location.reload();
      }, 1000);
    } catch (err: any) {
      setStatusAlert({
        type: "error",
        message: err.response?.data?.message || "Failed to update status.",
      });
    } finally {
      setStatusSubmitting(false);
    }
  };

  const handleExtendETA = async () => {
    if (!etaTask) return;
    if (!etaData.new_eta) {
      setEtaAlert({ type: "error", message: "New ETA is required." });
      return;
    }
    if (!etaData.reason.trim()) {
      setEtaAlert({ type: "error", message: "Reason is required." });
      return;
    }
    setEtaSubmitting(true);
    setEtaAlert(null);
    try {
      const token =
        localStorage.getItem("token") || sessionStorage.getItem("token");
      await API.put(`/api/tasks/eta/${etaTask.id}`, etaData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setEtaAlert({ type: "success", message: "ETA extended!" });
      setTimeout(() => {
        setShowETAModal(false);
        setEtaTask(null);
        setEtaData({ new_eta: "", reason: "" });
        window.location.reload();
      }, 1000);
    } catch (err: any) {
      setEtaAlert({
        type: "error",
        message: err.response?.data?.message || "Failed to extend ETA.",
      });
    } finally {
      setEtaSubmitting(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div>
      <PageMeta title="Tasks" description="Task & Activity Management" />
      <PageBreadcrumb pageTitle="Tasks" />

      {/* ── Reminder Toast ───────────────────────────────────────────────────── */}
      {reminderToast && (
        <div className="fixed top-5 right-5 z-[9999999] flex items-center gap-3 bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-700 shadow-xl rounded-xl px-4 py-3 min-w-[280px] animate-fade-in">
          <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center flex-shrink-0">
            <FaBell className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-gray-800 dark:text-gray-100">
              Reminder
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {reminderToast}
            </p>
          </div>
          <button
            onClick={() => setReminderToast(null)}
            className="text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400 text-lg leading-none flex-shrink-0"
          >
            &times;
          </button>
        </div>
      )}

      <div className="mt-4 space-y-4">
        {/* ── Top bar ───────────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
              <input
                type="text"
                placeholder="Search tasks..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
              />
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Statuses</option>
              {[
                "Pending",
                "In Progress",
                "On Hold",
                "Completed",
                "Cancelled",
              ].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Priorities</option>
              {["Low", "Medium", "High"].map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
            <button
              onClick={() => setFilterAssignedMe(!filterAssignedMe)}
              className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg border transition-colors ${
                filterAssignedMe
                  ? "bg-blue-600 border-blue-600 text-white"
                  : "border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800"
              }`}
            >
              <FaUser className="w-3 h-3" />
              Assigned to me
            </button>
          </div>
          <button
            onClick={() => {
              setEditingTask(null);
              resetForm();
              setShowModal(true);
            }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition duration-150 flex items-center gap-2 flex-shrink-0"
          >
            <FaPlus className="w-3 h-3" /> Create Task
          </button>
        </div>

        {error && <Alert variant="error" title="Error" message={error} />}
        {loading && !error && (
          <div className="text-gray-500 dark:text-gray-400 text-sm">
            Loading tasks...
          </div>
        )}
        {!loading && !error && (
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Showing {displayedTasks.length} of {(tasks || []).length} tasks
          </div>
        )}

        {!loading && !error && (
          <div className="space-y-2">
            {displayedTasks.length > 0 ? (
              displayedTasks.map((task) => (
                <TaskAccordionRow
                  key={task.id}
                  task={task}
                  onEdit={handleEdit}
                  onDelete={handleDeleteClick}
                  onView={handleView}
                />
              ))
            ) : (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400 text-sm">
                No tasks found
              </div>
            )}
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          CREATE / EDIT MODAL
      ══════════════════════════════════════════════════════════════════════ */}
      {showModal && (
        <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingTask ? "Edit Task" : "Create Task"}
              </h2>
              <button
                onClick={() => {
                  setShowModal(false);
                  resetForm();
                  setEditingTask(null);
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl font-bold"
              >
                &times;
              </button>
            </div>

            {formAlert && (
              <div className="mb-4">
                <Alert
                  variant={formAlert.type}
                  title={formAlert.type === "success" ? "Success" : "Error"}
                  message={formAlert.message}
                />
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                placeholder="e.g. Fix login bug on mobile"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Task details..."
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Priority
                </label>
                <select
                  value={formData.priority}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      priority: e.target.value as Task["priority"],
                    })
                  }
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {["Low", "Medium", "High"].map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Start Date
                </label>
                <DatePicker
                  selected={
                    formData.start_date
                      ? (() => {
                          const [y, m, d] = formData.start_date
                            .split("-")
                            .map(Number);
                          return new Date(y, m - 1, d);
                        })()
                      : null
                  }
                  onChange={(date: Date | null) =>
                    setFormData({
                      ...formData,
                      start_date: toLocalDateString(date),
                    })
                  }
                  minDate={new Date()}
                  dateFormat="dd/MM/yyyy"
                  placeholderText="Select start date"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  ETA / Due Date
                </label>
                <DatePicker
                  selected={
                    formData.due_date
                      ? (() => {
                          const [y, m, d] = formData.due_date
                            .split("-")
                            .map(Number);
                          return new Date(y, m - 1, d);
                        })()
                      : null
                  }
                  onChange={(date: Date | null) =>
                    setFormData({
                      ...formData,
                      due_date: toLocalDateString(date),
                    })
                  }
                  minDate={new Date()}
                  dateFormat="dd/MM/yyyy"
                  placeholderText="Select a date"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Link to Project
                </label>
                <select
                  value={selectedProjectFilter}
                  onChange={(e) => {
                    setSelectedProjectFilter(e.target.value);
                    setFormData((prev) => ({
                      ...prev,
                      project_id: e.target.value,
                      suite_id: "",
                    }));
                  }}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- None --</option>
                  {projects?.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.project_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Link to Suite
                </label>
                <select
                  value={formData.suite_id}
                  onChange={(e) =>
                    setFormData({ ...formData, suite_id: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- None --</option>
                  {filteredSuites?.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.suite_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <UserMultiSelect
                label="Assignees"
                users={users || []}
                selected={assignees}
                onChange={setAssignees}
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Tags{" "}
                <span className="text-xs text-gray-400 font-normal">
                  (comma-separated)
                </span>
              </label>
              <input
                type="text"
                value={formData.tags}
                onChange={(e) =>
                  setFormData({ ...formData, tags: e.target.value })
                }
                placeholder="e.g. regression, smoke, auth"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {formData.tags && <TagList tags={formData.tags} />}
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowModal(false);
                  resetForm();
                  setEditingTask(null);
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 rounded-lg transition duration-150"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={submitting}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg transition duration-150"
              >
                {submitting
                  ? editingTask
                    ? "Updating..."
                    : "Creating..."
                  : editingTask
                    ? "Update"
                    : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          VIEW / DETAIL MODAL
      ══════════════════════════════════════════════════════════════════════ */}
      {showViewModal && (
        <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-3xl mx-4 p-6 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-start justify-between gap-3 mb-5">
              <div className="flex-1 min-w-0">
                {viewingTask && (
                  <>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                        {viewingTask.title}
                      </h2>
                      {isOverdue(viewingTask.due_date, viewingTask.status) && (
                        <span className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400 font-medium">
                          <FaExclamationCircle className="w-3 h-3" />
                          Overdue
                        </span>
                      )}
                    </div>
                    {viewingTask.tags && <TagList tags={viewingTask.tags} />}
                  </>
                )}
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {viewingTask && (
                  <>
                    {/* Compact Reminder Badge */}
                    <ReminderBadge
                      taskId={viewingTask.id}
                      onToast={showReminderToast}
                    />

                    <button
                      onClick={() => {
                        setShowViewModal(false);
                        setStatusTask(viewingTask);
                        setNewStatus(viewingTask.status);
                        setShowStatusModal(true);
                      }}
                      className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
                    >
                      Change Status
                    </button>
                    <button
                      onClick={() => {
                        setShowViewModal(false);
                        setEtaTask(viewingTask);
                        setShowETAModal(true);
                      }}
                      className="px-3 py-1.5 text-xs font-medium text-white bg-orange-500 hover:bg-orange-600 rounded-lg"
                    >
                      Extend ETA
                    </button>
                  </>
                )}
                <button
                  onClick={() => {
                    setShowViewModal(false);
                    setViewingTask(null);
                  }}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl font-bold"
                >
                  &times;
                </button>
              </div>
            </div>

            {viewLoading && (
              <div className="text-sm text-gray-400 py-4">Loading...</div>
            )}

            {!viewLoading && viewingTask && (
              <TaskDetailView
                task={viewingTask}
                users={users || []}
                onProgressAdded={() => handleView(viewingTask)}
                onCommentAdded={() => handleView(viewingTask)}
                onReminderSaved={showReminderToast}
              />
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          STATUS CHANGE MODAL
      ══════════════════════════════════════════════════════════════════════ */}
      {showStatusModal && statusTask && (
        <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Change Status
              </h2>
              <button
                onClick={() => {
                  setShowStatusModal(false);
                  setStatusTask(null);
                  setStatusAlert(null);
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl font-bold"
              >
                &times;
              </button>
            </div>
            {statusAlert && (
              <div className="mb-4">
                <Alert
                  variant={statusAlert.type}
                  title={statusAlert.type === "success" ? "Success" : "Error"}
                  message={statusAlert.message}
                />
              </div>
            )}
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Task:{" "}
              <span className="font-medium text-gray-900 dark:text-white">
                {statusTask.title}
              </span>
            </p>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                New Status
              </label>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {[
                  "Pending",
                  "In Progress",
                  "On Hold",
                  "Completed",
                  "Cancelled",
                ].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowStatusModal(false);
                  setStatusTask(null);
                  setStatusAlert(null);
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleStatusChange}
                disabled={statusSubmitting}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg"
              >
                {statusSubmitting ? "Saving..." : "Update Status"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          ETA EXTENSION MODAL
      ══════════════════════════════════════════════════════════════════════ */}
      {showETAModal && etaTask && (
        <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Extend ETA
              </h2>
              <button
                onClick={() => {
                  setShowETAModal(false);
                  setEtaTask(null);
                  setEtaData({ new_eta: "", reason: "" });
                  setEtaAlert(null);
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl font-bold"
              >
                &times;
              </button>
            </div>
            {etaAlert && (
              <div className="mb-4">
                <Alert
                  variant={etaAlert.type}
                  title={etaAlert.type === "success" ? "Success" : "Error"}
                  message={etaAlert.message}
                />
              </div>
            )}
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
              Task:{" "}
              <span className="font-medium text-gray-900 dark:text-white">
                {etaTask.title}
              </span>
            </p>
            {etaTask.due_date && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                Current ETA: {formatDate(etaTask.due_date)}
              </p>
            )}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                New ETA <span className="text-red-500">*</span>
              </label>
              <DatePicker
                selected={
                  etaData.new_eta
                    ? (() => {
                        const [y, m, d] = etaData.new_eta
                          .split("-")
                          .map(Number);
                        return new Date(y, m - 1, d);
                      })()
                    : null
                }
                onChange={(date: Date | null) =>
                  setEtaData({ ...etaData, new_eta: toLocalDateString(date) })
                }
                minDate={new Date()}
                dateFormat="dd/MM/yyyy"
                placeholderText="Select ETA"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Reason <span className="text-red-500">*</span>
              </label>
              <textarea
                value={etaData.reason}
                onChange={(e) =>
                  setEtaData({ ...etaData, reason: e.target.value })
                }
                placeholder="Why is the ETA being extended?"
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowETAModal(false);
                  setEtaTask(null);
                  setEtaData({ new_eta: "", reason: "" });
                  setEtaAlert(null);
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleExtendETA}
                disabled={etaSubmitting}
                className="px-4 py-2 text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-60 rounded-lg"
              >
                {etaSubmitting ? "Saving..." : "Extend ETA"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          DELETE MODAL
      ══════════════════════════════════════════════════════════════════════ */}
      {showDeleteModal && deletingTask && (
        <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Delete Task
              </h2>
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeletingTask(null);
                  setDeleteAlert(null);
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl font-bold"
              >
                &times;
              </button>
            </div>
            {deleteAlert && (
              <div className="mb-4">
                <Alert
                  variant={deleteAlert.type}
                  title={deleteAlert.type === "success" ? "Success" : "Error"}
                  message={deleteAlert.message}
                />
              </div>
            )}
            <div className="flex items-start gap-3 mb-6">
              <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full bg-red-100 dark:bg-red-900">
                <svg
                  className="w-5 h-5 text-red-600 dark:text-red-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                  />
                </svg>
              </div>
              <div>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  Are you sure you want to delete task{" "}
                  <span className="font-semibold text-gray-900 dark:text-white">
                    "{deletingTask.title}"
                  </span>
                  ? All comments, progress logs, assignments and attachments
                  will be permanently removed.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeletingTask(null);
                  setDeleteAlert(null);
                }}
                disabled={deletingInProgress}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 rounded-lg transition duration-150"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deletingInProgress}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-60 rounded-lg transition duration-150"
              >
                {deletingInProgress ? "Deleting..." : "Yes, Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Task Detail View ─────────────────────────────────────────────────────────

function TaskDetailView({
  task,
  users,
  onProgressAdded,
  onCommentAdded,
  onReminderSaved,
}: {
  task: Task;
  users: User[];
  onProgressAdded: () => void;
  onCommentAdded: () => void;
  onReminderSaved: (msg: string) => void;
}) {
  const [progressText, setProgressText] = useState("");
  const [commentText, setCommentText] = useState("");
  const [mentions, setMentions] = useState<number[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleMentionClick = (userId: number, username: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const mention = `@${username.split(" ")[0]} `;
    const newText =
      commentText.substring(0, start) + mention + commentText.substring(end);
    setCommentText(newText);
    setMentions((prev) =>
      prev.includes(userId)
        ? prev.filter((x) => x !== userId)
        : [...prev, userId],
    );
    setTimeout(() => {
      textarea.focus();
      const cursor = start + mention.length;
      textarea.setSelectionRange(cursor, cursor);
    }, 0);
  };
  const [submittingP, setSubmittingP] = useState(false);
  const [submittingC, setSubmittingC] = useState(false);
  const [progressAlert, setProgressAlert] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [commentAlert, setCommentAlert] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Reminder state
  const [showReminderForm, setShowReminderForm] = useState(false);
  const [reminderData, setReminderData] = useState({
    remind_before: "7",
    remind_unit: "days",
    is_recurring: false,
  });
  const [submittingR, setSubmittingR] = useState(false);
  const [reminderAlert, setReminderAlert] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [existingReminder, setExistingReminder] = useState<{
    id: number;
    remind_before: number;
    remind_unit: string;
    is_recurring: boolean;
    remind_at: string;
    is_sent: boolean;
  } | null>(null);
  const [reminderLoading, setReminderLoading] = useState(true);

  // Fetch latest active reminder on mount
  useEffect(() => {
    const fetchReminder = async () => {
      setReminderLoading(true);
      try {
        const token =
          localStorage.getItem("token") || sessionStorage.getItem("token");
        const res = await API.get(`/api/tasks/${task.id}/latestreminders`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.data.success) {
          setExistingReminder(res.data.reminder);
        }
      } catch {
        setExistingReminder(null);
      } finally {
        setReminderLoading(false);
      }
    };
    fetchReminder();
  }, [task.id]);

  const handleAddProgress = async () => {
    if (!progressText.trim()) return;
    setSubmittingP(true);
    setProgressAlert(null);
    try {
      const token =
        localStorage.getItem("token") || sessionStorage.getItem("token");
      await API.post(
        `/api/tasks/${task.id}/progress`,
        { comment: progressText },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setProgressText("");
      setProgressAlert({ type: "success", message: "Progress added." });
      onProgressAdded();
    } catch (err: any) {
      setProgressAlert({
        type: "error",
        message: err.response?.data?.message || "Failed.",
      });
    } finally {
      setSubmittingP(false);
    }
  };

  const handleAddComment = async () => {
    if (!commentText.trim()) return;
    setSubmittingC(true);
    setCommentAlert(null);
    try {
      const token =
        localStorage.getItem("token") || sessionStorage.getItem("token");
      await API.post(
        `/api/tasks/${task.id}/comments`,
        { comment: commentText, mentions },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setCommentText("");
      setMentions([]);
      setCommentAlert({ type: "success", message: "Comment added." });
      onCommentAdded();
    } catch (err: any) {
      setCommentAlert({
        type: "error",
        message: err.response?.data?.message || "Failed.",
      });
    } finally {
      setSubmittingC(false);
    }
  };

  const handleSetReminder = async () => {
    setSubmittingR(true);
    setReminderAlert(null);
    try {
      const token =
        localStorage.getItem("token") || sessionStorage.getItem("token");
      await API.post(`/api/tasks/${task.id}/reminders`, reminderData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const msg = existingReminder
        ? `Updated to ${reminderData.remind_before} ${reminderData.remind_unit} before due date`
        : `Set for ${reminderData.remind_before} ${reminderData.remind_unit} before due date`;
      setReminderAlert({ type: "success", message: "Reminder saved!" });
      setShowReminderForm(false);
      onReminderSaved(msg);
      // Re-fetch to refresh the card
      const res = await API.get(`/api/tasks/${task.id}/latestreminders`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data.success) setExistingReminder(res.data.reminder);
    } catch (err: any) {
      setReminderAlert({
        type: "error",
        message: err.response?.data?.message || "Failed.",
      });
    } finally {
      setSubmittingR(false);
    }
  };

  const overdue = isOverdue(task.due_date, task.status);

  return (
    <div className="space-y-6">
      {/* Header info */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pb-4 border-b border-gray-100 dark:border-gray-800">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">
            Status
          </p>
          <StatusBadge status={task.status} />
        </div>
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">
            Priority
          </p>
          <PriorityBadge priority={task.priority} />
        </div>
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">
            Due Date
          </p>
          <p
            className={`text-sm font-medium ${overdue ? "text-red-500" : "text-gray-800 dark:text-gray-200"}`}
          >
            {task.due_date ? formatDate(task.due_date) : "Not set"}
            {overdue && " ⚠️"}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">
            Start Date
          </p>
          <p className="text-sm text-gray-800 dark:text-gray-200">
            {task.start_date ? formatDate(task.start_date) : "Not set"}
          </p>
        </div>
      </div>

      {/* Description */}
      {task.description && (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
            Description
          </p>
          <p className="text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
            {task.description}
          </p>
        </div>
      )}

      {/* Projects / Suites / Assignees */}
      <div className="flex gap-6">
        {(task.project_name || task.suite_name) && (
          <div className="flex-1">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
              Projects & Suites
            </p>
            <div className="flex gap-3">
              {task.project_name && (
                <span className="text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 px-3 py-1 rounded-full">
                  📁 {task.project_name}
                </span>
              )}
              {task.suite_name && (
                <span className="text-xs bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 px-3 py-1 rounded-full">
                  🧪 {task.suite_name}
                </span>
              )}
            </div>
          </div>
        )}
        {task.assignments && task.assignments.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
              Assignees
            </p>
            <div className="flex flex-wrap gap-2">
              {task.assignments
                .filter((a) => a.role !== "Owner")
                .map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 px-3 py-1.5 rounded-lg"
                  >
                    <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-xs font-bold text-blue-700 dark:text-blue-300">
                      {a.username?.[0]?.toUpperCase()}
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-800 dark:text-gray-200">
                        {a.username}
                      </p>
                      <p className="text-xs text-gray-400">{a.role}</p>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* ETA History */}
      {task.eta_history && task.eta_history.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
            ETA History
          </p>
          <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
            {task.eta_history.map((e) => (
              <div
                key={e.id}
                className="flex items-start gap-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-800 rounded-lg px-3 py-2"
              >
                <FaCalendarAlt className="w-3.5 h-3.5 text-orange-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-700 dark:text-gray-300">
                    <span className="line-through text-gray-400">
                      {e.old_eta ? formatDate(e.old_eta) : "—"}
                    </span>
                    {" → "}
                    <span className="font-medium">{formatDate(e.new_eta)}</span>
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {e.reason} — by {e.updated_by_name},{" "}
                    {formatDateTime(e.updated_at)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Progress log */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
          Progress Log
        </p>
        {progressAlert && (
          <div className="mb-2">
            <Alert
              variant={progressAlert.type}
              title=""
              message={progressAlert.message}
            />
          </div>
        )}
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={progressText}
            onChange={(e) => setProgressText(e.target.value)}
            placeholder="Add a progress update..."
            onKeyDown={(e) => e.key === "Enter" && handleAddProgress()}
            className="flex-1 px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleAddProgress}
            disabled={submittingP || !progressText.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg"
          >
            {submittingP ? "..." : "Add"}
          </button>
        </div>
        {task.progress && task.progress.length > 0 ? (
          <div className="max-h-40 overflow-y-auto space-y-2 border-l-2 border-blue-200 dark:border-blue-800 pl-4">
            {task.progress.map((p) => (
              <div key={p.id}>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {p.comment}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  {p.created_by_name} — {formatDateTime(p.created_at)}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-400 dark:text-gray-500">
            No progress logs yet.
          </p>
        )}
      </div>

      {/* Comments */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
          Comments & Activity
        </p>
        {commentAlert && (
          <div className="mb-2">
            <Alert
              variant={commentAlert.type}
              title=""
              message={commentAlert.message}
            />
          </div>
        )}
        <div className="space-y-2 mb-3">
          <textarea
            ref={textareaRef}
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Add a comment... (use @name to mention)"
            rows={2}
            className="w-full px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
          <div className="flex items-center justify-between">
            <div className="flex flex-wrap gap-1">
              {users.map((u) => (
                <button
                  key={u.id}
                  onClick={() => handleMentionClick(u.id, u.username)}
                  className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                    mentions.includes(u.id)
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400"
                  }`}
                >
                  @{u.username.split(" ")[0]}
                </button>
              ))}
            </div>
            <button
              onClick={handleAddComment}
              disabled={submittingC || !commentText.trim()}
              className="px-4 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg"
            >
              {submittingC ? "..." : "Comment"}
            </button>
          </div>
        </div>
        {task.comments && task.comments.length > 0 ? (
          <div className="max-h-40 overflow-y-auto space-y-3">
            {task.comments.map((c) =>
              c.is_system ? (
                <div
                  key={c.id}
                  className="grid grid-cols-[80px_1fr] gap-3 text-xs text-gray-400 dark:text-gray-500 relative pl-3"
                >
                  <div className="absolute left-0 top-0 bottom-0 w-px bg-gray-300 dark:bg-gray-600" />
                  <div className="whitespace-pre-line leading-tight">
                    {formatDateTime(c.created_at)}
                  </div>
                  <div className="flex items-start gap-2">
                    <span>—</span>
                    <span className="break-words">{c.comment}</span>
                  </div>
                </div>
              ) : (
                <div key={c.id} className="flex gap-3">
                  <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-xs font-bold text-blue-700 dark:text-blue-300 flex-shrink-0">
                    {c.created_by_name?.[0]?.toUpperCase() || "?"}
                  </div>
                  <div className="flex-1 bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2">
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      {c.comment}
                    </p>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                        {c.created_by_name}
                      </span>
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        {formatDateTime(c.created_at)}
                      </span>
                    </div>
                  </div>
                </div>
              ),
            )}
          </div>
        ) : (
          <p className="text-xs text-gray-400 dark:text-gray-500">
            No comments yet.
          </p>
        )}
      </div>

      {/* Footer */}
      <div className="grid grid-cols-2 gap-4 pt-3 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-400 dark:text-gray-500">
        <div>
          <p>
            Created by{" "}
            <span className="font-medium text-gray-600 dark:text-gray-400">
              {task.created_by_name || "—"}
            </span>
          </p>
          {task.created_at && <p>{formatDateTime(task.created_at)}</p>}
        </div>
        <div>
          <p>
            Last updated by{" "}
            <span className="font-medium text-gray-600 dark:text-gray-400">
              {task.updated_by_name || "—"}
            </span>
          </p>
          {task.updated_at && <p>{formatDateTime(task.updated_at)}</p>}
        </div>
      </div>
    </div>
  );
}
