import { useEffect, useState } from "react";
import { FaSearch, FaTimes } from "react-icons/fa";
import Alert from "../../../components/ui/alert/Alert";
import API from "../../../services/api";
import { getToken } from "./utils.ts";
import type { AvailableUser, SprintAssignee } from "./types.ts";

interface AssignUsersModalProps {
  sprintId: number;
  currentAssignees: SprintAssignee[];
  onClose: () => void;
  onUpdated: () => void;
}

export function AssignUsersModal({
  sprintId,
  currentAssignees,
  onClose,
  onUpdated,
}: AssignUsersModalProps) {
  const [users, setUsers] = useState<AvailableUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [alert, setAlert] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const assignedIds = new Set(currentAssignees.map((a) => a.id));

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await API.get("/api/users", {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        // FIX: API may return { data: [...] } or [...] directly — handle both
        const raw = res.data?.data ?? res.data;
        if (!cancelled && Array.isArray(raw)) setUsers(raw);
      } catch {
        if (!cancelled)
          setAlert({ type: "error", message: "Failed to load users." });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = users.filter(
    (u) => !search || u.username.toLowerCase().includes(search.toLowerCase()),
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
        await API.post(
          `/api/sprints/${sprintId}/assignees`,
          { user_id: userId },
          { headers: { Authorization: `Bearer ${getToken()}` } },
        );
      }
      onUpdated();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Failed to update assignment.";
      setAlert({ type: "error", message: msg });
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Manage Assignees
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="Close"
          >
            <FaTimes className="w-4 h-4" />
          </button>
        </div>

        {alert && (
          <div className="mb-3">
            <Alert
              variant={alert.type}
              title={alert.type === "success" ? "Success" : "Error"}
              message={alert.message}
            />
          </div>
        )}

        <div className="relative mb-3">
          <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search users…"
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 pl-9 pr-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex-1 overflow-y-auto space-y-1.5">
          {loading ? (
            <p className="text-sm text-gray-500 py-6 text-center">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-gray-500 py-6 text-center">
              No users found.
            </p>
          ) : (
            filtered.map((u) => {
              const assigned = assignedIds.has(u.id);
              return (
                <div
                  key={u.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                      {u.username.charAt(0).toUpperCase()}
                    </div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {u.username}
                    </p>
                  </div>
                  <button
                    onClick={() => handleToggle(u.id, assigned)}
                    disabled={togglingId === u.id}
                    className={`flex-shrink-0 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors disabled:opacity-60 ${
                      assigned
                        ? "bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40 border border-red-200 dark:border-red-800"
                        : "bg-blue-600 text-white hover:bg-blue-700"
                    }`}
                  >
                    {togglingId === u.id ? "…" : assigned ? "Remove" : "Assign"}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
