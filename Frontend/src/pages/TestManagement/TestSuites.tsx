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
}

interface TestSuite {
  id: number;
  project_id: number;
  suite_name: string;
  description: string;
  is_active: boolean;
  project_name?: string;
  created_by_name?: string;
  updated_by_name?: string;
  created_at?: string;
}

export default function TestSuites() {
  const { data: suites, loading, error } = useFetchWithAuth<TestSuite[]>("/api/test-suites");
  const { data: projects } = useFetchWithAuth<Project[]>("/api/projects");

  const [showModal, setShowModal] = useState(false);
  const [editingSuite, setEditingSuite] = useState<TestSuite | null>(null);
  const [formData, setFormData] = useState({
    project_id: "",
    suite_name: "",
    description: "",
    is_active: true,
  });
  const [submitting, setSubmitting] = useState(false);
  const [formAlert, setFormAlert] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingSuite, setDeletingSuite] = useState<TestSuite | null>(null);
  const [deleteAlert, setDeleteAlert] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [linkedCaseCount, setLinkedCaseCount] = useState(0);
  const [deletingInProgress, setDeletingInProgress] = useState(false);

  const handleSave = async () => {
    if (!formData.suite_name.trim()) {
      setFormAlert({ type: "error", message: "Suite name is required." });
      return;
    }
    if (!formData.project_id) {
      setFormAlert({ type: "error", message: "Please select a project." });
      return;
    }
    setSubmitting(true);
    setFormAlert(null);
    try {
      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      const url = editingSuite ? `/api/test-suites/update/${editingSuite.id}` : "/api/test-suites/create";
      const method = editingSuite ? API.put : API.post;
      const res = await method(url, formData, { headers: { Authorization: `Bearer ${token}` } });
      if (res.data.success) {
        setFormAlert({ type: "success", message: editingSuite ? "Suite updated successfully!" : "Suite created successfully!" });
        setTimeout(() => { handleCloseModal(); window.location.reload(); }, 1200);
      }
    } catch (err: any) {
      setFormAlert({ type: "error", message: err.response?.data?.message || "Operation failed." });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (suite: TestSuite) => {
    setEditingSuite(suite);
    setFormData({
      project_id: String(suite.project_id),
      suite_name: suite.suite_name,
      description: suite.description || "",
      is_active: suite.is_active,
    });
    setShowModal(true);
  };

  const handleDeleteClick = async (suite: TestSuite) => {
    setDeletingSuite(suite);
    setDeleteAlert(null);
    setLinkedCaseCount(0);
    try {
      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      const res = await API.get(`/api/test-suites/${suite.id}/case-count`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.data.success) setLinkedCaseCount(res.data.count ?? 0);
    } catch { setLinkedCaseCount(0); }
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingSuite) return;
    setDeletingInProgress(true);
    setDeleteAlert(null);
    try {
      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      await API.delete(`/api/test-suites/delete/${deletingSuite.id}`, { headers: { Authorization: `Bearer ${token}` } });
      setDeleteAlert({ type: "success", message: "Suite deleted successfully." });
      setTimeout(() => { setShowDeleteModal(false); setDeletingSuite(null); window.location.reload(); }, 1200);
    } catch (err: any) {
      setDeleteAlert({ type: "error", message: err.response?.data?.message || "Failed to delete suite." });
    } finally {
      setDeletingInProgress(false);
    }
  };

  const handleToggleStatus = async (suite: TestSuite) => {
    try {
      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      await API.put(`/api/test-suites/toggle/${suite.id}`, { is_active: !suite.is_active }, { headers: { Authorization: `Bearer ${token}` } });
      window.location.reload();
    } catch {}
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingSuite(null);
    setFormData({ project_id: "", suite_name: "", description: "", is_active: true });
    setFormAlert(null);
  };

  const handleCloseDeleteModal = () => {
    setShowDeleteModal(false);
    setDeletingSuite(null);
    setDeleteAlert(null);
    setLinkedCaseCount(0);
  };

  return (
    <div>
      <PageMeta title="Test Suites" description="Test Suites page" />
      <PageBreadcrumb pageTitle="Test Suites" />

      <div className="mt-4">
        <div className="flex justify-end mb-4">
          <button
            onClick={() => { setEditingSuite(null); setShowModal(true); }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition duration-150"
          >
            + Create Suite
          </button>
        </div>

        {error && <div className="mb-4"><Alert variant="error" title="Error" message={error} /></div>}
        {loading && !error && <div className="text-gray-500 dark:text-gray-400">Loading test suites...</div>}

        {!loading && !error && (
          <div className="overflow-x-auto rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 uppercase text-xs tracking-wider">
                <tr>
                  <th className="px-5 py-3">#</th>
                  <th className="px-5 py-3">Suite Name</th>
                  <th className="px-5 py-3">Project</th>
                  <th className="px-5 py-3">Description</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Active</th>
                  <th className="px-5 py-3">Created By</th>
                  <th className="px-5 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200">
                {suites && suites.length > 0 ? (
                  suites.map((suite, index) => (
                    <tr key={suite.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition duration-150">
                      <td className="px-5 py-3">{index + 1}</td>
                      <td className="px-5 py-3 font-medium">{suite.suite_name}</td>
                      <td className="px-5 py-3">
                        <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                          {suite.project_name || "—"}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-gray-500 dark:text-gray-400 max-w-xs truncate">{suite.description || "—"}</td>
                      <td className="px-5 py-3">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          suite.is_active
                            ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                            : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                        }`}>
                          {suite.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <button
                          onClick={() => handleToggleStatus(suite)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none ${
                            suite.is_active ? "bg-blue-600" : "bg-gray-300 dark:bg-gray-600"
                          }`}
                        >
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${
                            suite.is_active ? "translate-x-6" : "translate-x-1"
                          }`} />
                        </button>
                      </td>
                      <td className="px-5 py-3 text-gray-500 dark:text-gray-400">{suite.created_by_name || "—"}</td>
                      <td className="px-5 py-3 flex gap-3 items-center">
                        <FaEdit className="cursor-pointer text-blue-600" onClick={() => handleEdit(suite)} />
                        <FaTrash className="cursor-pointer text-red-600" onClick={() => handleDeleteClick(suite)} />
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={8} className="text-center py-5 text-gray-500">No test suites found</td></tr>
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
                {editingSuite ? "Edit Suite" : "Create Suite"}
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
                Project <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.project_id}
                onChange={(e) => setFormData({ ...formData, project_id: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Select Project --</option>
                {projects?.map((p) => (
                  <option key={p.id} value={p.id}>{p.project_name}</option>
                ))}
              </select>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Suite Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.suite_name}
                onChange={(e) => setFormData({ ...formData, suite_name: e.target.value })}
                placeholder="e.g. Authentication Tests"
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
                className={`relative inline-flex h-6 w-11 items-center rounded-full ${formData.is_active ? "bg-blue-600" : "bg-gray-300 dark:bg-gray-600"}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white ${formData.is_active ? "translate-x-6" : "translate-x-1"}`} />
              </button>
              <span className="text-sm text-gray-500 dark:text-gray-400">{formData.is_active ? "Active" : "Inactive"}</span>
            </div>

            <div className="flex justify-end gap-3">
              <button onClick={handleCloseModal} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 rounded-lg transition duration-150">Cancel</button>
              <button onClick={handleSave} disabled={submitting} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg transition duration-150">
                {submitting ? (editingSuite ? "Updating..." : "Creating...") : (editingSuite ? "Update" : "Create")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE MODAL */}
      {showDeleteModal && deletingSuite && (
        <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Delete Suite</h2>
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
                  Are you sure you want to delete suite{" "}
                  <span className="font-semibold text-gray-900 dark:text-white">{deletingSuite.suite_name}</span>? This cannot be undone.
                </p>
                {linkedCaseCount > 0 && (
                  <div className="mt-3 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700">
                    <p className="text-sm text-yellow-800 dark:text-yellow-300 font-medium">
                      ⚠️ {linkedCaseCount} test case{linkedCaseCount > 1 ? "s are" : " is"} linked to this suite.
                    </p>
                    <p className="text-xs text-yellow-700 dark:text-yellow-400 mt-1">
                      Please remove all linked test cases before deleting this suite.
                    </p>
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={handleCloseDeleteModal} disabled={deletingInProgress} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 rounded-lg transition duration-150">Cancel</button>
              <button
                onClick={handleConfirmDelete}
                disabled={deletingInProgress || linkedCaseCount > 0}
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