import { useState } from "react";
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

export default function Users() {
  // ✅ Fetch users
  const {
    data: users,
    loading,
    error,
  } = useFetchWithAuth<User[]>("/api/users");

  // ✅ Fetch roles & departments for dropdowns
  const { data: roles } = useFetchWithAuth<Role[]>("/api/roles");
  const { data: departments } =
    useFetchWithAuth<Department[]>("/api/departments");

  // ✅ Teams — loaded dynamically by department
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(false);

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

  // ✅ Fetch teams by department
  const fetchTeamsByDepartment = async (departmentId: string) => {
    if (!departmentId) {
      setTeams([]);
      return;
    }
    setTeamsLoading(true);
    try {
      const token = getToken();
      const res = await API.get(`/api/teams/department/${departmentId}`, {
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

    // Pre-load teams for the user's current department
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
        // ✅ UPDATE
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
        // ✅ CREATE AD USER
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
        // ✅ CREATE MANUAL USER
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

  // ─── RENDER ──────────────────────────────────────────────────────────────
  return (
    <div>
      <PageMeta title="User Management" description="User management page" />
      <PageBreadcrumb pageTitle="User Management" />

      <div className="mt-4">
        {/* Top bar */}
        <div className="flex justify-end mb-4">
          <button
            onClick={handleOpenCreate}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition duration-150"
          >
            + Create User
          </button>
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
                {users && users.length > 0 ? (
                  users.map((user, index) => (
                    <tr
                      key={user.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-800 transition duration-150"
                    >
                      <td className="px-5 py-3">{index + 1}</td>

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

                      {/* ✅ Team Column */}
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

                      {/* Status Badge */}
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

                      {/* Toggle */}
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

                      {/* ✅ Created At */}
                      <td className="px-5 py-3 whitespace-nowrap">
                        {formatDate(user.created_at)}
                      </td>

                      {/* ✅ Updated At */}
                      <td className="px-5 py-3 whitespace-nowrap">
                        {formatDate(user.updated_at)}
                      </td>

                      {/* Actions */}
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
                    <td colSpan={11} className="text-center py-5 text-gray-500">
                      No users found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ✅ CREATE / EDIT MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 max-h-[90vh] overflow-y-auto">
            {/* Header */}
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

            {/* ✅ User Type Tabs — only on CREATE */}
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

            {/* ✅ MANUAL USER FIELDS */}
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

            {/* ✅ AD USER FIELDS */}
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

            {/* ✅ ROLE */}
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

            {/* ✅ DEPARTMENT */}
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

            {/* ✅ TEAM — always rendered, disabled until department chosen */}
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

            {/* ✅ ACTIVE TOGGLE */}
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

            {/* Footer */}
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
