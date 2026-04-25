import { useState, useMemo } from "react";
import { FaEdit, FaTrash } from "react-icons/fa";
import PageBreadcrumb from "../components/common/PageBreadCrumb";
import PageMeta from "../components/common/PageMeta";
import Alert from "../components/ui/alert/Alert";
import useFetchWithAuth from "../hooks/useFetchWithAuth";
import API from "../services/api";

// ✅ Types
interface User {
  id: number;
  username: string;
  role_id: number;
  role_name: string;
  department_id: number | null;
  department_name: string | null;
  team_id: number | null;
  team_name: string | null;
  source: string;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
}

interface Role {
  id: number;
  role_name: string;
}

interface Department {
  id: number;
  department_name: string;
  is_active: boolean;
}

interface Team {
  id: number;
  team_name: string;
  is_active: boolean;
  department_id: number;
}

type UserType = "MANUAL" | "AD";

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
      <span className="text-gray-700 dark:text-gray-200">
        {formattedDate}
      </span>
      <span className="text-gray-400 dark:text-gray-500">
        {formattedTime}
      </span>
    </div>
  );
};

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export default function Users() {
  // ✅ Fetch users
  const {
    data: users,
    loading,
    error,
  } = useFetchWithAuth<User[]>("/api/users");

  // ✅ Fetch roles & departments — now using dropdown endpoints
const { data: roles } = useFetchWithAuth<Role[]>("/api/dropdown/roles");
const { data: departments } = useFetchWithAuth<Department[]>("/api/dropdown/departments");
const { data: allTeams } = useFetchWithAuth<Team[]>("/api/dropdown/teams");

  // ✅ Teams — loaded dynamically by department
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(false);

  // ─── SEARCH & FILTER STATE ──────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRole, setFilterRole] = useState("");
  const [filterDepartment, setFilterDepartment] = useState("");
  const [filterTeam, setFilterTeam] = useState("");
  const [filterSource, setFilterSource] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  // ─── PAGINATION STATE ───────────────────────────────────────────────────
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // ─── CREATE / EDIT MODAL ─────────────────────────────────────────────────
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userType, setUserType] = useState<UserType>("MANUAL");

  const [formData, setFormData] = useState({
    username: "",
    password: "",
    windows_username: "",
    role_id: "",
    department_id: "",
    team_id: "",
    is_active: true,
  });

  const [submitting, setSubmitting] = useState(false);
  const [formAlert, setFormAlert] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // ─── DELETE MODAL ────────────────────────────────────────────────────────
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [deleteAlert, setDeleteAlert] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [deletingInProgress, setDeletingInProgress] = useState(false);

  // ─── HELPERS ─────────────────────────────────────────────────────────────
  const getToken = () =>
    localStorage.getItem("token") || sessionStorage.getItem("token");

  // ✅ Fetch teams by department — now using dropdown endpoint
const fetchTeamsByDepartment = async (departmentId: string) => {
  if (!departmentId) {
    setTeams([]);
    return;
  }
  setTeamsLoading(true);
  try {
    const token = getToken();
    const res = await API.get(`/api/dropdown/teams/department/${departmentId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.data.success) {
      setTeams(res.data.data ?? []);
    }
  } catch {
    setTeams([]);
  } finally {
    setTeamsLoading(false);
  }
};

  // ✅ Department change — reset team, re-fetch teams
  const handleDepartmentChange = (departmentId: string) => {
    setFormData((prev) => ({
      ...prev,
      department_id: departmentId,
      team_id: "",
    }));
    fetchTeamsByDepartment(departmentId);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingUser(null);
    setUserType("MANUAL");
    setFormData({
      username: "",
      password: "",
      windows_username: "",
      role_id: "",
      department_id: "",
      team_id: "",
      is_active: true,
    });
    setFormAlert(null);
    setTeams([]);
  };

  const handleCloseDeleteModal = () => {
    setShowDeleteModal(false);
    setDeletingUser(null);
    setDeleteAlert(null);
  };

  // ─── OPEN CREATE ─────────────────────────────────────────────────────────
  const handleOpenCreate = () => {
    setEditingUser(null);
    setUserType("MANUAL");
    setFormData({
      username: "",
      password: "",
      windows_username: "",
      role_id: "",
      department_id: "",
      team_id: "",
      is_active: true,
    });
    setFormAlert(null);
    setTeams([]);
    setShowModal(true);
  };

  // ─── OPEN EDIT ───────────────────────────────────────────────────────────
  const handleEdit = (user: User) => {
    setEditingUser(user);
    setUserType(user.source === "AD" ? "AD" : "MANUAL");
    setFormData({
      username: user.username,
      password: "",
      windows_username: user.source === "AD" ? user.username : "",
      role_id: String(user.role_id ?? ""),
      department_id: String(user.department_id ?? ""),
      team_id: String(user.team_id ?? ""),
      is_active: user.is_active,
    });
    setFormAlert(null);

    if (user.department_id) {
      fetchTeamsByDepartment(String(user.department_id));
    } else {
      setTeams([]);
    }

    setShowModal(true);
  };

  // ─── SAVE (CREATE / UPDATE) ───────────────────────────────────────────────
  const handleSave = async () => {
    if (editingUser) {
      if (!formData.role_id) {
        setFormAlert({ type: "error", message: "Role is required." });
        return;
      }
    } else {
      if (userType === "MANUAL") {
        if (!formData.username.trim()) {
          setFormAlert({ type: "error", message: "Username is required." });
          return;
        }
        if (!formData.password.trim()) {
          setFormAlert({ type: "error", message: "Password is required." });
          return;
        }
        if (!formData.role_id) {
          setFormAlert({ type: "error", message: "Role is required." });
          return;
        }
      } else {
        if (!formData.windows_username.trim()) {
          setFormAlert({
            type: "error",
            message: "Windows username is required.",
          });
          return;
        }
        if (!formData.role_id) {
          setFormAlert({ type: "error", message: "Role is required." });
          return;
        }
      }
    }

    setSubmitting(true);
    setFormAlert(null);

    try {
      const token = getToken();
      let res;

      if (editingUser) {
        res = await API.put(
          `/api/users/update/${editingUser.id}`,
          {
            role_id: Number(formData.role_id),
            department_id: formData.department_id
              ? Number(formData.department_id)
              : null,
            team_id: formData.team_id ? Number(formData.team_id) : null,
            is_active: formData.is_active,
            ...(userType === "MANUAL" && formData.password
              ? { password: formData.password }
              : {}),
          },
          { headers: { Authorization: `Bearer ${token}` } },
        );
      } else if (userType === "AD") {
        res = await API.post(
          "/api/users/ad-user",
          {
            windows_username: formData.windows_username.trim(),
            role_id: Number(formData.role_id),
            department_id: formData.department_id
              ? Number(formData.department_id)
              : null,
            team_id: formData.team_id ? Number(formData.team_id) : null,
          },
          { headers: { Authorization: `Bearer ${token}` } },
        );
      } else {
        res = await API.post(
          "/api/users/create",
          {
            username: formData.username.trim(),
            password: formData.password,
            role_id: Number(formData.role_id),
            department_id: formData.department_id
              ? Number(formData.department_id)
              : null,
            team_id: formData.team_id ? Number(formData.team_id) : null,
          },
          { headers: { Authorization: `Bearer ${token}` } },
        );
      }

      if (res.data.success || res.data.message) {
        setFormAlert({
          type: "success",
          message: editingUser
            ? "User updated successfully!"
            : "User created successfully!",
        });

        setTimeout(() => {
          handleCloseModal();
          window.location.reload();
        }, 1200);
      }
    } catch (err: any) {
      const message = err.response?.data?.message || "Operation failed.";
      setFormAlert({ type: "error", message });
    } finally {
      setSubmitting(false);
    }
  };

  // ─── DELETE ──────────────────────────────────────────────────────────────
  const handleDeleteClick = (user: User) => {
    setDeletingUser(user);
    setDeleteAlert(null);
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingUser) return;

    setDeletingInProgress(true);
    setDeleteAlert(null);

    try {
      const token = getToken();

      await API.delete(`/api/users/delete/${deletingUser.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setDeleteAlert({
        type: "success",
        message: "User deleted successfully.",
      });

      setTimeout(() => {
        setShowDeleteModal(false);
        setDeletingUser(null);
        setDeleteAlert(null);
        window.location.reload();
      }, 1200);
    } catch (err: any) {
      const message = err.response?.data?.message || "Failed to delete user.";
      setDeleteAlert({ type: "error", message });
    } finally {
      setDeletingInProgress(false);
    }
  };

  // ─── TOGGLE ACTIVE ───────────────────────────────────────────────────────
  const handleToggleStatus = async (user: User) => {
    try {
      const token = getToken();

      await API.put(
        `/api/users/toggle/${user.id}`,
        { is_active: !user.is_active },
        { headers: { Authorization: `Bearer ${token}` } },
      );

      window.location.reload();
    } catch {
      // silent
    }
  };

  // ─── SEARCH + FILTER LOGIC ───────────────────────────────────────────────
  const filteredUsers = useMemo(() => {
    if (!users) return [];

    return users.filter((user) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !q ||
        user.username.toLowerCase().includes(q) ||
        (user.role_name ?? "").toLowerCase().includes(q) ||
        (user.department_name ?? "").toLowerCase().includes(q) ||
        (user.team_name ?? "").toLowerCase().includes(q);

      const matchesRole = !filterRole
  ? true
  : filterRole === "UNASSIGNED"
    ? user.role_id === null
    : String(user.role_id) === filterRole;

      const matchesDepartment = !filterDepartment
  ? true
  : filterDepartment === "UNASSIGNED"
    ? user.department_id === null
    : String(user.department_id) === filterDepartment;

    const matchesTeam = !filterTeam
  ? true
  : filterTeam === "UNASSIGNED"
    ? user.team_id === null
    : String(user.team_id) === filterTeam;

      const matchesSource =
        !filterSource || user.source === filterSource;

      const matchesStatus =
        !filterStatus ||
        (filterStatus === "active" ? user.is_active : !user.is_active);

      return (
  matchesSearch &&
  matchesRole &&
  matchesDepartment &&
  matchesTeam &&
  matchesSource &&
  matchesStatus
);
    });
}, [users, searchQuery, filterRole, filterDepartment, filterTeam, filterSource, filterStatus]);

  // ─── PAGINATION LOGIC ────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedUsers = filteredUsers.slice(
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

  // Reset to page 1 whenever filters change
  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    setCurrentPage(1);
  };

  const handleFilterRoleChange = (val: string) => {
    setFilterRole(val);
    setCurrentPage(1);
  };

  const handleFilterDepartmentChange = (val: string) => {
    setFilterDepartment(val);
    setCurrentPage(1);
  };

  const handleFilterTeamChange = (val: string) => {
  setFilterTeam(val);
  setCurrentPage(1);
};

  const handleFilterSourceChange = (val: string) => {
    setFilterSource(val);
    setCurrentPage(1);
  };

  const handleFilterStatusChange = (val: string) => {
    setFilterStatus(val);
    setCurrentPage(1);
  };

  const hasActiveFilters =
  searchQuery ||
  filterRole ||
  filterDepartment ||
  filterTeam ||
  filterSource ||
  filterStatus;

  const handleClearFilters = () => {
  setSearchQuery("");
  setFilterRole("");
  setFilterDepartment("");
  setFilterTeam("");
  setFilterSource("");
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

  // ─── RENDER ──────────────────────────────────────────────────────────────
  return (
    <div>
      <PageMeta title="User Management" description="User management page" />
      <PageBreadcrumb pageTitle="User Management" />

      <div className="mt-4">
        {/* ── Top bar ── */}
        <div className="flex justify-end mb-4">
          <button
            onClick={handleOpenCreate}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition duration-150"
          >
            + Create User
          </button>
        </div>

        {/* ── Search & Filters ── */}
        <div className="mb-4 space-y-3">
          {/* Search bar */}
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500 pointer-events-none"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 1010.5 18a7.5 7.5 0 006.15-3.15z"
              />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search by username, role, department or team..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Filter row */}
          <div className="flex flex-wrap gap-2 items-center">
            {/* Role filter */}
            <select
              value={filterRole}
              onChange={(e) => handleFilterRoleChange(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All roles</option>
              {roles?.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.role_name}
                </option>
              ))}
              <option value="UNASSIGNED">Unassigned</option>
            </select>

            {/* Department filter */}
            <select
              value={filterDepartment}
              onChange={(e) => handleFilterDepartmentChange(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All departments</option>
              {departments
                ?.filter((d) => d.is_active)
                .map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.department_name}
                  </option>
                ))}
                <option value="UNASSIGNED">Unassigned</option>
            </select>

{/* Team filter */}
            <select
  value={filterTeam}
  onChange={(e) => handleFilterTeamChange(e.target.value)}
  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
>
  <option value="">All teams</option>

  {allTeams
  ?.filter((t) => t.is_active)
  .map((t) => (
    <option key={t.id} value={t.id}>
      {t.team_name}
    </option>
))}
  <option value="UNASSIGNED">Unassigned</option>

</select>

            {/* Source filter */}
            <select
              value={filterSource}
              onChange={(e) => handleFilterSourceChange(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All sources</option>
              <option value="MANUAL">Manual</option>
              <option value="AD">AD</option>
            </select>

            {/* Status filter */}
            <select
              value={filterStatus}
              onChange={(e) => handleFilterStatusChange(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>

            {/* Clear filters */}
            {hasActiveFilters && (
              <button
                onClick={handleClearFilters}
                className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition duration-150 flex items-center gap-1"
              >
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
                Clear filters
              </button>
            )}

            {/* Result count */}
            <span className="ml-auto text-xs text-gray-400 dark:text-gray-500">
              {filteredUsers.length} {filteredUsers.length === 1 ? "user" : "users"} found
            </span>
          </div>
        </div>

        {error && (
          <div className="mb-4">
            <Alert variant="error" title="Error" message={error} />
          </div>
        )}

        {loading && !error && (
          <div className="text-gray-500 dark:text-gray-400">
            Loading users...
          </div>
        )}

        {!loading && !error && (
          <>
            <div className="overflow-x-auto rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 uppercase text-xs tracking-wider">
                  <tr>
                    <th className="px-5 py-3">#</th>
                    <th className="px-5 py-3">Username</th>
                    <th className="px-5 py-3">Role</th>
                    <th className="px-5 py-3">Department</th>
                    <th className="px-5 py-3">Team</th>
                    <th className="px-5 py-3">Source</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Active</th>
                    <th className="px-5 py-3">Created</th>
                    <th className="px-5 py-3">Updated</th>
                    <th className="px-5 py-3">Actions</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200">
                  {paginatedUsers.length > 0 ? (
                    paginatedUsers.map((user, index) => (
                      <tr
                        key={user.id}
                        className="hover:bg-gray-50 dark:hover:bg-gray-800 transition duration-150"
                      >
                        <td className="px-5 py-3">
                          {(safePage - 1) * pageSize + index + 1}
                        </td>

                        <td className="px-5 py-3 font-medium text-gray-900 dark:text-white">
                          {user.username}
                        </td>

                        <td className="px-5 py-3">
                          {user.role_name ?? (
                            <span className="text-gray-400 dark:text-gray-500 italic text-xs">
                              Unassigned
                            </span>
                          )}
                        </td>

                        <td className="px-5 py-3">
                          {user.department_name ?? (
                            <span className="text-gray-400 dark:text-gray-500 italic text-xs">
                              Unassigned
                            </span>
                          )}
                        </td>

                        <td className="px-5 py-3">
                          {user.team_name ?? (
                            <span className="text-gray-400 dark:text-gray-500 italic text-xs">
                              Unassigned
                            </span>
                          )}
                        </td>

                        <td className="px-5 py-3">
                          <span className="px-2 py-1 text-xs rounded-md bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
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

                        <td className="px-5 py-3">
                          <button
                            onClick={() => handleToggleStatus(user)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none ${
                              user.is_active
                                ? "bg-blue-600"
                                : "bg-gray-300 dark:bg-gray-600"
                            }`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${
                                user.is_active ? "translate-x-6" : "translate-x-1"
                              }`}
                            />
                          </button>
                        </td>

                        <td className="px-5 py-3">
                          {formatDate(user.created_at)}
                        </td>

                        <td className="px-5 py-3">
                          {formatDate(user.updated_at)}
                        </td>

                        <td className="px-5 py-3 flex gap-3 items-center">
                          <FaEdit
                            className="cursor-pointer text-blue-600"
                            onClick={() => handleEdit(user)}
                          />
                          <FaTrash
                            className="cursor-pointer text-red-600"
                            onClick={() => handleDeleteClick(user)}
                          />
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={11} className="text-center py-10 text-gray-500 dark:text-gray-400">
                        {hasActiveFilters
                          ? "No users match your search or filters."
                          : "No users found."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* ── Pagination ── */}
            {filteredUsers.length > 0 && (
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
                    {Math.min(safePage * pageSize, filteredUsers.length)} of{" "}
                    {filteredUsers.length}
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
                    ),
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

      {/* ✅ CREATE / EDIT MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingUser ? "Edit User" : "Create User"}
              </h2>
              <button
                onClick={handleCloseModal}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl font-bold"
              >
                &times;
              </button>
            </div>

            {formAlert && (
              <div className="mb-4">
                <Alert
                  variant={formAlert.type}
                  title={formAlert.type === "success" ? "Success" : "Error"}
                  message={formAlert.message}
                />
              </div>
            )}

            {!editingUser && (
              <div className="flex mb-5 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => setUserType("MANUAL")}
                  className={`flex-1 py-2 text-sm font-medium transition duration-150 ${
                    userType === "MANUAL"
                      ? "bg-blue-600 text-white"
                      : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                  }`}
                >
                  Manual User
                </button>
                <button
                  onClick={() => setUserType("AD")}
                  className={`flex-1 py-2 text-sm font-medium transition duration-150 ${
                    userType === "AD"
                      ? "bg-blue-600 text-white"
                      : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                  }`}
                >
                  AD User
                </button>
              </div>
            )}

            {(userType === "MANUAL" || editingUser) && (
              <>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Username <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) =>
                      setFormData({ ...formData, username: e.target.value })
                    }
                    disabled={!!editingUser}
                    placeholder="e.g. john.doe"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  {editingUser && (
                    <p className="text-xs text-gray-400 mt-1">
                      Username cannot be changed.
                    </p>
                  )}
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Password{" "}
                    {!editingUser && <span className="text-red-500">*</span>}
                    {editingUser && (
                      <span className="text-gray-400 text-xs font-normal ml-1">
                        (leave blank to keep current)
                      </span>
                    )}
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    placeholder={
                      editingUser ? "Leave blank to keep current" : "Password"
                    }
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </>
            )}

            {userType === "AD" && !editingUser && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Windows Username <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.windows_username}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      windows_username: e.target.value,
                    })
                  }
                  placeholder="e.g. DOMAIN\john.doe"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Role <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.role_id}
                onChange={(e) =>
                  setFormData({ ...formData, role_id: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select role...</option>
                {roles &&
                  roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.role_name}
                    </option>
                  ))}
              </select>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Department
                <span className="text-gray-400 text-xs font-normal ml-1">
                  (optional)
                </span>
              </label>
              <select
                value={formData.department_id}
                onChange={(e) => handleDepartmentChange(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">No department</option>
                {departments &&
                  departments
                    .filter((d) => d.is_active)
                    .map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.department_name}
                      </option>
                    ))}
              </select>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Team
                <span className="text-gray-400 text-xs font-normal ml-1">
                  (optional)
                </span>
              </label>
              <select
                value={formData.team_id}
                onChange={(e) =>
                  setFormData({ ...formData, team_id: e.target.value })
                }
                disabled={!formData.department_id || teamsLoading}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="">
                  {!formData.department_id
                    ? "Select a department first"
                    : teamsLoading
                      ? "Loading teams..."
                      : "No team"}
                </option>
                {!teamsLoading &&
                  teams
                    .filter((t) => t.is_active)
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.team_name}
                      </option>
                    ))}
              </select>
              {formData.department_id &&
                !teamsLoading &&
                teams.filter((t) => t.is_active).length === 0 && (
                  <p className="text-xs text-gray-400 mt-1">
                    No active teams in this department.
                  </p>
                )}
            </div>

            <div className="mb-6 flex items-center gap-3">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Active
              </span>
              <button
                onClick={() =>
                  setFormData({ ...formData, is_active: !formData.is_active })
                }
                className={`relative inline-flex h-6 w-11 items-center rounded-full ${
                  formData.is_active
                    ? "bg-blue-600"
                    : "bg-gray-300 dark:bg-gray-600"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white ${
                    formData.is_active ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {formData.is_active ? "Active" : "Inactive"}
              </span>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={handleCloseModal}
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
                  ? editingUser
                    ? "Updating..."
                    : "Creating..."
                  : editingUser
                    ? "Update"
                    : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ✅ DELETE CONFIRMATION MODAL */}
      {showDeleteModal && deletingUser && (
        <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Delete User
              </h2>
              <button
                onClick={handleCloseDeleteModal}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl font-bold"
              >
                &times;
              </button>
            </div>

            {deleteAlert && (
              <div className="mb-4">
                <Alert
                  variant={deleteAlert.type}
                  title={deleteAlert.type === "success" ? "Success" : "Error"}
                  message={deleteAlert.message}
                />
              </div>
            )}

            <div className="flex items-start gap-3 mb-4">
              <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full bg-red-100 dark:bg-red-900">
                <svg
                  className="w-5 h-5 text-red-600 dark:text-red-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                  />
                </svg>
              </div>
              <div>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  Are you sure you want to delete user{" "}
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {deletingUser.username}
                  </span>
                  ? This action cannot be undone.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={handleCloseDeleteModal}
                disabled={deletingInProgress}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 rounded-lg transition duration-150"
              >
                Cancel
              </button>

              <button
                onClick={handleConfirmDelete}
                disabled={deletingInProgress}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-60 rounded-lg transition duration-150"
              >
                {deletingInProgress ? "Deleting..." : "Yes, Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}