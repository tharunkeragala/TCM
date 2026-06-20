import { useState } from "react";
import { useNavigate } from "react-router";
import {
  FaEdit,
  FaTrash,
  FaEye,
  FaInfoCircle,
  FaChevronDown,
  FaChevronUp,
  FaCalendarAlt,
  FaUser,
  FaExclamationCircle,
} from "react-icons/fa";
import API from "../../../services/api";
import { Task } from "../types";
import { formatDate, isOverdue } from "../utils";
import StatusBadge from "./badges/StatusBadge";
import PriorityBadge from "./badges/PriorityBadge";
import TagList from "./TagList";
import AccordionDetail from "./AccordionDetail";

interface Props {
  task: Task;
  onEdit: (t: Task) => void;
  onDelete: (t: Task) => void;
  onView: (t: Task) => void;
}

export default function TaskAccordionRow({
  task,
  onEdit,
  onDelete,
  onView,
}: Props) {
  const navigate = useNavigate();
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
    setExpanded((prev) => !prev);
  };

  // ── Border / bg variants ──────────────────────────────────────────────────
  const cardCls = overdue
    ? "border-red-200 dark:border-red-700/50"
    : expanded
      ? "border-brand-300 dark:border-brand-700/50"
      : "border-gray-200 dark:border-gray-700 hover:border-brand-200 dark:hover:border-brand-700/50";

  const headerCls = expanded
    ? "bg-brand-50 dark:bg-brand-900/10"
    : overdue
      ? "bg-red-50 dark:bg-gray-900 hover:bg-red-50/80 dark:hover:bg-gray-800"
      : "hover:bg-gray-50 dark:hover:bg-gray-800/50";

  return (
    <div
      className={`w-full overflow-hidden rounded-xl border bg-white dark:bg-gray-900 shadow-sm transition-all duration-200 ${cardCls}`}
    >
      {/* ── Row header ─────────────────────────────────────────────────────── */}
      <div
        className={`flex items-center gap-3 px-4 py-3 cursor-pointer select-none transition-colors duration-150 min-w-0 ${headerCls}`}
        onClick={handleExpand}
      >
        {/* Chevron */}
        <span className="flex-shrink-0 text-gray-400 dark:text-gray-500">
          {expanded ? (
            <FaChevronUp className="w-3.5 h-3.5" />
          ) : (
            <FaChevronDown className="w-3.5 h-3.5" />
          )}
        </span>

        {/* Title area */}
        <div className="flex-1 min-w-0 overflow-hidden">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Task code */}
            <span className="px-2 py-0.5 text-xs font-bold rounded-md bg-brand-100 text-brand-700 dark:bg-brand-500/10 dark:text-brand-400 whitespace-nowrap flex-shrink-0">
              {task.task_code}
            </span>

            {/* Title */}
            <span className="text-sm font-semibold text-gray-900 dark:text-white truncate max-w-[180px]">
              {task.title.length > 30
                ? `${task.title.slice(0, 30)}...`
                : task.title}
            </span>

            {/* Overdue badge */}
            {overdue && (
              <span className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400 font-medium flex-shrink-0">
                <FaExclamationCircle className="w-3.5 h-3.5" />
                Overdue
              </span>
            )}
          </div>

          {task.tags && <TagList tags={task.tags} />}
        </div>

        {/* Meta chips (desktop) */}
        <div className="hidden md:flex items-center gap-3 flex-wrap flex-shrink-0">
          {task.project_name && (
            <span className="text-xs font-medium text-brand-700 dark:text-brand-400 bg-brand-50 dark:bg-brand-500/10 px-2.5 py-1 rounded-full whitespace-nowrap">
              {task.project_name}
            </span>
          )}
          <PriorityBadge priority={task.priority} />
          <StatusBadge status={task.status} />

          {task.due_date && (
            <span
              className={`flex items-center gap-1.5 text-xs font-medium whitespace-nowrap ${
                overdue
                  ? "text-red-600 dark:text-red-400"
                  : "text-gray-500 dark:text-gray-400"
              }`}
            >
              <FaCalendarAlt className="w-3.5 h-3.5" />
              {formatDate(task.due_date)}
            </span>
          )}

          {task.assignees && (
            <span className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
              <FaUser className="w-3.5 h-3.5" />
              {task.assignees}
            </span>
          )}

          {(task.comment_count ?? 0) > 0 && (
            <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
              💬 {task.comment_count}
            </span>
          )}
        </div>

        {/* Action icons — stop propagation */}
        <div
          className="flex items-center gap-3 flex-shrink-0 ml-1"
          onClick={(e) => e.stopPropagation()}
        >
          
          <button
            onClick={() => onView(task)}
            className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
            title="View"
          >
            <FaEye className="w-4 h-4" />
          </button>
          <button
            onClick={() => navigate(`/tasks/${task.id}`)}
            className="text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
            title="Task details page"
          >
            <FaInfoCircle className="w-4 h-4" />
          </button>
          <button
            onClick={() => onEdit(task)}
            className="text-brand-500 hover:text-brand-700 dark:hover:text-brand-400 transition-colors"
            title="Edit"
          >
            <FaEdit className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(task)}
            className="text-red-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
            title="Delete"
          >
            <FaTrash className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Expanded body ───────────────────────────────────────────────────── */}
      {expanded && (
        <div className="border-t border-gray-200 dark:border-gray-800 px-5 py-4">
          {loadingDetail ? (
            <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
              <span className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
              Loading detail…
            </div>
          ) : detail ? (
            <AccordionDetail detail={detail} />
          ) : null}
        </div>
      )}
    </div>
  );
}