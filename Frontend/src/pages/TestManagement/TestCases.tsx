import { useState } from "react";
import { FaEdit, FaTrash, FaEye, FaPlus } from "react-icons/fa";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import Alert from "../../components/ui/alert/Alert";
import useFetchWithAuth from "../../hooks/useFetchWithAuth";
import API from "../../services/api";

interface Project { id: number; project_name: string; }
interface TestSuite { id: number; suite_name: string; project_id: number; project_name?: string; }
interface TestStep { step_number: number; action: string; expected_result: string; }

interface TestCase {
  id: number;
  suite_id: number;
  title: string;
  preconditions: string;
  priority: "Low" | "Medium" | "High" | "Critical";
  status: "Draft" | "Ready" | "Deprecated";
  suite_name?: string;
  project_name?: string;
  created_by_name?: string;
  updated_by_name?: string;
  created_at?: string;
  updated_at?: string;
  steps?: TestStep[];
}

const PRIORITY_COLORS: Record<string, string> = {
  Low: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
  Medium: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  High: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  Critical: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
};

const STATUS_COLORS: Record<string, string> = {
  Draft: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  Ready: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  Deprecated: "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400",
};

const emptyStep = (): TestStep => ({ step_number: 1, action: "", expected_result: "" });

export default function TestCases() {
  const { data: testCases, loading, error } = useFetchWithAuth<TestCase[]>("/api/test-cases");
  const { data: projects } = useFetchWithAuth<Project[]>("/api/projects");
  const { data: allSuites } = useFetchWithAuth<TestSuite[]>("/api/test-suites");

  const [showModal, setShowModal] = useState(false);
  const [editingCase, setEditingCase] = useState<TestCase | null>(null);
  const [formData, setFormData] = useState({
    suite_id: "",
    title: "",
    preconditions: "",
    priority: "Medium" as TestCase["priority"],
    status: "Draft" as TestCase["status"],
  });
  const [steps, setSteps] = useState<TestStep[]>([emptyStep()]);
  const [selectedProjectFilter, setSelectedProjectFilter] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formAlert, setFormAlert] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // View modal
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewingCase, setViewingCase] = useState<TestCase | null>(null);
  const [viewLoading, setViewLoading] = useState(false);

  // Delete modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingCase, setDeletingCase] = useState<TestCase | null>(null);
  const [deleteAlert, setDeleteAlert] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [deletingInProgress, setDeletingInProgress] = useState(false);

  // Filtered suites based on selected project in form
  const filteredSuites = allSuites?.filter((s) =>
    selectedProjectFilter ? String(s.project_id) === selectedProjectFilter : true
  );

  // Steps management
  const handleAddStep = () => {
    setSteps((prev) => [
      ...prev,
      { step_number: prev.length + 1, action: "", expected_result: "" },
    ]);
  };

  const handleRemoveStep = (index: number) => {
    setSteps((prev) =>
      prev
        .filter((_, i) => i !== index)
        .map((s, i) => ({ ...s, step_number: i + 1 }))
    );
  };

  const handleStepChange = (index: number, field: keyof TestStep, value: string) => {
    setSteps((prev) =>
      prev.map((s, i) => (i === index ? { ...s, [field]: value } : s))
    );
  };

  const handleSave = async () => {
    if (!formData.title.trim()) {
      setFormAlert({ type: "error", message: "Title is required." });
      return;
    }
    if (!formData.suite_id) {
      setFormAlert({ type: "error", message: "Please select a suite." });
      return;
    }
    const invalidStep = steps.find((s) => !s.action.trim());
    if (invalidStep) {
      setFormAlert({ type: "error", message: "All steps must have an action." });
      return;
    }

    setSubmitting(true);
    setFormAlert(null);
    try {
      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      const payload = { ...formData, steps };
      const url = editingCase ? `/api/test-cases/update/${editingCase.id}` : "/api/test-cases/create";
      const method = editingCase ? API.put : API.post;
      const res = await method(url, payload, { headers: { Authorization: `Bearer ${token}` } });
      if (res.data.success) {
        setFormAlert({ type: "success", message: editingCase ? "Test case updated!" : "Test case created!" });
        setTimeout(() => { handleCloseModal(); window.location.reload(); }, 1200);
      }
    } catch (err: any) {
      setFormAlert({ type: "error", message: err.response?.data?.message || "Operation failed." });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async (tc: TestCase) => {
    try {
      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      const res = await API.get(`/api/test-cases/${tc.id}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.data.success) {
        const full: TestCase = res.data.data;
        setEditingCase(full);
        const suite = allSuites?.find((s) => s.id === full.suite_id);
        setSelectedProjectFilter(suite ? String(suite.project_id) : "");
        setFormData({
          suite_id: String(full.suite_id),
          title: full.title,
          preconditions: full.preconditions || "",
          priority: full.priority,
          status: full.status,
        });
        setSteps(full.steps && full.steps.length > 0 ? full.steps : [emptyStep()]);
        setShowModal(true);
      }
    } catch {
      setEditingCase(tc);
      setFormData({
        suite_id: String(tc.suite_id),
        title: tc.title,
        preconditions: tc.preconditions || "",
        priority: tc.priority,
        status: tc.status,
      });
      setSteps([emptyStep()]);
      setShowModal(true);
    }
  };

  const handleView = async (tc: TestCase) => {
    setViewLoading(true);
    setShowViewModal(true);
    try {
      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      const res = await API.get(`/api/test-cases/${tc.id}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.data.success) setViewingCase(res.data.data);
    } catch { setViewingCase(tc); }
    finally { setViewLoading(false); }
  };

  const handleDeleteClick = (tc: TestCase) => {
    setDeletingCase(tc);
    setDeleteAlert(null);
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingCase) return;
    setDeletingInProgress(true);
    setDeleteAlert(null);
    try {
      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      await API.delete(`/api/test-cases/delete/${deletingCase.id}`, { headers: { Authorization: `Bearer ${token}` } });
      setDeleteAlert({ type: "success", message: "Test case deleted successfully." });
      setTimeout(() => { setShowDeleteModal(false); setDeletingCase(null); window.location.reload(); }, 1200);
    } catch (err: any) {
      setDeleteAlert({ type: "error", message: err.response?.data?.message || "Failed to delete test case." });
    } finally {
      setDeletingInProgress(false);
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingCase(null);
    setFormData({ suite_id: "", title: "", preconditions: "", priority: "Medium", status: "Draft" });
    setSteps([emptyStep()]);
    setSelectedProjectFilter("");
    setFormAlert(null);
  };

  return (
    <div>
      <PageMeta title="Test Cases" description="Test Cases page" />
      <PageBreadcrumb pageTitle="Test Cases" />

      <div className="mt-4">
        <div className="flex justify-end mb-4">
          <button
            onClick={() => { setEditingCase(null); setShowModal(true); }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition duration-150"
          >
            + Create Test Case
          </button>
        </div>

        {error && <div className="mb-4"><Alert variant="error" title="Error" message={error} /></div>}
        {loading && !error && <div className="text-gray-500 dark:text-gray-400">Loading test cases...</div>}

        {!loading && !error && (
          <div className="overflow-x-auto rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 uppercase text-xs tracking-wider">
                <tr>
                  <th className="px-5 py-3">#</th>
                  <th className="px-5 py-3">Title</th>
                  <th className="px-5 py-3">Suite</th>
                  <th className="px-5 py-3">Project</th>
                  <th className="px-5 py-3">Priority</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Created By</th>
                  <th className="px-5 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200">
                {testCases && testCases.length > 0 ? (
                  testCases.map((tc, index) => (
                    <tr key={tc.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition duration-150">
                      <td className="px-5 py-3">{index + 1}</td>
                      <td className="px-5 py-3 font-medium max-w-xs truncate">{tc.title}</td>
                      <td className="px-5 py-3">
                        <span className="px-2 py-1 text-xs rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">
                          {tc.suite_name || "—"}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                          {tc.project_name || "—"}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${PRIORITY_COLORS[tc.priority] || ""}`}>
                          {tc.priority}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${STATUS_COLORS[tc.status] || ""}`}>
                          {tc.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-gray-500 dark:text-gray-400">{tc.created_by_name || "—"}</td>
                      <td className="px-5 py-3 flex gap-3 items-center">
                        <FaEye className="cursor-pointer text-gray-500 hover:text-gray-700 dark:hover:text-gray-300" onClick={() => handleView(tc)} />
                        <FaEdit className="cursor-pointer text-blue-600" onClick={() => handleEdit(tc)} />
                        <FaTrash className="cursor-pointer text-red-600" onClick={() => handleDeleteClick(tc)} />
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={8} className="text-center py-5 text-gray-500">No test cases found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE / EDIT MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingCase ? "Edit Test Case" : "Create Test Case"}
              </h2>
              <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl font-bold">&times;</button>
            </div>

            {formAlert && (
              <div className="mb-4">
                <Alert variant={formAlert.type} title={formAlert.type === "success" ? "Success" : "Error"} message={formAlert.message} />
              </div>
            )}

            {/* Project filter (not saved, just filters suite dropdown) */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Filter by Project</label>
              <select
                value={selectedProjectFilter}
                onChange={(e) => {
                  setSelectedProjectFilter(e.target.value);
                  setFormData((prev) => ({ ...prev, suite_id: "" }));
                }}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- All Projects --</option>
                {projects?.map((p) => <option key={p.id} value={p.id}>{p.project_name}</option>)}
              </select>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Suite <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.suite_id}
                onChange={(e) => setFormData({ ...formData, suite_id: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Select Suite --</option>
                {filteredSuites?.map((s) => <option key={s.id} value={s.id}>{s.suite_name}</option>)}
              </select>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g. Verify login with valid credentials"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Preconditions</label>
              <textarea
                value={formData.preconditions}
                onChange={(e) => setFormData({ ...formData, preconditions: e.target.value })}
                placeholder="e.g. User must be registered"
                rows={2}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Priority</label>
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value as TestCase["priority"] })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {["Low", "Medium", "High", "Critical"].map((p) => <option key={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as TestCase["status"] })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {["Draft", "Ready", "Deprecated"].map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>

            {/* Test Steps */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Test Steps</label>
                <button
                  onClick={handleAddStep}
                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
                >
                  <FaPlus className="w-3 h-3" /> Add Step
                </button>
              </div>

              <div className="space-y-3">
                {steps.map((step, index) => (
                  <div key={index} className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Step {index + 1}</span>
                      {steps.length > 1 && (
                        <button
                          onClick={() => handleRemoveStep(index)}
                          className="text-xs text-red-500 hover:text-red-700"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      value={step.action}
                      onChange={(e) => handleStepChange(index, "action", e.target.value)}
                      placeholder="Action *"
                      className="w-full mb-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="text"
                      value={step.expected_result}
                      onChange={(e) => handleStepChange(index, "expected_result", e.target.value)}
                      placeholder="Expected Result"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button onClick={handleCloseModal} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 rounded-lg transition duration-150">Cancel</button>
              <button onClick={handleSave} disabled={submitting} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg transition duration-150">
                {submitting ? (editingCase ? "Updating..." : "Creating...") : (editingCase ? "Update" : "Create")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW MODAL */}
      {showViewModal && (
        <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">View Test Case</h2>
              <button onClick={() => { setShowViewModal(false); setViewingCase(null); }} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl font-bold">&times;</button>
            </div>

            {viewLoading && <div className="text-gray-500 dark:text-gray-400 text-sm">Loading...</div>}

            {!viewLoading && viewingCase && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Title</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{viewingCase.title}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Suite</p>
                    <p className="text-sm text-gray-700 dark:text-gray-300">{viewingCase.suite_name || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Project</p>
                    <p className="text-sm text-gray-700 dark:text-gray-300">{viewingCase.project_name || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Priority</p>
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${PRIORITY_COLORS[viewingCase.priority]}`}>
                      {viewingCase.priority}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Status</p>
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${STATUS_COLORS[viewingCase.status]}`}>
                      {viewingCase.status}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Created By</p>
                    <p className="text-sm text-gray-700 dark:text-gray-300">{viewingCase.created_by_name || "—"}</p>
                  </div>
                </div>

                {viewingCase.preconditions && (
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Preconditions</p>
                    <p className="text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                      {viewingCase.preconditions}
                    </p>
                  </div>
                )}

                {viewingCase.steps && viewingCase.steps.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Test Steps</p>
                    <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-xs uppercase">
                          <tr>
                            <th className="px-4 py-2 text-left w-12">#</th>
                            <th className="px-4 py-2 text-left">Action</th>
                            <th className="px-4 py-2 text-left">Expected Result</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
                          {viewingCase.steps.map((step) => (
                            <tr key={step.step_number}>
                              <td className="px-4 py-2 text-gray-500 dark:text-gray-400">{step.step_number}</td>
                              <td className="px-4 py-2 text-gray-700 dark:text-gray-300">{step.action}</td>
                              <td className="px-4 py-2 text-gray-500 dark:text-gray-400">{step.expected_result || "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-200 dark:border-gray-700">
                  <div>
                    <p className="text-xs text-gray-400 dark:text-gray-500">Last Updated By</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">{viewingCase.updated_by_name || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 dark:text-gray-500">Last Updated At</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      {viewingCase.updated_at ? new Date(viewingCase.updated_at).toLocaleString() : "—"}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* DELETE MODAL */}
      {showDeleteModal && deletingCase && (
        <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Delete Test Case</h2>
              <button onClick={() => { setShowDeleteModal(false); setDeletingCase(null); setDeleteAlert(null); }} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl font-bold">&times;</button>
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
              <p className="text-sm text-gray-700 dark:text-gray-300">
                Are you sure you want to delete test case{" "}
                <span className="font-semibold text-gray-900 dark:text-white">"{deletingCase.title}"</span>?
                All steps will also be permanently removed.
              </p>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => { setShowDeleteModal(false); setDeletingCase(null); setDeleteAlert(null); }} disabled={deletingInProgress} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 rounded-lg transition duration-150">Cancel</button>
              <button onClick={handleConfirmDelete} disabled={deletingInProgress} className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-60 rounded-lg transition duration-150">
                {deletingInProgress ? "Deleting..." : "Yes, Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}