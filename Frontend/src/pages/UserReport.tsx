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

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatDate = (dateStr: string | null) => {
  if (!dateStr) {
    return (
      <span className="text-gray-400 dark:text-gray-500 italic text-xs">—</span>
    );
  }

  const d = new Date(dateStr); // ✅ no replace needed

  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const year = d.getUTCFullYear();

  let hours = d.getUTCHours();
  const minutes = String(d.getUTCMinutes()).padStart(2, "0");
  const seconds = String(d.getUTCSeconds()).padStart(2, "0");

  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;

  const formattedDate = `${day}/${month}/${year}`;
  const formattedTime = `${String(hours).padStart(2, "0")}.${minutes}.${seconds} ${ampm}`;

  return (
    <span className="text-xs text-gray-600 dark:text-gray-400">
      {formattedDate}{" "}
      <span className="text-gray-400 dark:text-gray-500">{formattedTime}</span>
    </span>
  );
};

const formatDateStr = (dateStr: string | null): string => {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return (
    d.toLocaleDateString(undefined, {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }) +
    " " +
    d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
  );
};

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

  // ── Derived dropdown options ───────────────────────────────────────────────
  const roles = useMemo(
    () =>
      [
        ...new Set(
          (users ?? [])
            .map((u) => u.role_name)
            .filter((v): v is string => Boolean(v)),
        ),
      ].sort(),
    [users],
  );
  const departments = useMemo(
    () =>
      [
        ...new Set(
          (users ?? [])
            .map((u) => u.department_name)
            .filter((v): v is string => Boolean(v)),
        ),
      ].sort(),
    [users],
  );
  const teams = useMemo(
    () =>
      [
        ...new Set(
          (users ?? [])
            .map((u) => u.team_name)
            .filter((v): v is string => Boolean(v)),
        ),
      ].sort(),
    [users],
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
  };

  // ── Filtered data ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (!users) return [];
    const q = search.toLowerCase().trim();
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
      if (filterRole && u.role_name !== filterRole) return false;
      if (filterDept && u.department_name !== filterDept) return false;
      if (filterTeam && u.team_name !== filterTeam) return false;
      if (filterSource && u.source !== filterSource) return false;
      if (filterStatus === "active" && !u.is_active) return false;
      if (filterStatus === "inactive" && u.is_active) return false;
      return true;
    });
  }, [
    users,
    search,
    filterRole,
    filterDept,
    filterTeam,
    filterSource,
    filterStatus,
  ]);

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

  // ── Excel export ──────────────────────────────────────────────────────────
  const handleExport = () => {
    const rows = filtered.map((u, i) => ({
      "#": i + 1,
      ID: u.id,
      Username: u.username,
      Role: u.role_name ?? "",
      "Role ID": u.role_id,
      Department: u.department_name ?? "",
      "Department ID": u.department_id ?? "",
      Team: u.team_name ?? "",
      "Team ID": u.team_id ?? "",
      Source: u.source,
      Status: u.is_active ? "Active" : "Inactive",
      "Created At": formatDateStr(u.created_at),
      "Created By": u.created_by_username ?? "",
      // "Created By ID": u.created_by ?? "",
      "Updated At": formatDateStr(u.updated_at),
      "Updated By": u.updated_by_username ?? "",
      // "Updated By ID": u.updated_by ?? "",
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
      { wch: 13 },
      { wch: 22 },
      { wch: 16 },
      { wch: 13 },
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
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by username, role, department, team, created/updated by…"
                className="w-full pl-8 pr-8 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
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
              onChange={(e) => setFilterRole(e.target.value)}
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
              onChange={(e) => setFilterDept(e.target.value)}
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
            </select>

            {/* Team */}
            <select
              value={filterTeam}
              onChange={(e) => setFilterTeam(e.target.value)}
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
            </select>

            {/* Source */}
            <select
              value={filterSource}
              onChange={(e) => setFilterSource(e.target.value)}
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
              onChange={(e) => setFilterStatus(e.target.value)}
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
          <div className="overflow-x-auto rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 uppercase text-xs tracking-wider">
                <tr>
                  <th className="px-5 py-3 whitespace-nowrap">#</th>
                  {/* <th className="px-5 py-3 whitespace-nowrap">ID</th> */}
                  <th className="px-5 py-3 whitespace-nowrap">Username</th>
                  <th className="px-5 py-3 whitespace-nowrap">Role</th>
                  {/* <th className="px-5 py-3 whitespace-nowrap">Role ID</th> */}
                  <th className="px-5 py-3 whitespace-nowrap">Department</th>
                  {/* <th className="px-5 py-3 whitespace-nowrap">Dept ID</th> */}
                  <th className="px-5 py-3 whitespace-nowrap">Team</th>
                  {/* <th className="px-5 py-3 whitespace-nowrap">Team ID</th> */}
                  <th className="px-5 py-3 whitespace-nowrap">Source</th>
                  <th className="px-5 py-3 whitespace-nowrap">Status</th>
                  <th className="px-5 py-3 whitespace-nowrap">Created At</th>
                  <th className="px-5 py-3 whitespace-nowrap">Created By</th>
                  {/* <th className="px-5 py-3 whitespace-nowrap">Created By ID</th> */}
                  <th className="px-5 py-3 whitespace-nowrap">Updated At</th>
                  <th className="px-5 py-3 whitespace-nowrap">Updated By</th>
                  {/* <th className="px-5 py-3 whitespace-nowrap">Updated By ID</th> */}
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200">
                {filtered.length > 0 ? (
                  filtered.map((user, index) => (
                    <tr
                      key={user.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-800 transition duration-150"
                    >
                      {/* # */}
                      <td className="px-5 py-3 text-gray-400 dark:text-gray-500 text-xs">
                        {index + 1}
                      </td>

                      {/* ID */}
                      {/* <td className="px-5 py-3 text-xs font-mono text-gray-500 dark:text-gray-400">
                        {user.id}
                      </td> */}

                      {/* Username */}
                      <td className="px-5 py-3 font-medium text-gray-900 dark:text-white whitespace-nowrap">
                        {user.username}
                      </td>

                      {/* Role name */}
                      <td className="px-5 py-3 whitespace-nowrap">
                        {user.role_name ?? <Dash />}
                      </td>

                      {/* Role ID */}
                      {/* <td className="px-5 py-3 text-xs font-mono text-gray-500 dark:text-gray-400">
                        {user.role_id}
                      </td> */}

                      {/* Department name */}
                      <td className="px-5 py-3 whitespace-nowrap">
                        {user.department_name ?? <Dash />}
                      </td>

                      {/* Department ID */}
                      {/* <td className="px-5 py-3 text-xs font-mono text-gray-500 dark:text-gray-400">
                        {user.department_id ?? <Dash />}
                      </td> */}

                      {/* Team name */}
                      <td className="px-5 py-3 whitespace-nowrap">
                        {user.team_name ?? <Dash />}
                      </td>

                      {/* Team ID */}
                      {/* <td className="px-5 py-3 text-xs font-mono text-gray-500 dark:text-gray-400">
                        {user.team_id ?? <Dash />}
                      </td> */}

                      {/* Source */}
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

                      {/* Status */}
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

                      {/* Created At */}
                      <td className="px-5 py-3 whitespace-nowrap">
                        {formatDate(user.created_at)}
                      </td>

                      {/* Created By username */}
                      <td className="px-5 py-3 whitespace-nowrap text-xs text-gray-600 dark:text-gray-400">
                        {user.created_by_username ?? <Dash />}
                      </td>

                      {/* Created By ID */}
                      {/* <td className="px-5 py-3 text-xs font-mono text-gray-500 dark:text-gray-400">
                        {user.created_by ?? <Dash />}
                      </td> */}

                      {/* Updated At */}
                      <td className="px-5 py-3 whitespace-nowrap">
                        {formatDate(user.updated_at)}
                      </td>

                      {/* Updated By username */}
                      <td className="px-5 py-3 whitespace-nowrap text-xs text-gray-600 dark:text-gray-400">
                        {user.updated_by_username ?? <Dash />}
                      </td>

                      {/* Updated By ID */}
                      {/* <td className="px-5 py-3 text-xs font-mono text-gray-500 dark:text-gray-400">
                        {user.updated_by ?? <Dash />}
                      </td> */}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={17}
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
        )}
      </div>
    </div>
  );
}
