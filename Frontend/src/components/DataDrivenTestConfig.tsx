import React, { useCallback, useEffect, useMemo, useState } from "react";

import {
  FaCheckCircle,
  FaChevronDown,
  FaDatabase,
  FaEdit,
  FaPlay,
  FaPlus,
  FaSave,
  FaSearch,
  FaSync,
  FaTimes,
  FaTrash,
  FaUpload,
} from "react-icons/fa";

import API from "../services/api";
import { authHeaders } from "../pages/TestManagement/Playwright/helpers";

type SourceType = "CSV" | "XLSX" | "JSON";

interface Props {
  testCaseId: number | string;
}

interface MessageState {
  type: "success" | "error" | "info";
  text: string;
}

interface SavedDataSource {
  id: number;
  testCaseId: number;
  sourceType: SourceType | string;
  sourcePath?: string;
  fileName: string;
  rowCount: number;
}

interface UploadResponseData {
  sourceId: number;
  fileName?: string;
  sourceType?: SourceType | string;
  preview: Record<string, unknown>[];
  rowCount: number;
  columns?: string[];
}

interface MappingRow {
  id: string | number;
  placeholder: string;
  dataColumn: string;
  transformation: string;
}

interface MappingSetSummary {
  id: number;
  testCaseId: number;
  name: string;
  description?: string;
  rowsCount: number;
  createdAt?: string;
  updatedAt?: string;
}

interface LoadedMappingSet {
  id: number;
  testCaseId: number;
  name: string;
  description?: string;
  rows: MappingRow[];
}

const ACCEPTED_FILES: Record<SourceType, string> = {
  CSV: ".csv,text/csv",

  XLSX: ".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",

  JSON: ".json,application/json",
};

const createMappingRow = (): MappingRow => ({
  id: `new-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,

  placeholder: "",
  dataColumn: "",
  transformation: "None",
});

const isObjectRow = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export default function DataDrivenTestConfig({ testCaseId }: Props) {
  /* ======================================================================== */
  /* Test data                                                                */
  /* ======================================================================== */

  const [sourceType, setSourceType] = useState<SourceType>("CSV");

  const [savedSources, setSavedSources] = useState<SavedDataSource[]>([]);

  const [loadingSources, setLoadingSources] = useState(false);

  const [loadingSavedSource, setLoadingSavedSource] = useState(false);

  const [dataSourceId, setDataSourceId] = useState<number | null>(null);

  const [selectedFileName, setSelectedFileName] = useState("");

  const [preview, setPreview] = useState<Record<string, unknown>[]>([]);

  const [rowCount, setRowCount] = useState(0);

  const [sourceSearch, setSourceSearch] = useState("");

  const [showSourceDropdown, setShowSourceDropdown] = useState(false);

  /* ======================================================================== */
  /* Mapping sets                                                             */
  /* ======================================================================== */

  const [mappingSets, setMappingSets] = useState<MappingSetSummary[]>([]);

  const [selectedMappingSetId, setSelectedMappingSetId] = useState<
    number | null
  >(null);

  const [mappingSetName, setMappingSetName] = useState("");

  const [mappingSetDescription, setMappingSetDescription] = useState("");

  const [mappingRows, setMappingRows] = useState<MappingRow[]>([]);

  const [loadingMappingSets, setLoadingMappingSets] = useState(false);

  const [loadingMappingSet, setLoadingMappingSet] = useState(false);

  const [savingMappingSet, setSavingMappingSet] = useState(false);

  const [deletingMappingSet, setDeletingMappingSet] = useState(false);

  const [mappingSetSearch, setMappingSetSearch] = useState("");

  const [showMappingSetDropdown, setShowMappingSetDropdown] = useState(false);

  const [isNewMappingSet, setIsNewMappingSet] = useState(false);

  const [mappingDirty, setMappingDirty] = useState(false);

  /* ======================================================================== */
  /* Other state                                                              */
  /* ======================================================================== */

  const [uploading, setUploading] = useState(false);

  const [running, setRunning] = useState(false);

  const [message, setMessage] = useState<MessageState | null>(null);

  /* ======================================================================== */
  /* Helpers                                                                  */
  /* ======================================================================== */

  const getErrorMessage = (error: any, fallback: string) =>
    error?.response?.data?.error ||
    error?.response?.data?.message ||
    error?.message ||
    fallback;

  const columns = useMemo(() => {
    const set = new Set<string>();

    preview.forEach((row) => {
      if (!isObjectRow(row)) {
        return;
      }

      Object.keys(row).forEach((column) => set.add(column));
    });

    return Array.from(set);
  }, [preview]);

  const selectedSource = useMemo(
    () =>
      savedSources.find(
        (source) => Number(source.id) === Number(dataSourceId),
      ) || null,
    [savedSources, dataSourceId],
  );

  const filteredSources = useMemo(() => {
    const search = sourceSearch.trim().toLowerCase();

    if (!search) {
      return savedSources;
    }

    return savedSources.filter((source) =>
      [source.id, source.fileName, source.sourceType, source.rowCount]
        .join(" ")
        .toLowerCase()
        .includes(search),
    );
  }, [savedSources, sourceSearch]);

  const selectedMappingSet = useMemo(
    () =>
      mappingSets.find(
        (set) => Number(set.id) === Number(selectedMappingSetId),
      ) || null,
    [mappingSets, selectedMappingSetId],
  );

  const filteredMappingSets = useMemo(() => {
    const search = mappingSetSearch.trim().toLowerCase();

    if (!search) {
      return mappingSets;
    }

    return mappingSets.filter((set) =>
      [set.id, set.name, set.description || "", set.rowsCount]
        .join(" ")
        .toLowerCase()
        .includes(search),
    );
  }, [mappingSets, mappingSetSearch]);

  const validRows = useMemo(
    () =>
      mappingRows.filter(
        (row) =>
          row.placeholder.trim() &&
          row.dataColumn.trim() &&
          columns.includes(row.dataColumn),
      ),
    [mappingRows, columns],
  );

  const invalidRows = useMemo(
    () =>
      mappingRows.filter((row) => {
        if (!row.placeholder.trim() || !row.dataColumn.trim()) {
          return true;
        }

        return !columns.includes(row.dataColumn);
      }),
    [mappingRows, columns],
  );

  const canRun =
    Boolean(dataSourceId) &&
    Boolean(selectedMappingSetId) &&
    rowCount > 0 &&
    mappingRows.length > 0 &&
    invalidRows.length === 0 &&
    !running &&
    !uploading &&
    !loadingSavedSource &&
    !loadingMappingSet &&
    !savingMappingSet;

  /* ======================================================================== */
  /* Reset test-data source                                                   */
  /* ======================================================================== */

  const resetActiveSource = useCallback(() => {
    setDataSourceId(null);
    setSelectedFileName("");
    setPreview([]);
    setRowCount(0);
    setSourceSearch("");
    setShowSourceDropdown(false);
  }, []);

  /* ======================================================================== */
  /* Load one saved test-data source                                          */
  /* ======================================================================== */

  const loadSavedSource = useCallback(
    async (sourceId: number) => {
      if (!sourceId) {
        resetActiveSource();
        return;
      }

      setLoadingSavedSource(true);
      setMessage(null);

      try {
        const response = await API.get(
          `/api/advanced/data-drive/source/${sourceId}`,
          {
            headers: authHeaders(),
          },
        );

        if (!response.data?.success) {
          throw new Error(
            response.data?.error || "Failed to load saved test data.",
          );
        }

        const data = response.data.data;

        const rows = Array.isArray(data.preview)
          ? data.preview.filter(isObjectRow)
          : [];

        if (!rows.length) {
          throw new Error("Selected dataset contains no valid rows.");
        }

        setDataSourceId(Number(data.sourceId));

        setSelectedFileName(data.fileName || `Source #${sourceId}`);

        setPreview(rows);

        setRowCount(rows.length);

        if (
          data.sourceType === "CSV" ||
          data.sourceType === "XLSX" ||
          data.sourceType === "JSON"
        ) {
          setSourceType(data.sourceType);
        }

        setSourceSearch("");
        setShowSourceDropdown(false);

        setMessage({
          type: "success",
          text: `Loaded "${
            data.fileName || `Source #${sourceId}`
          }" with ${rows.length} row${rows.length === 1 ? "" : "s"}.`,
        });
      } catch (error: any) {
        resetActiveSource();

        setMessage({
          type: "error",
          text: getErrorMessage(error, "Failed to load saved test data."),
        });
      } finally {
        setLoadingSavedSource(false);
      }
    },
    [resetActiveSource],
  );

  /* ======================================================================== */
  /* Load saved test-data list                                                */
  /* ======================================================================== */

  const loadSavedSources = useCallback(
    async (autoSelectId?: number) => {
      if (!testCaseId) {
        return;
      }

      setLoadingSources(true);

      try {
        const response = await API.get(
          `/api/advanced/data-drive/sources/${testCaseId}`,
          {
            headers: authHeaders(),
          },
        );

        if (!response.data?.success) {
          throw new Error(
            response.data?.error || "Failed to load saved test data.",
          );
        }

        const sources = response.data.data?.sources || [];

        setSavedSources(sources);

        if (
          autoSelectId &&
          sources.some(
            (source: SavedDataSource) =>
              Number(source.id) === Number(autoSelectId),
          )
        ) {
          await loadSavedSource(autoSelectId);
        }
      } catch (error: any) {
        setSavedSources([]);

        setMessage({
          type: "error",
          text: getErrorMessage(error, "Failed to load saved test data."),
        });
      } finally {
        setLoadingSources(false);
      }
    },
    [testCaseId, loadSavedSource],
  );

  /* ======================================================================== */
  /* Upload new data                                                          */
  /* ======================================================================== */

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const input = event.target;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    const extension = file.name.split(".").pop()?.toUpperCase();

    if (extension !== sourceType) {
      setMessage({
        type: "error",
        text: `Selected type is ${sourceType}, but the file is ${extension || "unknown"}.`,
      });

      input.value = "";

      return;
    }

    const formData = new FormData();

    formData.append("file", file, file.name);
    formData.append("testCaseId", String(testCaseId));
    formData.append("sourceType", sourceType);

    setUploading(true);
    setMessage(null);

    try {
      const headers = {
        ...authHeaders(),
      } as Record<string, string>;

      delete headers["Content-Type"];
      delete headers["content-type"];

      const response = await API.post(
        "/api/advanced/data-drive/upload",
        formData,
        {
          headers,
          transformRequest: [(data) => data],
        },
      );

      if (!response.data?.success) {
        throw new Error(response.data?.error || "Upload failed.");
      }

      const data = response.data.data as UploadResponseData;

      const sourceId = Number(data.sourceId);

      if (!sourceId) {
        throw new Error("Backend did not return a sourceId.");
      }

      setMessage({
        type: "success",
        text: `Uploaded "${file.name}".`,
      });

      await loadSavedSources(sourceId);
    } catch (error: any) {
      setMessage({
        type: "error",
        text: getErrorMessage(error, "Failed to upload test data."),
      });
    } finally {
      setUploading(false);
      input.value = "";
    }
  };

  /* ======================================================================== */
  /* Mapping sets                                                             */
  /* ======================================================================== */

  const resetMappingEditor = useCallback(() => {
    setSelectedMappingSetId(null);

    setMappingSetName("");

    setMappingSetDescription("");

    setMappingRows([]);

    setIsNewMappingSet(false);

    setMappingDirty(false);

    setMappingSetSearch("");

    setShowMappingSetDropdown(false);
  }, []);

  const loadMappingSets = useCallback(async () => {
    if (!testCaseId) {
      return;
    }

    setLoadingMappingSets(true);

    try {
      const response = await API.get(
        `/api/advanced/data-drive/mapping-sets/${testCaseId}`,
        {
          headers: authHeaders(),
        },
      );

      if (!response.data?.success) {
        throw new Error(response.data?.error || "Failed to load mapping sets.");
      }

      const sets = response.data.data?.mappingSets || [];

      setMappingSets(sets);
    } catch (error: any) {
      setMappingSets([]);

      setMessage({
        type: "error",
        text: getErrorMessage(error, "Failed to load saved mapping sets."),
      });
    } finally {
      setLoadingMappingSets(false);
    }
  }, [testCaseId]);

  const loadMappingSet = useCallback(
    async (mappingSetId: number) => {
      if (!mappingSetId) {
        resetMappingEditor();
        return;
      }

      setLoadingMappingSet(true);
      setMessage(null);

      try {
        const response = await API.get(
          `/api/advanced/data-drive/mapping-set/${mappingSetId}`,
          {
            headers: authHeaders(),
          },
        );

        if (!response.data?.success) {
          throw new Error(
            response.data?.error || "Failed to load mapping set.",
          );
        }

        const data = response.data.data as LoadedMappingSet;

        setSelectedMappingSetId(Number(data.id));

        setMappingSetName(data.name || "");

        setMappingSetDescription(data.description || "");

        setMappingRows(
          (data.rows || []).map((row) => ({
            id: row.id,
            placeholder: row.placeholder || "",
            dataColumn: row.dataColumn || "",
            transformation: row.transformation || "None",
          })),
        );

        setIsNewMappingSet(false);
        setMappingDirty(false);
        setMappingSetSearch("");
        setShowMappingSetDropdown(false);

        setMessage({
          type: "success",
          text: `Loaded mapping "${data.name}" with ${
            data.rows?.length || 0
          } row${data.rows?.length === 1 ? "" : "s"}.`,
        });
      } catch (error: any) {
        setMessage({
          type: "error",
          text: getErrorMessage(error, "Failed to load mapping set."),
        });
      } finally {
        setLoadingMappingSet(false);
      }
    },
    [resetMappingEditor],
  );

  const startNewMappingSet = () => {
    if (!columns.length) {
      setMessage({
        type: "error",
        text: "Select test data before creating a mapping.",
      });

      return;
    }

    const firstRow = createMappingRow();

    setSelectedMappingSetId(null);

    setMappingSetName("");

    setMappingSetDescription("");

    setMappingRows([firstRow]);

    setIsNewMappingSet(true);

    setMappingDirty(true);

    setMappingSetSearch("");

    setShowMappingSetDropdown(false);

    setMessage({
      type: "info",
      text: "New mapping started. Enter a name and configure the mapping rows.",
    });
  };

  const addMappingRow = () => {
    setMappingRows((current) => [...current, createMappingRow()]);

    setMappingDirty(true);
  };

  const updateMappingRow = (
    id: string | number,
    field: keyof Omit<MappingRow, "id">,
    value: string,
  ) => {
    setMappingRows((current) =>
      current.map((row) =>
        String(row.id) === String(id)
          ? {
              ...row,
              [field]: value,
            }
          : row,
      ),
    );

    setMappingDirty(true);
  };

  const removeMappingRow = (id: string | number) => {
    setMappingRows((current) =>
      current.filter((row) => String(row.id) !== String(id)),
    );

    setMappingDirty(true);
  };

  const saveMappingSet = async () => {
    if (!mappingSetName.trim()) {
      setMessage({
        type: "error",
        text: "Mapping name is required.",
      });

      return;
    }

    if (!mappingRows.length) {
      setMessage({
        type: "error",
        text: "Add at least one mapping row.",
      });

      return;
    }

    if (validRows.length !== mappingRows.length) {
      setMessage({
        type: "error",
        text: "Every row requires a placeholder and valid data column.",
      });

      return;
    }

    setSavingMappingSet(true);
    setMessage(null);

    try {
      const payload = {
        testCaseId,

        name: mappingSetName.trim(),

        description: mappingSetDescription.trim() || null,

        rows: mappingRows.map((row) => ({
          placeholder: row.placeholder.trim(),

          dataColumn: row.dataColumn,

          transformation: row.transformation,
        })),
      };

      let response;

      if (selectedMappingSetId) {
        response = await API.put(
          `/api/advanced/data-drive/mapping-set/${selectedMappingSetId}`,
          payload,
          {
            headers: authHeaders(),
          },
        );
      } else {
        response = await API.post(
          "/api/advanced/data-drive/mapping-set",
          payload,
          {
            headers: authHeaders(),
          },
        );
      }

      if (!response.data?.success) {
        throw new Error(response.data?.error || "Failed to save mapping set.");
      }

      const savedId = Number(response.data.data?.mappingSetId);

      await loadMappingSets();

      if (savedId) {
        await loadMappingSet(savedId);
      }

      setIsNewMappingSet(false);

      setMappingDirty(false);

      setMessage({
        type: "success",
        text: `Saved "${mappingSetName.trim()}" with ${mappingRows.length} mapping row${
          mappingRows.length === 1 ? "" : "s"
        }.`,
      });
    } catch (error: any) {
      setMessage({
        type: "error",
        text: getErrorMessage(error, "Failed to save mapping set."),
      });
    } finally {
      setSavingMappingSet(false);
    }
  };

  const deleteMappingSet = async () => {
    if (!selectedMappingSetId) {
      return;
    }

    if (!window.confirm(`Delete mapping "${mappingSetName}"?`)) {
      return;
    }

    setDeletingMappingSet(true);
    setMessage(null);

    try {
      const response = await API.delete(
        `/api/advanced/data-drive/mapping-set/${selectedMappingSetId}`,
        {
          headers: authHeaders(),
        },
      );

      if (!response.data?.success) {
        throw new Error(response.data?.error || "Failed to delete mapping.");
      }

      resetMappingEditor();

      await loadMappingSets();

      setMessage({
        type: "success",
        text: "Mapping deleted successfully.",
      });
    } catch (error: any) {
      setMessage({
        type: "error",
        text: getErrorMessage(error, "Failed to delete mapping."),
      });
    } finally {
      setDeletingMappingSet(false);
    }
  };

  /* ======================================================================== */
  /* Run                                                                      */
  /* ======================================================================== */

  const runDataDrivenTest = async () => {
    if (!dataSourceId) {
      setMessage({
        type: "error",
        text: "Select test data first.",
      });

      return;
    }

    if (!selectedMappingSetId) {
      setMessage({
        type: "error",
        text: "Select a saved parameter mapping first.",
      });

      return;
    }

    if (mappingDirty) {
      setMessage({
        type: "error",
        text: "Save the mapping changes before running.",
      });

      return;
    }

    if (invalidRows.length) {
      setMessage({
        type: "error",
        text: "Fix invalid mapping rows before running.",
      });

      return;
    }

    setRunning(true);

    setMessage({
      type: "info",
      text: `Running ${rowCount} parameterized test iteration${
        rowCount === 1 ? "" : "s"
      }...`,
    });

    try {
      const response = await API.post(
        "/api/advanced/data-drive/run-parameterized",
        {
          testCaseId,

          dataSourceId,

          mappingSetId: selectedMappingSetId,

          continueOnFailure: false,
        },
        {
          headers: authHeaders(),
        },
      );

      if (!response.data?.success) {
        throw new Error(
          response.data?.error || "Failed to execute parameterized test.",
        );
      }

      const totalRuns = Number(response.data.data?.totalRuns) || 0;

      const runIds = response.data.data?.runIds || [];

      setMessage({
        type: "success",

        text: `${totalRuns} run${totalRuns === 1 ? "" : "s"} completed${
          runIds.length ? `. Run IDs: ${runIds.join(", ")}` : "."
        }`,
      });
    } catch (error: any) {
      setMessage({
        type: "error",

        text: getErrorMessage(error, "Failed to execute parameterized test."),
      });
    } finally {
      setRunning(false);
    }
  };

  /* ======================================================================== */
  /* Initial load                                                             */
  /* ======================================================================== */

  useEffect(() => {
    resetActiveSource();

    resetMappingEditor();

    setSavedSources([]);

    setMappingSets([]);

    setMessage(null);

    loadSavedSources();

    loadMappingSets();
  }, [
    testCaseId,
    resetActiveSource,
    resetMappingEditor,
    loadSavedSources,
    loadMappingSets,
  ]);

  /* ======================================================================== */
  /* Message style                                                            */
  /* ======================================================================== */

  const messageClasses =
    message?.type === "success"
      ? "border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300"
      : message?.type === "error"
        ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
        : "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300";

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6 dark:border-gray-700 dark:bg-gray-900">
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-[260px] flex-1">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Data-Driven Testing
          </h3>

          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Manage reusable test data, mapping sets, and parameterized
            Playwright executions.
          </p>

          {dataSourceId && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700 dark:bg-green-950/40 dark:text-green-300">
                <FaCheckCircle />
                Source #{dataSourceId}
              </span>

              {selectedFileName && (
                <span className="max-w-[320px] truncate rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                  {selectedFileName}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Upload */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={sourceType}
            onChange={(event) =>
              setSourceType(event.target.value as SourceType)
            }
            disabled={uploading || running}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          >
            <option value="CSV">CSV</option>
            <option value="XLSX">XLSX</option>
            <option value="JSON">JSON</option>
          </select>

          <label
            className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white ${
              uploading || running
                ? "cursor-not-allowed bg-blue-400"
                : "cursor-pointer bg-blue-600 hover:bg-blue-700"
            }`}
          >
            <FaUpload />

            {uploading ? "Uploading..." : "Upload New Test Data"}

            <input
              type="file"
              hidden
              accept={ACCEPTED_FILES[sourceType]}
              disabled={uploading || running}
              onChange={handleFileUpload}
            />
          </label>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div
          className={`mb-5 rounded-lg border px-3 py-2 text-sm ${messageClasses}`}
        >
          {message.text}
        </div>
      )}

      {/* Saved data */}
      <div className="mb-5 rounded-xl border border-gray-200 p-4 dark:border-gray-700">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <FaDatabase className="text-blue-500" />

              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                Saved Test Data
              </h4>
            </div>

            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Search and select reusable test data.
            </p>
          </div>

          <button
            type="button"
            onClick={() => loadSavedSources()}
            disabled={loadingSources}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            <FaSync className={loadingSources ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        <div className="relative">
          <div className="flex min-h-[42px] items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 focus-within:border-blue-500 dark:border-gray-600 dark:bg-gray-800">
            <FaSearch className="text-gray-400" />

            <input
              value={
                showSourceDropdown
                  ? sourceSearch
                  : selectedSource
                    ? `#${selectedSource.id} — ${selectedSource.fileName}`
                    : ""
              }
              onChange={(event) => {
                setSourceSearch(event.target.value);

                setShowSourceDropdown(true);
              }}
              onFocus={() => {
                setSourceSearch("");
                setShowSourceDropdown(true);
              }}
              placeholder="Search saved test data..."
              className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none dark:text-white"
            />

            {dataSourceId && !showSourceDropdown ? (
              <button type="button" onClick={resetActiveSource}>
                <FaTimes className="text-gray-400" />
              </button>
            ) : (
              <FaChevronDown className="text-gray-400" />
            )}
          </div>

          {showSourceDropdown && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => {
                  setShowSourceDropdown(false);
                  setSourceSearch("");
                }}
              />

              <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900">
                {filteredSources.length ? (
                  filteredSources.map((source) => (
                    <button
                      type="button"
                      key={source.id}
                      onClick={() => loadSavedSource(source.id)}
                      className="w-full border-b border-gray-100 px-4 py-3 text-left last:border-0 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
                    >
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {source.fileName}
                      </div>

                      <div className="mt-1 text-xs text-gray-500">
                        Source #{source.id} • {source.sourceType} •{" "}
                        {source.rowCount} rows
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="px-4 py-6 text-center text-sm text-gray-500">
                    No matching datasets.
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {loadingSavedSource && (
          <p className="mt-2 text-xs text-blue-500">Loading dataset...</p>
        )}
      </div>

      {/* Preview */}
      {preview.length > 0 && (
        <div className="mb-5">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-sm font-medium text-gray-900 dark:text-white">
              Preview
            </h4>

            <div className="flex gap-2">
              <span className="rounded-full bg-gray-100 px-3 py-1 text-xs dark:bg-gray-800 dark:text-gray-300">
                {rowCount} rows
              </span>

              <span className="rounded-full bg-gray-100 px-3 py-1 text-xs dark:bg-gray-800 dark:text-gray-300">
                {columns.length} columns
              </span>
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="max-h-[145px] overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800 dark:text-white">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs">#</th>

                    {columns.map((column) => (
                      <th
                        key={column}
                        className="whitespace-nowrap px-3 py-2 text-left text-xs"
                      >
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {preview.map((row, rowIndex) => (
                    <tr
                      key={rowIndex}
                      className="border-t border-gray-100 dark:border-gray-800"
                    >
                      <td className="px-3 py-2 text-xs text-gray-400">
                        {rowIndex + 1}
                      </td>

                      {columns.map((column) => (
                        <td
                          key={`${rowIndex}-${column}`}
                          className="max-w-[260px] truncate whitespace-nowrap px-3 py-2 text-gray-600 dark:text-gray-400"
                        >
                          {String(row[column] ?? "—")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Mapping Sets */}
      <div className="mb-6 rounded-xl border border-gray-200 p-4 dark:border-gray-700">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
              Parameter Mapping Sets
            </h4>

            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              One saved mapping can contain multiple placeholder mapping rows.
            </p>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={loadMappingSets}
              disabled={loadingMappingSets}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              <FaSync className={loadingMappingSets ? "animate-spin" : ""} />
              Refresh
            </button>

            <button
              type="button"
              onClick={startNewMappingSet}
              disabled={!columns.length}
              className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              <FaPlus />
              New Mapping
            </button>
          </div>
        </div>

        {/* Mapping dropdown */}
        <div className="mb-4">
          <label className="mb-1.5 block text-xs font-medium text-gray-600 dark:text-gray-300">
            Saved Mapping
          </label>

          <div className="relative">
            <div className="flex min-h-[42px] items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 dark:border-gray-600 dark:bg-gray-800">
              <FaSearch className="text-gray-400" />

              <input
                value={
                  showMappingSetDropdown
                    ? mappingSetSearch
                    : selectedMappingSet
                      ? `${selectedMappingSet.name} (${selectedMappingSet.rowsCount} rows)`
                      : isNewMappingSet
                        ? "New Mapping"
                        : ""
                }
                onChange={(event) => {
                  setMappingSetSearch(event.target.value);

                  setShowMappingSetDropdown(true);
                }}
                onFocus={() => {
                  setMappingSetSearch("");
                  setShowMappingSetDropdown(true);
                }}
                placeholder="Search saved mappings..."
                className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none dark:text-white"
              />

              <FaChevronDown className="text-gray-400" />
            </div>

            {showMappingSetDropdown && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => {
                    setShowMappingSetDropdown(false);
                    setMappingSetSearch("");
                  }}
                />

                <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900">
                  {filteredMappingSets.length ? (
                    filteredMappingSets.map((set) => (
                      <button
                        type="button"
                        key={set.id}
                        onClick={() => loadMappingSet(set.id)}
                        className="w-full border-b border-gray-100 px-4 py-3 text-left last:border-0 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {set.name}
                            </div>

                            <div className="mt-1 text-xs text-gray-500">
                              {set.rowsCount} mapping row
                              {set.rowsCount === 1 ? "" : "s"}
                            </div>
                          </div>

                          {Number(selectedMappingSetId) === Number(set.id) && (
                            <FaCheckCircle className="text-green-500" />
                          )}
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="px-4 py-6 text-center text-sm text-gray-500">
                      No saved mappings found.
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {(selectedMappingSetId || isNewMappingSet) && (
          <div className="space-y-4">
            {/* Mapping metadata */}
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-600 dark:text-gray-300">
                  Mapping Name
                </label>

                <input
                  value={mappingSetName}
                  onChange={(event) => {
                    setMappingSetName(event.target.value);

                    setMappingDirty(true);
                  }}
                  placeholder="Login Data Mapping"
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-600 dark:text-gray-300">
                  Description
                </label>

                <input
                  value={mappingSetDescription}
                  onChange={(event) => {
                    setMappingSetDescription(event.target.value);

                    setMappingDirty(true);
                  }}
                  placeholder="Optional description"
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                />
              </div>
            </div>

            {/* Mapping rows */}
            <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
                <div>
                  <h5 className="text-sm font-semibold text-gray-900 dark:text-white">
                    Mapping Rows
                  </h5>

                  <p className="text-xs text-gray-500">
                    Example: {"{{username}}"} → username
                  </p>
                </div>

                <button
                  type="button"
                  onClick={addMappingRow}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700"
                >
                  <FaPlus />
                  Add Row
                </button>
              </div>

              <div className="hidden bg-gray-50 px-4 py-2 md:grid md:grid-cols-[45px_minmax(170px,1fr)_minmax(160px,1fr)_160px_70px] md:gap-3 dark:bg-gray-800">
                <span className="text-xs text-gray-500">#</span>

                <span className="text-xs text-gray-500">Placeholder</span>

                <span className="text-xs text-gray-500">Data Column</span>

                <span className="text-xs text-gray-500">Transformation</span>

                <span className="text-xs text-gray-500">Action</span>
              </div>

              <div className="max-h-[340px] overflow-y-auto">
                {mappingRows.map((row, index) => {
                  const columnValid =
                    !row.dataColumn || columns.includes(row.dataColumn);

                  return (
                    <div
                      key={row.id}
                      className="grid gap-3 border-t border-gray-100 px-4 py-3 md:grid-cols-[45px_minmax(170px,1fr)_minmax(160px,1fr)_160px_70px] dark:border-gray-800"
                    >
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-xs dark:bg-gray-700 dark:text-gray-300">
                        {index + 1}
                      </span>

                      <input
                        value={row.placeholder}
                        onChange={(event) =>
                          updateMappingRow(
                            row.id,
                            "placeholder",
                            event.target.value,
                          )
                        }
                        placeholder="{{username}}"
                        className="rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-xs dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                      />

                      <div>
                        <select
                          value={row.dataColumn}
                          onChange={(event) =>
                            updateMappingRow(
                              row.id,
                              "dataColumn",
                              event.target.value,
                            )
                          }
                          className={`w-full rounded-lg border bg-white px-3 py-2 text-xs dark:bg-gray-900 dark:text-white ${
                            columnValid
                              ? "border-gray-300 dark:border-gray-600"
                              : "border-red-400"
                          }`}
                        >
                          <option value="">Select column</option>

                          {columns.map((column) => (
                            <option key={column} value={column}>
                              {column}
                            </option>
                          ))}

                          {row.dataColumn &&
                            !columns.includes(row.dataColumn) && (
                              <option value={row.dataColumn}>
                                {row.dataColumn} (unavailable)
                              </option>
                            )}
                        </select>

                        {!columnValid && (
                          <p className="mt-1 text-[11px] text-red-500">
                            Column not available in selected data
                          </p>
                        )}
                      </div>

                      <select
                        value={row.transformation}
                        onChange={(event) =>
                          updateMappingRow(
                            row.id,
                            "transformation",
                            event.target.value,
                          )
                        }
                        className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                      >
                        <option value="None">None</option>

                        <option value="JSONPath">JSONPath</option>

                        <option value="Regex">Regex</option>

                        <option value="Uppercase">Uppercase</option>
                      </select>

                      <button
                        type="button"
                        onClick={() => removeMappingRow(row.id)}
                        className="inline-flex items-center justify-center rounded-lg px-2 py-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                      >
                        <FaTrash />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Mapping actions */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                {invalidRows.length ? (
                  <span className="text-xs text-red-500">
                    {invalidRows.length} row
                    {invalidRows.length === 1 ? "" : "s"} require attention.
                  </span>
                ) : (
                  <span className="text-xs text-gray-400">
                    {validRows.length} valid mapping row
                    {validRows.length === 1 ? "" : "s"}
                  </span>
                )}
              </div>

              <div className="flex gap-2">
                {selectedMappingSetId && (
                  <button
                    type="button"
                    onClick={deleteMappingSet}
                    disabled={deletingMappingSet || savingMappingSet}
                    className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-900"
                  >
                    <FaTrash />

                    {deletingMappingSet ? "Deleting..." : "Delete Mapping"}
                  </button>
                )}

                <button
                  type="button"
                  onClick={saveMappingSet}
                  disabled={
                    savingMappingSet ||
                    !mappingSetName.trim() ||
                    !mappingRows.length ||
                    invalidRows.length > 0
                  }
                  className="inline-flex items-center gap-2 rounded-lg bg-gray-800 px-4 py-2 text-sm font-medium text-white hover:bg-gray-900 disabled:opacity-50 dark:bg-gray-700"
                >
                  <FaSave />

                  {savingMappingSet
                    ? "Saving..."
                    : selectedMappingSetId
                      ? "Update Mapping"
                      : "Save Mapping"}
                </button>
              </div>
            </div>

            {mappingDirty && (
              <p className="text-xs text-amber-600">
                You have unsaved mapping changes.
              </p>
            )}
          </div>
        )}

        {!selectedMappingSetId && !isNewMappingSet && !loadingMappingSet && (
          <div className="rounded-lg border border-dashed border-gray-300 px-4 py-6 text-center dark:border-gray-700">
            <p className="text-sm text-gray-500">
              Select a saved mapping or create a new mapping.
            </p>
          </div>
        )}
      </div>

      {/* Run */}
      <button
        type="button"
        onClick={runDataDrivenTest}
        disabled={!canRun}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-purple-600 px-4 py-3 text-sm font-medium text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <FaPlay />

        {running
          ? `Running ${rowCount} row${rowCount === 1 ? "" : "s"}...`
          : !dataSourceId
            ? "Select Test Data to Run"
            : !selectedMappingSetId
              ? "Select Parameter Mapping to Run"
              : mappingDirty
                ? "Save Mapping Changes Before Run"
                : `Run ${selectedMappingSet?.name || "Selected Mapping"} — ${rowCount} Row${
                    rowCount === 1 ? "" : "s"
                  }`}
      </button>
    </div>
  );
}
