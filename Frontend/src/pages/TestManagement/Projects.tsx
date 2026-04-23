import { useState } from "react";
import { FaEdit, FaTrash } from "react-icons/fa";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import Alert from "../../components/ui/alert/Alert";
import useFetchWithAuth from "../../hooks/useFetchWithAuth";
import API from "../../services/api";

interface Project {
  id: number;
  project_name: string;
  description: string;
  is_active: boolean;
  created_by_name?: string;
  updated_by_name?: string;
  created_at?: string;
  updated_at?: string;
}

export default function Projects() {
  const {
    data: projects,
    loading,
    error,
  } = useFetchWithAuth<Project[]>("/api/projects");

  const [showModal, setShowModal] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [formData, setFormData] = useState({
    project_name: "",
    description: "",
    is_active: true,
  });
  const [submitting, setSubmitting] = useState(false);
  const [formAlert, setFormAlert] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingProject, setDeletingProject] = useState<Project | null>(null);
  const [deleteAlert, setDeleteAlert] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [linkedSuiteCount, setLinkedSuiteCount] = useState(0);
  const [deletingInProgress, setDeletingInProgress] = useState(false);

  const handleSave = async () => {
    if (!formData.project_name.trim()) {
      setFormAlert({ type: "error", message: "Project name is required." });
      return;
    }
    setSubmitting(true);
    setFormAlert(null);
    try {
      const token =
        localStorage.getItem("token") || sessionStorage.getItem("token");
      const url = editingProject
        ? `/api/projects/update/${editingProject.id}`
        : "/api/projects/create";
      const method = editingProject ? API.put : API.post;
      const res = await method(url, formData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data.success) {
        setFormAlert({
          type: "success",
          message: editingProject
            ? "Project updated successfully!"
            : "Project created successfully!",
        });
        setTimeout(() => {
          handleCloseModal();
          window.location.reload();
        }, 1200);
      }
    } catch (err: any) {
      setFormAlert({
        type: "error",
        message: err.response?.data?.message || "Operation failed.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (project: Project) => {
    setEditingProject(project);
    setFormData({
      project_name: project.project_name,
      description: project.description || "",
      is_active: project.is_active,
    });
    setShowModal(true);
  };

  const handleDeleteClick = async (project: Project) => {
    setDeletingProject(project);
    setDeleteAlert(null);
    setLinkedSuiteCount(0);
    try {
      const token =
        localStorage.getItem("token") || sessionStorage.getItem("token");
      const res = await API.get(`/api/projects/${project.id}/suite-count`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data.success) setLinkedSuiteCount(res.data.count ?? 0);
    } catch {
      setLinkedSuiteCount(0);
    }
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingProject) return;
    setDeletingInProgress(true);
    setDeleteAlert(null);
    try {
      const token =
        localStorage.getItem("token") || sessionStorage.getItem("token");
      await API.delete(`/api/projects/delete/${deletingProject.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setDeleteAlert({ type: "success", message: "Project deleted successfully." });
      setTimeout(() => {
        setShowDeleteModal(false);
        setDeletingProject(null);
        window.location.reload();
      }, 1200);
    } catch (err: any) {
      setDeleteAlert({
        type: "error",
        message: err.response?.data?.message || "Failed to delete project.",
      });
    } finally {
      setDeletingInProgress(false);
    }
  };

  const handleToggleStatus = async (project: Project) => {
    try {
      const token =
        localStorage.getItem("token") || sessionStorage.getItem("token");
      await API.put(
        `/api/projects/toggle/${project.id}`,
        { is_active: !project.is_active },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      window.location.reload();
    } catch {}
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingProject(null);
    setFormData({ project_name: "", description: "", is_active: true });
    setFormAlert(null);
  };

  const handleCloseDeleteModal = () => {
    setShowDeleteModal(false);
    setDeletingProject(null);
    setDeleteAlert(null);
    setLinkedSuiteCount(0);
  };

  return (
    <div>
      <PageMeta title="Projects" description="Projects page" />
      <PageBreadcrumb pageTitle="Projects" />

      <div className="mt-4">
        <div className="flex justify-end mb-4">
          <button
            onClick={() => { setEditingProject(null); setShowModal(true); }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition duration-150"
          >
            + Create Project
          </button>
        </div>

        {error && (
          <div className="mb-4">
            <Alert variant="error" title="Error" message={error} />
          </div>
        )}

        {loading && !error && (
          <div className="text-gray-500 dark:text-gray-400">Loading projects...</div>
        )}

        {!loading && !error && (
          <div className="overflow-x-auto rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 uppercase text-xs tracking-wider">
                <tr>
                  <th className="px-5 py-3">#</th>
                  <th className="px-5 py-3">Project Name</th>
                  <th className="px-5 py-3">Description</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Active</th>
                  <th className="px-5 py-3">Created By</th>
                  <th className="px-5 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200">
                {projects && projects.length > 0 ? (
                  projects.map((project, index) => (
                    <tr key={project.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition duration-150">
                      <td className="px-5 py-3">{index + 1}</td>
                      <td className="px-5 py-3 font-medium">{project.project_name}</td>
                      <td className="px-5 py-3 text-gray-500 dark:text-gray-400 max-w-xs truncate">
                        {project.description || "—"}
                      </td>
                      <td className="px-5 py-3">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          project.is_active
                            ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                            : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                        }`}>
                          {project.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <button
                          onClick={() => handleToggleStatus(project)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none ${
                            project.is_active ? "bg-blue-600" : "bg-gray-300 dark:bg-gray-600"
                          }`}
                        >
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${
                            project.is_active ? "translate-x-6" : "translate-x-1"
                          }`} />
                        </button>
                      </td>
                      <td className="px-5 py-3 text-gray-500 dark:text-gray-400">
                        {project.created_by_name || "—"}
                      </td>
                      <td className="px-5 py-3 flex gap-3 items-center">
                        <FaEdit className="cursor-pointer text-blue-600" onClick={() => handleEdit(project)} />
                        <FaTrash className="cursor-pointer text-red-600" onClick={() => handleDeleteClick(project)} />
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="text-center py-5 text-gray-500">No projects found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE / EDIT MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingProject ? "Edit Project" : "Create Project"}
              </h2>
              <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl font-bold">&times;</button>
            </div>

            {formAlert && (
              <div className="mb-4">
                <Alert variant={formAlert.type} title={formAlert.type === "success" ? "Success" : "Error"} message={formAlert.message} />
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Project Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.project_name}
                onChange={(e) => setFormData({ ...formData, project_name: e.target.value })}
                placeholder="e.g. E-Commerce Platform"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description..."
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            <div className="mb-6 flex items-center gap-3">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Active</span>
              <button
                onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full ${
                  formData.is_active ? "bg-blue-600" : "bg-gray-300 dark:bg-gray-600"
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white ${
                  formData.is_active ? "translate-x-6" : "translate-x-1"
                }`} />
              </button>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {formData.is_active ? "Active" : "Inactive"}
              </span>
            </div>

            <div className="flex justify-end gap-3">
              <button onClick={handleCloseModal} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 rounded-lg transition duration-150">
                Cancel
              </button>
              <button onClick={handleSave} disabled={submitting} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg transition duration-150">
                {submitting ? (editingProject ? "Updating..." : "Creating...") : (editingProject ? "Update" : "Create")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE MODAL */}
      {showDeleteModal && deletingProject && (
        <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Delete Project</h2>
              <button onClick={handleCloseDeleteModal} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl font-bold">&times;</button>
            </div>

            {deleteAlert && (
              <div className="mb-4">
                <Alert variant={deleteAlert.type} title={deleteAlert.type === "success" ? "Success" : "Error"} message={deleteAlert.message} />
              </div>
            )}

            <div className="flex items-start gap-3 mb-4">
              <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full bg-red-100 dark:bg-red-900">
                <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  Are you sure you want to delete project{" "}
                  <span className="font-semibold text-gray-900 dark:text-white">{deletingProject.project_name}</span>?
                  This cannot be undone.
                </p>
                {linkedSuiteCount > 0 && (
                  <div className="mt-3 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700">
                    <p className="text-sm text-yellow-800 dark:text-yellow-300 font-medium">
                      ⚠️ {linkedSuiteCount} test suite{linkedSuiteCount > 1 ? "s are" : " is"} linked to this project.
                    </p>
                    <p className="text-xs text-yellow-700 dark:text-yellow-400 mt-1">
                      Please remove all linked suites before deleting this project.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button onClick={handleCloseDeleteModal} disabled={deletingInProgress} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 rounded-lg transition duration-150">
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deletingInProgress || linkedSuiteCount > 0}
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