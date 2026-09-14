import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
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
  FaPaperPlane,
  FaClipboardCheck,
} from "react-icons/fa";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import Alert from "../../components/ui/alert/Alert";
import useFetchWithAuth from "../../hooks/useFetchWithAuth";
import { usePermissions } from "../../hooks/usePermissions";
import API from "../../services/api";
import WorkflowStatusBadge from "../../components/workflow/WorkflowStatusBadge";
import { testCaseWorkflowAPI } from "../../services/testCaseWorkflowAPI";

interface Project {
  id: number;
  project_name: string;
}
interface TestSuite {
  id: number;
  suite_name: string;
  project_id: number;
  project_name?: string;
}
interface TestStep {
  step_number: number;
  action: string;
  expected_result: string;
}
interface TestCase {
  id: number;
  suite_id: number;
  title: string;
  preconditions: string;
  priority: "Low" | "Medium" | "High" | "Critical";
  status?: string; // legacy DB field; not used by workflow UI
  workflow_status: "Draft" | "Review" | "Approved";
  workflow_request_id?: number | null;
  active_request_status?: "PENDING" | "RETURNED" | null;
  active_return_comment?: string | null;
  proposed_suite_id?: number | null;
  proposed_title?: string | null;
  proposed_preconditions?: string | null;
  proposed_priority?: "Low" | "Medium" | "High" | "Critical" | null;
  proposed_playwright_script?: string | null;
  proposed_steps?: TestStep[] | null;
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
  Draft: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  Review: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  Approved: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
};

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

const emptyStep = (): TestStep => ({
  step_number: 1,
  action: "",
  expected_result: "",
});

export default function TestCases() {
  const {
    data: testCases,
    loading,
    error,
  } = useFetchWithAuth<TestCase[]>("/api/test-cases");
  const { data: projects } = useFetchWithAuth<Project[]>("/api/projects");
  const { data: allSuites } = useFetchWithAuth<TestSuite[]>("/api/test-suites");
  // const { can } = usePermissions();
  // const canViewApprovals = can("/test-case-approvals", "can_view");

  // Filters
  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [suiteFilter, setSuiteFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [scriptFilter, setScriptFilter] = useState<"" | "yes" | "no">("");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modals
  const [showModal, setShowModal] = useState(false);
  const [editingCase, setEditingCase] = useState<TestCase | null>(null);
  const [formData, setFormData] = useState({
    suite_id: "",
    title: "",
    preconditions: "",
    priority: "Medium" as TestCase["priority"],
    playwright_script: "",
  });
  const [steps, setSteps] = useState<TestStep[]>([emptyStep()]);
  const [selectedProjectFilter, setSelectedProjectFilter] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formAlert, setFormAlert] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingCase, setDeletingCase] = useState<TestCase | null>(null);
  const [deleteAlert, setDeleteAlert] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [deletingInProgress, setDeletingInProgress] = useState(false);

  const getToken = () =>
    localStorage.getItem("token") || sessionStorage.getItem("token");

  const filteredSuites = allSuites?.filter((s) =>
    selectedProjectFilter
      ? String(s.project_id) === selectedProjectFilter
      : true,
  );

  const filteredCases = useMemo(() => {
    const q = search.toLowerCase();
    return (testCases || []).filter((tc) => {
      const matchText =
        !q ||
        `${tc.title} ${tc.suite_name || ""} ${tc.project_name || ""} ${tc.created_by_name || ""}`
          .toLowerCase()
          .includes(q);
      const matchProject = !projectFilter || tc.project_name === projectFilter;
      const matchSuite = !suiteFilter || String(tc.suite_id) === suiteFilter;
      const matchPriority = !priorityFilter || tc.priority === priorityFilter;
      const matchStatus = !statusFilter || tc.workflow_status === statusFilter;
      const matchScript =
        !scriptFilter ||
        (scriptFilter === "yes"
          ? !!tc.playwright_script
          : !tc.playwright_script);
      return (
        matchText &&
        matchProject &&
        matchSuite &&
        matchPriority &&
        matchStatus &&
        matchScript
      );
    });
  }, [
    testCases,
    search,
    projectFilter,
    suiteFilter,
    priorityFilter,
    statusFilter,
    scriptFilter,
  ]);

  const hasFilters = Boolean(
    search ||
    projectFilter ||
    suiteFilter ||
    priorityFilter ||
    statusFilter ||
    scriptFilter,
  );

  // ─── PAGINATION LOGIC ────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(filteredCases.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedCases = filteredCases.slice(
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

  // Reset to page 1 whenever any filter changes
  const handleSearchChange = (val: string) => {
    setSearch(val);
    setCurrentPage(1);
  };
  const handleProjectFilterChange = (val: string) => {
    setProjectFilter(val);
    setCurrentPage(1);
  };
  const handleSuiteFilterChange = (val: string) => {
    setSuiteFilter(val);
    setCurrentPage(1);
  };
  const handlePriorityFilterChange = (val: string) => {
    setPriorityFilter(val);
    setCurrentPage(1);
  };
  const handleStatusFilterChange = (val: string) => {
    setStatusFilter(val);
    setCurrentPage(1);
  };
  const handleScriptFilterChange = (val: "" | "yes" | "no") => {
    setScriptFilter(val);
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setSearch("");
    setProjectFilter("");
    setSuiteFilter("");
    setPriorityFilter("");
    setStatusFilter("");
    setScriptFilter("");
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

  const handleAddStep = () =>
    setSteps((prev) => [
      ...prev,
      { step_number: prev.length + 1, action: "", expected_result: "" },
    ]);
  const handleRemoveStep = (i: number) =>
    setSteps((prev) =>
      prev
        .filter((_, idx) => idx !== i)
        .map((s, idx) => ({ ...s, step_number: idx + 1 })),
    );
  const handleStepChange = (i: number, field: keyof TestStep, value: string) =>
    setSteps((prev) =>
      prev.map((s, idx) => (idx === i ? { ...s, [field]: value } : s)),
    );

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
      setFormAlert({
        type: "error",
        message: "All steps must have an action.",
      });
      return;
    }
    setSubmitting(true);
    setFormAlert(null);
    try {
      const payload = {
        suite_id: Number(formData.suite_id),
        title: formData.title.trim(),
        preconditions: formData.preconditions,
        priority: formData.priority,
        playwright_script: formData.playwright_script,
        steps,
      };
      const url = editingCase
        ? `/api/test-cases/update/${editingCase.id}`
        : "/api/test-cases/create";
      const method = editingCase ? API.put : API.post;
      const res = await method(url, payload, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.data.success) {
        setFormAlert({
          type: "success",
          message: editingCase
            ? editingCase.active_request_status === "RETURNED"
              ? "Corrected changes resubmitted. Status is now Pending Review."
              : editingCase.workflow_status === "Draft"
                ? "Draft saved. Submit it for review when it is ready."
                : "Changes sent for approval. Status is now Pending Review."
            : "Test case created as Draft. Submit it for review when it is ready.",
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

  const handleEdit = async (tc: TestCase) => {
    if (tc.workflow_status === "Review") {
      setFormAlert(null);
      alert(
        "This test case is currently in Review and cannot be edited until a decision is made.",
      );
      return;
    }
    try {
      const res = await API.get(`/api/test-cases/${tc.id}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.data.success) {
        const full: TestCase = res.data.data;
        setEditingCase(full);
        const suite = allSuites?.find((s) => s.id === full.suite_id);
        setSelectedProjectFilter(suite ? String(suite.project_id) : "");
        const returned = full.active_request_status === "RETURNED";
        setFormData({
          suite_id: String(
            returned && full.proposed_suite_id
              ? full.proposed_suite_id
              : full.suite_id,
          ),
          title:
            returned && full.proposed_title ? full.proposed_title : full.title,
          preconditions: returned
            ? full.proposed_preconditions || ""
            : full.preconditions || "",
          priority:
            returned && full.proposed_priority
              ? full.proposed_priority
              : full.priority,
          playwright_script: returned
            ? full.proposed_playwright_script || ""
            : full.playwright_script || "",
        });
        setSteps(
          returned && full.proposed_steps && full.proposed_steps.length > 0
            ? full.proposed_steps
            : full.steps && full.steps.length > 0
              ? full.steps
              : [emptyStep()],
        );
        if (returned) {
          setFormAlert({
            type: "error",
            message:
              full.active_return_comment ||
              "This change request was returned. Correct it and resubmit.",
          });
        }
        setShowModal(true);
      }
    } catch {
      setEditingCase(tc);
      setFormData({
        suite_id: String(tc.suite_id),
        title: tc.title,
        preconditions: tc.preconditions || "",
        priority: tc.priority,
        playwright_script: tc.playwright_script || "",
      });
      setSteps([emptyStep()]);
      setShowModal(true);
    }
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
      await API.delete(`/api/test-cases/delete/${deletingCase.id}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      setDeleteAlert({ type: "success", message: "Test case deleted." });
      setTimeout(() => {
        setShowDeleteModal(false);
        setDeletingCase(null);
        window.location.reload();
      }, 1200);
    } catch (err: any) {
      setDeleteAlert({
        type: "error",
        message: err.response?.data?.message || "Failed to delete.",
      });
    } finally {
      setDeletingInProgress(false);
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingCase(null);
    setFormData({
      suite_id: "",
      title: "",
      preconditions: "",
      priority: "Medium",
      playwright_script: "",
    });
    setSteps([emptyStep()]);
    setSelectedProjectFilter("");
    setFormAlert(null);
  };

  // Project names for filter dropdown
  const projectNames = useMemo(
    () => [
      ...new Set(
        (testCases || []).map((tc) => tc.project_name).filter(Boolean),
      ),
    ],
    [testCases],
  );

  return (
    <div>
      <PageMeta title="Test Cases" description="Test Cases" />
      <PageBreadcrumb pageTitle="Test Cases" />

      <div className="mt-4">
        {/* Summary */}
        <div className="mb-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {filteredCases.length} test case
            {filteredCases.length !== 1 ? "s" : ""} · {allSuites?.length ?? 0}{" "}
            suite{allSuites?.length !== 1 ? "s" : ""} · {projects?.length ?? 0}{" "}
            project{projects?.length !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Toolbar */}
        <div className="mb-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-[220px]">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <input
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search test cases…"
                className="w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              />
            </div>

            {/* Filters */}
            <select
              value={projectFilter}
              onChange={(e) => handleProjectFilterChange(e.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
            >
              <option value="">All Projects</option>
              {projectNames.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>

            <select
              value={suiteFilter}
              onChange={(e) => handleSuiteFilterChange(e.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
            >
              <option value="">All Suites</option>
              {(allSuites || []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.suite_name}
                </option>
              ))}
            </select>

            <select
              value={priorityFilter}
              onChange={(e) => handlePriorityFilterChange(e.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
            >
              <option value="">All Priority</option>
              {["Low", "Medium", "High", "Critical"].map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => handleStatusFilterChange(e.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
            >
              <option value="">All Status</option>
              <option value="Draft">Draft</option>
              <option value="Review">Pending Review</option>
              <option value="Approved">Approved</option>
            </select>

            <select
              value={scriptFilter}
              onChange={(e) => handleScriptFilterChange(e.target.value as any)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
            >
              <option value="">All Scripts</option>
              <option value="yes">Has Script</option>
              <option value="no">No Script</option>
            </select>

            {hasFilters && (
              <button
                onClick={clearFilters}
                className="inline-flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400"
              >
                <FaTimes className="h-3 w-3" /> Clear
              </button>
            )}

            <div className="ml-auto flex items-center gap-2">
              <Link
                to="/script/recorder"
                className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-3 py-2 text-sm font-medium text-white hover:bg-purple-700"
              >
                <FaVideo className="h-3.5 w-3.5" /> Record
              </Link>
              <Link
                to="/script/runner"
                className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700"
              >
                <FaPlay className="h-3.5 w-3.5" /> Runner
              </Link>
              {/* {canViewApprovals && (
                <Link
                  to="/test-case-approvals"
                  className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-300"
                >
                  <FaClipboardCheck className="h-3.5 w-3.5" /> Approvals
                </Link>
              )} */}
              <button
                onClick={() => {
                  setEditingCase(null);
                  setShowModal(true);
                }}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                <FaPlus className="h-3.5 w-3.5" /> Create
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4">
            <Alert variant="error" title="Error" message={error} />
          </div>
        )}
        {loading && (
          <div className="text-sm text-gray-500 dark:text-gray-400 py-4">
            Loading test cases…
          </div>
        )}

        {/* Table */}
        {!loading && !error && (
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900 overflow-hidden">
            {filteredCases.length === 0 ? (
              <div className="py-16 text-center text-gray-500 dark:text-gray-400">
                {hasFilters ? (
                  <div>
                    <p className="mb-2">
                      No test cases match the current filters.
                    </p>
                    <button
                      onClick={clearFilters}
                      className="text-blue-600 hover:underline text-sm"
                    >
                      Clear filters
                    </button>
                  </div>
                ) : (
                  "No test cases found. Create one to get started."
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        #
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Title
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Project / Suite
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Priority
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Status
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Script
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Updated By
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Updated On
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {paginatedCases.map((tc) => (
                      <tr
                        key={tc.id}
                        className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group"
                      >
                        <td className="px-4 py-3 text-xs text-gray-400 font-mono">
                          {tc.id}
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            to={`/test-cases/${tc.id}`}
                            className="font-medium text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                          >
                            {tc.title}
                          </Link>
                          {tc.preconditions && (
                            <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500 truncate max-w-xs">
                              {tc.preconditions}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-xs text-gray-700 dark:text-gray-300 font-medium">
                            {tc.project_name || "—"}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {tc.suite_name || "—"}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${PRIORITY_COLORS[tc.priority]}`}
                          >
                            {tc.priority}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <WorkflowStatusBadge status={tc.workflow_status} />
                          {tc.active_request_status === "RETURNED" && (
                            <div className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">
                              Returned for correction
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {tc.playwright_script ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />{" "}
                              Yes
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                              <span className="h-1.5 w-1.5 rounded-full bg-gray-300" />{" "}
                              None
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                          {tc.updated_by_name || "—"}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                          {tc.updated_at
                            ? new Date(tc.updated_at).toLocaleString()
                            : "—"}
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <Link
                              to={`/test-cases/${tc.id}`}
                              className="p-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition"
                              title="View"
                            >
                              <FaEye className="h-3 w-3" />
                            </Link>
                            <Link
                              to={`/script/editor/${tc.id}`}
                              className="p-1.5 rounded-md hover:bg-purple-100 dark:hover:bg-purple-900/30 text-purple-500 hover:text-purple-700 transition"
                              title="Edit Script"
                            >
                              <FaCode className="h-3 w-3" />
                            </Link>
                            <Link
                              to={`/script/runner/${tc.id}`}
                              className="p-1.5 rounded-md hover:bg-green-100 dark:hover:bg-green-900/30 text-green-500 hover:text-green-700 transition"
                              title="Run"
                            >
                              <FaPlay className="h-3 w-3" />
                            </Link>
                            {tc.workflow_status === "Draft" &&
                              tc.active_request_status !== "RETURNED" && (
                                <button
                                  onClick={async () => {
                                    try {
                                      await testCaseWorkflowAPI.submitForReview(
                                        tc.id,
                                      );
                                      window.location.reload();
                                    } catch (err: any) {
                                      alert(
                                        err.response?.data?.message ||
                                          "Failed to submit for review.",
                                      );
                                    }
                                  }}
                                  className="p-1.5 rounded-md hover:bg-indigo-100 dark:hover:bg-indigo-900/30 text-indigo-500 hover:text-indigo-700 transition"
                                  title="Submit for Review"
                                >
                                  <FaPaperPlane className="h-3 w-3" />
                                </button>
                              )}
                            {tc.workflow_status !== "Review" && (
                              <button
                                onClick={() => handleEdit(tc)}
                                className={`p-1.5 rounded-md transition ${
                                  tc.active_request_status === "RETURNED"
                                    ? "hover:bg-amber-100 dark:hover:bg-amber-900/30 text-amber-600 hover:text-amber-700"
                                    : "hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-500 hover:text-blue-700"
                                }`}
                                title={
                                  tc.active_request_status === "RETURNED"
                                    ? "Correct Returned Changes"
                                    : "Propose Changes"
                                }
                              >
                                <FaEdit className="h-3 w-3" />
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteClick(tc)}
                              disabled={Boolean(tc.workflow_request_id)}
                              className="p-1.5 rounded-md hover:bg-red-100 dark:hover:bg-red-900/30 text-red-400 hover:text-red-600 transition disabled:opacity-30 disabled:cursor-not-allowed"
                              title={
                                tc.workflow_request_id
                                  ? "Resolve workflow request before deleting"
                                  : "Delete"
                              }
                            >
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

        {/* ── Pagination ── */}
        {!loading && !error && filteredCases.length > 0 && (
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
                {Math.min(safePage * pageSize, filteredCases.length)} of{" "}
                {filteredCases.length}
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
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M11 19l-7-7 7-7M18 19l-7-7 7-7"
                  />
                </svg>
              </button>

              {/* Prev */}
              <button
                onClick={() => handlePageChange(safePage - 1)}
                disabled={safePage === 1}
                className="p-1.5 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
                title="Previous page"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 19l-7-7 7-7"
                  />
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
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>

              {/* Last */}
              <button
                onClick={() => handlePageChange(totalPages)}
                disabled={safePage === totalPages}
                className="p-1.5 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
                title="Last page"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13 5l7 7-7 7M6 5l7 7-7 7"
                  />
                </svg>
              </button>
            </div>
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
                  <WorkflowStatusBadge
                    status={editingCase?.workflow_status || "Draft"}
                  />
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
                            e.target.value,
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
                    Script
                  </label>

                  {editingCase && (
                    <Link
                      to={`/script/editor/${editingCase.id}`}
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
                  placeholder="Paste or record Script here…"
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
                  ? "Saving…"
                  : !editingCase
                    ? "Create Draft"
                    : editingCase.active_request_status === "RETURNED"
                      ? "Resubmit for Approval"
                      : editingCase.workflow_status === "Draft"
                        ? "Save Draft"
                        : "Submit Changes for Approval"}
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
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Delete Test Case
              </h2>
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeletingCase(null);
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
            <div className="flex items-start gap-3 mb-5">
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
              <p className="text-sm text-gray-700 dark:text-gray-300">
                Are you sure you want to delete{" "}
                <span className="font-semibold text-gray-900 dark:text-white">
                  "{deletingCase.title}"
                </span>
                ? All steps will also be permanently removed.
              </p>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeletingCase(null);
                  setDeleteAlert(null);
                }}
                disabled={deletingInProgress}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deletingInProgress}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-60 rounded-lg"
              >
                {deletingInProgress ? "Deleting…" : "Yes, Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
