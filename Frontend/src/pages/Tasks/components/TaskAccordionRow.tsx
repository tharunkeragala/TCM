import { useState } from "react";
import {
  FaEdit,
  FaTrash,
  FaEye,
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
      className={`rounded-xl border overflow-hidden bg-white dark:bg-gray-900 transition-all duration-200 ${
        overdue
          ? "border-red-300 dark:border-red-700 bg-red-50 dark:bg-gray-900 hover:border-red-400 dark:hover:border-red-600"
          : expanded
            ? "border-blue-400 dark:border-blue-600 bg-blue-50 dark:bg-gray-900"
            : "border-gray-300 dark:border-gray-600  hover:border-blue-400 dark:hover:border-blue-600 hover:bg-blue-50 dark:hover:bg-gray-800"
      } shadow-sm hover:shadow-md`}
    >
      {/* Row header */}
      <div
        className={`flex items-center gap-4 px-5 py-4 cursor-pointer select-none rounded-t-xl transition-colors duration-200 ${
          expanded
            ? "bg-blue-100 dark:bg-blue-900/30"
            : "hover:bg-gray-100 dark:hover:bg-gray-800"
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
            <div className="flex items-center gap-3 min-w-0">
              <span
                className="
      px-2 py-0.5
      text-xs font-bold
      rounded-md
      bg-blue-100 text-blue-700
      dark:bg-blue-900/40 dark:text-blue-300
      whitespace-nowrap
    "
              >
                {task.task_code}
              </span>

              <span
                className="
      text-sm font-semibold
      text-gray-900 dark:text-white
      truncate
    "
              >
                {task.title}
              </span>
            </div>
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

        {/* Actions — stop propagation so clicks don't toggle accordion */}
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

      {/* Expanded body */}
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
