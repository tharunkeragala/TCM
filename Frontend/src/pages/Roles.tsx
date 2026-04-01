import { useEffect, useState } from "react";
import API from "../services/api";
import CheckboxTree from "react-checkbox-tree";
import "react-checkbox-tree/lib/react-checkbox-tree.css";
import PageBreadcrumb from "../components/common/PageBreadCrumb";
import PageMeta from "../components/common/PageMeta";
import Alert from "../components/ui/alert/Alert";
import useFetchWithAuth from "../hooks/useFetchWithAuth";

interface Role {
  id: number;
  role_name: string;
}

interface Menu {
  id: number;
  menu_name: string;
  children?: Menu[];
}

interface MenuNode {
  value: number;
  label: string;
  children?: MenuNode[];
}

interface Permission {
  menu_id: number;
  can_view: number;
  can_create: number;
  can_edit: number;
  can_delete: number;
}

export default function Roles() {
  // ─── Roles Table ──────────────────────────────────────────────────────────
  const {
    data: roles,
    loading,
    error,
    refetch,
  } = useFetchWithAuth<Role[]>("/api/roles");

  // ─── Permissions State ────────────────────────────────────────────────────
  const [menus, setMenus] = useState<MenuNode[]>([]);
  const [checked, setChecked] = useState<number[]>([]);
  const [expanded, setExpanded] = useState<number[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [loadingMenus, setLoadingMenus] = useState<boolean>(false);
  const [loadingPermissions, setLoadingPermissions] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [menuAlert, setMenuAlert] = useState<string | null>(null);
  const [permAlert, setPermAlert] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // ─── Create Role Modal ────────────────────────────────────────────────────
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [createName, setCreateName] = useState<string>("");
  const [creating, setCreating] = useState<boolean>(false);
  const [createAlert, setCreateAlert] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // ─── Edit Role Modal ──────────────────────────────────────────────────────
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [editRole, setEditRole] = useState<Role | null>(null);
  const [editName, setEditName] = useState<string>("");
  const [editing, setEditing] = useState<boolean>(false);
  const [editAlert, setEditAlert] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // ─── Delete Confirm Modal ─────────────────────────────────────────────────
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [deleteRole, setDeleteRole] = useState<Role | null>(null);
  const [deleting, setDeleting] = useState<boolean>(false);
  const [deleteAlert, setDeleteAlert] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // ─── Load Menus Once ──────────────────────────────────────────────────────
  useEffect(() => {
    loadMenus();
  }, []);

  // ─── Load Permissions When Role Selected ──────────────────────────────────
  useEffect(() => {
    if (selectedRoleId !== null) {
      setPermAlert(null);
      setChecked([]);
      loadPermissions(selectedRoleId);
    }
  }, [selectedRoleId]);

  // ─── Load Menus ───────────────────────────────────────────────────────────
  const loadMenus = async () => {
    setLoadingMenus(true);
    setMenuAlert(null);
    try {
      const res = await API.get("/api/roles/menus");
      const raw: Menu[] = res.data?.data ?? res.data;
      if (!Array.isArray(raw) || raw.length === 0) {
        setMenuAlert("No menus found in database.");
        setMenus([]);
        return;
      }
      const format = (data: Menu[]): MenuNode[] =>
        data.map((m) => ({
          value: m.id,
          label: m.menu_name,
          children:
            m.children && m.children.length > 0
              ? format(m.children)
              : undefined,
        }));
      setMenus(format(raw));
    } catch (err: any) {
      console.error("Menu fetch error:", err.response ?? err);
      setMenuAlert("Failed to load menus.");
    } finally {
      setLoadingMenus(false);
    }
  };

  // ─── Load Permissions ─────────────────────────────────────────────────────
  const loadPermissions = async (id: number) => {
    setLoadingPermissions(true);
    try {
      const res = await API.get(`/api/roles/${id}/permissions`);
      const raw: Permission[] = res.data?.data ?? res.data;
      if (!Array.isArray(raw)) {
        setPermAlert({
          type: "error",
          message: "Unexpected permissions response.",
        });
        return;
      }
      setChecked(raw.filter((p) => p.can_view).map((p) => p.menu_id));
    } catch (err: any) {
      const status = err.response?.status;
      if (status === 403) {
        setPermAlert({ type: "error", message: "Access denied." });
      } else if (status === 404) {
        setPermAlert({
          type: "error",
          message: "Permissions endpoint not found.",
        });
      } else {
        setPermAlert({ type: "error", message: "Failed to load permissions." });
      }
    } finally {
      setLoadingPermissions(false);
    }
  };

  // ─── Save Permissions ─────────────────────────────────────────────────────
  const savePermissions = async () => {
    if (selectedRoleId === null) {
      setPermAlert({ type: "error", message: "Please select a role first." });
      return;
    }
    setSaving(true);
    setPermAlert(null);
    try {
      const permissions: Permission[] = checked.map((menuId) => ({
        menu_id: menuId,
        can_view: 1,
        can_create: 1,
        can_edit: 1,
        can_delete: 1,
      }));
      await API.post("/api/roles/save", {
        roleId: selectedRoleId,
        permissions,
      });
      setPermAlert({
        type: "success",
        message: "Permissions saved successfully.",
      });
    } catch {
      setPermAlert({ type: "error", message: "Failed to save permissions." });
    } finally {
      setSaving(false);
    }
  };

  // ─── Create Role ──────────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!createName.trim()) {
      setCreateAlert({ type: "error", message: "Role name is required." });
      return;
    }
    setCreating(true);
    setCreateAlert(null);
    try {
      await API.post("/api/roles/create", { role_name: createName.trim() });
      setCreateAlert({
        type: "success",
        message: "Role created successfully.",
      });
      setTimeout(() => {
        setShowCreateModal(false);
        setCreateName("");
        setCreateAlert(null);
        refetch();
      }, 1200);
    } catch (err: any) {
      setCreateAlert({
        type: "error",
        message: err.response?.data?.message || "Failed to create role.",
      });
    } finally {
      setCreating(false);
    }
  };

  // ─── Edit Role ────────────────────────────────────────────────────────────
  const openEditModal = (role: Role) => {
    setEditRole(role);
    setEditName(role.role_name);
    setEditAlert(null);
    setShowEditModal(true);
  };

  const handleEdit = async () => {
    if (!editName.trim()) {
      setEditAlert({ type: "error", message: "Role name is required." });
      return;
    }
    setEditing(true);
    setEditAlert(null);
    try {
      await API.put(`/api/roles/${editRole?.id}`, {
        role_name: editName.trim(),
      });
      setEditAlert({ type: "success", message: "Role updated successfully." });
      setTimeout(() => {
        setShowEditModal(false);
        setEditRole(null);
        setEditName("");
        setEditAlert(null);
        refetch();
      }, 1200);
    } catch (err: any) {
      setEditAlert({
        type: "error",
        message: err.response?.data?.message || "Failed to update role.",
      });
    } finally {
      setEditing(false);
    }
  };

  // ─── Delete Role ──────────────────────────────────────────────────────────
  const openDeleteModal = (role: Role) => {
    setDeleteRole(role);
    setDeleteAlert(null);
    setShowDeleteModal(true);
  };

  const handleDelete = async () => {
    setDeleting(true);
    setDeleteAlert(null);
    try {
      await API.delete(`/api/roles/${deleteRole?.id}`);
      setDeleteAlert({
        type: "success",
        message: "Role deleted successfully.",
      });
      setTimeout(() => {
        setShowDeleteModal(false);
        setDeleteRole(null);
        setDeleteAlert(null);
        if (selectedRoleId === deleteRole?.id) setSelectedRoleId(null);
        refetch();
      }, 1200);
    } catch (err: any) {
      setDeleteAlert({
        type: "error",
        message: err.response?.data?.message || "Failed to delete role.",
      });
    } finally {
      setDeleting(false);
    }
  };

  // ─── Modal open/close body class ─────────────────────────────────────────
  const isAnyModalOpen = showCreateModal || showEditModal || showDeleteModal;
  useEffect(() => {
    if (isAnyModalOpen) {
      document.body.classList.add("modal-open");
    } else {
      document.body.classList.remove("modal-open");
    }
    return () => document.body.classList.remove("modal-open");
  }, [isAnyModalOpen]);

  return (
    <div>
      <PageMeta
        title="Roles & Permissions"
        description="Roles and permissions page"
      />
      <PageBreadcrumb pageTitle="Roles & Permissions" />

      <div className="mt-4 space-y-6">
        {/* ─── Top Bar ─────────────────────────────────────────────────────── */}
        <div className="flex justify-end">
          <button
            onClick={() => {
              setCreateName("");
              setCreateAlert(null);
              setShowCreateModal(true);
            }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition duration-150"
          >
            + Add Role
          </button>
        </div>

        {/* ─── Roles Table ─────────────────────────────────────────────────── */}
        {error && (
          <div className="mb-4">
            <Alert variant="error" title="Error" message={error} />
          </div>
        )}

        {loading && !error && (
          <div className="text-gray-500 dark:text-gray-400">
            Loading roles...
          </div>
        )}

        {!loading && !error && (
          <div className="overflow-x-auto rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 uppercase text-xs tracking-wider">
                <tr>
                  <th className="px-5 py-3">#</th>
                  <th className="px-5 py-3">Role Name</th>
                  <th className="px-5 py-3">Permissions</th>
                  <th className="px-5 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
                {roles && roles.length > 0 ? (
                  roles.map((role, index) => (
                    <tr
                      key={role.id}
                      className={`hover:bg-gray-50 dark:hover:bg-gray-800 transition duration-150 ${
                        selectedRoleId === role.id
                          ? "bg-blue-50 dark:bg-blue-900/20"
                          : ""
                      }`}
                    >
                      {/* ✅ Sequence Number */}
                      <td className="px-5 py-3 font-medium text-gray-900 dark:text-white">
                        {index + 1}
                      </td>

                      <td className="px-5 py-3 font-medium text-gray-900 dark:text-white">
                        {role.role_name}
                      </td>

                      {/* Permissions Button */}
                      <td className="px-5 py-3">
                        <button
                          onClick={() => setSelectedRoleId(role.id)}
                          className={`px-3 py-1 text-xs font-medium rounded-lg transition duration-150 ${
                            selectedRoleId === role.id
                              ? "bg-blue-600 text-white"
                              : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-blue-100 dark:hover:bg-blue-900/30"
                          }`}
                        >
                          {selectedRoleId === role.id
                            ? "Selected"
                            : "Set Permissions"}
                        </button>
                      </td>

                      {/* Edit / Delete */}
                      <td className="px-5 py-3 flex items-center gap-2">
                        <button
                          onClick={() => openEditModal(role)}
                          className="px-3 py-1 text-xs font-medium rounded-lg bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 hover:bg-yellow-200 transition duration-150"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => openDeleteModal(role)}
                          className="px-3 py-1 text-xs font-medium rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-200 transition duration-150"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="text-center py-5 text-gray-500">
                      No roles found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ─── Permissions Panel ────────────────────────────────────────────── */}
        {selectedRoleId !== null && (
  <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/60 backdrop-blur-md">
    <div className="relative w-full max-w-2xl mx-4 rounded-2xl border border-white/10 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)]">

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-gray-400/50 dark:border-gray-700/50">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Permissions
          <span className="ml-2 px-2 py-1 text-xs rounded-md bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300">
            {roles?.find((r) => r.id === selectedRoleId)?.role_name}
          </span>
        </h2>

        <button
          onClick={() => {
            setSelectedRoleId(null);
            setChecked([]);
            setPermAlert(null);
            setMenuAlert(null);
          }}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200/60 dark:hover:bg-gray-700/60 transition"
        >
          <span className="text-lg text-gray-500 hover:text-gray-800 dark:hover:text-white">
            ✕
          </span>
        </button>
      </div>

      {/* Alerts */}
      <div className="px-6 pt-4 space-y-3">
        {menuAlert && (
          <Alert
            variant="error"
            title="Menu Error"
            message={menuAlert}
          />
        )}

        {permAlert && (
          <Alert
            variant={permAlert.type}
            title={permAlert.type === "success" ? "Success" : "Error"}
            message={permAlert.message}
          />
        )}
      </div>

      {/* Content */}
      <div className="px-6 py-4">
        {loadingMenus || loadingPermissions ? (
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
          </div>
        ) : menus.length === 0 ? (
          <div className="text-center text-sm text-gray-500 dark:text-gray-400">
            No menus found.
            <button
              onClick={loadMenus}
              className="ml-2 text-blue-500 hover:text-blue-600 font-medium underline"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="max-h-[400px] overflow-y-auto rounded-lg border p-3 pr-2 bg-gray-50 text-gray-900 dark:bg-gray-800/40 dark:text-white dark:border-gray-700">
            <CheckboxTree
              nodes={menus}
              checked={checked}
              expanded={expanded}
              onCheck={(val) => setChecked(val as number[])}
              onExpand={(val) => setExpanded(val as number[])}
              icons={{
                check: <span className="text-blue-600">✔</span>,
                uncheck: <span className="text-gray-400">☐</span>,
                halfCheck: <span className="text-blue-400">▣</span>,
                expandClose: <span className="text-gray-500">▶</span>,
                expandOpen: <span className="text-gray-500">▼</span>,
                expandAll: <span />,
                collapseAll: <span />,
                parentClose: <span>📁</span>,
                parentOpen: <span>📂</span>,
                leaf: <span>📄</span>,
              }}
            />
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-400/50 dark:border-gray-700/50">
        <button
          onClick={() => setSelectedRoleId(null)}
          className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
        >
          Cancel
        </button>

        <button
          onClick={savePermissions}
          disabled={saving}
          className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg transition duration-150">
          {saving ? "Saving..." : "Save Permissions"}
        </button>
      </div>
    </div>
  </div>
)}
      </div>

      {/* ─── Create Role Modal ────────────────────────────────────────────────── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Add Role
              </h2>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setCreateName("");
                  setCreateAlert(null);
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl font-bold"
              >
                &times;
              </button>
            </div>

            {createAlert && (
              <div className="mb-4">
                <Alert
                  variant={createAlert.type}
                  title={createAlert.type === "success" ? "Success" : "Error"}
                  message={createAlert.message}
                />
              </div>
            )}

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Role Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="e.g. Manager"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setCreateName("");
                  setCreateAlert(null);
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 rounded-lg transition duration-150"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={creating}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg transition duration-150"
              >
                {creating ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Edit Role Modal ──────────────────────────────────────────────────── */}
      {showEditModal && (
        <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Edit Role
              </h2>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditRole(null);
                  setEditAlert(null);
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl font-bold"
              >
                &times;
              </button>
            </div>

            {editAlert && (
              <div className="mb-4">
                <Alert
                  variant={editAlert.type}
                  title={editAlert.type === "success" ? "Success" : "Error"}
                  message={editAlert.message}
                />
              </div>
            )}

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Role Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditRole(null);
                  setEditAlert(null);
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 rounded-lg transition duration-150"
              >
                Cancel
              </button>
              <button
                onClick={handleEdit}
                disabled={editing}
                className="px-4 py-2 text-sm font-medium text-white bg-yellow-500 hover:bg-yellow-600 disabled:opacity-60 rounded-lg transition duration-150"
              >
                {editing ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Delete Confirm Modal ─────────────────────────────────────────────── */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Delete Role
              </h2>
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteRole(null);
                  setDeleteAlert(null);
                }}
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

            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Are you sure you want to delete role{" "}
              <span className="font-semibold text-red-500">
                "{deleteRole?.role_name}"
              </span>
              ? This will also remove all its permissions. This action cannot be
              undone.
            </p>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteRole(null);
                  setDeleteAlert(null);
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 rounded-lg transition duration-150"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-60 rounded-lg transition duration-150"
              >
                {deleting ? "Deleting..." : "Yes, Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
