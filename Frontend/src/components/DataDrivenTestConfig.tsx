
/**
 * DataDrivenTestConfig.tsx
 *
 * Place at:
 *   src/pages/TestManagement/Playwright/components/DataDrivenTestConfig.tsx
 */

import React, { useMemo, useState } from "react";
import {
  FaCheckCircle,
  FaPlay,
  FaPlus,
  FaSave,
  FaTrash,
  FaUpload,
} from "react-icons/fa";

import API from "../services/api";
import { authHeaders } from "../pages/TestManagement/Playwright/helpers";

type SourceType = "CSV" | "XLSX" | "JSON";

interface ParameterMapping {
  id: string;
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

interface UploadResponseData {
  sourceId: number;
  preview: Record<string, unknown>[];
  rowCount: number;
  columns?: string[];
}

const ACCEPTED_FILES: Record<SourceType, string> = {
  CSV: ".csv,text/csv",
  XLSX:
    ".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  JSON: ".json,application/json",
};

const createMapping = (): ParameterMapping => ({
  id: `mapping-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`,
  placeholder: "",
  dataColumn: "",
  transformation: "None",
});

export default function DataDrivenTestConfig({
  testCaseId,
}: Props) {
  const [sourceType, setSourceType] =
    useState<SourceType>("CSV");

  const [selectedFileName, setSelectedFileName] =
    useState("");

  const [dataSourceId, setDataSourceId] = useState<
    number | null
  >(null);

  const [preview, setPreview] = useState<
    Record<string, unknown>[]
  >([]);

  const [rowCount, setRowCount] = useState(0);

  const [mappings, setMappings] = useState<
    ParameterMapping[]
  >([]);

  const [uploading, setUploading] =
    useState(false);

  const [savingMappings, setSavingMappings] =
    useState(false);

  const [running, setRunning] =
    useState(false);

  const [message, setMessage] =
    useState<MessageState | null>(null);

  const columns = useMemo(() => {
    if (!preview[0]) {
      return [];
    }

    return Object.keys(preview[0]);
  }, [preview]);

  const validMappings = useMemo(() => {
    return mappings.filter(
      (mapping) =>
        mapping.placeholder.trim() !== "" &&
        mapping.dataColumn.trim() !== "",
    );
  }, [mappings]);

  const canRun =
    Boolean(dataSourceId) &&
    rowCount > 0 &&
    !uploading &&
    !savingMappings &&
    !running;

  const resetDataSource = () => {
    setDataSourceId(null);
    setPreview([]);
    setRowCount(0);
    setSelectedFileName("");
  };

  const getErrorMessage = (
    error: any,
    fallback: string,
  ) => {
    return (
      error?.response?.data?.error ||
      error?.response?.data?.message ||
      error?.message ||
      fallback
    );
  };

  const handleSourceTypeChange = (
    event: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    setSourceType(
      event.target.value as SourceType,
    );

    resetDataSource();
    setMappings([]);
    setMessage(null);
  };

const handleFileUpload = async (
  event: React.ChangeEvent<HTMLInputElement>,
) => {
  const input = event.target;
  const file = input.files?.[0];

  if (!file) {
    setMessage({
      type: "error",
      text: "No file was selected.",
    });
    return;
  }

  const formData = new FormData();

  formData.append("file", file, file.name);
  formData.append("testCaseId", String(testCaseId));
  formData.append("sourceType", sourceType);

  // Debug - confirm FormData actually contains the file
  console.log("Uploading file:", {
    name: file.name,
    type: file.type,
    size: file.size,
    testCaseId,
    sourceType,
  });

  for (const [key, value] of formData.entries()) {
    console.log(
      "FormData:",
      key,
      value instanceof File
        ? {
            name: value.name,
            size: value.size,
            type: value.type,
          }
        : value,
    );
  }

  setUploading(true);
  setMessage(null);

  try {
    /*
     * IMPORTANT:
     * Use native axios multipart handling.
     *
     * Do NOT send:
     * Content-Type: application/json
     *
     * Do NOT manually send:
     * Content-Type: multipart/form-data
     *
     * The browser must generate:
     * multipart/form-data; boundary=----WebKitFormBoundary...
     */
    const headers = {
      ...authHeaders(),
    } as Record<string, string>;

    // Remove any Content-Type coming from authHeaders().
    delete headers["Content-Type"];
    delete headers["content-type"];

    const response = await API.post(
      "/api/advanced/data-drive/upload",
      formData,
      {
        headers,

        /*
         * Prevent an Axios instance-level transform from trying
         * to serialize FormData as JSON.
         */
        transformRequest: [
          (data) => data,
        ],
      },
    );

    if (!response.data?.success) {
      throw new Error(
        response.data?.error || "Upload failed.",
      );
    }

    const uploadedData = response.data.data;

    const uploadedSourceId = Number(
      uploadedData?.sourceId,
    );

    const uploadedRowCount = Number(
      uploadedData?.rowCount,
    );

    if (!uploadedSourceId) {
      throw new Error(
        "The backend did not return a valid sourceId.",
      );
    }

    setDataSourceId(uploadedSourceId);
    setPreview(uploadedData?.preview || []);
    setRowCount(uploadedRowCount || 0);
    setSelectedFileName(file.name);

    setMessage({
      type: "success",
      text: `Loaded ${
        uploadedRowCount || 0
      } row${
        uploadedRowCount === 1 ? "" : "s"
      } from ${file.name}.`,
    });
  } catch (error: any) {
    console.error(
      "Data-driven upload failed:",
      error?.response?.status,
      error?.response?.data,
      error,
    );

    setDataSourceId(null);
    setPreview([]);
    setRowCount(0);

    setMessage({
      type: "error",
      text:
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        error?.message ||
        "Failed to upload the file.",
    });
  } finally {
    setUploading(false);

    /*
     * Allows choosing the same file again.
     */
    input.value = "";
  }
};

  const addMapping = () => {
    setMappings((current) => [
      ...current,
      createMapping(),
    ]);
  };

  const updateMapping = (
    id: string,
    field: keyof Omit<
      ParameterMapping,
      "id"
    >,
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

  const removeMapping = (
    id: string,
  ) => {
    setMappings((current) =>
      current.filter(
        (mapping) => mapping.id !== id,
      ),
    );
  };

  const saveMappings = async () => {
    if (mappings.length === 0) {
      setMessage({
        type: "error",
        text: "Add at least one mapping before saving.",
      });

      return;
    }

    if (
      validMappings.length !==
      mappings.length
    ) {
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
          mappings:
            validMappings.map(
              ({
                placeholder,
                dataColumn,
                transformation,
              }) => ({
                placeholder:
                  placeholder.trim(),
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
        throw new Error(
          response.data?.error ||
            "Failed to save mappings.",
        );
      }

      const count =
        Number(
          response.data.data
            ?.mappingsCount,
        ) || validMappings.length;

      setMessage({
        type: "success",
        text: `Saved ${count} mapping${
          count === 1 ? "" : "s"
        }.`,
      });
    } catch (error: any) {
      setMessage({
        type: "error",
        text: getErrorMessage(
          error,
          "Failed to save mappings.",
        ),
      });
    } finally {
      setSavingMappings(false);
    }
  };

  const runDataDrivenTest =
    async () => {
      if (!dataSourceId) {
        setMessage({
          type: "error",
          text: "Upload a test data file before running.",
        });

        return;
      }

      if (rowCount === 0) {
        setMessage({
          type: "error",
          text: "The uploaded source has no data rows.",
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
        const response =
          await API.post(
            "/api/advanced/data-drive/run-parameterized",
            {
              testCaseId,
              dataSourceId,
              continueOnFailure:
                false,
            },
            {
              headers:
                authHeaders(),
            },
          );

        if (
          !response.data?.success
        ) {
          throw new Error(
            response.data?.error ||
              "Failed to run parameterized tests.",
          );
        }

        const totalRuns =
          Number(
            response.data.data
              ?.totalRuns,
          ) || 0;

        const runIds:
          | number[]
          | string[] =
          response.data.data
            ?.runIds || [];

        setMessage({
          type: "success",
          text: `Completed ${totalRuns} run${
            totalRuns === 1
              ? ""
              : "s"
          }${
            runIds.length
              ? `. Run IDs: ${runIds.join(
                  ", ",
                )}`
              : "."
          }`,
        });
      } catch (error: any) {
        const backendError =
          getErrorMessage(
            error,
            "Failed to run the data-driven test.",
          );

        setMessage({
          type: "error",
          text: backendError,
        });
      } finally {
        setRunning(false);
      }
    };

  const messageClasses =
    message?.type === "success"
      ? "border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300"
      : message?.type === "error"
        ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
        : "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300";

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6 dark:border-gray-700 dark:bg-gray-900">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Data-Driven Testing
          </h3>

          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Upload test data, map values
            to placeholders and execute
            the selected test case for
            every data row.
          </p>
        </div>

        {dataSourceId && (
          <span className="inline-flex items-center gap-2 rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700 dark:bg-green-950/40 dark:text-green-300">
            <FaCheckCircle />
            Source #{dataSourceId}
          </span>
        )}
      </div>

      {message && (
        <div
          className={`mb-5 rounded-lg border px-3 py-2 text-sm ${messageClasses}`}
        >
          {message.text}
        </div>
      )}

      <div className="mb-6 rounded-xl border border-gray-200 p-4 dark:border-gray-700">
        <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
          Test Data Source
        </label>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <select
            value={sourceType}
            onChange={
              handleSourceTypeChange
            }
            disabled={
              uploading || running
            }
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white sm:w-40"
          >
            <option value="CSV">
              CSV
            </option>

            <option value="XLSX">
              XLSX
            </option>

            <option value="JSON">
              JSON
            </option>
          </select>

          <label
            className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white ${
              uploading || running
                ? "cursor-not-allowed bg-blue-400"
                : "cursor-pointer bg-blue-600 hover:bg-blue-700"
            }`}
          >
            <FaUpload />

            {uploading
              ? "Uploading..."
              : `Upload ${sourceType}`}

            <input
              type="file"
              hidden
              disabled={
                uploading || running
              }
              accept={
                ACCEPTED_FILES[
                  sourceType
                ]
              }
              onChange={
                handleFileUpload
              }
            />
          </label>

          {selectedFileName && (
            <span
              title={
                selectedFileName
              }
              className="min-w-0 truncate text-sm text-gray-500 dark:text-gray-400"
            >
              {selectedFileName}
            </span>
          )}
        </div>
      </div>

      {preview.length > 0 && (
  <div className="mb-6">
    <div className="mb-3 flex items-center justify-between gap-2">
      <h4 className="text-sm font-medium text-gray-900 dark:text-white">
        Preview
      </h4>

      <span className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-300">
        {rowCount} rows
      </span>
    </div>

    <div className="rounded-lg border border-gray-200 dark:border-gray-700">
      <div
        className="overflow-auto"
        style={{
          maxHeight: "145px",
        }}
      >
        <table className="min-w-full table-fixed text-sm">
          <thead className="sticky top-0 z-20 bg-gray-50 dark:bg-gray-800">
            <tr className="h-9">
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
                key={`preview-${rowIndex}`}
                className="h-9 border-b border-gray-100 last:border-b-0 dark:border-gray-800"
              >
                <td className="h-9 whitespace-nowrap px-3 py-2 text-xs text-gray-400">
                  {rowIndex + 1}
                </td>

                {columns.map((column) => (
                  <td
                    key={`${rowIndex}-${column}`}
                    className="h-9 max-w-[260px] truncate whitespace-nowrap px-3 py-2 text-gray-600 dark:text-gray-400"
                    title={String(row[column] ?? "")}
                  >
                    {row[column] === null ||
                    row[column] === undefined
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
        Showing 3 rows at a time. Scroll to view all {preview.length} rows.
      </p>
    )}
  </div>
)}

      <div className="mb-6 rounded-xl border border-gray-200 p-4 dark:border-gray-700">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-medium text-gray-900 dark:text-white">
              Parameter Mappings
            </h4>

            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Example:{" "}
              {
                "{{customer.name}}"
              }{" "}
              → customerName
            </p>
          </div>

          <button
            type="button"
            onClick={addMapping}
            disabled={
              columns.length ===
                0 ||
              savingMappings ||
              running
            }
            className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            <FaPlus />
            Add Mapping
          </button>
        </div>

        {mappings.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 px-4 py-6 text-center text-sm text-gray-500 dark:border-gray-700">
            {columns.length === 0
              ? "Upload a test data file first."
              : "No parameter mappings configured."}
          </div>
        ) : (
          <div className="space-y-3">
            {mappings.map(
              (
                mapping,
                index,
              ) => (
                <div
                  key={
                    mapping.id
                  }
                  className="grid gap-2 rounded-lg bg-gray-50 p-3 md:grid-cols-[40px_1fr_1fr_180px_90px] md:items-center dark:bg-gray-800"
                >
                  <span className="text-xs text-gray-400">
                    {index +
                      1}
                  </span>

                  <input
                    value={
                      mapping.placeholder
                    }
                    onChange={(
                      event,
                    ) =>
                      updateMapping(
                        mapping.id,
                        "placeholder",
                        event
                          .target
                          .value,
                      )
                    }
                    placeholder="{{customer.name}}"
                    disabled={
                      savingMappings ||
                      running
                    }
                    className="rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-xs dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                  />

                  <select
                    value={
                      mapping.dataColumn
                    }
                    onChange={(
                      event,
                    ) =>
                      updateMapping(
                        mapping.id,
                        "dataColumn",
                        event
                          .target
                          .value,
                      )
                    }
                    disabled={
                      savingMappings ||
                      running
                    }
                    className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                  >
                    <option value="">
                      Select
                      column
                    </option>

                    {columns.map(
                      (
                        column,
                      ) => (
                        <option
                          key={
                            column
                          }
                          value={
                            column
                          }
                        >
                          {
                            column
                          }
                        </option>
                      ),
                    )}
                  </select>

                  <select
                    value={
                      mapping.transformation
                    }
                    onChange={(
                      event,
                    ) =>
                      updateMapping(
                        mapping.id,
                        "transformation",
                        event
                          .target
                          .value,
                      )
                    }
                    disabled={
                      savingMappings ||
                      running
                    }
                    className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                  >
                    <option value="None">
                      None
                    </option>

                    <option value="JSONPath">
                      JSONPath
                    </option>

                    <option value="Regex">
                      Regex
                    </option>

                    <option value="Uppercase">
                      Uppercase
                    </option>
                  </select>

                  <button
                    type="button"
                    onClick={() =>
                      removeMapping(
                        mapping.id,
                      )
                    }
                    disabled={
                      savingMappings ||
                      running
                    }
                    className="inline-flex items-center justify-center gap-1 rounded-lg px-2 py-2 text-xs text-red-500 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/30"
                  >
                    <FaTrash />
                    Remove
                  </button>
                </div>
              ),
            )}
          </div>
        )}

        {mappings.length > 0 && (
          <button
            type="button"
            onClick={saveMappings}
            disabled={
              savingMappings ||
              running
            }
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-gray-800 px-4 py-2 text-sm font-medium text-white hover:bg-gray-900 disabled:opacity-50 dark:bg-gray-700"
          >
            <FaSave />

            {savingMappings
              ? "Saving..."
              : "Save Mappings"}
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={
          runDataDrivenTest
        }
        disabled={!canRun}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-purple-600 px-4 py-3 text-sm font-medium text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <FaPlay />

        {running
          ? `Running ${rowCount} row${
              rowCount === 1
                ? ""
                : "s"
            }...`
          : `Run Test With All ${rowCount} Data Row${
              rowCount === 1
                ? ""
                : "s"
            }`}
      </button>
    </div>
  );
}
