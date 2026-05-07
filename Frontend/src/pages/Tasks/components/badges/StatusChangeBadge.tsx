import { useState, useEffect, useRef } from "react";
import { FaChevronDown } from "react-icons/fa";
import API from "../../../../services/api";
import { Task } from "../../types";
import { STATUS_CONFIG, ALL_STATUSES } from "../../constants";
import StatusBadge from "./StatusBadge";

interface Props {
  task: Task;
  onToast: (msg: string) => void;
  onStatusChanged: () => void;
}

export default function StatusChangeBadge({ task, onToast, onStatusChanged }: Props) {
  const [showPopover, setShowPopover] = useState(false);
  const [newStatus, setNewStatus] = useState(task.status);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setShowPopover(false);
        setError(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSave = async () => {
    if (newStatus === task.status) {
      setShowPopover(false);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const token =
        localStorage.getItem("token") || sessionStorage.getItem("token");
      await API.put(
        `/api/tasks/status/${task.id}`,
        { status: newStatus },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setShowPopover(false);
      onToast(`Status updated to "${newStatus}"`);
      onStatusChanged();
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to update status.");
    } finally {
      setSubmitting(false);
    }
  };

  const cfg = STATUS_CONFIG[task.status] || STATUS_CONFIG["Pending"];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setShowPopover(!showPopover)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40"
      >
        {cfg.icon}
        <span>Change Status</span>
        <FaChevronDown className="w-2.5 h-2.5 ml-0.5" />
      </button>

      {showPopover && (
        <div className="absolute right-0 top-full mt-2 z-50 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl p-3 space-y-3">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            Change Status
          </p>
          <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg px-2.5 py-2">
            <span className="text-xs text-gray-500 dark:text-gray-400">Current:</span>
            <StatusBadge status={task.status} />
          </div>
          {error && (
            <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-lg px-2 py-1.5">
              {error}
            </p>
          )}
          <select
            value={newStatus}
            onChange={(e) => setNewStatus(e.target.value as Task["status"])}
            className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {ALL_STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => { setShowPopover(false); setError(null); }}
              className="flex-1 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={submitting}
              className="flex-1 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg"
            >
              {submitting ? "..." : "Update"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}