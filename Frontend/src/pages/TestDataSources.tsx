import { useEffect, useMemo, useState } from "react";
import {
  FaDatabase,
  FaEye,
  FaFileCsv,
  FaFileExcel,
  FaFileCode,
  FaPlus,
  FaSearch,
  FaTimes,
  FaTrash,
  FaUpload,
} from "react-icons/fa";
import PageBreadcrumb from "../components/common/PageBreadCrumb";
import PageMeta from "../components/common/PageMeta";
import Alert from "../components/ui/alert/Alert";
import useFetchWithAuth from "../hooks/useFetchWithAuth";
import API from "../services/api";
import TablePagination from "../components/common/TablePagination";

interface TestCase {
  id: number;
  title?: string;
  test_case_id?: string;
  report_id?: string;
}

interface DataSource {
  id: number;
  testCaseId: number;
  testCaseTitle?: string | null;
  testCaseCode?: string | null;
  sourceType: string;
  sourcePath?: string | null;
  fileName: string;
  rowCount: number;
  createdAt?: string | null;
}

interface DataSourcePreview {
  sourceId: number;
  testCaseId: number;
  sourceType: string;
  sourcePath?: string | null;
  fileName: string;
  rowCount: number;
  preview: Record<string, unknown>[];
  columns: string[];
  invalidRows?: number;
  page?: number;
  pageSize?: number;
  totalPages?: number;
}

type AlertState = {
  type: "success" | "error";
  message: string;
} | null;

const getToken = () =>
  localStorage.getItem("token") || sessionStorage.getItem("token");

const normalizeTestCases = (value: unknown): TestCase[] => {
  if (Array.isArray(value)) {
    return value as TestCase[];
  }

  if (
    value &&
    typeof value === "object" &&
    "data" in value &&
    Array.isArray((value as { data?: unknown }).data)
  ) {
    return (value as { data: TestCase[] }).data;
  }

  return [];
};

const sourceIcon = (sourceType?: string) => {
  switch (String(sourceType || "").toUpperCase()) {
    case "CSV":
      return <FaFileCsv className="text-green-600" />;
    case "XLSX":
      return <FaFileExcel className="text-green-700" />;
    case "JSON":
      return <FaFileCode className="text-amber-600" />;
    default:
      return <FaDatabase className="text-blue-600" />;
  }
};

const sourceBadge = (sourceType?: string) => {
  switch (String(sourceType || "").toUpperCase()) {
    case "CSV":
      return "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300";
    case "XLSX":
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300";
    case "JSON":
      return "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300";
    default:
      return "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300";
  }
};

const formatCellValue = (value: unknown) => {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  return String(value);
};

const PREVIEW_PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

const formatDate = (value?: string | null) => {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleString();
};

export default function TestDataSources() {
  const {
    data: testCaseResponse,
    refetch: refetchTestCases,
  } = useFetchWithAuth<any>("/api/test-cases");

  const [sources, setSources] = useState<DataSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");

  const [search, setSearch] = useState("");
  const [testCaseFilter, setTestCaseFilter] = useState("");
  const [sourceTypeFilter, setSourceTypeFilter] = useState("");

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadAlert, setUploadAlert] = useState<AlertState>(null);
  const [uploadForm, setUploadForm] = useState({
    testCaseId: "",
    sourceType: "CSV",
    file: null as File | null,
  });

  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [previewData, setPreviewData] = useState<DataSourcePreview | null>(null);
  const [previewSource, setPreviewSource] = useState<DataSource | null>(null);
  const [previewPage, setPreviewPage] = useState(1);
  const [previewPageSize, setPreviewPageSize] = useState(25);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingSource, setDeletingSource] = useState<DataSource | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteAlert, setDeleteAlert] = useState<AlertState>(null);

  const testCases = useMemo(
    () => normalizeTestCases(testCaseResponse),
    [testCaseResponse],
  );

  const loadSources = async () => {
    const token = getToken();

    if (!token) {
      setPageError("User not authenticated.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setPageError("");

      const response = await API.get("/api/data-testing/data-drive/sources", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.data?.success === false) {
        setPageError(response.data?.error || "Failed to load test data sources.");
        setSources([]);
        return;
      }

      setSources(response.data?.data?.sources ?? []);
    } catch (error: any) {
      console.error("Failed to load test data sources:", error);

      setPageError(
        error.response?.data?.error ||
          error.response?.data?.message ||
          "Failed to load test data sources.",
      );

      setSources([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSources();
  }, []);

  const filteredSources = useMemo(() => {
    const query = search.trim().toLowerCase();

    return sources.filter((source) => {
      if (
        testCaseFilter &&
        String(source.testCaseId) !== String(testCaseFilter)
      ) {
        return false;
      }

      if (
        sourceTypeFilter &&
        String(source.sourceType).toUpperCase() !==
          String(sourceTypeFilter).toUpperCase()
      ) {
        return false;
      }

      if (!query) {
        return true;
      }

      return [
        source.id,
        source.fileName,
        source.sourceType,
        source.testCaseId,
        source.testCaseTitle,
        source.testCaseCode,
      ]
        .filter(
          (value) =>
            value !== null && value !== undefined && String(value).trim(),
        )
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [sources, search, testCaseFilter, sourceTypeFilter]);

  const clearFilters = () => {
    setSearch("");
    setTestCaseFilter("");
    setSourceTypeFilter("");
  };

  const openUploadModal = () => {
    setUploadForm({
      testCaseId: "",
      sourceType: "CSV",
      file: null,
    });

    setUploadAlert(null);
    setShowUploadModal(true);
  };

  const closeUploadModal = () => {
    if (uploading) return;

    setShowUploadModal(false);
    setUploadAlert(null);

    setUploadForm({
      testCaseId: "",
      sourceType: "CSV",
      file: null,
    });
  };

  const handleUpload = async () => {
    if (!uploadForm.testCaseId) {
      setUploadAlert({
        type: "error",
        message: "Please select a test case.",
      });
      return;
    }

    if (!uploadForm.sourceType) {
      setUploadAlert({
        type: "error",
        message: "Please select a source type.",
      });
      return;
    }

    if (!uploadForm.file) {
      setUploadAlert({
        type: "error",
        message: "Please select a data file.",
      });
      return;
    }

    const token = getToken();

    if (!token) {
      setUploadAlert({
        type: "error",
        message: "User not authenticated.",
      });
      return;
    }

    const expectedExtension = {
      CSV: [".csv"],
      XLSX: [".xlsx"],
      JSON: [".json"],
    }[uploadForm.sourceType];

    const lowerFileName = uploadForm.file.name.toLowerCase();

    if (
      expectedExtension &&
      !expectedExtension.some((extension) =>
        lowerFileName.endsWith(extension),
      )
    ) {
      setUploadAlert({
        type: "error",
        message: `Selected file does not match ${uploadForm.sourceType} format.`,
      });
      return;
    }

    try {
      setUploading(true);
      setUploadAlert(null);

      const formData = new FormData();

      formData.append("testCaseId", uploadForm.testCaseId);
      formData.append("sourceType", uploadForm.sourceType);
      formData.append("file", uploadForm.file);

      const response = await API.post(
        "/api/data-testing/data-drive/upload",
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
        },
      );

      if (response.data?.success === false) {
        setUploadAlert({
          type: "error",
          message: response.data?.error || "Upload failed.",
        });
        return;
      }

      setUploadAlert({
        type: "success",
        message: "Test dataset uploaded successfully.",
      });

      await Promise.all([loadSources(), refetchTestCases()]);

      setTimeout(() => {
        closeUploadModal();
      }, 900);
    } catch (error: any) {
      console.error("Dataset upload failed:", error);

      setUploadAlert({
        type: "error",
        message:
          error.response?.data?.error ||
          error.response?.data?.message ||
          "Failed to upload test dataset.",
      });
    } finally {
      setUploading(false);
    }
  };

  const loadPreviewPage = async (
    sourceId: number,
    page: number,
    pageSize: number,
  ) => {
    const token = getToken();

    if (!token) {
      setPreviewError("User not authenticated.");
      return;
    }

    setPreviewLoading(true);
    setPreviewError("");

    try {
      const response = await API.get(
        `/api/data-testing/data-drive/source/${sourceId}`,
        {
          params: {
            page,
            pageSize,
          },
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (response.data?.success === false) {
        setPreviewError(
          response.data?.error || "Failed to load dataset preview.",
        );
        return;
      }

      setPreviewData(response.data?.data ?? null);
    } catch (error: any) {
      console.error("Failed to load dataset preview:", error);

      setPreviewError(
        error.response?.data?.error ||
          error.response?.data?.message ||
          "Failed to load dataset preview.",
      );
    } finally {
      setPreviewLoading(false);
    }
  };

  const openPreview = async (source: DataSource) => {
    setPreviewSource(source);
    setPreviewPage(1);
    setPreviewPageSize(25);
    setShowPreviewModal(true);
    setPreviewData(null);
    setPreviewError("");

    await loadPreviewPage(source.id, 1, 25);
  };

  const handlePreviewPageChange = async (page: number) => {
    if (!previewSource || previewLoading) {
      return;
    }

    const totalPages = Math.max(
      1,
      previewData?.totalPages ??
        Math.ceil((previewData?.rowCount ?? 0) / previewPageSize),
    );

    const nextPage = Math.max(1, Math.min(page, totalPages));

    setPreviewPage(nextPage);

    await loadPreviewPage(
      previewSource.id,
      nextPage,
      previewPageSize,
    );
  };

  const handlePreviewPageSizeChange = async (size: number) => {
    if (!previewSource || previewLoading) {
      return;
    }

    setPreviewPageSize(size);
    setPreviewPage(1);

    await loadPreviewPage(
      previewSource.id,
      1,
      size,
    );
  };

  const closePreviewModal = () => {
    setShowPreviewModal(false);
    setPreviewData(null);
    setPreviewSource(null);
    setPreviewError("");
    setPreviewPage(1);
    setPreviewPageSize(25);
  };

  const openDeleteModal = (source: DataSource) => {
    setDeletingSource(source);
    setDeleteAlert(null);
    setShowDeleteModal(true);
  };

  const closeDeleteModal = () => {
    if (deleting) return;

    setShowDeleteModal(false);
    setDeletingSource(null);
    setDeleteAlert(null);
  };

  const handleDelete = async () => {
    if (!deletingSource) return;

    const token = getToken();

    if (!token) {
      setDeleteAlert({
        type: "error",
        message: "User not authenticated.",
      });
      return;
    }

    try {
      setDeleting(true);
      setDeleteAlert(null);

      const response = await API.delete(
        `/api/data-testing/data-drive/source/${deletingSource.id}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (response.data?.success === false) {
        setDeleteAlert({
          type: "error",
          message: response.data?.error || "Failed to delete dataset.",
        });
        return;
      }

      setDeleteAlert({
        type: "success",
        message: "Test dataset deleted successfully.",
      });

      await loadSources();

      setTimeout(() => {
        closeDeleteModal();
      }, 900);
    } catch (error: any) {
      console.error("Failed to delete dataset:", error);

      setDeleteAlert({
        type: "error",
        message:
          error.response?.data?.error ||
          error.response?.data?.message ||
          "Failed to delete test dataset.",
      });
    } finally {
      setDeleting(false);
    }
  };

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;

      if (showPreviewModal) {
        closePreviewModal();
        return;
      }

      if (showDeleteModal && !deleting) {
        closeDeleteModal();
        return;
      }

      if (showUploadModal && !uploading) {
        closeUploadModal();
      }
    };

    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [
    showPreviewModal,
    showDeleteModal,
    showUploadModal,
    deleting,
    uploading,
  ]);

  return (
    <div>
      <PageMeta
        title="Test Data Sources"
        description="Manage data-driven testing datasets"
      />

      <PageBreadcrumb pageTitle="Test Data Sources" />

      <div className="mt-4">
        <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Test Data Master
            </h2>

            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Manage reusable CSV, Excel and JSON datasets used by data-driven
              test cases.
            </p>
          </div>

          <button
            type="button"
            onClick={openUploadModal}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition duration-150 hover:bg-blue-700"
          >
            <FaPlus className="text-xs" />
            Add Dataset
          </button>
        </div>

        {pageError && (
          <div className="mb-4">
            <Alert variant="error" title="Error" message={pageError} />
          </div>
        )}

        <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <div className="relative min-w-0 flex-1">
              <FaSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400" />

              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search file, test case or source type..."
                className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-8 pr-8 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              />

              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  <FaTimes className="text-xs" />
                </button>
              )}
            </div>

            <select
              value={testCaseFilter}
              onChange={(event) => setTestCaseFilter(event.target.value)}
              className="min-w-[220px] rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            >
              <option value="">All Test Cases</option>

              {testCases.map((testCase) => (
                <option key={testCase.id} value={testCase.id}>
                  {testCase.test_case_id || testCase.report_id
                    ? `${testCase.test_case_id || testCase.report_id} - `
                    : ""}
                  {testCase.title || `Test Case ${testCase.id}`}
                </option>
              ))}
            </select>

            <select
              value={sourceTypeFilter}
              onChange={(event) => setSourceTypeFilter(event.target.value)}
              className="min-w-[150px] rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            >
              <option value="">All Types</option>
              <option value="CSV">CSV</option>
              <option value="XLSX">XLSX</option>
              <option value="JSON">JSON</option>
            </select>

            {(search || testCaseFilter || sourceTypeFilter) && (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-gray-300 bg-gray-100 px-3 py-2 text-xs font-medium text-gray-600 transition hover:bg-gray-200 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                <FaTimes className="text-[10px]" />
                Clear
              </button>
            )}
          </div>
        </div>

        {loading && !pageError ? (
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Loading test data sources...
          </div>
        ) : !pageError ? (
          <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-lg dark:border-gray-700">
            <table className="w-full min-w-[1050px] text-left text-sm">
              <thead className="bg-gray-100 text-xs uppercase tracking-wider text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                <tr>
                  <th className="px-5 py-3">#</th>
                  <th className="px-5 py-3">Dataset</th>
                  <th className="px-5 py-3">Test Case</th>
                  <th className="px-5 py-3">Type</th>
                  <th className="px-5 py-3">Rows</th>
                  <th className="px-5 py-3">Created</th>
                  <th className="px-5 py-3">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-200 bg-white text-gray-700 dark:divide-gray-700 dark:bg-gray-900 dark:text-gray-200">
                {filteredSources.length > 0 ? (
                  filteredSources.map((source, index) => (
                    <tr
                      key={source.id}
                      className="transition duration-150 hover:bg-gray-50 dark:hover:bg-gray-800"
                    >
                      <td className="px-5 py-3">{index + 1}</td>

                      <td className="px-5 py-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800">
                            {sourceIcon(source.sourceType)}
                          </span>

                          <div className="min-w-0">
                            <p
                              className="max-w-[320px] truncate text-sm font-medium text-gray-900 dark:text-white"
                              title={source.fileName}
                            >
                              {source.fileName}
                            </p>

                            <p className="text-[11px] text-gray-400">
                              Source #{source.id}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-3">
                        <div className="max-w-[320px]">
                          <p className="truncate text-sm text-gray-800 dark:text-gray-200">
                            {source.testCaseTitle ||
                              `Test Case ${source.testCaseId}`}
                          </p>

                          <p className="text-[11px] text-gray-400">
                            {source.testCaseCode
                              ? source.testCaseCode
                              : `ID: ${source.testCaseId}`}
                          </p>
                        </div>
                      </td>

                      <td className="px-5 py-3">
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-semibold ${sourceBadge(
                            source.sourceType,
                          )}`}
                        >
                          {source.sourceType}
                        </span>
                      </td>

                      <td className="px-5 py-3">
                        <span className="font-semibold text-gray-800 dark:text-gray-100">
                          {source.rowCount}
                        </span>
                      </td>

                      <td className="px-5 py-3 whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">
                        {formatDate(source.createdAt)}
                      </td>

                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => openPreview(source)}
                            aria-label={`Preview ${source.fileName}`}
                            title="Preview dataset"
                            className="text-blue-600 transition hover:text-blue-700"
                          >
                            <FaEye />
                          </button>

                          <button
                            type="button"
                            onClick={() => openDeleteModal(source)}
                            aria-label={`Delete ${source.fileName}`}
                            title="Delete dataset"
                            className="text-red-600 transition hover:text-red-700"
                          >
                            <FaTrash />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-5 py-10 text-center text-gray-500"
                    >
                      No test data sources found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : null}

        {!loading && !pageError && (
          <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
            Showing{" "}
            <span className="font-semibold text-gray-700 dark:text-gray-200">
              {filteredSources.length}
            </span>{" "}
            of{" "}
            <span className="font-semibold text-gray-700 dark:text-gray-200">
              {sources.length}
            </span>{" "}
            datasets
          </div>
        )}
      </div>

      {showUploadModal && (
        <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-900">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Add Test Dataset
                </h2>

                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Upload a CSV, XLSX or JSON file for a test case.
                </p>
              </div>

              <button
                type="button"
                onClick={closeUploadModal}
                disabled={uploading}
                className="text-xl font-bold text-gray-400 hover:text-gray-600 disabled:opacity-50 dark:hover:text-gray-200"
              >
                &times;
              </button>
            </div>

            {uploadAlert && (
              <div className="mb-4">
                <Alert
                  variant={uploadAlert.type}
                  title={uploadAlert.type === "success" ? "Success" : "Error"}
                  message={uploadAlert.message}
                />
              </div>
            )}

            <div className="mb-4">
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Test Case <span className="text-red-500">*</span>
              </label>

              <select
                value={uploadForm.testCaseId}
                disabled={uploading}
                onChange={(event) =>
                  setUploadForm((previous) => ({
                    ...previous,
                    testCaseId: event.target.value,
                  }))
                }
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 disabled:opacity-60 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              >
                <option value="">-- Select Test Case --</option>

                {testCases.map((testCase) => (
                  <option key={testCase.id} value={testCase.id}>
                    {testCase.test_case_id || testCase.report_id
                      ? `${testCase.test_case_id || testCase.report_id} - `
                      : ""}
                    {testCase.title || `Test Case ${testCase.id}`}
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-4">
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Data Type <span className="text-red-500">*</span>
              </label>

              <select
                value={uploadForm.sourceType}
                disabled={uploading}
                onChange={(event) =>
                  setUploadForm((previous) => ({
                    ...previous,
                    sourceType: event.target.value,
                    file: null,
                  }))
                }
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 disabled:opacity-60 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              >
                <option value="CSV">CSV</option>
                <option value="XLSX">Excel (.xlsx)</option>
                <option value="JSON">JSON</option>
              </select>
            </div>

            <div className="mb-6">
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Dataset File <span className="text-red-500">*</span>
              </label>

              <label className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 px-4 py-5 transition hover:border-blue-400 hover:bg-blue-50/40 dark:border-gray-600 dark:bg-gray-800 dark:hover:border-blue-500 dark:hover:bg-gray-800">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300">
                  <FaUpload />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-gray-800 dark:text-gray-200">
                    {uploadForm.file
                      ? uploadForm.file.name
                      : "Choose a dataset file"}
                  </span>

                  <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">
                    Expected format: {uploadForm.sourceType}
                  </span>
                </span>

                <input
                  type="file"
                  disabled={uploading}
                  accept={
                    uploadForm.sourceType === "CSV"
                      ? ".csv,text/csv"
                      : uploadForm.sourceType === "XLSX"
                        ? ".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                        : ".json,application/json"
                  }
                  onChange={(event) =>
                    setUploadForm((previous) => ({
                      ...previous,
                      file: event.target.files?.[0] ?? null,
                    }))
                  }
                  className="hidden"
                />
              </label>
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={closeUploadModal}
                disabled={uploading}
                className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-200 disabled:opacity-60 dark:bg-gray-700 dark:text-gray-300"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleUpload}
                disabled={uploading}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
              >
                <FaUpload className="text-xs" />
                {uploading ? "Uploading..." : "Upload Dataset"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showPreviewModal && (
        <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="flex h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-900">
            {/* Fixed Header */}
            <div className="shrink-0 border-b border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
              <div className="flex items-center justify-between px-6 py-4">
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-semibold text-gray-900 dark:text-white">
                    Dataset Preview
                  </h2>

                  {previewData && (
                    <p className="mt-1 truncate text-xs text-gray-500 dark:text-gray-400">
                      {previewData.fileName} • {previewData.rowCount} rows •{" "}
                      {previewData.columns.length} columns
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={closePreviewModal}
                  className="ml-4 text-xl font-bold text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  &times;
                </button>
              </div>

              {/* Fixed Summary */}
              {previewData && !previewError && (
                <div className="grid grid-cols-2 gap-3 border-t border-gray-100 px-6 py-4 sm:grid-cols-4 dark:border-gray-800">
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/50">
                    <p className="text-[11px] uppercase text-gray-400">
                      Source Type
                    </p>

                    <p className="mt-1 text-sm font-semibold text-gray-800 dark:text-gray-200">
                      {previewData.sourceType}
                    </p>
                  </div>

                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/50">
                    <p className="text-[11px] uppercase text-gray-400">
                      Total Rows
                    </p>

                    <p className="mt-1 text-sm font-semibold text-gray-800 dark:text-gray-200">
                      {previewData.rowCount}
                    </p>
                  </div>

                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/50">
                    <p className="text-[11px] uppercase text-gray-400">
                      Columns
                    </p>

                    <p className="mt-1 text-sm font-semibold text-gray-800 dark:text-gray-200">
                      {previewData.columns.length}
                    </p>
                  </div>

                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/50">
                    <p className="text-[11px] uppercase text-gray-400">
                      Invalid Rows
                    </p>

                    <p className="mt-1 text-sm font-semibold text-gray-800 dark:text-gray-200">
                      {previewData.invalidRows ?? 0}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Scrollable Dataset Only */}
            <div className="min-h-0 flex-1 overflow-hidden">
              {previewLoading && !previewData ? (
                <div className="flex h-full items-center justify-center p-6 text-sm text-gray-500">
                  Loading dataset preview...
                </div>
              ) : previewError ? (
                <div className="p-6">
                  <Alert
                    variant="error"
                    title="Error"
                    message={previewError}
                  />
                </div>
              ) : previewData ? (
                <div className="h-full overflow-auto">
                  <table className="min-w-full border-collapse text-left text-xs">
                    <thead className="sticky top-0 z-20 bg-gray-100 text-gray-700 shadow-sm dark:bg-gray-800 dark:text-gray-200">
                      <tr>
                        <th className="whitespace-nowrap border-b border-gray-200 px-3 py-2 dark:border-gray-700">
                          #
                        </th>

                        {previewData.columns.map((column) => (
                          <th
                            key={column}
                            className="whitespace-nowrap border-b border-gray-200 px-3 py-2 font-semibold dark:border-gray-700"
                          >
                            {column}
                          </th>
                        ))}
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-gray-200 bg-white text-gray-700 dark:divide-gray-700 dark:bg-gray-900 dark:text-gray-200">
                      {previewData.preview.length > 0 ? (
                        previewData.preview.map((row, rowIndex) => {
                          const absoluteRowNumber =
                            (previewPage - 1) * previewPageSize +
                            rowIndex +
                            1;

                          return (
                            <tr
                              key={absoluteRowNumber}
                              className="hover:bg-gray-50 dark:hover:bg-gray-800/50"
                            >
                              <td className="whitespace-nowrap px-3 py-2 text-gray-400">
                                {absoluteRowNumber}
                              </td>

                              {previewData.columns.map((column) => (
                                <td
                                  key={`${absoluteRowNumber}-${column}`}
                                  className="max-w-[320px] px-3 py-2"
                                >
                                  <div
                                    className="max-w-[320px] truncate"
                                    title={formatCellValue(row[column])}
                                  >
                                    {formatCellValue(row[column]) || (
                                      <span className="text-gray-300">
                                        —
                                      </span>
                                    )}
                                  </div>
                                </td>
                              ))}
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td
                            colSpan={Math.max(
                              1,
                              previewData.columns.length + 1,
                            )}
                            className="px-4 py-10 text-center text-gray-400"
                          >
                            No rows available on this page
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>

                  {previewLoading && previewData && (
                    <div className="sticky bottom-0 border-t border-gray-200 bg-white/95 px-4 py-2 text-center text-xs text-gray-500 backdrop-blur dark:border-gray-700 dark:bg-gray-900/95">
                      Loading page...
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex h-full items-center justify-center p-6 text-sm text-gray-500">
                  No preview data available.
                </div>
              )}
            </div>

            {/* Fixed Pagination */}
            <div className="shrink-0 border-t border-gray-200 bg-white px-6 py-3 dark:border-gray-700 dark:bg-gray-900">
              {previewData ? (
                <TablePagination
                  totalItems={previewData.rowCount}
                  currentPage={previewPage}
                  totalPages={Math.max(
                    1,
                    previewData.totalPages ??
                      Math.ceil(
                        previewData.rowCount / previewPageSize,
                      ),
                  )}
                  pageSize={previewPageSize}
                  pageSizeOptions={PREVIEW_PAGE_SIZE_OPTIONS}
                  onPageChange={handlePreviewPageChange}
                  onPageSizeChange={handlePreviewPageSizeChange}
                />
              ) : (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={closePreviewModal}
                    className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300"
                  >
                    Close
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showDeleteModal && deletingSource && (
        <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-900">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Delete Dataset
              </h2>

              <button
                type="button"
                onClick={closeDeleteModal}
                disabled={deleting}
                className="text-xl font-bold text-gray-400 hover:text-gray-600 disabled:opacity-50 dark:hover:text-gray-200"
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

            <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
              <p className="text-sm text-gray-700 dark:text-gray-300">
                Are you sure you want to delete{" "}
                <span className="font-semibold text-gray-900 dark:text-white">
                  {deletingSource.fileName}
                </span>
                ?
              </p>

              <p className="mt-2 text-xs text-red-700 dark:text-red-300">
                This will remove the dataset and all persisted rows associated
                with it. This action cannot be undone.
              </p>
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={closeDeleteModal}
                disabled={deleting}
                className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-200 disabled:opacity-60 dark:bg-gray-700 dark:text-gray-300"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-60"
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