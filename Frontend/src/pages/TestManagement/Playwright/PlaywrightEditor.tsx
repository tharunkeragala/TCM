import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  FaBrain,
  FaChevronDown,
  FaCode,
  FaPlay,
  FaSave,
  FaSearch,
  FaTimes,
  FaVideo,
} from "react-icons/fa";

import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import PageMeta from "../../../components/common/PageMeta";
import Alert from "../../../components/ui/alert/Alert";
import API from "../../../services/api";

import { authHeaders, formatSelector } from "./helpers";

import type { ParsedStep, TestCase } from "./types";

const SAMPLE_SCRIPT = `// Navigate to page
await page.goto('https://example.com');

// Wait for content
await page.waitForSelector('h1');

// Click or fill elements
// await page.click('#login');
// await page.fill('[name="username"]', 'demo');
`;

export default function PlaywrightEditor() {
  const { testCaseId } = useParams();
  const navigate = useNavigate();

  const [tests, setTests] = useState<TestCase[]>([]);
  const [testSearch, setTestSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);

  const [selectedId, setSelectedId] = useState<string>(testCaseId || "");

  const [selectedCase, setSelectedCase] = useState<TestCase | null>(null);

  const [script, setScript] = useState(SAMPLE_SCRIPT);

  const [steps, setSteps] = useState<ParsedStep[]>([]);

  const [loading, setLoading] = useState(false);

  const [saving, setSaving] = useState(false);

  const [alert, setAlert] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  useEffect(() => {
    API.get("/api/test-cases", {
      headers: authHeaders(),
    })
      .then((response) => {
        setTests(response.data.data || []);
      })
      .catch(() => {
        setTests([]);
      });
  }, []);

  useEffect(() => {
    const recordedScript = localStorage.getItem("recordedPlaywrightScript");

    if (recordedScript) {
      setScript(recordedScript);

      localStorage.removeItem("recordedPlaywrightScript");
    }
  }, []);

  const loadCase = useCallback(
    async (id: string) => {
      if (!id) {
        setSelectedCase(null);
        return;
      }

      setLoading(true);
      setAlert(null);

      try {
        const response = await API.get(`/api/test-cases/${id}`, {
          headers: authHeaders(),
        });

        if (response.data.success) {
          const testCase: TestCase = response.data.data;

          setSelectedCase(testCase);

          setScript((currentScript) => {
            const recordedScript = localStorage.getItem(
              "recordedPlaywrightScript",
            );

            if (recordedScript) {
              return recordedScript;
            }

            if (currentScript !== SAMPLE_SCRIPT && !testCaseId) {
              return currentScript;
            }

            return testCase.playwright_script || SAMPLE_SCRIPT;
          });
        }
      } catch (error: any) {
        setAlert({
          type: "error",
          message: error.response?.data?.message || "Failed to load test case.",
        });
      } finally {
        setLoading(false);
      }
    },
    [testCaseId],
  );

  useEffect(() => {
    if (selectedId) {
      loadCase(selectedId);
    }
  }, [selectedId, loadCase]);

  const parseSteps = useCallback(async (value: string) => {
    try {
      const response = await API.post(
        "/api/playwright/parse-steps",
        {
          script: value,
        },
        {
          headers: authHeaders(),
        },
      );

      setSteps(response.data.data || []);
    } catch {
      setSteps([]);
    }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      parseSteps(script);
    }, 250);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [script, parseSteps]);

  const canSave = useMemo(
    () => Boolean(selectedCase && script.trim()),
    [selectedCase, script],
  );

  const filteredTests = useMemo(
    () =>
      tests.filter((test) =>
        `${test.title} ${test.project_name || ""} ${test.suite_name || ""}`
          .toLowerCase()
          .includes(testSearch.toLowerCase()),
      ),
    [tests, testSearch],
  );

  const saveScript = async () => {
    if (!selectedCase) {
      setAlert({
        type: "error",
        message: "Select a test case before saving.",
      });

      return;
    }

    setSaving(true);
    setAlert(null);

    try {
      const payload = {
        suite_id: selectedCase.suite_id,
        title: selectedCase.title,
        preconditions: selectedCase.preconditions || "",
        priority: selectedCase.priority || "Medium",
        status: selectedCase.status || "Draft",
        steps: selectedCase.steps || [],
        playwright_script: script,
      };

      const response = await API.put(
        `/api/test-cases/update/${selectedCase.id}`,
        payload,
        {
          headers: authHeaders(),
        },
      );

      if (response.data.success) {
        setSelectedCase((current) =>
          current
            ? {
                ...current,
                playwright_script: script,
              }
            : current,
        );

        setAlert({
          type: "success",
          message: "Script saved successfully.",
        });
      }
    } catch (error: any) {
      setAlert({
        type: "error",
        message: error.response?.data?.message || "Failed to save script.",
      });
    } finally {
      setSaving(false);
    }
  };

  const selectTest = (testCase: TestCase) => {
    setSelectedId(String(testCase.id));

    setTestSearch("");
    setShowDropdown(false);

    navigate(`/script/editor/${testCase.id}`);
  };

  const clearSelectedTest = () => {
    setSelectedId("");
    setSelectedCase(null);
    setScript(SAMPLE_SCRIPT);
    setSteps([]);
    setTestSearch("");
    setShowDropdown(false);

    navigate("/script/editor");
  };

  return (
    <div>
      <PageMeta
        title="Script Editor"
        description="Edit Playwright automation scripts"
      />

      <PageBreadcrumb pageTitle="Script Editor" />

      <div className="mt-4 space-y-4">
        {alert && (
          <Alert
            variant={alert.type}
            title={alert.type === "success" ? "Success" : "Error"}
            message={alert.message}
          />
        )}

        {/* Top bar */}
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="flex flex-wrap items-center gap-3">
            {/* Test case picker */}
            <div className="relative min-w-[280px] flex-1">
              <div
                className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
                onClick={() => setShowDropdown((current) => !current)}
              >
                <FaSearch className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />

                <input
                  value={
                    showDropdown
                      ? testSearch
                      : selectedCase
                        ? `#${selectedCase.id} — ${selectedCase.title}`
                        : ""
                  }
                  onChange={(event) => {
                    setTestSearch(event.target.value);

                    setShowDropdown(true);
                  }}
                  onFocus={() => {
                    setTestSearch("");
                    setShowDropdown(true);
                  }}
                  placeholder="Search and select a test case…"
                  className="flex-1 bg-transparent text-sm text-gray-900 focus:outline-none dark:text-white"
                />

                {selectedCase && !showDropdown ? (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      clearSelectedTest();
                    }}
                    aria-label="Clear selected test case"
                  >
                    <FaTimes className="h-3 w-3 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200" />
                  </button>
                ) : (
                  <FaChevronDown
                    className={`h-3 w-3 text-gray-400 transition-transform ${
                      showDropdown ? "rotate-180" : ""
                    }`}
                  />
                )}
              </div>

              {showDropdown && (
                <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900">
                  {filteredTests.length === 0 ? (
                    <div className="px-4 py-6 text-center text-sm text-gray-500">
                      No test cases found.
                    </div>
                  ) : (
                    filteredTests.map((testCase) => (
                      <button
                        type="button"
                        key={testCase.id}
                        onClick={() => selectTest(testCase)}
                        className="w-full border-b border-gray-100 px-4 py-3 text-left last:border-0 hover:bg-gray-50 dark:border-gray-700/50 dark:hover:bg-gray-800"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-medium text-gray-900 dark:text-white">
                            #{testCase.id} — {testCase.title}
                          </span>

                          {!testCase.playwright_script && (
                            <span className="flex-shrink-0 text-xs text-amber-500">
                              No script
                            </span>
                          )}
                        </div>

                        <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                          {testCase.project_name || "—"} /{" "}
                          {testCase.suite_name || "—"}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}

              {showDropdown && (
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowDropdown(false)}
                />
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-2">
              <Link
                to="/script/recorder"
                className="inline-flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                <FaVideo className="h-3.5 w-3.5" />
                Record
              </Link>

              <button
                type="button"
                onClick={saveScript}
                disabled={!canSave || saving || loading}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <FaSave className="h-3.5 w-3.5" />

                {saving ? "Saving…" : "Save"}
              </button>

              {selectedCase && (
                <>
                  <Link
                    to={`/script/runner/${selectedCase.id}`}
                    className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
                  >
                    <FaPlay className="h-3.5 w-3.5" />
                    Run
                  </Link>

                  <Link
                    to={`/script/advanced/${selectedCase.id}`}
                    className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700"
                  >
                    <FaBrain className="h-3.5 w-3.5" />
                    Advanced Automation
                  </Link>
                </>
              )}
            </div>
          </div>

          {/* Selected case meta */}
          {selectedCase && (
            <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-gray-100 pt-3 dark:border-gray-700">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  {selectedCase.project_name || "—"}
                </span>

                {" / "}

                <span className="font-medium text-gray-700 dark:text-gray-300">
                  {selectedCase.suite_name || "—"}
                </span>
              </span>

              <span
                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                  {
                    Low: "bg-gray-100 text-gray-600",
                    Medium: "bg-blue-100 text-blue-700",
                    High: "bg-orange-100 text-orange-700",
                    Critical: "bg-red-100 text-red-700",
                  }[selectedCase.priority] || ""
                }`}
              >
                {selectedCase.priority}
              </span>

              <span
                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                  {
                    Draft: "bg-yellow-100 text-yellow-700",
                    Ready: "bg-green-100 text-green-700",
                    Deprecated: "bg-gray-100 text-gray-500",
                  }[selectedCase.status] || ""
                }`}
              >
                {selectedCase.status}
              </span>

              <Link
                to={`/test-cases/${selectedCase.id}`}
                className="ml-auto text-xs text-blue-600 hover:underline dark:text-blue-400"
              >
                View Details →
              </Link>
            </div>
          )}
        </div>

        {/* Editor and parsed steps */}
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          {/* Script */}
          <div className="min-w-0 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3 dark:border-gray-700">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
                <FaCode className="text-blue-500" />
                Script
              </h2>

              <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                <span>{script.split("\n").length} lines</span>

                {loading && <span className="text-blue-500">Loading…</span>}
              </div>
            </div>

            <div className="h-[360px] overflow-auto">
              <textarea
                value={script}
                onChange={(event) => setScript(event.target.value)}
                spellCheck={false}
                placeholder="Write your script here…"
                className="
                  block
                  h-full
                  min-h-full
                  w-full
                  resize-none
                  overflow-auto
                  bg-white
                  p-5
                  font-mono
                  text-sm
                  text-gray-900
                  outline-none
                  dark:bg-gray-900
                  dark:text-gray-100
                "
              />
            </div>
          </div>

          {/* Parsed Steps */}
          <div className="min-w-0 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <div className="flex h-[49px] items-center justify-between border-b border-gray-200 px-5 dark:border-gray-700">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                Parsed Steps
              </h3>

              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                {steps.length}
              </span>
            </div>

            <div className="h-[360px] overflow-y-auto overflow-x-hidden p-4">
              {steps.length === 0 ? (
                <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                  No recognizable script steps.
                </div>
              ) : (
                <div className="space-y-2">
                  {steps.map((step, index) => (
                    <div
                      key={`${index}-${step.raw}`}
                      className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800"
                    >
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="font-mono text-xs font-semibold text-blue-600 dark:text-blue-300">
                          {index + 1}. {step.action}
                        </span>

                        {step.value && (
                          <span
                            title={String(step.value)}
                            className="max-w-[120px] truncate text-xs text-green-600 dark:text-green-400"
                          >
                            {step.value}
                          </span>
                        )}
                      </div>

                      <div className="break-all font-mono text-xs text-gray-500 dark:text-gray-400">
                        {formatSelector(step.selector) || step.raw || "—"}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}