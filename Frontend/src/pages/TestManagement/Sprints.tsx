import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import {
  FaPlus,
  FaCalendarAlt,
  FaLayerGroup,
  FaClipboardList,
  FaPlay,
  FaCheckCircle,
  FaTrash,
  FaEdit,
  FaSearch,
  FaTimes,
} from "react-icons/fa";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import Alert from "../../components/ui/alert/Alert";
import DateField from "../../components/common/DateField";
import useFetchWithAuth from "../../hooks/useFetchWithAuth";
import API from "../../services/api";

interface Project {
  id: number;
  project_name: string;
}

interface Sprint {
  id: number;
  project_id: number;
  project_name?: string;
  sprint_name: string;
  goal?: string;
  start_date?: string;
  end_date?: string;
  status: "Planned" | "Active" | "Completed";
  suite_count?: number;
  case_count?: number;
  created_by_name?: string;
}

const STATUS_COLORS: Record<string, string> = {
  Planned: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
  Active: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  Completed:
    "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
};

// Accent bar + icon badge colors per status — used for the modernized card treatment
const STATUS_ACCENT: Record<string, string> = {
  Planned: "bg-gray-300 dark:bg-gray-600",
  Active: "bg-blue-500",
  Completed: "bg-green-500",
};

const STATUS_BADGE_BG: Record<string, string> = {
  Planned: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
  Active: "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400",
  Completed:
    "bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-400",
};

// Sort priority: surface what's actionable first, archive what's done last
const STATUS_PRIORITY: Record<string, number> = {
  Active: 0,
  Planned: 1,
  Completed: 2,
};

const PAGE_SIZE_OPTIONS = [12, 24, 48, 96];

const getToken = () =>
  localStorage.getItem("token") || sessionStorage.getItem("token");

// ─── Create / Edit Sprint Modal ────────────────────────────────────────────
export function SprintFormModal({
  editing,
  projects,
  defaultProjectId,
  onClose,
  onSaved,
}: {
  editing: Sprint | null;
  projects: Project[];
  defaultProjectId?: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [formData, setFormData] = useState({
    project_id: String(editing?.project_id ?? defaultProjectId ?? ""),
    sprint_name: editing?.sprint_name ?? "",
    goal: editing?.goal ?? "",
    start_date: editing?.start_date ? editing.start_date.slice(0, 10) : "",
    end_date: editing?.end_date ? editing.end_date.slice(0, 10) : "",
  });

  const [submitting, setSubmitting] = useState(false);
  const [alert, setAlert] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // ✅ ESC + CLICK OUTSIDE CLOSE (ADDED ONLY)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    const handleClickOutside = (e: MouseEvent) => {
      const modal = document.getElementById("sprint-modal");
      if (modal && e.target === modal) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("mousedown", handleClickOutside);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose]);

  const handleSave = async () => {
    if (!formData.sprint_name.trim())
      return setAlert({ type: "error", message: "Sprint name is required." });

    if (!formData.project_id)
      return setAlert({ type: "error", message: "Please select a project." });

    setSubmitting(true);
    setAlert(null);

    try {
      const url = editing
        ? `/api/sprints/update/${editing.id}`
        : "/api/sprints/create";
      const method = editing ? API.put : API.post;

      const res = await method(url, formData, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });

      if (res.data.success) {
        setAlert({
          type: "success",
          message: editing ? "Sprint updated!" : "Sprint created!",
        });

        setTimeout(() => {
          onClose();
          onSaved();
        }, 800);
      }
    } catch (err: any) {
      setAlert({
        type: "error",
        message: err.response?.data?.message || "Operation failed.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      id="sprint-modal"
      className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/50 backdrop-blur-sm"
    >
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {editing ? "Edit Sprint" : "Create Sprint"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl font-bold"
          >
            &times;
          </button>
        </div>

        {alert && (
          <div className="mb-4">
            <Alert
              variant={alert.type}
              title={alert.type === "success" ? "Success" : "Error"}
              message={alert.message}
            />
          </div>
        )}

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Project <span className="text-red-500">*</span>
          </label>
          <select
            value={formData.project_id}
            onChange={(e) =>
              setFormData({ ...formData, project_id: e.target.value })
            }
            disabled={!!editing}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
          >
            <option value="">-- Select Project --</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.project_name}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Sprint Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.sprint_name}
            onChange={(e) =>
              setFormData({ ...formData, sprint_name: e.target.value })
            }
            placeholder="e.g. CFP Sprint 1"
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Goal
          </label>
          <textarea
            value={formData.goal}
            onChange={(e) => setFormData({ ...formData, goal: e.target.value })}
            placeholder="Optional sprint goal..."
            rows={2}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <DateField
            label="Start Date"
            value={formData.start_date}
            onChange={(val) => setFormData({ ...formData, start_date: val })}
            max={formData.end_date || undefined}
            placeholder="Select start date"
          />
          <DateField
            label="End Date"
            value={formData.end_date}
            onChange={(val) => setFormData({ ...formData, end_date: val })}
            min={formData.start_date || undefined}
            placeholder="Select end date"
          />
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
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
              ? editing
                ? "Updating..."
                : "Creating..."
              : editing
                ? "Update"
                : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Delete Confirm ─────────────────────────────────────────────────────────
export function DeleteSprintModal({
  sprint,
  onClose,
  onDeleted,
}: {
  sprint: Sprint;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [inProgress, setInProgress] = useState(false);
  const [alert, setAlert] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // ✅ ESC + CLICK OUTSIDE CLOSE (ADDED ONLY)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    const handleClickOutside = (e: MouseEvent) => {
      const modal = document.getElementById("delete-sprint-modal");
      if (modal && e.target === modal) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("mousedown", handleClickOutside);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose]);

  const handleConfirm = async () => {
    setInProgress(true);
    setAlert(null);

    try {
      await API.delete(`/api/sprints/delete/${sprint.id}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });

      setAlert({ type: "success", message: "Sprint deleted." });

      setTimeout(() => {
        onClose();
        onDeleted();
      }, 800);
    } catch (err: any) {
      setAlert({
        type: "error",
        message: err.response?.data?.message || "Failed to delete.",
      });
    } finally {
      setInProgress(false);
    }
  };

  return (
    <div
      id="delete-sprint-modal"
      className="fixed inset-0 z-[50] flex items-center justify-center bg-black/50 backdrop-blur-sm"
    >
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Delete Sprint
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl font-bold"
          >
            &times;
          </button>
        </div>

        {alert && (
          <div className="mb-4">
            <Alert
              variant={alert.type}
              title={alert.type === "success" ? "Success" : "Error"}
              message={alert.message}
            />
          </div>
        )}

        <p className="text-sm text-gray-700 dark:text-gray-300 mb-5">
          Delete{" "}
          <span className="font-semibold text-gray-900 dark:text-white">
            "{sprint.sprint_name}"
          </span>
          ? This removes the board and all suite/test-case links from this
          sprint — the suites and test cases themselves are kept.
        </p>

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={inProgress}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={inProgress}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-60 rounded-lg"
          >
            {inProgress ? "Deleting..." : "Yes, Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Sprint Card ────────────────────────────────────────────────────────────
function SprintCard({
  sprint,
  onNavigate,
  onEdit,
  onDelete,
}: {
  sprint: Sprint;
  onNavigate: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const StatusIcon =
    sprint.status === "Active"
      ? FaPlay
      : sprint.status === "Completed"
        ? FaCheckCircle
        : FaCalendarAlt;

  return (
    <div
      onClick={onNavigate}
      className="group relative cursor-pointer overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm hover:shadow-lg hover:-translate-y-0.5 hover:border-blue-300 dark:hover:border-blue-700 transition-all duration-200"
    >
      {/* Status accent bar */}
      <div className={`h-1 w-full ${STATUS_ACCENT[sprint.status]}`} />

      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              className={`flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full ${STATUS_BADGE_BG[sprint.status]}`}
            >
              <StatusIcon className="w-3.5 h-3.5" />
            </span>
            <span className="font-semibold text-gray-900 dark:text-white truncate">
              {sprint.sprint_name}
            </span>
          </div>
          <span
            className={`px-2 py-0.5 text-xs font-semibold rounded-full flex-shrink-0 ${STATUS_COLORS[sprint.status]}`}
          >
            {sprint.status}
          </span>
        </div>

        {sprint.project_name && (
          <p className="mt-2 ml-[42px] text-xs text-gray-400 dark:text-gray-500 truncate">
            {sprint.project_name}
          </p>
        )}

        {sprint.goal && (
          <p className="mt-2 ml-[42px] text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
            {sprint.goal}
          </p>
        )}

        <div className="mt-3 ml-[42px] flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1 rounded-md bg-gray-50 dark:bg-gray-800 px-2 py-1 text-xs text-gray-600 dark:text-gray-300">
            <FaLayerGroup className="w-3 h-3 text-purple-400" />{" "}
            {sprint.suite_count ?? 0} suites
          </span>
          <span className="inline-flex items-center gap-1 rounded-md bg-gray-50 dark:bg-gray-800 px-2 py-1 text-xs text-gray-600 dark:text-gray-300">
            <FaClipboardList className="w-3 h-3 text-indigo-400" />{" "}
            {sprint.case_count ?? 0} cases
          </span>
        </div>

        {(sprint.start_date || sprint.end_date) && (
          <p className="mt-3 ml-[42px] text-xs text-gray-400 dark:text-gray-500">
            {sprint.start_date
              ? new Date(sprint.start_date).toLocaleDateString()
              : "—"}
            {" → "}
            {sprint.end_date
              ? new Date(sprint.end_date).toLocaleDateString()
              : "—"}
          </p>
        )}

        <div
          className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={onEdit}
            className="p-1.5 rounded-md bg-white/90 dark:bg-gray-900/90 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-600 shadow-sm transition-colors"
            title="Edit"
          >
            <FaEdit className="w-3 h-3" />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 rounded-md bg-white/90 dark:bg-gray-900/90 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 shadow-sm transition-colors"
            title="Delete"
          >
            <FaTrash className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────
export default function Sprints() {
  const navigate = useNavigate();
  const { data: projects } = useFetchWithAuth<Project[]>("/api/projects");
  const [projectFilter, setProjectFilter] = useState("");

  const {
    data: sprints,
    loading,
    error,
    refetch,
  } = useFetchWithAuth<Sprint[]>(
    projectFilter ? `/api/sprints?project_id=${projectFilter}` : "/api/sprints",
  );

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingSprint, setEditingSprint] = useState<Sprint | null>(null);
  const [deletingSprint, setDeletingSprint] = useState<Sprint | null>(null);

  // ─── SEARCH & FILTER STATE ──────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"" | Sprint["status"]>("");

  // ─── PAGINATION STATE ───────────────────────────────────────────────────
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);

  const onRefresh = () => {
    if (typeof refetch === "function") refetch();
    else window.location.reload();
  };

  // ─── SEARCH + FILTER + SORT LOGIC ────────────────────────────────────────
  // Sorted with Active sprints surfaced first, then Planned, then Completed —
  // and most recently started within each group. Keeps the board scannable
  // as the sprint archive grows over time, instead of relying on fixed
  // sections that would otherwise need per-section pagination.
  const filteredSprints = useMemo(() => {
    const list = sprints || [];
    const q = searchQuery.toLowerCase();

    return list
      .filter((sprint) => {
        const matchesSearch =
          !q ||
          sprint.sprint_name.toLowerCase().includes(q) ||
          (sprint.goal ?? "").toLowerCase().includes(q) ||
          (sprint.project_name ?? "").toLowerCase().includes(q);

        const matchesStatus = !filterStatus || sprint.status === filterStatus;

        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => {
        const statusDiff =
          STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status];
        if (statusDiff !== 0) return statusDiff;
        const aDate = a.start_date ? new Date(a.start_date).getTime() : 0;
        const bDate = b.start_date ? new Date(b.start_date).getTime() : 0;
        return bDate - aDate;
      });
  }, [sprints, searchQuery, filterStatus]);

  // ─── PAGINATION LOGIC ────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(filteredSprints.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedSprints = filteredSprints.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize,
  );

  const handlePageChange = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  };

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    setCurrentPage(1);
  };

  const handleProjectFilterChange = (val: string) => {
    setProjectFilter(val);
    setCurrentPage(1);
  };

  const handleFilterStatusChange = (val: "" | Sprint["status"]) => {
    setFilterStatus(val);
    setCurrentPage(1);
  };

  const hasActiveFilters = Boolean(
    searchQuery || projectFilter || filterStatus,
  );

  const handleClearFilters = () => {
    setSearchQuery("");
    setProjectFilter("");
    setFilterStatus("");
    setCurrentPage(1);
  };

  // ─── PAGINATION RANGE ────────────────────────────────────────────────────
  const getPaginationRange = () => {
    const delta = 2;
    const range: (number | "...")[] = [];
    const left = Math.max(2, safePage - delta);
    const right = Math.min(totalPages - 1, safePage + delta);

    range.push(1);
    if (left > 2) range.push("...");
    for (let i = left; i <= right; i++) range.push(i);
    if (right < totalPages - 1) range.push("...");
    if (totalPages > 1) range.push(totalPages);

    return range;
  };

  return (
    <div>
      <PageMeta title="Sprints" description="Sprint planning" />
      <PageBreadcrumb pageTitle="Sprints" />

      <div className="mt-4">
        {/* Summary */}
        <div className="mb-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {filteredSprints.length} sprint
            {filteredSprints.length !== 1 ? "s" : ""}
          </p>
        </div>

        {/* ── Search & Filters ── */}
        <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-[220px]">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <input
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search sprints…"
                className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              />
            </div>

            {/* Filters */}
            <select
              value={projectFilter}
              onChange={(e) => handleProjectFilterChange(e.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
            >
              <option value="">All Projects</option>
              {projects?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.project_name}
                </option>
              ))}
            </select>

            <select
              value={filterStatus}
              onChange={(e) =>
                handleFilterStatusChange(
                  e.target.value as "" | Sprint["status"],
                )
              }
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
            >
              <option value="">All Status</option>
              <option value="Active">Active</option>
              <option value="Planned">Planned</option>
              <option value="Completed">Completed</option>
            </select>

            {hasActiveFilters && (
              <button
                onClick={handleClearFilters}
                className="inline-flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400"
              >
                <FaTimes className="h-3 w-3" /> Clear
              </button>
            )}

            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                <FaPlus className="h-3.5 w-3.5" /> Create
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4">
            <Alert variant="error" title="Error" message={error} />
          </div>
        )}
        {loading && !error && (
          <div className="text-gray-500 dark:text-gray-400 py-8 text-center">
            Loading sprints...
          </div>
        )}

        {!loading && !error && (
          <>
            {paginatedSprints.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3">
                {paginatedSprints.map((sprint) => (
                  <SprintCard
                    key={sprint.id}
                    sprint={sprint}
                    onNavigate={() => navigate(`/sprints/${sprint.id}`)}
                    onEdit={() => setEditingSprint(sprint)}
                    onDelete={() => setDeletingSprint(sprint)}
                  />
                ))}
              </div>
            ) : sprints && sprints.length > 0 ? (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                No sprints match your search or filters.{" "}
                <button
                  onClick={handleClearFilters}
                  className="text-blue-500 hover:underline"
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                No sprints found.{" "}
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="text-blue-500 hover:underline"
                >
                  Create your first sprint
                </button>
              </div>
            )}
          </>
        )}

        {/* ── Pagination ── */}
        {!loading && !error && filteredSprints.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            {/* Left: page size + info */}
            <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
              <span>Cards per page:</span>
              <select
                value={pageSize}
                onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {PAGE_SIZE_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <span>
                {(safePage - 1) * pageSize + 1}–
                {Math.min(safePage * pageSize, filteredSprints.length)} of{" "}
                {filteredSprints.length}
              </span>
            </div>

            {/* Right: page controls */}
            <div className="flex items-center gap-1">
              {/* First */}
              <button
                onClick={() => handlePageChange(1)}
                disabled={safePage === 1}
                className="p-1.5 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
                title="First page"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M11 19l-7-7 7-7M18 19l-7-7 7-7"
                  />
                </svg>
              </button>

              {/* Prev */}
              <button
                onClick={() => handlePageChange(safePage - 1)}
                disabled={safePage === 1}
                className="p-1.5 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
                title="Previous page"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>

              {/* Page numbers */}
              {getPaginationRange().map((item, i) =>
                item === "..." ? (
                  <span
                    key={`ellipsis-${i}`}
                    className="px-2 py-1 text-gray-400 dark:text-gray-500 text-sm select-none"
                  >
                    …
                  </span>
                ) : (
                  <button
                    key={item}
                    onClick={() => handlePageChange(item as number)}
                    className={`min-w-[32px] px-2 py-1 rounded-md text-sm font-medium transition ${
                      safePage === item
                        ? "bg-blue-600 text-white"
                        : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                    }`}
                  >
                    {item}
                  </button>
                ),
              )}

              {/* Next */}
              <button
                onClick={() => handlePageChange(safePage + 1)}
                disabled={safePage === totalPages}
                className="p-1.5 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
                title="Next page"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>

              {/* Last */}
              <button
                onClick={() => handlePageChange(totalPages)}
                disabled={safePage === totalPages}
                className="p-1.5 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
                title="Last page"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13 5l7 7-7 7M6 5l7 7-7 7"
                  />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>

      {showCreateModal && (
        <SprintFormModal
          editing={null}
          projects={projects || []}
          defaultProjectId={projectFilter ? Number(projectFilter) : undefined}
          onClose={() => setShowCreateModal(false)}
          onSaved={onRefresh}
        />
      )}
      {editingSprint && (
        <SprintFormModal
          editing={editingSprint}
          projects={projects || []}
          onClose={() => setEditingSprint(null)}
          onSaved={onRefresh}
        />
      )}
      {deletingSprint && (
        <DeleteSprintModal
          sprint={deletingSprint}
          onClose={() => setDeletingSprint(null)}
          onDeleted={onRefresh}
        />
      )}
    </div>
  );
}
