import React, { useCallback, useEffect, useMemo, useState } from "react";

import {
  FaCheckCircle,
  FaDatabase,
  FaPlay,
  FaPlus,
  FaSave,
  FaSync,
  FaTrash,
  FaUpload,
} from "react-icons/fa";

import API from "../services/api";
import { authHeaders } from "../pages/TestManagement/Playwright/helpers";

type SourceType = "CSV" | "XLSX" | "JSON";

interface ParameterMapping {
  id: string | number;
  placeholder: string;
  dataColumn: string;
  transformation: string;
}

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
  preview: Record<string, unknown>[];
  rowCount: number;
  columns?: string[];
}

interface SavedMappingResponse {
  id: number;
  testCaseId?: number;
  placeholder?: string;
  dataColumn?: string;
  transformation?: string;
}

const ACCEPTED_FILES: Record<SourceType, string> = {
  CSV: ".csv,text/csv",

  XLSX: ".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",

  JSON: ".json,application/json",
};

const createMapping = (): ParameterMapping => ({
  id: `mapping-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,

  placeholder: "",
  dataColumn: "",
  transformation: "None",
});

export default function DataDrivenTestConfig({ testCaseId }: Props) {
  const [sourceType, setSourceType] = useState<SourceType>("CSV");

  const [savedSources, setSavedSources] = useState<SavedDataSource[]>([]);

  const [loadingSources, setLoadingSources] = useState(false);

  const [loadingSavedSource, setLoadingSavedSource] = useState(false);

  const [selectedFileName, setSelectedFileName] = useState("");

  const [dataSourceId, setDataSourceId] = useState<number | null>(null);

  const [preview, setPreview] = useState<Record<string, unknown>[]>([]);

  const [rowCount, setRowCount] = useState(0);

  const [mappings, setMappings] = useState<ParameterMapping[]>([]);

  const [loadingMappings, setLoadingMappings] = useState(false);

  const [uploading, setUploading] = useState(false);

  const [savingMappings, setSavingMappings] = useState(false);

  const [running, setRunning] = useState(false);

  const [message, setMessage] = useState<MessageState | null>(null);

  const columns = useMemo(
    () => (preview[0] ? Object.keys(preview[0]) : []),
    [preview],
  );

  const validMappings = useMemo(
    () =>
      mappings.filter(
        (mapping) =>
          mapping.placeholder.trim() !== "" && mapping.dataColumn.trim() !== "",
      ),
    [mappings],
  );

  const canRun =
    Boolean(dataSourceId) &&
    rowCount > 0 &&
    !uploading &&
    !loadingSavedSource &&
    !loadingMappings &&
    !savingMappings &&
    !running;

  const getErrorMessage = (error: any, fallback: string) =>
    error?.response?.data?.error ||
    error?.response?.data?.message ||
    error?.message ||
    fallback;

  /* -------------------------------------------------------------------------- */
  /* Reset active source                                                        */
  /* -------------------------------------------------------------------------- */

  const resetActiveSource = useCallback(() => {
    setDataSourceId(null);
    setPreview([]);
    setRowCount(0);
    setSelectedFileName("");
  }, []);

  /* -------------------------------------------------------------------------- */
  /* Load one saved data source                                                 */
  /* -------------------------------------------------------------------------- */

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
            response.data?.error || "Failed to load selected data source.",
          );
        }

        const data = response.data.data;

        setDataSourceId(Number(data.sourceId));

        setPreview(data.preview || []);

        setRowCount(Number(data.rowCount) || 0);

        setSelectedFileName(data.fileName || `Source #${sourceId}`);

        if (
          data.sourceType === "CSV" ||
          data.sourceType === "XLSX" ||
          data.sourceType === "JSON"
        ) {
          setSourceType(data.sourceType);
        }

        /*
         * IMPORTANT:
         *
         * Do NOT clear mappings here.
         *
         * Mappings are linked to the
         * test case, not to the currently
         * selected data source.
         */

        setMessage({
          type: "success",

          text: `Loaded saved dataset "${
            data.fileName || `Source #${sourceId}`
          }" with ${data.rowCount || 0} rows.`,
        });
      } catch (error: any) {
        resetActiveSource();

        setMessage({
          type: "error",

          text: getErrorMessage(error, "Failed to load selected test data."),
        });
      } finally {
        setLoadingSavedSource(false);
      }
    },
    [resetActiveSource],
  );

  /* -------------------------------------------------------------------------- */
  /* Load saved source list                                                     */
  /* -------------------------------------------------------------------------- */

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
          throw new Error(response.data?.error || "Failed to load saved data.");
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
        console.error("Load saved data sources failed:", error);

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

  /* -------------------------------------------------------------------------- */
  /* Load saved parameter mappings                                              */
  /* -------------------------------------------------------------------------- */

  const loadSavedMappings = useCallback(async () => {
    if (!testCaseId) {
      setMappings([]);
      return;
    }

    setLoadingMappings(true);

    try {
      const response = await API.get(
        `/api/advanced/data-drive/mappings/${testCaseId}`,
        {
          headers: authHeaders(),
        },
      );

      if (!response.data?.success) {
        throw new Error(
          response.data?.error || "Failed to load parameter mappings.",
        );
      }

      const savedMappings: SavedMappingResponse[] =
        response.data.data?.mappings || [];

      setMappings(
        savedMappings.map((mapping) => ({
          id: mapping.id,

          placeholder: mapping.placeholder || "",

          dataColumn: mapping.dataColumn || "",

          transformation: mapping.transformation || "None",
        })),
      );
    } catch (error: any) {
      console.error("Load parameter mappings failed:", error);

      setMappings([]);

      setMessage({
        type: "error",

        text: getErrorMessage(
          error,
          "Failed to load saved parameter mappings.",
        ),
      });
    } finally {
      setLoadingMappings(false);
    }
  }, [testCaseId]);

  /* -------------------------------------------------------------------------- */
  /* Load when test case changes                                                */
  /* -------------------------------------------------------------------------- */

  useEffect(() => {
    resetActiveSource();

    setSavedSources([]);
    setMappings([]);
    setMessage(null);

    loadSavedSources();
    loadSavedMappings();
  }, [testCaseId, resetActiveSource, loadSavedSources, loadSavedMappings]);

  /* -------------------------------------------------------------------------- */
  /* Saved source selection                                                     */
  /* -------------------------------------------------------------------------- */

  const handleSavedSourceChange = async (
    event: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    const sourceId = Number(event.target.value);

    if (!sourceId) {
      resetActiveSource();

      /*
       * Do NOT clear mappings.
       */
      return;
    }

    await loadSavedSource(sourceId);
  };

  /* -------------------------------------------------------------------------- */
  /* Upload source                                                              */
  /* -------------------------------------------------------------------------- */

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const input = event.target;

    const file = input.files?.[0];

    if (!file) {
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

      const newSourceId = Number(data.sourceId);

      if (!newSourceId) {
        throw new Error("Backend did not return a valid sourceId.");
      }

      setDataSourceId(newSourceId);

      setPreview(data.preview || []);

      setRowCount(Number(data.rowCount) || 0);

      setSelectedFileName(file.name);

      /*
       * Existing mappings remain.
       *
       * Do NOT call:
       *
       * setMappings([]);
       */

      setMessage({
        type: "success",

        text: `Uploaded "${file.name}" with ${data.rowCount || 0} rows.`,
      });

      /*
       * Refresh source list and
       * automatically select
       * the new source.
       */
      await loadSavedSources(newSourceId);
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

  /* -------------------------------------------------------------------------- */
  /* Add mapping                                                                */
  /* -------------------------------------------------------------------------- */

  const addMapping = () => {
    setMappings((current) => [...current, createMapping()]);
  };

  /* -------------------------------------------------------------------------- */
  /* Update mapping                                                             */
  /* -------------------------------------------------------------------------- */

  const updateMapping = (
    id: string | number,

    field: keyof Omit<ParameterMapping, "id">,

    value: string,
  ) => {
    setMappings((current) =>
      current.map((mapping) =>
        mapping.id === id
          ? {
              ...mapping,

              [field]: value,
            }
          : mapping,
      ),
    );
  };

  /* -------------------------------------------------------------------------- */
  /* Remove mapping                                                             */
  /* -------------------------------------------------------------------------- */

  const removeMapping = (id: string | number) => {
    setMappings((current) => current.filter((mapping) => mapping.id !== id));
  };

  /* -------------------------------------------------------------------------- */
  /* Save mappings                                                              */
  /* -------------------------------------------------------------------------- */

  const saveMappings = async () => {
    if (mappings.length === 0) {
      setMessage({
        type: "error",

        text: "Add at least one parameter mapping.",
      });

      return;
    }

    if (validMappings.length !== mappings.length) {
      setMessage({
        type: "error",

        text: "Every mapping requires both a placeholder and data column.",
      });

      return;
    }

    setSavingMappings(true);

    setMessage(null);

    try {
      const response = await API.post(
        "/api/advanced/data-drive/configure",
        {
          testCaseId,

          mappings: validMappings.map(
            ({ placeholder, dataColumn, transformation }) => ({
              placeholder: placeholder.trim(),

              dataColumn,

              transformation,
            }),
          ),
        },
        {
          headers: authHeaders(),
        },
      );

      if (!response.data?.success) {
        throw new Error(response.data?.error || "Failed to save mappings.");
      }

      const count =
        Number(response.data.data?.mappingsCount) || validMappings.length;

      /*
       * Reload from DB so frontend
       * receives actual SQL IDs.
       */
      await loadSavedMappings();

      setMessage({
        type: "success",

        text: `Saved ${count} parameter mapping${count === 1 ? "" : "s"}.`,
      });
    } catch (error: any) {
      setMessage({
        type: "error",

        text: getErrorMessage(error, "Failed to save mappings."),
      });
    } finally {
      setSavingMappings(false);
    }
  };

  /* -------------------------------------------------------------------------- */
  /* Run test                                                                   */
  /* -------------------------------------------------------------------------- */

  const runDataDrivenTest = async () => {
    if (!dataSourceId) {
      setMessage({
        type: "error",

        text: "Select a saved test dataset or upload a new one.",
      });

      return;
    }

    if (!rowCount) {
      setMessage({
        type: "error",

        text: "Selected dataset contains no rows.",
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

          continueOnFailure: false,
        },
        {
          headers: authHeaders(),
        },
      );

      if (!response.data?.success) {
        throw new Error(
          response.data?.error || "Failed to run parameterized test.",
        );
      }

      const totalRuns = Number(response.data.data?.totalRuns) || 0;

      const runIds = response.data.data?.runIds || [];

      setMessage({
        type: "success",

        text: `${totalRuns} test run${totalRuns === 1 ? "" : "s"} completed${
          runIds.length ? `. Run IDs: ${runIds.join(", ")}` : "."
        }`,
      });
    } catch (error: any) {
      setMessage({
        type: "error",

        text: getErrorMessage(error, "Failed to execute data-driven test."),
      });
    } finally {
      setRunning(false);
    }
  };

  /* -------------------------------------------------------------------------- */
  /* Message styling                                                            */
  /* -------------------------------------------------------------------------- */

  const messageClasses =
    message?.type === "success"
      ? "border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300"
      : message?.type === "error"
        ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
        : "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300";

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6 dark:border-gray-700 dark:bg-gray-900">
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Data-Driven Testing
          </h3>

          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Reuse saved test data, configure parameter mappings, and run the
            selected test against every data row.
          </p>
        </div>

        {dataSourceId && (
          <span className="inline-flex items-center gap-2 rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700 dark:bg-green-950/40 dark:text-green-300">
            <FaCheckCircle />
            Source #{dataSourceId}
          </span>
        )}
      </div>

      {/* Message */}
      {message && (
        <div
          className={`mb-5 rounded-lg border px-3 py-2 text-sm ${messageClasses}`}
        >
          {message.text}
        </div>
      )}

      {/* Saved data sources */}
      <div className="mb-4 rounded-xl border border-gray-200 p-4 dark:border-gray-700">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <FaDatabase className="text-blue-500" />

              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                Saved Test Data
              </h4>
            </div>

            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Select a previously uploaded dataset instead of uploading it
              again.
            </p>
          </div>

          <button
            type="button"
            onClick={() => loadSavedSources()}
            disabled={loadingSources || uploading || running}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            <FaSync className={loadingSources ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        <select
          value={dataSourceId || ""}
          onChange={handleSavedSourceChange}
          disabled={
            loadingSources || loadingSavedSource || uploading || running
          }
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        >
          <option value="">
            {loadingSources
              ? "Loading saved datasets..."
              : savedSources.length
                ? "Select saved test data..."
                : "No saved test data"}
          </option>

          {savedSources.map((source) => (
            <option key={source.id} value={source.id}>
              #{source.id} — {source.fileName} ({source.sourceType},{" "}
              {source.rowCount} rows)
            </option>
          ))}
        </select>

        {loadingSavedSource && (
          <p className="mt-2 text-xs text-blue-500">Loading dataset...</p>
        )}
      </div>

      {/* Upload */}
      <div className="mb-6 rounded-xl border border-dashed border-gray-300 p-4 dark:border-gray-700">
        <div className="mb-3">
          <h4 className="text-sm font-medium text-gray-900 dark:text-white">
            Upload New Test Data
          </h4>

          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Upload only when the required dataset is not already stored.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <select
            value={sourceType}
            onChange={(event) =>
              setSourceType(event.target.value as SourceType)
            }
            disabled={uploading || running}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white sm:w-40"
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

            {uploading ? "Uploading..." : "Upload New"}

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

      {/* Preview */}
      {preview.length > 0 && (
        <div className="mb-6">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                Preview
              </h4>

              {selectedFileName && (
                <p className="mt-0.5 text-xs text-gray-400">
                  {selectedFileName}
                </p>
              )}
            </div>

            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-300">
              {rowCount} rows
            </span>
          </div>

          <div className="rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="max-h-[145px] overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 z-20 bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="w-12 whitespace-nowrap border-b border-gray-200 px-3 py-2 text-left text-xs font-medium text-gray-500 dark:border-gray-700">
                      #
                    </th>

                    {columns.map((column) => (
                      <th
                        key={column}
                        className="whitespace-nowrap border-b border-gray-200 px-3 py-2 text-left text-xs font-medium text-gray-700 dark:border-gray-700 dark:text-gray-300"
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
                      className="h-9 border-b border-gray-100 last:border-0 dark:border-gray-800"
                    >
                      <td className="whitespace-nowrap px-3 py-2 text-xs text-gray-400">
                        {rowIndex + 1}
                      </td>

                      {columns.map((column) => (
                        <td
                          key={`${rowIndex}-${column}`}
                          className="max-w-[260px] truncate whitespace-nowrap px-3 py-2 text-gray-600 dark:text-gray-400"
                          title={String(row[column] ?? "")}
                        >
                          {row[column] === null || row[column] === undefined
                            ? "—"
                            : String(row[column])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {preview.length > 3 && (
            <p className="mt-2 text-xs text-gray-400">
              Showing approximately 3 rows at a time. Scroll to view all{" "}
              {preview.length} rows.
            </p>
          )}
        </div>
      )}

      {/* Parameter mappings */}
      <div className="mb-6 rounded-xl border border-gray-200 p-4 dark:border-gray-700">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-medium text-gray-900 dark:text-white">
              Parameter Mappings
            </h4>

            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Saved against the selected test case. Example:{" "}
              {"{{customer.name}}"} → customerName
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={loadSavedMappings}
              disabled={loadingMappings || savingMappings || running}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              <FaSync className={loadingMappings ? "animate-spin" : ""} />

              {loadingMappings ? "Loading..." : "Refresh"}
            </button>

            <button
              type="button"
              onClick={addMapping}
              disabled={
                columns.length === 0 ||
                loadingMappings ||
                savingMappings ||
                running
              }
              className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-xs font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <FaPlus />
              Add Mapping
            </button>
          </div>
        </div>

        {loadingMappings ? (
          <div className="rounded-lg border border-gray-200 px-4 py-6 text-center text-sm text-blue-500 dark:border-gray-700">
            Loading saved parameter mappings...
          </div>
        ) : mappings.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 px-4 py-6 text-center text-sm text-gray-500 dark:border-gray-700">
            {columns.length === 0
              ? "Select or upload a dataset first."
              : "No saved parameter mappings. Add one to configure data substitution."}
          </div>
        ) : (
          <div className="max-h-[280px] space-y-3 overflow-y-auto pr-1">
            {mappings.map((mapping, index) => (
              <div
                key={mapping.id}
                className="grid gap-2 rounded-lg bg-gray-50 p-3 md:grid-cols-[40px_minmax(180px,1fr)_minmax(160px,1fr)_180px_90px] md:items-center dark:bg-gray-800"
              >
                <span className="text-xs text-gray-400">{index + 1}</span>

                <input
                  value={mapping.placeholder}
                  onChange={(event) =>
                    updateMapping(mapping.id, "placeholder", event.target.value)
                  }
                  placeholder="{{customer.name}}"
                  disabled={savingMappings || running}
                  className="min-w-0 rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-xs dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                />

                <select
                  value={mapping.dataColumn}
                  onChange={(event) =>
                    updateMapping(mapping.id, "dataColumn", event.target.value)
                  }
                  disabled={savingMappings || running}
                  className="min-w-0 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                >
                  <option value="">Select column</option>

                  {columns.map((column) => (
                    <option key={column} value={column}>
                      {column}
                    </option>
                  ))}

                  {/*
                   * Preserve saved mapping
                   * value even when the
                   * currently selected dataset
                   * no longer contains that
                   * column.
                   */}
                  {mapping.dataColumn &&
                    !columns.includes(mapping.dataColumn) && (
                      <option value={mapping.dataColumn}>
                        {mapping.dataColumn} (not in dataset)
                      </option>
                    )}
                </select>

                <select
                  value={mapping.transformation}
                  onChange={(event) =>
                    updateMapping(
                      mapping.id,
                      "transformation",
                      event.target.value,
                    )
                  }
                  disabled={savingMappings || running}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                >
                  <option value="None">None</option>

                  <option value="JSONPath">JSONPath</option>

                  <option value="Regex">Regex</option>

                  <option value="Uppercase">Uppercase</option>
                </select>

                <button
                  type="button"
                  onClick={() => removeMapping(mapping.id)}
                  disabled={savingMappings || running}
                  className="inline-flex items-center justify-center gap-1 rounded-lg px-2 py-2 text-xs text-red-500 hover:bg-red-50 hover:text-red-700 disabled:opacity-50 dark:hover:bg-red-950/30"
                >
                  <FaTrash />
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        {mappings.length > 0 && !loadingMappings && (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={saveMappings}
              disabled={savingMappings || running}
              className="inline-flex items-center gap-2 rounded-lg bg-gray-800 px-4 py-2 text-sm font-medium text-white hover:bg-gray-900 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-700 dark:hover:bg-gray-600"
            >
              <FaSave />

              {savingMappings ? "Saving..." : "Save Mappings"}
            </button>

            <span className="text-xs text-gray-400">
              {validMappings.length} valid mapping
              {validMappings.length === 1 ? "" : "s"}
            </span>
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
          : dataSourceId
            ? `Run Selected Data Set — ${rowCount} Row${
                rowCount === 1 ? "" : "s"
              }`
            : "Select Test Data to Run"}
      </button>
    </div>
  );
}
