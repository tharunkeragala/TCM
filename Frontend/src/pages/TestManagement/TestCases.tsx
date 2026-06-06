import { useMemo, useState } from "react";
import { Link } from "react-router";
import {
  FaEdit,
  FaTrash,
  FaEye,
  FaPlus,
  FaCode,
  FaPlay,
  FaVideo,
  FaSearch,
  FaTimes,
} from "react-icons/fa";
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
  playwright_script?: string;
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

  // Filters
  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [suiteFilter, setSuiteFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [scriptFilter, setScriptFilter] = useState<"" | "yes" | "no">("");

  // Modals
  const [showModal, setShowModal] = useState(false);
  const [editingCase, setEditingCase] = useState<TestCase | null>(null);
  const [formData, setFormData] = useState({ suite_id: "", title: "", preconditions: "", priority: "Medium" as TestCase["priority"], status: "Draft" as TestCase["status"], playwright_script: "" });
  const [steps, setSteps] = useState<TestStep[]>([emptyStep()]);
  const [selectedProjectFilter, setSelectedProjectFilter] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formAlert, setFormAlert] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingCase, setDeletingCase] = useState<TestCase | null>(null);
  const [deleteAlert, setDeleteAlert] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [deletingInProgress, setDeletingInProgress] = useState(false);

  const getToken = () => localStorage.getItem("token") || sessionStorage.getItem("token");

  const filteredSuites = allSuites?.filter((s) => selectedProjectFilter ? String(s.project_id) === selectedProjectFilter : true);

  const filteredCases = useMemo(() => {
    const q = search.toLowerCase();
    return (testCases || []).filter((tc) => {
      const matchText = !q || `${tc.title} ${tc.suite_name || ""} ${tc.project_name || ""} ${tc.created_by_name || ""}`.toLowerCase().includes(q);
      const matchProject = !projectFilter || tc.project_name === projectFilter;
      const matchSuite = !suiteFilter || String(tc.suite_id) === suiteFilter;
      const matchPriority = !priorityFilter || tc.priority === priorityFilter;
      const matchStatus = !statusFilter || tc.status === statusFilter;
      const matchScript = !scriptFilter || (scriptFilter === "yes" ? !!tc.playwright_script : !tc.playwright_script);
      return matchText && matchProject && matchSuite && matchPriority && matchStatus && matchScript;
    });
  }, [testCases, search, projectFilter, suiteFilter, priorityFilter, statusFilter, scriptFilter]);

  const hasFilters = search || projectFilter || suiteFilter || priorityFilter || statusFilter || scriptFilter;

  const clearFilters = () => { setSearch(""); setProjectFilter(""); setSuiteFilter(""); setPriorityFilter(""); setStatusFilter(""); setScriptFilter(""); };

  const handleAddStep = () => setSteps((prev) => [...prev, { step_number: prev.length + 1, action: "", expected_result: "" }]);
  const handleRemoveStep = (i: number) => setSteps((prev) => prev.filter((_, idx) => idx !== i).map((s, idx) => ({ ...s, step_number: idx + 1 })));
  const handleStepChange = (i: number, field: keyof TestStep, value: string) => setSteps((prev) => prev.map((s, idx) => idx === i ? { ...s, [field]: value } : s));

  const handleSave = async () => {
    if (!formData.title.trim()) { setFormAlert({ type: "error", message: "Title is required." }); return; }
    if (!formData.suite_id) { setFormAlert({ type: "error", message: "Please select a suite." }); return; }
    const invalidStep = steps.find((s) => !s.action.trim());
    if (invalidStep) { setFormAlert({ type: "error", message: "All steps must have an action." }); return; }
    setSubmitting(true); setFormAlert(null);
    try {
      const payload = { ...formData, steps };
      const url = editingCase ? `/api/test-cases/update/${editingCase.id}` : "/api/test-cases/create";
      const method = editingCase ? API.put : API.post;
      const res = await method(url, payload, { headers: { Authorization: `Bearer ${getToken()}` } });
      if (res.data.success) {
        setFormAlert({ type: "success", message: editingCase ? "Test case updated!" : "Test case created!" });
        setTimeout(() => { handleCloseModal(); window.location.reload(); }, 1200);
      }
    } catch (err: any) {
      setFormAlert({ type: "error", message: err.response?.data?.message || "Operation failed." });
    } finally { setSubmitting(false); }
  };

  const handleEdit = async (tc: TestCase) => {
    try {
      const res = await API.get(`/api/test-cases/${tc.id}`, { headers: { Authorization: `Bearer ${getToken()}` } });
      if (res.data.success) {
        const full: TestCase = res.data.data;
        setEditingCase(full);
        const suite = allSuites?.find((s) => s.id === full.suite_id);
        setSelectedProjectFilter(suite ? String(suite.project_id) : "");
        setFormData({ suite_id: String(full.suite_id), title: full.title, preconditions: full.preconditions || "", priority: full.priority, status: full.status, playwright_script: full.playwright_script || "" });
        setSteps(full.steps && full.steps.length > 0 ? full.steps : [emptyStep()]);
        setShowModal(true);
      }
    } catch {
      setEditingCase(tc);
      setFormData({ suite_id: String(tc.suite_id), title: tc.title, preconditions: tc.preconditions || "", priority: tc.priority, status: tc.status, playwright_script: tc.playwright_script || "" });
      setSteps([emptyStep()]);
      setShowModal(true);
    }
  };

  const handleDeleteClick = (tc: TestCase) => { setDeletingCase(tc); setDeleteAlert(null); setShowDeleteModal(true); };

  const handleConfirmDelete = async () => {
    if (!deletingCase) return;
    setDeletingInProgress(true); setDeleteAlert(null);
    try {
      await API.delete(`/api/test-cases/delete/${deletingCase.id}`, { headers: { Authorization: `Bearer ${getToken()}` } });
      setDeleteAlert({ type: "success", message: "Test case deleted." });
      setTimeout(() => { setShowDeleteModal(false); setDeletingCase(null); window.location.reload(); }, 1200);
    } catch (err: any) {
      setDeleteAlert({ type: "error", message: err.response?.data?.message || "Failed to delete." });
    } finally { setDeletingInProgress(false); }
  };

  const handleCloseModal = () => {
    setShowModal(false); setEditingCase(null);
    setFormData({ suite_id: "", title: "", preconditions: "", priority: "Medium", status: "Draft", playwright_script: "" });
    setSteps([emptyStep()]); setSelectedProjectFilter(""); setFormAlert(null);
  };

  // Project names for filter dropdown
  const projectNames = useMemo(() => [...new Set((testCases || []).map((tc) => tc.project_name).filter(Boolean))], [testCases]);

  return (
    <div>
      <PageMeta title="Test Cases" description="Test Cases" />
      <PageBreadcrumb pageTitle="Test Cases" />

      <div className="mt-4">
        {/* Toolbar */}
        <div className="mb-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-[220px]">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search test cases…"
                className="w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              />
            </div>

            {/* Filters */}
            <select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300">
              <option value="">All Projects</option>
              {projectNames.map((p) => <option key={p}>{p}</option>)}
            </select>

            <select value={suiteFilter} onChange={(e) => setSuiteFilter(e.target.value)} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300">
              <option value="">All Suites</option>
              {(allSuites || []).map((s) => <option key={s.id} value={s.id}>{s.suite_name}</option>)}
            </select>

            <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300">
              <option value="">All Priority</option>
              {["Low", "Medium", "High", "Critical"].map((p) => <option key={p}>{p}</option>)}
            </select>

            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300">
              <option value="">All Status</option>
              {["Draft", "Ready", "Deprecated"].map((s) => <option key={s}>{s}</option>)}
            </select>

            <select value={scriptFilter} onChange={(e) => setScriptFilter(e.target.value as any)} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300">
              <option value="">All Scripts</option>
              <option value="yes">Has Script</option>
              <option value="no">No Script</option>
            </select>

            {hasFilters && (
              <button onClick={clearFilters} className="inline-flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400">
                <FaTimes className="h-3 w-3" /> Clear
              </button>
            )}

            <div className="ml-auto flex items-center gap-2">
              <Link to="/playwright/recorder" className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-3 py-2 text-sm font-medium text-white hover:bg-purple-700">
                <FaVideo className="h-3.5 w-3.5" /> Record
              </Link>
              <Link to="/playwright/runner" className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700">
                <FaPlay className="h-3.5 w-3.5" /> Runner
              </Link>
              <button
                onClick={() => { setEditingCase(null); setShowModal(true); }}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                <FaPlus className="h-3.5 w-3.5" /> Create
              </button>
            </div>
          </div>

          {/* Active filter summary */}
          {(filteredCases.length !== (testCases || []).length) && (
            <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Showing <span className="font-semibold text-gray-900 dark:text-white">{filteredCases.length}</span> of {(testCases || []).length} test cases
            </div>
          )}
        </div>

        {error && <div className="mb-4"><Alert variant="error" title="Error" message={error} /></div>}
        {loading && <div className="text-sm text-gray-500 dark:text-gray-400 py-4">Loading test cases…</div>}

        {/* Table */}
        {!loading && !error && (
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900 overflow-hidden">
            {filteredCases.length === 0 ? (
              <div className="py-16 text-center text-gray-500 dark:text-gray-400">
                {hasFilters ? (
                  <div>
                    <p className="mb-2">No test cases match the current filters.</p>
                    <button onClick={clearFilters} className="text-blue-600 hover:underline text-sm">Clear filters</button>
                  </div>
                ) : "No test cases found. Create one to get started."}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">#</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Title</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Project / Suite</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Priority</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Script</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Updated By</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Updated On</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {filteredCases.map((tc) => (
                      <tr key={tc.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group">
                        <td className="px-4 py-3 text-xs text-gray-400 font-mono">{tc.id}</td>
                        <td className="px-4 py-3">
                          <Link to={`/test-cases/${tc.id}`} className="font-medium text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                            {tc.title}
                          </Link>
                          {tc.preconditions && (
                            <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500 truncate max-w-xs">{tc.preconditions}</p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-xs text-gray-700 dark:text-gray-300 font-medium">{tc.project_name || "—"}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{tc.suite_name || "—"}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${PRIORITY_COLORS[tc.priority]}`}>{tc.priority}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_COLORS[tc.status]}`}>{tc.status}</span>
                        </td>
                        <td className="px-4 py-3">
                          {tc.playwright_script ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                              <span className="h-1.5 w-1.5 rounded-full bg-green-500" /> Yes
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                              <span className="h-1.5 w-1.5 rounded-full bg-gray-300" /> None
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">{tc.updated_by_name || "—"}</td>
                        {/* <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">{tc.updated_by_name || "—"}</td> */}
                        <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">{tc.updated_at ? new Date(tc.updated_at).toLocaleString() : "—"}</td>

                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <Link to={`/test-cases/${tc.id}`} className="p-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition" title="View">
                              <FaEye className="h-3 w-3" />
                            </Link>
                            <Link to={`/playwright/editor/${tc.id}`} className="p-1.5 rounded-md hover:bg-purple-100 dark:hover:bg-purple-900/30 text-purple-500 hover:text-purple-700 transition" title="Edit Script">
                              <FaCode className="h-3 w-3" />
                            </Link>
                            <Link to={`/playwright/runner/${tc.id}`} className="p-1.5 rounded-md hover:bg-green-100 dark:hover:bg-green-900/30 text-green-500 hover:text-green-700 transition" title="Run">
                              <FaPlay className="h-3 w-3" />
                            </Link>
                            <button onClick={() => handleEdit(tc)} className="p-1.5 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-500 hover:text-blue-700 transition" title="Edit">
                              <FaEdit className="h-3 w-3" />
                            </button>
                            <button onClick={() => handleDeleteClick(tc)} className="p-1.5 rounded-md hover:bg-red-100 dark:hover:bg-red-900/30 text-red-400 hover:text-red-600 transition" title="Delete">
                              <FaTrash className="h-3 w-3" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
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

      <div className="space-y-4">
        {/* Project + Suite + Priority + Status */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Filter by Project
            </label>
            <select
              value={selectedProjectFilter}
              onChange={(e) => {
                setSelectedProjectFilter(e.target.value);
                setFormData((prev) => ({
                  ...prev,
                  suite_id: "",
                }));
              }}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- All Projects --</option>
              {projects?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.project_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Suite <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.suite_id}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  suite_id: e.target.value,
                })
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Select Suite --</option>
              {filteredSuites?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.suite_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Priority
            </label>
            <select
              value={formData.priority}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  priority: e.target.value as TestCase["priority"],
                })
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {["Low", "Medium", "High", "Critical"].map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Status
            </label>
            <select
              value={formData.status}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  status: e.target.value as TestCase["status"],
                })
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {["Draft", "Ready", "Deprecated"].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Title <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) =>
              setFormData({
                ...formData,
                title: e.target.value,
              })
            }
            placeholder="e.g. Verify login with valid credentials"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Preconditions */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Preconditions
          </label>
          <textarea
            value={formData.preconditions}
            onChange={(e) =>
              setFormData({
                ...formData,
                preconditions: e.target.value,
              })
            }
            placeholder="e.g. User must be registered"
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        {/* Test Steps */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Test Steps
            </label>
            <button
              onClick={handleAddStep}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
            >
              <FaPlus className="h-3 w-3" />
              Add Step
            </button>
          </div>

          <div className="space-y-3">
            {steps.map((step, index) => (
              <div
                key={index}
                className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                    Step {index + 1}
                  </span>

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
                  onChange={(e) =>
                    handleStepChange(index, "action", e.target.value)
                  }
                  placeholder="Action *"
                  className="w-full mb-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />

                <input
                  type="text"
                  value={step.expected_result}
                  onChange={(e) =>
                    handleStepChange(
                      index,
                      "expected_result",
                      e.target.value
                    )
                  }
                  placeholder="Expected Result"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Playwright Script */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Playwright Script
            </label>

            {editingCase && (
              <Link
                to={`/playwright/editor/${editingCase.id}`}
                className="text-xs text-purple-600 hover:text-purple-700 font-medium"
              >
                Open Full Editor →
              </Link>
            )}
          </div>

          <textarea
            value={formData.playwright_script}
            onChange={(e) =>
              setFormData({
                ...formData,
                playwright_script: e.target.value,
              })
            }
            placeholder="Paste or record Playwright script here…"
            rows={5}
            spellCheck={false}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
          />
        </div>
      </div>

      <div className="flex justify-end gap-3 mt-6">
        <button
          onClick={handleCloseModal}
          className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 rounded-lg"
        >
          Cancel
        </button>

        <button
          onClick={handleSave}
          disabled={submitting}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg"
        >
          {submitting
            ? editingCase
              ? "Updating…"
              : "Creating…"
            : editingCase
            ? "Update"
            : "Create"}
        </button>
      </div>
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
            {deleteAlert && <div className="mb-4"><Alert variant={deleteAlert.type} title={deleteAlert.type === "success" ? "Success" : "Error"} message={deleteAlert.message} /></div>}
            <div className="flex items-start gap-3 mb-5">
              <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full bg-red-100 dark:bg-red-900">
                <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                Are you sure you want to delete <span className="font-semibold text-gray-900 dark:text-white">"{deletingCase.title}"</span>? All steps will also be permanently removed.
              </p>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => { setShowDeleteModal(false); setDeletingCase(null); setDeleteAlert(null); }} disabled={deletingInProgress} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 rounded-lg">Cancel</button>
              <button onClick={handleConfirmDelete} disabled={deletingInProgress} className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-60 rounded-lg">
                {deletingInProgress ? "Deleting…" : "Yes, Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}