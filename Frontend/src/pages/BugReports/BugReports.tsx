import { useEffect, useMemo, useState } from "react";
import {
  FaBug,
  FaEdit,
  FaPlus,
  FaSearch,
  FaTimes,
  FaTrash,
} from "react-icons/fa";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import Alert from "../../components/ui/alert/Alert";
import useFetchWithAuth from "../../hooks/useFetchWithAuth";
import { bugReportAPI, BugReport } from "../../services/bugReportAPI";
import CreateBugReportModal from "./components/CreateBugReportModal";
import BugReportDetailsModal from "./components/BugReportDetailsModal";
import DeleteModal from "./components/modals/DeleteModal";
import TablePagination from "../../components/common/TablePagination";

interface AlertState {
  show: boolean;
  message: string;
  type: "success" | "error" | "warning" | "info";
}

const SEVERITY_COLORS: Record<string, string> = {
  Critical: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  High: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  Medium: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  Low: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
};

const STATUS_COLORS: Record<string, string> = {
  Pass: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  Fail: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  Blocked: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  "No Test": "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
  Reopened: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  "Not Tested": "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
};

export default function BugReports() {
  const [bugReports, setBugReports] = useState<BugReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState<AlertState>({
    show: false,
    message: "",
    type: "info",
  });

  const [limit] = useState(20);
  const [offset, setOffset] = useState(0);
  const [totalRecords, setTotalRecords] = useState(0);

  const [filterStatus, setFilterStatus] = useState("");
  const [filterSeverity, setFilterSeverity] = useState("");
  const [filterProject, setFilterProject] = useState("");
  const [search, setSearch] = useState("");

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedBug, setSelectedBug] = useState<BugReport | null>(null);

  const { data: projects } = useFetchWithAuth<any[]>("/api/projects");
  const { data: sprints } = useFetchWithAuth<any[]>("/api/sprints");

  useEffect(() => {
    loadBugReports();
  }, [filterStatus, filterSeverity, filterProject, offset]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;

      if (showDeleteModal) {
        setShowDeleteModal(false);
        setSelectedBug(null);
        return;
      }

      if (showDetailsModal) {
        setShowDetailsModal(false);
        setSelectedBug(null);
        return;
      }

      if (showCreateModal) {
        setShowCreateModal(false);
        setSelectedBug(null);
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [showCreateModal, showDetailsModal, showDeleteModal]);

  const loadBugReports = async () => {
    try {
      setLoading(true);
      const response = await bugReportAPI.getBugReports({
        project_id: filterProject ? parseInt(filterProject) : undefined,
        status: filterStatus || undefined,
        severity: filterSeverity || undefined,
        limit,
        offset,
      });
      setBugReports(response.data || []);
      setTotalRecords(response.total || 0);
    } catch (error) {
      console.error("Error loading bug reports:", error);
      setAlert({
        show: true,
        message: "Failed to load bug reports",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredBugReports = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return bugReports;

    return bugReports.filter((bug) =>
      [
        bug.report_id,
        bug.title,
        bug.project_name,
        bug.function_name,
        bug.assigned_to_name,
        bug.status,
        bug.current_cycle_status,
        bug.severity,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [bugReports, search]);

  const hasFilters = Boolean(
    filterStatus || filterSeverity || filterProject || search,
  );

  const handleCreateSuccess = (message: string) => {
    setAlert({ show: true, message, type: "success" });
    setShowCreateModal(false);
    setSelectedBug(null);
    loadBugReports();
  };

  const handleViewBug = (bug: BugReport) => {
    setSelectedBug(bug);
    setShowDetailsModal(true);
  };

  const handleEditBug = (bug: BugReport) => {
    setSelectedBug(bug);
    setShowCreateModal(true);
  };

  const handleDeleteClick = (bug: BugReport) => {
    setSelectedBug(bug);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedBug) return;
    try {
      await bugReportAPI.deleteBugReport(selectedBug.id);
      setAlert({
        show: true,
        message: "Bug report deleted successfully",
        type: "success",
      });
      setShowDeleteModal(false);
      setSelectedBug(null);
      loadBugReports();
    } catch (error) {
      console.error("Error deleting bug report:", error);
      setAlert({
        show: true,
        message: "Failed to delete bug report",
        type: "error",
      });
    }
  };

  const clearFilters = () => {
    setFilterStatus("");
    setFilterSeverity("");
    setFilterProject("");
    setSearch("");
    setOffset(0);
  };

  return (
    <div>
      <PageMeta
        title="Log Defect"
        description="Manage bug and issue reports"
      />
      <PageBreadcrumb pageTitle="Log Defect" />

      <div className="mt-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {/* {totalRecords} bug report{totalRecords !== 1 ? "s" : ""} */}
              {hasFilters ? " · filtered view" : ""}
            </p>
          </div>
        </div>

        {alert.show && (
          <div className="mb-4">
            <Alert
              variant={
                alert.type === "warning" || alert.type === "info"
                  ? "info"
                  : alert.type
              }
              title={
                alert.type === "success"
                  ? "Success"
                  : alert.type === "error"
                    ? "Error"
                    : "Notice"
              }
              message={alert.message}
            />
          </div>
        )}

        <div className="mb-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[240px] flex-1">
              <FaSearch className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search bug reports…"
                className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              />
            </div>

            <select
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value);
                setOffset(0);
              }}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
            >
              <option value="">All Status</option>
              <option value="Open">Open</option>
              <option value="In Progress">In Progress</option>
              <option value="Reopened">Reopened</option>
              <option value="Resolved">Resolved</option>
              <option value="Closed">Closed</option>
            </select>

            <select
              value={filterSeverity}
              onChange={(e) => {
                setFilterSeverity(e.target.value);
                setOffset(0);
              }}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
            >
              <option value="">All Severity</option>
              <option value="Critical">Critical</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>

            <select
              value={filterProject}
              onChange={(e) => {
                setFilterProject(e.target.value);
                setOffset(0);
              }}
              className="min-w-[170px] rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
            >
              <option value="">All Projects</option>
              {projects?.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.project_name}
                </option>
              ))}
            </select>
            <button
              onClick={() => {
                setSelectedBug(null);
                setShowCreateModal(true);
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              <FaPlus className="h-3.5 w-3.5" /> Report New Bug
            </button>

            {hasFilters && (
              <button
                onClick={clearFilters}
                className="inline-flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
              >
                <FaTimes className="h-3 w-3" /> Clear
              </button>
            )}
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
          <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-700">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
              <FaBug className="h-3.5 w-3.5 text-red-500" /> Bugs Reported
            </h2>
            <span className="text-xs text-gray-400 dark:text-gray-500">
              Showing {filteredBugReports.length} of {totalRecords}
            </span>
          </div>

          {loading ? (
            <div className="py-12 text-center text-sm text-gray-400">
              Loading bug reports…
            </div>
          ) : filteredBugReports.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-400 italic">
              No bug reports found.
            </div>
          ) : (
            <div className="max-h-[560px] space-y-2 overflow-y-auto p-4">
              {filteredBugReports.map((bug) => (
                <div
                  key={bug.id}
                  role="button"
                  tabIndex={0}
                  title="Click to view bug report"
                  onClick={() => handleViewBug(bug)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleViewBug(bug);
                    }
                  }}
                  className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-gray-200 px-4 py-3 transition-colors hover:border-blue-300 hover:bg-blue-50/40 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-gray-700 dark:hover:border-blue-700 dark:hover:bg-blue-950/10"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                      {bug.report_id}
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-center gap-2">
                        <p className="truncate text-sm font-medium text-gray-800 dark:text-gray-200">
                          {bug.title}
                        </p>
                        <span className="hidden max-w-[180px] truncate text-[11px] text-gray-400 md:inline dark:text-gray-500">
                          {bug.project_name || "Unknown Project"}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-gray-400 dark:text-gray-500">
                        {bug.function_name || "No function"}
                        {bug.assigned_to_name
                          ? ` · Assigned to ${bug.assigned_to_name}`
                          : " · Unassigned"}
                      </p>
                    </div>

                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${SEVERITY_COLORS[bug.severity] || "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"}`}
                    >
                      {bug.severity}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        STATUS_COLORS[
                          bug.current_cycle_status || "Not Tested"
                        ] ||
                        "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                      }`}
                      title="Latest cycle status"
                    >
                      {bug.current_cycle_status || "Not Tested"}
                    </span>
                  </div>

                  <div
                    className="flex flex-shrink-0 items-center gap-2"
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => handleEditBug(bug)}
                      className="rounded-md p-1.5 text-blue-600 transition-colors hover:bg-blue-100 dark:hover:bg-blue-900/30"
                      title="Edit Bug Report"
                    >
                      <FaEdit className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => handleDeleteClick(bug)}
                      className="rounded-md p-1.5 text-red-500 transition-colors hover:bg-red-100 dark:hover:bg-red-900/30"
                      title="Delete Bug Report"
                    >
                      <FaTrash className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && totalRecords > 0 && (
            <div className="border-t border-gray-200 px-4 py-3 dark:border-gray-700">
              <TablePagination
                currentPage={Math.floor(offset / limit) + 1}
                totalItems={totalRecords}
                totalPages={Math.ceil(totalRecords / limit)}
                pageSize={limit}
                onPageChange={(page) => setOffset((page - 1) * limit)}
              />
            </div>
          )}
        </div>
      </div>

      {showCreateModal && (
        <CreateBugReportModal
          bug={selectedBug}
          onClose={() => {
            setShowCreateModal(false);
            setSelectedBug(null);
          }}
          onSuccess={handleCreateSuccess}
          projects={projects || []}
          sprints={sprints || []}
        />
      )}

      {showDetailsModal && selectedBug && (
        <BugReportDetailsModal
          bugId={selectedBug.id}
          onClose={() => {
            setShowDetailsModal(false);
            setSelectedBug(null);
          }}
          onUpdate={loadBugReports}
        />
      )}

      {showDeleteModal && selectedBug && (
        <DeleteModal
          title="Delete Bug Report"
          message={`Are you sure you want to delete bug report \"${selectedBug.report_id}\"? This cannot be undone.`}
          onConfirm={handleDeleteConfirm}
          onCancel={() => {
            setShowDeleteModal(false);
            setSelectedBug(null);
          }}
        />
      )}
    </div>
  );
}
