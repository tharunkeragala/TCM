import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router";
import {
  Bell,
  X,
  Check,
  CheckCheck,
  AlertTriangle,
  Clock,
  Inbox,
  Loader2,
} from "lucide-react";
import { Dropdown } from "../ui/dropdown/Dropdown";
import { DropdownItem } from "../ui/dropdown/DropdownItem";

interface Notification {
  id: number;
  task_id: number | null;
  type: "deadline_reminder" | "task_overdue" | string;
  message: string;
  is_read: boolean;
  created_at: string;
  task_title?: string;
  redirect_url?: string;
}

function timeAgo(dateString: string): string {
  const diffMs = Date.now() - new Date(dateString).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function NotificationIcon({ type }: { type: string }) {
  const isOverdue = type === "task_overdue";
  return (
    <span
      className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
      style={{
        background: isOverdue
          ? "rgba(248,113,113,0.12)"
          : "rgba(91,156,246,0.12)",
        color: isOverdue ? "#f87171" : "#5b9cf6",
      }}
    >
      {isOverdue ? (
        <AlertTriangle size={18} strokeWidth={2} />
      ) : (
        <Clock size={18} strokeWidth={2} />
      )}
    </span>
  );
}

const AUTH_HEADER = () => ({
  Authorization: `Bearer ${localStorage.getItem("token")}`,
});

export default function NotificationDropdown() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);

  // ── Fetch ────────────────────────────────────────────────────────────────
  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", { headers: AUTH_HEADER() });
      if (!res.ok) throw new Error("Failed to fetch notifications");
      const data = await res.json();
      setNotifications(data.notifications ?? []);
      setUnreadCount(data.unreadCount ?? 0);
    } catch (err) {
      console.error("Error fetching notifications:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  function toggleDropdown() {
    setIsOpen((prev) => !prev);
  }
  function closeDropdown() {
    setIsOpen(false);
  }

  // ── Mark single as read ────────────────────────────────────────────────
  const markAsRead = useCallback(async (id: number) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));

    try {
      const res = await fetch(`/api/notifications/${id}/read`, {
        method: "PUT",
        headers: AUTH_HEADER(),
      });
      if (!res.ok) throw new Error("Failed to mark notification as read");
    } catch (err) {
      console.error("Error marking notification read:", err);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: false } : n))
      );
      setUnreadCount((prev) => prev + 1);
    }
  }, []);

  // ── Mark all as read ────────────────────────────────────────────────────
  const markAllAsRead = useCallback(async () => {
    if (unreadCount === 0 || markingAll) return;

    const previous = notifications;
    setMarkingAll(true);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);

    try {
      const res = await fetch("/api/notifications/read-all", {
        method: "PUT",
        headers: AUTH_HEADER(),
      });
      if (!res.ok) throw new Error("Failed to mark all notifications as read");
    } catch (err) {
      console.error("Error marking all notifications read:", err);
      setNotifications(previous);
      setUnreadCount(previous.filter((n) => !n.is_read).length);
    } finally {
      setMarkingAll(false);
    }
  }, [unreadCount, markingAll, notifications]);

  // ── 🚀 UPDATED CLICK HANDLER (MAIN FIX) ────────────────────────────────
  const handleNotificationClick = (n: Notification) => {
    if (!n.is_read) markAsRead(n.id);
    closeDropdown();

    // 1. BEST: backend-controlled redirect
    if (n.redirect_url) {
      navigate(n.redirect_url);
      return;
    }

    // 2. fallback: task routing
    if (n.task_id) {
      navigate(`/tasks/${n.task_id}`);
      return;
    }

    // 3. default
    navigate("/notifications");
  };

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Notifications"
        aria-haspopup="true"
        aria-expanded={isOpen}
        className="relative flex items-center justify-center transition-colors border rounded-full h-11 w-11"
        style={{
          background: "rgba(255,255,255,0.04)",
          borderColor: "rgba(255,255,255,0.09)",
          color: "rgba(148,172,215,0.65)",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background =
            "rgba(255,255,255,0.09)";
          (e.currentTarget as HTMLButtonElement).style.color =
            "rgba(190,215,255,0.85)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background =
            "rgba(255,255,255,0.04)";
          (e.currentTarget as HTMLButtonElement).style.color =
            "rgba(148,172,215,0.65)";
        }}
        onClick={toggleDropdown}
      >
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 z-20 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
        <Bell size={20} strokeWidth={2} />
      </button>

      <Dropdown
        isOpen={isOpen}
        onClose={closeDropdown}
        className="absolute -right-[240px] mt-[17px] flex h-[480px] w-[350px] flex-col rounded-2xl border border-gray-200 bg-white p-3 shadow-theme-lg dark:border-gray-800 dark:bg-gray-dark sm:w-[361px] lg:right-0"
      >
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-gray-100 dark:border-gray-700">
          <h5 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
            Notifications{unreadCount > 0 ? ` (${unreadCount})` : ""}
          </h5>
          <div className="flex items-center gap-3">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                disabled={markingAll}
                className="flex items-center gap-1 text-xs font-medium text-brand-500 hover:text-brand-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {markingAll ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <CheckCheck size={14} />
                )}
                Mark all read
              </button>
            )}
            <button
              type="button"
              aria-label="Close notifications"
              onClick={toggleDropdown}
              className="text-gray-500 transition dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <ul className="flex flex-col h-auto overflow-y-auto custom-scrollbar">
          {loading ? (
            <li className="flex flex-col items-center gap-2 py-10 text-gray-400">
              <Loader2 size={20} className="animate-spin" />
              <span className="text-sm">Loading...</span>
            </li>
          ) : notifications.length === 0 ? (
            <li className="flex flex-col items-center gap-2 py-10 text-gray-400">
              <Inbox size={24} />
              <span className="text-sm">No notifications yet</span>
            </li>
          ) : (
            notifications.map((n) => (
              <li key={n.id}>
                <DropdownItem
                  onItemClick={() => handleNotificationClick(n)}
                  className={`flex gap-3 rounded-lg border-b border-gray-100 p-3 px-4.5 py-3 hover:bg-gray-100 dark:border-gray-800 dark:hover:bg-white/5 ${
                    !n.is_read ? "bg-blue-50/50 dark:bg-white/[0.03]" : ""
                  }`}
                >
                  <NotificationIcon type={n.type} />

                  <span className="block flex-1">
                    <span className="mb-1.5 block text-theme-sm text-gray-700 dark:text-gray-300">
                      {n.message}
                    </span>

                    <span className="flex items-center gap-2 text-gray-500 text-theme-xs dark:text-gray-400">
                      <span>
                        {n.type === "task_overdue" ? "Overdue" : "Reminder"}
                      </span>
                      <span className="w-1 h-1 bg-gray-400 rounded-full" />
                      <span>
                        {new Date(
                          n.created_at.replace(" ", "T")
                        ).toLocaleString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                          hour12: true,
                        })}
                      </span>
                    </span>
                  </span>

                  {!n.is_read && (
                    <button
                      type="button"
                      aria-label="Mark as read"
                      onClick={(e) => {
                        e.stopPropagation();
                        markAsRead(n.id);
                      }}
                      className="shrink-0 self-start p-1 text-gray-400 hover:text-brand-500"
                    >
                      <Check size={16} />
                    </button>
                  )}
                </DropdownItem>
              </li>
            ))
          )}
        </ul>

        <button
          type="button"
          onClick={() => {
            closeDropdown();
            navigate("/notifications");
          }}
          className="block px-4 py-2 mt-3 text-sm font-medium text-center text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
        >
          View All Notifications
        </button>
      </Dropdown>
    </div>
  );
}