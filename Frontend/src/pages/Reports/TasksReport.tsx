import { useState, useMemo } from "react";
import * as XLSX from "xlsx";
import axios from "../../utils/axios";
import {
  FaSearch,
  FaTimes,
  FaFileExcel,
  FaExclamationCircle,
} from "react-icons/fa";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import Alert from "../../components/ui/alert/Alert";
import useFetchWithAuth from "../../hooks/useFetchWithAuth";
import TablePagination from "../../components/common/TablePagination";

// ─── Types ────────────────────────────────────────────────────────────────────
interface TaskReport {
  id: number;
  task_code: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  start_date: string | null;
  due_date: string | null;
  project_id: number | null;
  suite_id: number | null;
  tags: string | null;
  created_by: number | null;
  updated_by: number | null;
  created_at: string | null;
  updated_at: string | null;
  created_by_name: string | null;
  updated_by_name: string | null;
  project_name: string | null;
  suite_name: string | null;
  comment_count: number;
  assignees: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatDate = (dateStr: string | null) => {
  if (!dateStr)
    return (
      <span className="text-gray-400 dark:text-gray-500 italic text-xs">—</span>
    );
  const d = new Date(dateStr);
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const year = d.getUTCFullYear();
  let hours = d.getUTCHours();
  const minutes = String(d.getUTCMinutes()).padStart(2, "0");
  const seconds = String(d.getUTCSeconds()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return (
    <div className="flex flex-col text-xs leading-tight">
      <span className="text-gray-700 dark:text-gray-200">{`${day}/${month}/${year}`}</span>
      <span className="text-gray-400 dark:text-gray-500">{`${String(hours).padStart(2, "0")}:${minutes}:${seconds} ${ampm}`}</span>
    </div>
  );
};

const formatDatePlain = (dateStr: string | null): string => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const year = d.getUTCFullYear();
  let hours = d.getUTCHours();
  const minutes = String(d.getUTCMinutes()).padStart(2, "0");
  const seconds = String(d.getUTCSeconds()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${day}/${month}/${year} ${String(hours).padStart(2, "0")}:${minutes}:${seconds} ${ampm}`;
};

const isOverdue = (dueDate: string | null, status: string) => {
  if (!dueDate) return false;
  if (["done", "closed", "cancelled"].includes(status.toLowerCase()))
    return false;
  return new Date(dueDate) < new Date();
};

const Dash = () => (
  <span className="text-gray-400 dark:text-gray-500 italic text-xs">—</span>
);

const STATUS_COLORS: Record<string, string> = {
  open: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  "in progress":
    "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  done: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  closed: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  blocked:
    "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  high: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  medium:
    "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  low: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
};

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

// ─── Component ────────────────────────────────────────────────────────────────
export default function TasksReport() {
  const {
    data: tasks,
    loading,
    error,
  } = useFetchWithAuth<TaskReport[]>("/api/reports/tasks/list");

  // ── Filter state ──────────────────────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterPriority, setFilterPriority] = useState("");
  const [filterProject, setFilterProject] = useState("");
  const [filterSuite, setFilterSuite] = useState("");
  const [filterOverdue, setFilterOverdue] = useState("");
  const [filterAssignee, setFilterAssignee] = useState("");

  // ── Pagination state ──────────────────────────────────────────────────────
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [exporting, setExporting] = useState(false);
  // ── Derived dropdown options ───────────────────────────────────────────────
  const projects = useMemo(
    () =>
      [
        ...new Set(
          (tasks ?? [])
            .map((t) => t.project_name)
            .filter((v): v is string => Boolean(v)),
        ),
      ].sort(),
    [tasks],
  );
  const suites = useMemo(
    () =>
      [
        ...new Set(
          (tasks ?? [])
            .map((t) => t.suite_name)
            .filter((v): v is string => Boolean(v)),
        ),
      ].sort(),
    [tasks],
  );
  const statuses = useMemo(
    () =>
      [...new Set((tasks ?? []).map((t) => t.status).filter(Boolean))].sort(),
    [tasks],
  );
  const priorities = useMemo(
    () =>
      [...new Set((tasks ?? []).map((t) => t.priority).filter(Boolean))].sort(),
    [tasks],
  );
  const assignees = useMemo(
    () =>
      [
        ...new Set(
          (tasks ?? [])
            .flatMap((t) =>
              t.assignees ? t.assignees.split(",").map((a) => a.trim()) : [],
            )
            .filter(Boolean),
        ),
      ].sort(),
    [tasks],
  );

  const activeFilterCount = [
    search,
    filterStatus,
    filterPriority,
    filterProject,
    filterSuite,
    filterOverdue,
    filterAssignee,
  ].filter(Boolean).length;

  const clearFilters = () => {
    setSearch("");
    setFilterStatus("");
    setFilterPriority("");
    setFilterProject("");
    setFilterSuite("");
    setFilterOverdue("");
    setCurrentPage(1);
    setFilterAssignee("");
  };

  const handleFilterChange = (setter: (v: string) => void) => (val: string) => {
    setter(val);
    setCurrentPage(1);
  };

  const handleSearchChange = (val: string) => {
    setSearch(val);
    setCurrentPage(1);
  };

  // ── Filtered data ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (!tasks) return [];
    const q = search.toLowerCase().trim();
    return tasks.filter((t) => {
      if (
        q &&
        !t.title.toLowerCase().includes(q) &&
        !t.task_code.toLowerCase().includes(q) &&
        !(t.project_name ?? "").toLowerCase().includes(q) &&
        !(t.suite_name ?? "").toLowerCase().includes(q) &&
        !(t.assignees ?? "").toLowerCase().includes(q) &&
        !(t.tags ?? "").toLowerCase().includes(q) &&
        !(t.created_by_name ?? "").toLowerCase().includes(q) &&
        !String(t.id).includes(q)
      )
        return false;
      if (filterStatus && t.status !== filterStatus) return false;
      if (filterPriority && t.priority !== filterPriority) return false;
      if (filterProject && t.project_name !== filterProject) return false;
      if (filterSuite && t.suite_name !== filterSuite) return false;
      if (filterOverdue === "yes" && !isOverdue(t.due_date, t.status))
        return false;
      if (filterOverdue === "no" && isOverdue(t.due_date, t.status))
        return false;
      if (
        filterAssignee &&
        !(t.assignees ?? "")
          .split(",")
          .map((a) => a.trim())
          .includes(filterAssignee)
      )
        return false;

      return true;
    });
  }, [
    tasks,
    search,
    filterStatus,
    filterPriority,
    filterProject,
    filterSuite,
    filterOverdue,
    filterAssignee,
  ]);

  // ── Pagination ────────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginated = filtered.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize,
  );

  const handlePageChange = (page: number) =>
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  };

  // ── Stats ─────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const all = tasks ?? [];

    const normalize = (s?: string | null) => (s ?? "").trim().toLowerCase();

    return {
      total: all.length,

      completed: all.filter((t) => normalize(t.status) === "completed").length,

      pending: all.filter((t) => normalize(t.status) === "pending").length,

      inProgress: all.filter((t) => normalize(t.status) === "in progress")
        .length,

      onHold: all.filter((t) => normalize(t.status) === "on hold").length,

      cancelled: all.filter((t) => normalize(t.status) === "cancelled").length,

      overdue: all.filter((t) => isOverdue(t.due_date, t.status)).length,
    };
  }, [tasks]);

  // ── Excel export ──────────────────────────────────────────────────────────
  const handleExport = async () => {
  try {
    setExporting(true);

    // Fetch ALL tasks without pagination
    const response = await axios.get(
      "/api/reports/tasks/list?download=true",
      {
        withCredentials: true,
      },
    );

    const allTasks: TaskReport[] = response.data.data || [];

    // Apply SAME frontend filters to full dataset
    const q = search.toLowerCase().trim();

    const exportFiltered = allTasks.filter((t) => {
      if (
        q &&
        !t.title.toLowerCase().includes(q) &&
        !t.task_code.toLowerCase().includes(q) &&
        !(t.project_name ?? "").toLowerCase().includes(q) &&
        !(t.suite_name ?? "").toLowerCase().includes(q) &&
        !(t.assignees ?? "").toLowerCase().includes(q) &&
        !(t.tags ?? "").toLowerCase().includes(q) &&
        !(t.created_by_name ?? "").toLowerCase().includes(q) &&
        !String(t.id).includes(q)
      )
        return false;

      if (filterStatus && t.status !== filterStatus) return false;

      if (filterPriority && t.priority !== filterPriority) return false;

      if (filterProject && t.project_name !== filterProject) return false;

      if (filterSuite && t.suite_name !== filterSuite) return false;

      if (filterOverdue === "yes" && !isOverdue(t.due_date, t.status))
        return false;

      if (filterOverdue === "no" && isOverdue(t.due_date, t.status))
        return false;

      if (
        filterAssignee &&
        !(t.assignees ?? "")
          .split(",")
          .map((a) => a.trim())
          .includes(filterAssignee)
      )
        return false;

      return true;
    });

    const rows = exportFiltered.map((t, i) => ({
      "#": i + 1,
      "Task Code": t.task_code,
      Title: t.title,
      Status: t.status,
      Priority: t.priority,
      Project: t.project_name ?? "",
      Suite: t.suite_name ?? "",
      Assignees: t.assignees ?? "",
      "Start Date": formatDatePlain(t.start_date),
      "Due Date": formatDatePlain(t.due_date),
      Overdue: isOverdue(t.due_date, t.status) ? "Yes" : "No",
      "Created By": t.created_by_name ?? "",
      "Created At": formatDatePlain(t.created_at),
      "Updated By": t.updated_by_name ?? "",
      "Updated At": formatDatePlain(t.updated_at),
    }));

    const ws = XLSX.utils.json_to_sheet(rows);

    ws["!cols"] = [
      { wch: 5 },
      { wch: 12 },
      { wch: 35 },
      { wch: 14 },
      { wch: 10 },
      { wch: 20 },
      { wch: 20 },
      { wch: 25 },
      { wch: 20 },
      { wch: 20 },
      { wch: 8 },
      { wch: 16 },
      { wch: 22 },
      { wch: 16 },
      { wch: 22 },
    ];

    const wb = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(wb, ws, "Tasks Report");

    const stamp = new Date()
      .toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
      .replace(/ /g, "-");

    XLSX.writeFile(wb, `Tasks_Report_${stamp}.xlsx`);
  } catch (err) {
    console.error("Excel export failed:", err);
    alert("Failed to export Excel report");
  } finally {
    setExporting(false);
  }
};

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="w-full max-w-full overflow-hidden">
      <PageMeta title="Tasks Report" description="Tasks report page" />
      <PageBreadcrumb pageTitle="Tasks Report" />

      <div className="mt-4 min-w-0">
        {/* ── Summary Cards ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3 mb-5">
          {[
            {
              label: "Total",
              value: stats.total,
              color: "blue",
            },
            {
              label: "Completed",
              value: stats.completed,
              color: "green",
            },
            {
              label: "Pending",
              value: stats.pending,
              color: "yellow",
            },
            {
              label: "In Progress",
              value: stats.inProgress,
              color: "sky",
            },
            {
              label: "On Hold",
              value: stats.onHold,
              color: "orange",
            },
            {
              label: "Cancelled",
              value: stats.cancelled,
              color: "red",
            },
            {
              label: "Overdue",
              value: stats.overdue,
              color: "rose",
            },
          ].map(({ label, value, color }) => (
            <div
              key={label}
              className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm px-5 py-4"
            >
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                {label}
              </p>

              <p
                className={`text-2xl font-bold ${
                  color === "blue"
                    ? "text-blue-600 dark:text-blue-400"
                    : color === "green"
                      ? "text-green-600 dark:text-green-400"
                      : color === "yellow"
                        ? "text-yellow-500 dark:text-yellow-400"
                        : color === "sky"
                          ? "text-sky-600 dark:text-sky-400"
                          : color === "orange"
                            ? "text-orange-600 dark:text-orange-400"
                            : color === "rose"
                              ? "text-rose-600 dark:text-rose-400"
                              : "text-red-600 dark:text-red-400"
                }`}
              >
                {loading ? (
                  <span className="text-gray-300 dark:text-gray-700">—</span>
                ) : (
                  value
                )}
              </p>
            </div>
          ))}
        </div>

        {/* ── Filters Bar ───────────────────────────────────────────────── */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm mb-4 p-4 min-w-0">
          {/* Row 1: search + export */}
          <div className="flex flex-col sm:flex-row gap-3 mb-3 min-w-0">
            <div className="relative flex-1 min-w-0">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search by title, code, project, suite, assignees, tags, created by…"
                className="w-full pl-8 pr-8 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {search && (
                <button
                  onClick={() => handleSearchChange("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  <FaTimes className="text-xs" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {activeFilterCount > 0 && (
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg border border-gray-300 dark:border-gray-600 transition"
                >
                  <FaTimes className="text-[10px]" />
                  Clear
                  <span className="ml-0.5 px-1.5 py-0.5 text-[10px] font-bold bg-blue-600 text-white rounded-full leading-none">
                    {activeFilterCount}
                  </span>
                </button>
              )}
              <button
  onClick={handleExport}
  disabled={loading || exporting || filtered.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition duration-150 whitespace-nowrap"
              >
                <FaFileExcel />

{exporting ? "Exporting..." : "Export Excel"}

{!loading && !exporting && filtered.length > 0 && (
  <span className="bg-green-500 px-1.5 py-0.5 rounded-full text-[10px] font-bold leading-none">
    {filtered.length}
  </span>
)}
              </button>
            </div>
          </div>

          {/* Row 2: dropdowns */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <select
              value={filterStatus}
              onChange={(e) =>
                handleFilterChange(setFilterStatus)(e.target.value)
              }
              className={`px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition min-w-0 ${filterStatus ? "border-blue-400 dark:border-blue-500" : "border-gray-300 dark:border-gray-600"}`}
            >
              <option value="">All Statuses</option>
              {statuses.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>

            <select
              value={filterPriority}
              onChange={(e) =>
                handleFilterChange(setFilterPriority)(e.target.value)
              }
              className={`px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition min-w-0 ${filterPriority ? "border-blue-400 dark:border-blue-500" : "border-gray-300 dark:border-gray-600"}`}
            >
              <option value="">All Priorities</option>
              {priorities.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>

            <select
              value={filterProject}
              onChange={(e) =>
                handleFilterChange(setFilterProject)(e.target.value)
              }
              className={`px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition min-w-0 ${filterProject ? "border-blue-400 dark:border-blue-500" : "border-gray-300 dark:border-gray-600"}`}
            >
              <option value="">All Projects</option>
              {projects.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>

            <select
              value={filterSuite}
              onChange={(e) =>
                handleFilterChange(setFilterSuite)(e.target.value)
              }
              className={`px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition min-w-0 ${filterSuite ? "border-blue-400 dark:border-blue-500" : "border-gray-300 dark:border-gray-600"}`}
            >
              <option value="">All Suites</option>
              {suites.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>

            <select
              value={filterOverdue}
              onChange={(e) =>
                handleFilterChange(setFilterOverdue)(e.target.value)
              }
              className={`px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition min-w-0 ${filterOverdue ? "border-blue-400 dark:border-blue-500" : "border-gray-300 dark:border-gray-600"}`}
            >
              <option value="">All (Overdue)</option>
              <option value="yes">Overdue Only</option>
              <option value="no">Not Overdue</option>
            </select>

            <select
              value={filterAssignee}
              onChange={(e) =>
                handleFilterChange(setFilterAssignee)(e.target.value)
              }
              className={`px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition min-w-0 ${filterAssignee ? "border-blue-400 dark:border-blue-500" : "border-gray-300 dark:border-gray-600"}`}
            >
              <option value="">All Assignees</option>
              {assignees.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* ── Result count ──────────────────────────────────────────────── */}
        {!loading && !error && (
          <div className="flex items-center gap-2 mb-3 px-1">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Showing{" "}
              <span className="font-semibold text-gray-700 dark:text-gray-200">
                {filtered.length}
              </span>{" "}
              of{" "}
              <span className="font-semibold text-gray-700 dark:text-gray-200">
                {tasks?.length ?? 0}
              </span>{" "}
              tasks
            </p>
            {activeFilterCount > 0 &&
              filtered.length !== (tasks?.length ?? 0) && (
                <span className="text-xs text-blue-600 dark:text-blue-400">
                  · {(tasks?.length ?? 0) - filtered.length} filtered out
                </span>
              )}
          </div>
        )}

        {/* ── Error / Loading ───────────────────────────────────────────── */}
        {error && (
          <div className="mb-4">
            <Alert variant="error" title="Error" message={error} />
          </div>
        )}
        {loading && !error && (
          <div className="text-gray-500 dark:text-gray-400 text-sm py-4">
            Loading tasks...
          </div>
        )}

        {/* ── Table ─────────────────────────────────────────────────────── */}
        {!loading && !error && (
          <>
            {/* Table Wrapper */}
            <div className="w-full min-w-0">
              <div className="w-full overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg bg-white dark:bg-gray-900">
                <table className="w-full table-auto text-sm text-left border-collapse">
                  <thead className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 uppercase text-xs tracking-wider sticky top-0 z-10">
                    <tr>
                      <th className="px-4 py-3 whitespace-nowrap">#</th>

                      <th className="px-4 py-3 whitespace-nowrap">Code</th>

                      <th
                        className="px-4 py-3 whitespace-nowrap"
                        style={{ minWidth: "220px", maxWidth: "300px" }}
                      >
                        Title
                      </th>

                      <th className="px-4 py-3 whitespace-nowrap">Status</th>

                      <th className="px-4 py-3 whitespace-nowrap">Priority</th>

                      <th className="px-4 py-3 whitespace-nowrap">Project</th>

                      <th className="px-4 py-3 whitespace-nowrap">Suite</th>

                      <th
                        className="px-4 py-3 whitespace-nowrap"
                        style={{ minWidth: "180px" }}
                      >
                        Assignees
                      </th>

                      <th className="px-4 py-3 whitespace-nowrap">Due Date</th>

                      <th className="px-4 py-3 whitespace-nowrap">
                        Created By
                      </th>

                      <th className="px-4 py-3 whitespace-nowrap">
                        Created At
                      </th>

                      <th className="px-4 py-3 whitespace-nowrap">
                        Updated By
                      </th>

                      <th className="px-4 py-3 whitespace-nowrap">
                        Updated At
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200">
                    {paginated.length > 0 ? (
                      paginated.map((task, index) => {
                        const overdue = isOverdue(task.due_date, task.status);
                        const statusKey = task.status.toLowerCase();
                        const priorityKey = task.priority.toLowerCase();

                        return (
                          <tr
                            key={task.id}
                            className={`transition duration-150 ${
                              overdue
                                ? "bg-red-50 dark:bg-red-900/10 hover:bg-red-100 dark:hover:bg-red-900/20"
                                : "hover:bg-gray-50 dark:hover:bg-gray-800"
                            }`}
                          >
                            {/* Index */}
                            <td className="px-4 py-3 text-gray-400 dark:text-gray-500 text-xs whitespace-nowrap">
                              {(safePage - 1) * pageSize + index + 1}
                            </td>

                            {/* Code */}
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className="px-2 py-0.5 text-xs font-bold rounded-md bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                                {task.task_code}
                              </span>
                            </td>

                            {/* Title */}
                            <td
                              className="px-4 py-3"
                              style={{
                                minWidth: "220px",
                                maxWidth: "300px",
                              }}
                            >
                              <div className="flex items-start gap-1.5">
                                {overdue && (
                                  <FaExclamationCircle className="text-red-500 dark:text-red-400 w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                                )}

                                <span
                                  className="text-sm font-medium text-gray-900 dark:text-white leading-snug overflow-hidden line-clamp-2"
                                  title={task.title}
                                >
                                  {task.title}
                                </span>
                              </div>
                            </td>

                            {/* Status */}
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span
                                className={`px-2 py-1 text-xs rounded-md font-medium capitalize ${
                                  STATUS_COLORS[statusKey] ??
                                  "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                                }`}
                              >
                                {task.status}
                              </span>
                            </td>

                            {/* Priority */}
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span
                                className={`px-2 py-1 text-xs rounded-md font-medium capitalize ${
                                  PRIORITY_COLORS[priorityKey] ??
                                  "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                                }`}
                              >
                                {task.priority}
                              </span>
                            </td>

                            {/* Project */}
                            <td className="px-4 py-3 whitespace-nowrap text-xs">
                              {task.project_name ? (
                                <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 font-medium">
                                  {task.project_name}
                                </span>
                              ) : (
                                <Dash />
                              )}
                            </td>

                            {/* Suite */}
                            <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-600 dark:text-gray-400">
                              {task.suite_name ?? <Dash />}
                            </td>

                            {/* Assignees */}
                            <td
                              className="px-4 py-3 text-xs text-gray-600 dark:text-gray-400"
                              style={{
                                minWidth: "180px",
                                maxWidth: "220px",
                              }}
                            >
                              <span className="break-words leading-snug">
                                {task.assignees ?? <Dash />}
                              </span>
                            </td>

                            {/* Due Date */}
                            <td className="px-4 py-3 whitespace-nowrap">
                              {task.due_date ? (
                                <span
                                  className={`text-xs font-medium ${
                                    overdue
                                      ? "text-red-600 dark:text-red-400"
                                      : "text-gray-700 dark:text-gray-200"
                                  }`}
                                >
                                  {new Date(task.due_date).toLocaleDateString(
                                    "en-GB",
                                    {
                                      day: "2-digit",
                                      month: "short",
                                      year: "numeric",
                                    },
                                  )}
                                </span>
                              ) : (
                                <Dash />
                              )}
                            </td>

                            {/* Created By */}
                            <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-600 dark:text-gray-400">
                              {task.created_by_name ?? <Dash />}
                            </td>

                            {/* Created At */}
                            <td className="px-4 py-3 whitespace-nowrap">
                              {formatDate(task.created_at)}
                            </td>

                            {/* Updated By */}
                            <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-600 dark:text-gray-400">
                              {task.updated_by_name ?? <Dash />}
                            </td>

                            {/* Updated At */}
                            <td className="px-4 py-3 whitespace-nowrap">
                              {formatDate(task.updated_at)}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td
                          colSpan={13}
                          className="text-center py-8 text-gray-500 dark:text-gray-400"
                        >
                          {activeFilterCount > 0
                            ? "No tasks match the current filters."
                            : "No tasks found."}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination */}
            <TablePagination
              totalItems={filtered.length}
              currentPage={safePage}
              totalPages={totalPages}
              pageSize={pageSize}
              pageSizeOptions={PAGE_SIZE_OPTIONS}
              onPageChange={handlePageChange}
              onPageSizeChange={handlePageSizeChange}
            />
          </>
        )}
      </div>
    </div>
  );
}
