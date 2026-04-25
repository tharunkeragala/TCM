import { useState, useMemo } from "react";
import * as XLSX from "xlsx";
import { FaSearch, FaTimes, FaFileExcel } from "react-icons/fa";
import PageBreadcrumb from "../components/common/PageBreadCrumb";
import PageMeta from "../components/common/PageMeta";
import Alert from "../components/ui/alert/Alert";
import useFetchWithAuth from "../hooks/useFetchWithAuth";

// ─── Types ────────────────────────────────────────────────────────────────────
interface User {
  id: number;
  username: string;
  source: string;
  is_active: boolean;
  role_id: number;
  department_id: number | null;
  team_id: number | null;
  created_at: string | null;
  updated_at: string | null;
  created_by: number | null;
  updated_by: number | null;
  created_by_username: string | null;
  updated_by_username: string | null;
  role_name: string | null;
  department_name: string | null;
  team_name: string | null;
}

// ✅ Format date helper
const formatDate = (dateStr: string | null) => {
  if (!dateStr) {
    return (
      <span className="text-gray-400 dark:text-gray-500 italic text-xs">
        —
      </span>
    );
  }

  const d = new Date(dateStr);

  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const year = d.getUTCFullYear();

  let hours = d.getUTCHours();
  const minutes = String(d.getUTCMinutes()).padStart(2, "0");
  const seconds = String(d.getUTCSeconds()).padStart(2, "0");

  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;

  const formattedDate = `${day}/${month}/${year}`;
  const formattedTime = `${String(hours).padStart(2, "0")}:${minutes}:${seconds} ${ampm}`;

  return (
    <div className="flex flex-col text-xs leading-tight">
      <span className="text-gray-700 dark:text-gray-200">{formattedDate}</span>
      <span className="text-gray-400 dark:text-gray-500">{formattedTime}</span>
    </div>
  );
};

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

const Dash = () => (
  <span className="text-gray-400 dark:text-gray-500 italic text-xs">—</span>
);

// ─── Component ────────────────────────────────────────────────────────────────
export default function UserReport() {
  const {
    data: users,
    loading,
    error,
  } = useFetchWithAuth<User[]>("/api/reports/users/list");

  // ── Filter state ──────────────────────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [filterTeam, setFilterTeam] = useState("");
  const [filterSource, setFilterSource] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  // ── Pagination state ──────────────────────────────────────────────────────
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // ── Derived dropdown options ───────────────────────────────────────────────
  const roles = useMemo(
    () =>
      [
        ...new Set(
          (users ?? [])
            .map((u) => u.role_name)
            .filter((v): v is string => Boolean(v))
        ),
      ].sort(),
    [users]
  );
  const departments = useMemo(
    () =>
      [
        ...new Set(
          (users ?? [])
            .map((u) => u.department_name)
            .filter((v): v is string => Boolean(v))
        ),
      ].sort(),
    [users]
  );
  const teams = useMemo(
    () =>
      [
        ...new Set(
          (users ?? [])
            .map((u) => u.team_name)
            .filter((v): v is string => Boolean(v))
        ),
      ].sort(),
    [users]
  );

  const activeFilterCount = [
    search,
    filterRole,
    filterDept,
    filterTeam,
    filterSource,
    filterStatus,
  ].filter(Boolean).length;

  const clearFilters = () => {
    setSearch("");
    setFilterRole("");
    setFilterDept("");
    setFilterTeam("");
    setFilterSource("");
    setFilterStatus("");
    setCurrentPage(1);
  };

  // ── Filtered data ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (!users) return [];
    const q = search.toLowerCase().trim();
    const matchFilter = (value: string | null, filter: string) => {
  if (!filter) return true;
  if (filter === "UNASSIGNED") return value === null;
  return value === filter;
};
    return users.filter((u) => {
      if (
        q &&
        !u.username.toLowerCase().includes(q) &&
        !(u.role_name ?? "").toLowerCase().includes(q) &&
        !(u.department_name ?? "").toLowerCase().includes(q) &&
        !(u.team_name ?? "").toLowerCase().includes(q) &&
        !(u.created_by_username ?? "").toLowerCase().includes(q) &&
        !(u.updated_by_username ?? "").toLowerCase().includes(q) &&
        !String(u.id).includes(q)
      )
        return false;
      if (!matchFilter(u.department_name, filterDept)) return false;
if (!matchFilter(u.team_name, filterTeam)) return false;
if (!matchFilter(u.role_name, filterRole)) return false;
      if (filterSource && u.source !== filterSource) return false;
      if (filterStatus === "active" && !u.is_active) return false;
      if (filterStatus === "inactive" && u.is_active) return false;
      return true;
    });
  }, [users, search, filterRole, filterDept, filterTeam, filterSource, filterStatus]);

  // ── Pagination logic ──────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedUsers = filtered.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize
  );

  const handlePageChange = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  };

  // Reset to page 1 whenever filters change
  const handleSearchChange = (val: string) => {
    setSearch(val);
    setCurrentPage(1);
  };

  const handleFilterChange = (setter: (v: string) => void) => (val: string) => {
    setter(val);
    setCurrentPage(1);
  };

  // ── Pagination range ──────────────────────────────────────────────────────
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

  // ── Stats ─────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const all = users ?? [];
    return {
      total: all.length,
      active: all.filter((u) => u.is_active).length,
      inactive: all.filter((u) => !u.is_active).length,
      manual: all.filter((u) => u.source === "MANUAL").length,
      ad: all.filter((u) => u.source === "AD").length,
    };
  }, [users]);

  // ── Excel export (exports all filtered, not just current page) ────────────
  const handleExport = () => {
    const rows = filtered.map((u, i) => ({
      "#": i + 1,
      // ID: u.id,
      Username: u.username,
      Role: u.role_name ?? "",
      // "Role ID": u.role_id,
      Department: u.department_name ?? "",
      // "Department ID": u.department_id ?? "",
      Team: u.team_name ?? "",
      // "Team ID": u.team_id ?? "",
      Source: u.source,
      Status: u.is_active ? "Active" : "Inactive",
      "Created At": u.created_at ?? "",
      "Created By": u.created_by_username ?? "",
      "Updated At": u.updated_at ?? "",
      "Updated By": u.updated_by_username ?? "",
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [
      { wch: 5 },
      { wch: 6 },
      { wch: 20 },
      { wch: 16 },
      { wch: 9 },
      { wch: 18 },
      { wch: 14 },
      { wch: 14 },
      { wch: 9 },
      { wch: 10 },
      { wch: 10 },
      { wch: 22 },
      { wch: 16 },
      { wch: 22 },
      { wch: 16 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "User Report");

    const stamp = new Date()
      .toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
      .replace(/ /g, "-");
    XLSX.writeFile(wb, `User_Report_${stamp}.xlsx`);
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div>
      <PageMeta title="User Report" description="User report page" />
      <PageBreadcrumb pageTitle="User Report" />

      <div className="mt-4">
        {/* ── Summary Cards ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-5">
          {[
            { label: "Total Users", value: stats.total, color: "blue" },
            { label: "Active", value: stats.active, color: "green" },
            { label: "Inactive", value: stats.inactive, color: "red" },
            { label: "Manual", value: stats.manual, color: "purple" },
            { label: "AD Users", value: stats.ad, color: "orange" },
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
                      : color === "red"
                        ? "text-red-600 dark:text-red-400"
                        : color === "purple"
                          ? "text-purple-600 dark:text-purple-400"
                          : "text-orange-500 dark:text-orange-400"
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
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm mb-4 p-4">
          {/* Row 1: search + export */}
          <div className="flex flex-col sm:flex-row gap-3 mb-3">
            <div className="relative flex-1">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search by username, role, department, team, created/updated by…"
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
                disabled={loading || filtered.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition duration-150"
              >
                <FaFileExcel />
                Export Excel
                {!loading && filtered.length > 0 && (
                  <span className="bg-green-500 px-1.5 py-0.5 rounded-full text-[10px] font-bold leading-none">
                    {filtered.length}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Row 2: dropdown filters */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {/* Role */}
            <select
              value={filterRole}
              onChange={(e) => handleFilterChange(setFilterRole)(e.target.value)}
              className={`px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition ${
                filterRole
                  ? "border-blue-400 dark:border-blue-500"
                  : "border-gray-300 dark:border-gray-600"
              }`}
            >
              <option value="">All Roles</option>
              {roles.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>

            {/* Department */}
            <select
              value={filterDept}
              onChange={(e) => handleFilterChange(setFilterDept)(e.target.value)}
              className={`px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition ${
                filterDept
                  ? "border-blue-400 dark:border-blue-500"
                  : "border-gray-300 dark:border-gray-600"
              }`}
            >
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
              <option value="UNASSIGNED">Unassigned</option>
            </select>

            {/* Team */}
            <select
              value={filterTeam}
              onChange={(e) => handleFilterChange(setFilterTeam)(e.target.value)}
              className={`px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition ${
                filterTeam
                  ? "border-blue-400 dark:border-blue-500"
                  : "border-gray-300 dark:border-gray-600"
              }`}
            >
              <option value="">All Teams</option>
              {teams.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
              <option value="UNASSIGNED">Unassigned</option>
            </select>

            {/* Source */}
            <select
              value={filterSource}
              onChange={(e) => handleFilterChange(setFilterSource)(e.target.value)}
              className={`px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition ${
                filterSource
                  ? "border-blue-400 dark:border-blue-500"
                  : "border-gray-300 dark:border-gray-600"
              }`}
            >
              <option value="">All Sources</option>
              <option value="MANUAL">Manual</option>
              <option value="AD">AD</option>
            </select>

            {/* Status */}
            <select
              value={filterStatus}
              onChange={(e) => handleFilterChange(setFilterStatus)(e.target.value)}
              className={`px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition ${
                filterStatus
                  ? "border-blue-400 dark:border-blue-500"
                  : "border-gray-300 dark:border-gray-600"
              }`}
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
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
                {users?.length ?? 0}
              </span>{" "}
              users
            </p>
            {activeFilterCount > 0 &&
              filtered.length !== (users?.length ?? 0) && (
                <span className="text-xs text-blue-600 dark:text-blue-400">
                  · {(users?.length ?? 0) - filtered.length} filtered out
                </span>
              )}
          </div>
        )}

        {/* ── Error ─────────────────────────────────────────────────────── */}
        {error && (
          <div className="mb-4">
            <Alert variant="error" title="Error" message={error} />
          </div>
        )}

        {/* ── Loading ───────────────────────────────────────────────────── */}
        {loading && !error && (
          <div className="text-gray-500 dark:text-gray-400 text-sm py-4">
            Loading users...
          </div>
        )}

        {/* ── Table ─────────────────────────────────────────────────────── */}
        {!loading && !error && (
          <>
            <div className="overflow-x-auto rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 uppercase text-xs tracking-wider">
                  <tr>
                    <th className="px-5 py-3 whitespace-nowrap">#</th>
                    <th className="px-5 py-3 whitespace-nowrap">Username</th>
                    <th className="px-5 py-3 whitespace-nowrap">Role</th>
                    <th className="px-5 py-3 whitespace-nowrap">Department</th>
                    <th className="px-5 py-3 whitespace-nowrap">Team</th>
                    <th className="px-5 py-3 whitespace-nowrap">Source</th>
                    <th className="px-5 py-3 whitespace-nowrap">Status</th>
                    <th className="px-5 py-3 whitespace-nowrap">Created At</th>
                    <th className="px-5 py-3 whitespace-nowrap">Created By</th>
                    <th className="px-5 py-3 whitespace-nowrap">Updated At</th>
                    <th className="px-5 py-3 whitespace-nowrap">Updated By</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200">
                  {paginatedUsers.length > 0 ? (
                    paginatedUsers.map((user, index) => (
                      <tr
                        key={user.id}
                        className="hover:bg-gray-50 dark:hover:bg-gray-800 transition duration-150"
                      >
                        {/* # — reflects global position, not just current page */}
                        <td className="px-5 py-3 text-gray-400 dark:text-gray-500 text-xs">
                          {(safePage - 1) * pageSize + index + 1}
                        </td>

                        <td className="px-5 py-3 font-medium text-gray-900 dark:text-white whitespace-nowrap">
                          {user.username}
                        </td>

                        <td className="px-5 py-3 whitespace-nowrap">
                          {user.role_name ?? <Dash />}
                        </td>

                        <td className="px-5 py-3 whitespace-nowrap">
                          {user.department_name ?? (
                            <span className="text-gray-400 dark:text-gray-500 italic text-xs">
                              Unassigned
                            </span>
                          )}
                        </td>

                        <td className="px-5 py-3 whitespace-nowrap">
                          {user.team_name ?? (
                            <span className="text-gray-400 dark:text-gray-500 italic text-xs">
                              Unassigned
                            </span>
                          )}
                        </td>

                        <td className="px-5 py-3">
                          <span
                            className={`px-2 py-1 text-xs rounded-md font-medium ${
                              user.source === "AD"
                                ? "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300"
                                : "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                            }`}
                          >
                            {user.source}
                          </span>
                        </td>

                        <td className="px-5 py-3">
                          <span
                            className={`px-2 py-1 text-xs font-semibold rounded-full ${
                              user.is_active
                                ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                                : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                            }`}
                          >
                            {user.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>

                        <td className="px-5 py-3 whitespace-nowrap">
                          {formatDate(user.created_at)}
                        </td>

                        <td className="px-5 py-3 whitespace-nowrap text-xs text-gray-600 dark:text-gray-400">
                          {user.created_by_username ?? <Dash />}
                        </td>

                        <td className="px-5 py-3 whitespace-nowrap">
                          {formatDate(user.updated_at)}
                        </td>

                        <td className="px-5 py-3 whitespace-nowrap text-xs text-gray-600 dark:text-gray-400">
                          {user.updated_by_username ?? <Dash />}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={11}
                        className="text-center py-8 text-gray-500 dark:text-gray-400"
                      >
                        {activeFilterCount > 0
                          ? "No users match the current filters."
                          : "No users found."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* ── Pagination ── */}
            {filtered.length > 0 && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                {/* Left: page size + info */}
                <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                  <span>Rows per page:</span>
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
                    {Math.min(safePage * pageSize, filtered.length)} of{" "}
                    {filtered.length}
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
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7M18 19l-7-7 7-7" />
                    </svg>
                  </button>

                  {/* Prev */}
                  <button
                    onClick={() => handlePageChange(safePage - 1)}
                    disabled={safePage === 1}
                    className="p-1.5 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
                    title="Previous page"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
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
                    )
                  )}

                  {/* Next */}
                  <button
                    onClick={() => handlePageChange(safePage + 1)}
                    disabled={safePage === totalPages}
                    className="p-1.5 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
                    title="Next page"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>

                  {/* Last */}
                  <button
                    onClick={() => handlePageChange(totalPages)}
                    disabled={safePage === totalPages}
                    className="p-1.5 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
                    title="Last page"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M6 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}