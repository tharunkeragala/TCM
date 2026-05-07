import { useState, useEffect, useRef } from "react";
import { FaCalendarAlt, FaChevronDown } from "react-icons/fa";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import API from "../../../../services/api";
import { Task } from "../../types";
import { formatDate, toLocalDateString } from "../../utils";

interface Props {
  task: Task;
  onToast: (msg: string) => void;
  onETAChanged: () => void;
}

export default function ExtendETABadge({ task, onToast, onETAChanged }: Props) {
  const [showPopover, setShowPopover] = useState(false);
  const [etaData, setEtaData] = useState({ new_eta: "", reason: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setShowPopover(false);
        setError(null);
        setEtaData({ new_eta: "", reason: "" });
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSave = async () => {
    if (!etaData.new_eta) { setError("New ETA is required."); return; }
    if (!etaData.reason.trim()) { setError("Reason is required."); return; }
    setSubmitting(true);
    setError(null);
    try {
      const token =
        localStorage.getItem("token") || sessionStorage.getItem("token");
      await API.put(`/api/tasks/eta/${task.id}`, etaData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setShowPopover(false);
      setEtaData({ new_eta: "", reason: "" });
      onToast(`ETA extended to ${formatDate(etaData.new_eta)}`);
      onETAChanged();
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to extend ETA.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setShowPopover(!showPopover)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors border-orange-200 dark:border-orange-700 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-900/40"
      >
        <FaCalendarAlt className="w-3 h-3" />
        <span>Extend ETA</span>
        <FaChevronDown className="w-2.5 h-2.5 ml-0.5" />
      </button>

      {showPopover && (
        <div className="absolute right-0 top-full mt-2 z-50 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl p-3 space-y-3">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            Extend ETA
          </p>
          {task.due_date && (
            <div className="flex items-center gap-2 bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-800 rounded-lg px-2.5 py-2">
              <FaCalendarAlt className="w-3 h-3 text-orange-500 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-gray-500 dark:text-gray-400">Current ETA</p>
                <p className="text-xs font-medium text-gray-800 dark:text-gray-200">
                  {formatDate(task.due_date)}
                </p>
              </div>
            </div>
          )}
          {error && (
            <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-lg px-2 py-1.5">
              {error}
            </p>
          )}
          <div>
            <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              New ETA <span className="text-red-500">*</span>
            </p>
            <DatePicker
              selected={
                etaData.new_eta
                  ? (() => {
                      const [y, m, d] = etaData.new_eta.split("-").map(Number);
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
              className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Reason <span className="text-red-500">*</span>
            </p>
            <textarea
              value={etaData.reason}
              onChange={(e) => setEtaData({ ...etaData, reason: e.target.value })}
              placeholder="Why is the ETA being extended?"
              rows={2}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => {
                setShowPopover(false);
                setError(null);
                setEtaData({ new_eta: "", reason: "" });
              }}
              className="flex-1 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={submitting}
              className="flex-1 px-3 py-1.5 text-xs font-medium text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-60 rounded-lg"
            >
              {submitting ? "..." : "Extend"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}