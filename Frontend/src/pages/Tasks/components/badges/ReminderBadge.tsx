import { useState, useEffect, useRef } from "react";
import { FaBell } from "react-icons/fa";
import API from "../../../../services/api";
import { formatDate } from "../../utils";

interface Props {
  taskId: number;
  onToast: (msg: string) => void;
}

export default function ReminderBadge({ taskId, onToast }: Props) {
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

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setShowPopover(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

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

      {showPopover && (
        <div className="absolute right-0 top-full mt-2 z-50 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl p-3 space-y-3">
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
          {reminder && (
            <p className="text-xs text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-800 rounded-lg px-2 py-1.5">
              ⚠️ Saving will replace the current reminder.
            </p>
          )}
          <div className="flex gap-2">
            <input
              type="number"
              min={1}
              value={reminderData.remind_before}
              onChange={(e) =>
                setReminderData({ ...reminderData, remind_before: e.target.value })
              }
              className="w-16 px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <select
              value={reminderData.remind_unit}
              onChange={(e) =>
                setReminderData({ ...reminderData, remind_unit: e.target.value })
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
                setReminderData({ ...reminderData, is_recurring: e.target.checked })
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