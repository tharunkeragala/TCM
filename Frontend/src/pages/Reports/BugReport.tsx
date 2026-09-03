import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { FaBug, FaFileExcel, FaSearch, FaTimes } from "react-icons/fa";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import Alert from "../../components/ui/alert/Alert";
import useFetchWithAuth from "../../hooks/useFetchWithAuth";
import { bugReportAPI } from "../../services/bugReportAPI";

interface BugReportSummaryRow {
  sprint_id: number;
  sprint_name?: string | null;
  project_id: number;
  project_name?: string | null;
  bug_count: number;
  pass_count: number;
  fail_count: number;
  blocked_count: number;
  no_test_count: number;
  latest_pass: number;
  latest_fail: number;
  latest_blocked: number;
  latest_no_test: number;
  latest_status_date?: string | null;
}

interface BugWiseReportRow {
  bug_id: number;
  report_id: string;
  title: string;
  project_id: number;
  project_name?: string | null;
  sprint_id: number;
  sprint_name?: string | null;
  severity: string;
  bug_status: string;
  priority: number;
  function_name?: string | null;
  assigned_to_name?: string | null;
  pass_count: number;
  fail_count: number;
  blocked_count: number;
  no_test_count: number;
  latest_status?: string | null;
  latest_status_date?: string | null;
  first_reported_date?: string | null;
  updated_at?: string | null;
}

interface BugReportStatistics {
  total_bugs: number;
  open_bugs: number;
  in_progress_bugs: number;
  resolved_bugs: number;
  closed_bugs: number;
  critical_bugs: number;
  high_bugs: number;
  medium_bugs: number;
  low_bugs: number;
}

const STATUS_COLORS = {
  pass: "text-green-600 dark:text-green-400",
  fail: "text-red-600 dark:text-red-400",
  blocked: "text-amber-600 dark:text-amber-400",
  noTest: "text-gray-500 dark:text-gray-400",
};

const formatDate = (value?: string | null) => {
  if (!value) return "-";

  const normalized = String(value).trim().replace(" ", "T");

  const hasTimezone =
    /Z$/i.test(normalized) || /[+-]\d{2}:\d{2}$/.test(normalized);

  if (hasTimezone) {
    const date = new Date(normalized);
    return Number.isNaN(date.getTime()) ? "-" : date.toLocaleDateString();
  }

  const match = normalized.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?(?:\.(\d+))?$/,
  );

  if (match) {
    const [, year, month, day] = match;
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    return Number.isNaN(date.getTime()) ? "-" : date.toLocaleDateString();
  }

  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleDateString();
};

const numberValue = (value: unknown) => Number(value ?? 0);

const cycleBadge = (status?: string | null) => {
  switch (status) {
    case "Pass":
      return "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300";
    case "Fail":
      return "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300";
    case "Blocked":
      return "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300";
    case "No Test":
      return "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300";
    case "Reopened":
      return "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300";
    default:
      return "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300";
  }
};

const severityBadge = (severity?: string | null) => {
  switch (severity) {
    case "Critical":
      return "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300";
    case "High":
      return "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300";
    case "Medium":
      return "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300";
    case "Low":
      return "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300";
    default:
      return "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300";
  }
};

const bugStatusBadge = (status?: string | null) => {
  switch (status) {
    case "Open":
      return "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300";
    case "In Progress":
      return "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300";
    case "Resolved":
      return "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300";
    case "Closed":
      return "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300";
    case "Reopened":
      return "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300";
    default:
      return "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300";
  }
};

export default function BugReport() {
  const { data: projects } = useFetchWithAuth<any[]>("/api/projects");
  const { data: sprints } = useFetchWithAuth<any[]>("/api/sprints");

  const [projectId, setProjectId] = useState("");
  const [sprintId, setSprintId] = useState("");
  const [search, setSearch] = useState("");

  const [statistics, setStatistics] =
    useState<BugReportStatistics | null>(null);
  const [summary, setSummary] = useState<BugReportSummaryRow[]>([]);
  const [bugWise, setBugWise] = useState<BugWiseReportRow[]>([]);
  const [reportView, setReportView] =
    useState<"sprint" | "bug">("sprint");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const loadReport = async () => {
      try {
        setLoading(true);
        setError("");

        const response = await bugReportAPI.getBugStatistics({
          project_id: projectId ? Number(projectId) : undefined,
          sprint_id: sprintId ? Number(sprintId) : undefined,
        });

        if (!active) return;

        setStatistics(response.statistics ?? null);
        setSummary(response.summary ?? []);
        setBugWise(response.bugWise ?? []);
      } catch (loadError) {
        console.error("Error loading bug report:", loadError);

        if (active) {
          setError("Failed to load bug report");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadReport();

    return () => {
      active = false;
    };
  }, [projectId, sprintId]);

  const filteredSummary = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return summary;

    return summary.filter((row) =>
      [row.project_name, row.sprint_name, row.project_id, row.sprint_id]
        .filter(Boolean)
        .some((value) =>
          String(value).toLowerCase().includes(query),
        ),
    );
  }, [search, summary]);

  const filteredBugWise = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return bugWise;

    return bugWise.filter((row) =>
      [
        row.report_id,
        row.title,
        row.project_name,
        row.sprint_name,
        row.function_name,
        row.assigned_to_name,
        row.severity,
        row.bug_status,
        row.latest_status,
      ]
        .filter(Boolean)
        .some((value) =>
          String(value).toLowerCase().includes(query),
        ),
    );
  }, [bugWise, search]);

  const totals = useMemo(
    () =>
      summary.reduce(
        (result, row) => ({
          bugs: result.bugs + numberValue(row.bug_count),
          pass: result.pass + numberValue(row.pass_count),
          fail: result.fail + numberValue(row.fail_count),
          blocked: result.blocked + numberValue(row.blocked_count),
          noTest: result.noTest + numberValue(row.no_test_count),
        }),
        {
          bugs: 0,
          pass: 0,
          fail: 0,
          blocked: 0,
          noTest: 0,
        },
      ),
    [summary],
  );

  const clearFilters = () => {
    setProjectId("");
    setSprintId("");
    setSearch("");
  };

  const handleExport = () => {
    const workbook = XLSX.utils.book_new();

    if (reportView === "sprint") {
      const rows = filteredSummary.map((row, index) => ({
        "#": index + 1,
        Project:
          row.project_name ?? `Project ${row.project_id}`,
        Sprint:
          row.sprint_name ?? `Sprint ${row.sprint_id}`,
        Bugs: numberValue(row.bug_count),
        Pass: numberValue(row.pass_count),
        Fail: numberValue(row.fail_count),
        Blocked: numberValue(row.blocked_count),
        "No Test": numberValue(row.no_test_count),
        "Latest Status Date": formatDate(
          row.latest_status_date,
        ),
      }));

      const worksheet = XLSX.utils.json_to_sheet(rows);

      worksheet["!cols"] = [
        { wch: 5 },
        { wch: 24 },
        { wch: 24 },
        { wch: 10 },
        { wch: 10 },
        { wch: 10 },
        { wch: 10 },
        { wch: 10 },
        { wch: 20 },
      ];

      XLSX.utils.book_append_sheet(
        workbook,
        worksheet,
        "Sprint Wise",
      );
    } else {
      const rows = filteredBugWise.map((row, index) => ({
        "#": index + 1,
        "Bug ID": row.report_id,
        Title: row.title,
        Project:
          row.project_name ?? `Project ${row.project_id}`,
        Sprint:
          row.sprint_name ?? `Sprint ${row.sprint_id}`,
        Function: row.function_name ?? "-",
        Severity: row.severity,
        "Bug Status": row.bug_status,
        Priority: row.priority,
        "Assigned To":
          row.assigned_to_name ?? "Unassigned",
        Pass: numberValue(row.pass_count),
        Fail: numberValue(row.fail_count),
        Blocked: numberValue(row.blocked_count),
        "No Test": numberValue(row.no_test_count),
        "Latest Cycle Status":
          row.latest_status ?? "-",
        "Latest Status Date": formatDate(
          row.latest_status_date,
        ),
      }));

      const worksheet = XLSX.utils.json_to_sheet(rows);

      worksheet["!cols"] = [
        { wch: 5 },
        { wch: 16 },
        { wch: 34 },
        { wch: 24 },
        { wch: 24 },
        { wch: 20 },
        { wch: 12 },
        { wch: 14 },
        { wch: 10 },
        { wch: 18 },
        { wch: 10 },
        { wch: 10 },
        { wch: 10 },
        { wch: 10 },
        { wch: 18 },
        { wch: 20 },
      ];

      XLSX.utils.book_append_sheet(
        workbook,
        worksheet,
        "Bug Wise",
      );
    }

    XLSX.writeFile(
      workbook,
      `Bug_Report_${
        reportView === "sprint"
          ? "Sprint_Wise"
          : "Bug_Wise"
      }_${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
  };

  const cards = [
    {
      label: "Total Bugs",
      value: statistics?.total_bugs ?? 0,
      color: "text-blue-600 dark:text-blue-400",
    },
    {
      label: "Open",
      value: statistics?.open_bugs ?? 0,
      color: "text-sky-600 dark:text-sky-400",
    },
    {
      label: "In Progress",
      value: statistics?.in_progress_bugs ?? 0,
      color: "text-amber-600 dark:text-amber-400",
    },
    {
      label: "Resolved",
      value: statistics?.resolved_bugs ?? 0,
      color: "text-green-600 dark:text-green-400",
    },
    {
      label: "Critical",
      value: statistics?.critical_bugs ?? 0,
      color: "text-red-600 dark:text-red-400",
    },
  ];

  return (
    <div className="w-full max-w-full overflow-hidden">
      <PageMeta
        title="Bug Report"
        description="Sprint-wise and bug-wise bug report"
      />

      <PageBreadcrumb pageTitle="Bug Report" />

      <div className="mt-4 min-w-0">
        {/* Statistics */}
        <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-5">
          {cards.map((card) => (
            <div
              key={card.label}
              className="rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-sm dark:border-gray-700 dark:bg-gray-900"
            >
              <p className="mb-1 text-xs text-gray-500 dark:text-gray-400">
                {card.label}
              </p>

              <p
                className={`text-2xl font-bold ${card.color}`}
              >
                {loading ? "-" : card.value}
              </p>
            </div>
          ))}
        </div>

        {error && (
          <div className="mb-4">
            <Alert
              variant="error"
              title="Error"
              message={error}
            />
          </div>
        )}

        {/* Filters */}
        <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div className="relative md:col-span-2">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400" />

              <input
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder={
                  reportView === "sprint"
                    ? "Search project or sprint..."
                    : "Search bug ID, title, project, sprint, function..."
                }
                className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-8 pr-8 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              />

              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                >
                  <FaTimes className="text-xs" />
                </button>
              )}
            </div>

            <select
              value={projectId}
              onChange={(event) => {
                setProjectId(event.target.value);
                setSprintId("");
              }}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            >
              <option value="">All Projects</option>

              {(projects ?? []).map((project) => (
                <option
                  key={project.id}
                  value={project.id}
                >
                  {project.project_name ?? project.name}
                </option>
              ))}
            </select>

            <select
              value={sprintId}
              onChange={(event) =>
                setSprintId(event.target.value)
              }
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            >
              <option value="">All Sprints</option>

              {(sprints ?? [])
                .filter(
                  (sprint) =>
                    !projectId ||
                    String(sprint.project_id) ===
                      String(projectId),
                )
                .map((sprint) => (
                  <option
                    key={sprint.id}
                    value={sprint.id}
                  >
                    {sprint.sprint_name}
                  </option>
                ))}
            </select>
          </div>

          {(projectId || sprintId || search) && (
            <button
              type="button"
              onClick={clearFilters}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300"
            >
              <FaTimes />
              Clear filters
            </button>
          )}
        </div>

        {/* Header / Export */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <FaBug className="text-blue-500" />

            {reportView === "sprint"
              ? `${filteredSummary.length} sprint summaries`
              : `${filteredBugWise.length} bug/sprint records`}
          </div>

          <button
            type="button"
            onClick={handleExport}
            disabled={
              reportView === "sprint"
                ? filteredSummary.length === 0
                : filteredBugWise.length === 0
            }
            className="inline-flex items-center gap-2 rounded-lg border border-green-600 px-3 py-2 text-sm font-medium text-green-700 hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-green-400 dark:hover:bg-green-900/20"
          >
            <FaFileExcel />
            Export Excel
          </button>
        </div>

        {/* Report tabs */}
        <div className="mb-3 flex gap-1 overflow-x-auto rounded-xl border border-gray-200 bg-white px-2 pt-2 dark:border-gray-700 dark:bg-gray-900">
          <button
            type="button"
            onClick={() => setReportView("sprint")}
            className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              reportView === "sprint"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400"
            }`}
          >
            Sprint-wise Report ({filteredSummary.length})
          </button>

          <button
            type="button"
            onClick={() => setReportView("bug")}
            className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              reportView === "bug"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400"
            }`}
          >
            Bug-wise Report ({filteredBugWise.length})
          </button>
        </div>

        {/* Sprint-wise */}
        {reportView === "sprint" && (
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase text-gray-500 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-400">
                <tr>
                  <th className="px-4 py-3">
                    Project
                  </th>
                  <th className="px-4 py-3">
                    Sprint
                  </th>
                  <th className="px-4 py-3">
                    Bugs
                  </th>
                  <th className="px-4 py-3">
                    Pass
                  </th>
                  <th className="px-4 py-3">
                    Fail
                  </th>
                  <th className="px-4 py-3">
                    Blocked
                  </th>
                  <th className="px-4 py-3">
                    No Test
                  </th>
                  <th className="px-4 py-3">
                    Latest Update
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {loading ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-10 text-center text-gray-400"
                    >
                      Loading report...
                    </td>
                  </tr>
                ) : filteredSummary.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-10 text-center text-gray-400"
                    >
                      No sprint summary data available
                    </td>
                  </tr>
                ) : (
                  filteredSummary.map((row) => (
                    <tr
                      key={`${row.project_id}-${row.sprint_id}`}
                      className="hover:bg-gray-50 dark:hover:bg-gray-800/40"
                    >
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-gray-800 dark:text-gray-200">
                        {row.project_name ??
                          `Project ${row.project_id}`}
                      </td>

                      <td className="whitespace-nowrap px-4 py-3 text-gray-600 dark:text-gray-300">
                        {row.sprint_name ??
                          `Sprint ${row.sprint_id}`}
                      </td>

                      <td className="px-4 py-3 font-semibold text-gray-800 dark:text-gray-200">
                        {numberValue(row.bug_count)}
                      </td>

                      <td
                        className={`px-4 py-3 font-semibold ${STATUS_COLORS.pass}`}
                      >
                        {numberValue(row.pass_count)}
                      </td>

                      <td
                        className={`px-4 py-3 font-semibold ${STATUS_COLORS.fail}`}
                      >
                        {numberValue(row.fail_count)}
                      </td>

                      <td
                        className={`px-4 py-3 font-semibold ${STATUS_COLORS.blocked}`}
                      >
                        {numberValue(row.blocked_count)}
                      </td>

                      <td
                        className={`px-4 py-3 font-semibold ${STATUS_COLORS.noTest}`}
                      >
                        {numberValue(row.no_test_count)}
                      </td>

                      <td className="whitespace-nowrap px-4 py-3 text-gray-500 dark:text-gray-400">
                        {formatDate(
                          row.latest_status_date,
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Bug-wise */}
        {reportView === "bug" && (
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <table className="min-w-[1450px] w-full text-left text-sm">
              <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase text-gray-500 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-400">
                <tr>
                  <th className="px-4 py-3">
                    Bug ID
                  </th>
                  <th className="px-4 py-3">
                    Title
                  </th>
                  <th className="px-4 py-3">
                    Project
                  </th>
                  <th className="px-4 py-3">
                    Sprint
                  </th>
                  <th className="px-4 py-3">
                    Function
                  </th>
                  <th className="px-4 py-3">
                    Severity
                  </th>
                  <th className="px-4 py-3">
                    Bug Status
                  </th>
                  <th className="px-4 py-3">
                    Assigned To
                  </th>
                  <th className="px-4 py-3">
                    Pass
                  </th>
                  <th className="px-4 py-3">
                    Fail
                  </th>
                  <th className="px-4 py-3">
                    Blocked
                  </th>
                  <th className="px-4 py-3">
                    No Test
                  </th>
                  <th className="px-4 py-3">
                    Latest Cycle
                  </th>
                  <th className="px-4 py-3">
                    Latest Update
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {loading ? (
                  <tr>
                    <td
                      colSpan={14}
                      className="px-4 py-10 text-center text-gray-400"
                    >
                      Loading report...
                    </td>
                  </tr>
                ) : filteredBugWise.length === 0 ? (
                  <tr>
                    <td
                      colSpan={14}
                      className="px-4 py-10 text-center text-gray-400"
                    >
                      No bug-wise report data available
                    </td>
                  </tr>
                ) : (
                  filteredBugWise.map((row) => (
                    <tr
                      key={`${row.bug_id}-${row.sprint_id}`}
                      className="hover:bg-gray-50 dark:hover:bg-gray-800/40"
                    >
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs font-semibold text-gray-700 dark:text-gray-300">
                        {row.report_id}
                      </td>

                      <td className="max-w-[320px] px-4 py-3">
                        <p
                          className="truncate font-medium text-gray-800 dark:text-gray-200"
                          title={row.title}
                        >
                          {row.title}
                        </p>
                      </td>

                      <td className="whitespace-nowrap px-4 py-3 text-gray-600 dark:text-gray-300">
                        {row.project_name ??
                          `Project ${row.project_id}`}
                      </td>

                      <td className="whitespace-nowrap px-4 py-3 text-gray-600 dark:text-gray-300">
                        {row.sprint_name ??
                          `Sprint ${row.sprint_id}`}
                      </td>

                      <td className="whitespace-nowrap px-4 py-3 text-gray-500 dark:text-gray-400">
                        {row.function_name || "—"}
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${severityBadge(
                            row.severity,
                          )}`}
                        >
                          {row.severity}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${bugStatusBadge(
                            row.bug_status,
                          )}`}
                        >
                          {row.bug_status}
                        </span>
                      </td>

                      <td className="whitespace-nowrap px-4 py-3 text-gray-500 dark:text-gray-400">
                        {row.assigned_to_name ||
                          "Unassigned"}
                      </td>

                      <td
                        className={`px-4 py-3 font-semibold ${STATUS_COLORS.pass}`}
                      >
                        {numberValue(row.pass_count)}
                      </td>

                      <td
                        className={`px-4 py-3 font-semibold ${STATUS_COLORS.fail}`}
                      >
                        {numberValue(row.fail_count)}
                      </td>

                      <td
                        className={`px-4 py-3 font-semibold ${STATUS_COLORS.blocked}`}
                      >
                        {numberValue(
                          row.blocked_count,
                        )}
                      </td>

                      <td
                        className={`px-4 py-3 font-semibold ${STATUS_COLORS.noTest}`}
                      >
                        {numberValue(
                          row.no_test_count,
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${cycleBadge(
                            row.latest_status,
                          )}`}
                        >
                          {row.latest_status || "—"}
                        </span>
                      </td>

                      <td className="whitespace-nowrap px-4 py-3 text-gray-500 dark:text-gray-400">
                        {formatDate(
                          row.latest_status_date,
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Totals */}
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
          {[
            {
              label: "Tracked Bugs",
              value: totals.bugs,
              color: "text-blue-600",
            },
            {
              label: "Pass Cycles",
              value: totals.pass,
              color: "text-green-600",
            },
            {
              label: "Fail Cycles",
              value: totals.fail,
              color: "text-red-600",
            },
            {
              label: "Blocked Cycles",
              value: totals.blocked,
              color: "text-amber-600",
            },
            {
              label: "No Test Cycles",
              value: totals.noTest,
              color: "text-gray-500",
            },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm dark:border-gray-700 dark:bg-gray-900"
            >
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {item.label}
              </p>

              <p
                className={`mt-1 text-xl font-bold ${item.color} dark:text-opacity-90`}
              >
                {item.value}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
