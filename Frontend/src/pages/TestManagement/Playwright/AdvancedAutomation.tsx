import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Link,
  useNavigate,
  useParams,
} from "react-router-dom";

import {
  FaArrowLeft,
  FaBrain,
  FaChevronDown,
  FaCode,
  FaCopy,
  FaDatabase,
  FaExchangeAlt,
  FaLightbulb,
  FaProjectDiagram,
  FaSearch,
  FaServer,
  FaTimes,
} from "react-icons/fa";

import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import PageMeta from "../../../components/common/PageMeta";
import Alert from "../../../components/ui/alert/Alert";

import API from "../../../services/api";

import {
  authHeaders,
} from "./helpers";

import type {
  TestCase,
} from "./types";

import DataDrivenTestConfig from "../../../components/DataDrivenTestConfig";
import ConditionalBlockBuilder from "../../../components/ConditionalBlockBuilder";
import KeywordScriptEditor from "../../../components/KeywordScriptEditor";
import DataTransformationBuilder from "../../../components/DataTransformationBuilder";
import APITestingBuilder from "../../../components/APITestingBuilder";
import AISuggestions from "../../../components/AISuggestions";

type AdvancedTab =
  | "data-driven"
  | "api-testing"
  | "conditional"
  | "keywords"
  | "transformation"
  | "ai";

interface AdvancedTabDefinition {
  id: AdvancedTab;
  label: string;
  description: string;

  icon: React.ComponentType<{
    className?: string;
  }>;
}

const ADVANCED_TABS: AdvancedTabDefinition[] = [
  {
    id: "data-driven",
    label: "Data-Driven",
    description:
      "Reuse saved datasets, configure parameter mappings, and execute parameterized tests.",
    icon: FaDatabase,
  },
  {
    id: "api-testing",
    label: "API Testing",
    description:
      "Configure and execute API requests.",
    icon: FaServer,
  },
  {
    id: "conditional",
    label: "Conditional",
    description:
      "Create conditional and looping execution flows.",
    icon: FaProjectDiagram,
  },
  {
    id: "keywords",
    label: "Keywords",
    description:
      "Write or convert keyword-driven test scripts.",
    icon: FaCode,
  },
  {
    id: "transformation",
    label: "Transformation",
    description:
      "Test JSONPath, JMESPath, XPath, regex, and JavaScript transformations.",
    icon: FaExchangeAlt,
  },
  {
    id: "ai",
    label: "AI Suggestions",
    description:
      "Generate assertion and refactoring recommendations.",
    icon: FaLightbulb,
  },
];

export default function AdvancedAutomation() {
  const { testCaseId } = useParams();
  const navigate = useNavigate();

  const [tests, setTests] =
    useState<TestCase[]>([]);

  const [
    selectedCase,
    setSelectedCase,
  ] =
    useState<TestCase | null>(
      null,
    );

  const [
    selectedId,
    setSelectedId,
  ] = useState(
    testCaseId || "",
  );

  const [
    testSearch,
    setTestSearch,
  ] =
    useState("");

  const [
    showDropdown,
    setShowDropdown,
  ] =
    useState(false);

  const [
    script,
    setScript,
  ] =
    useState("");

  const [
    loading,
    setLoading,
  ] =
    useState(false);

  const [
    activeAdvancedTab,
    setActiveAdvancedTab,
  ] =
    useState<AdvancedTab>(
      "data-driven",
    );

  const [
    copied,
    setCopied,
  ] =
    useState(false);

  const [alert, setAlert] =
    useState<{
      type:
        | "success"
        | "error";

      message: string;
    } | null>(
      null,
    );

  /* -------------------------------------------------------------------------- */
  /* Load test cases                                                            */
  /* -------------------------------------------------------------------------- */

  useEffect(() => {
    API.get(
      "/api/test-cases",
      {
        headers:
          authHeaders(),
      },
    )
      .then(
        (
          response,
        ) => {
          setTests(
            response.data
              .data || [],
          );
        },
      )
      .catch(
        () => {
          setTests([]);
        },
      );
  }, []);

  /* -------------------------------------------------------------------------- */
  /* Load selected test case                                                    */
  /* -------------------------------------------------------------------------- */

  const loadCase =
    useCallback(
      async (
        id: string,
      ) => {
        if (!id) {
          setSelectedCase(
            null,
          );

          setScript("");

          return;
        }

        setLoading(
          true,
        );

        setAlert(
          null,
        );

        try {
          const response =
            await API.get(
              `/api/test-cases/${id}`,
              {
                headers:
                  authHeaders(),
              },
            );

          if (
            !response
              .data
              ?.success
          ) {
            throw new Error(
              response
                .data
                ?.message ||
                "Failed to load test case.",
            );
          }

          const testCase: TestCase =
            response
              .data
              .data;

          setSelectedCase(
            testCase,
          );

          setScript(
            testCase
              .playwright_script ||
              "",
          );
        } catch (
          error: any
        ) {
          setSelectedCase(
            null,
          );

          setScript("");

          setAlert({
            type: "error",

            message:
              error
                .response
                ?.data
                ?.message ||
              error
                .response
                ?.data
                ?.error ||
              error
                .message ||
              "Failed to load test case.",
          });
        } finally {
          setLoading(
            false,
          );
        }
      },
      [],
    );

  useEffect(() => {
    if (
      selectedId
    ) {
      loadCase(
        selectedId,
      );
    }
  }, [
    selectedId,
    loadCase,
  ]);

  /* -------------------------------------------------------------------------- */
  /* Filter test cases                                                          */
  /* -------------------------------------------------------------------------- */

  const filteredTests =
    useMemo(
      () =>
        tests.filter(
          (
            test,
          ) =>
            `${test.title} ${
              test.project_name ||
              ""
            } ${
              test.suite_name ||
              ""
            }`
              .toLowerCase()
              .includes(
                testSearch
                  .toLowerCase(),
              ),
        ),
      [
        tests,
        testSearch,
      ],
    );

  /* -------------------------------------------------------------------------- */
  /* Selected tab                                                               */
  /* -------------------------------------------------------------------------- */

  const selectedAdvancedTab =
    useMemo(
      () =>
        ADVANCED_TABS.find(
          (
            tab,
          ) =>
            tab.id ===
            activeAdvancedTab,
        ),
      [
        activeAdvancedTab,
      ],
    );

  /* -------------------------------------------------------------------------- */
  /* Select test                                                                */
  /* -------------------------------------------------------------------------- */

  const selectTest = (
    testCase: TestCase,
  ) => {
    const id =
      String(
        testCase.id,
      );

    setSelectedId(
      id,
    );

    setTestSearch(
      "",
    );

    setShowDropdown(
      false,
    );

    setActiveAdvancedTab(
      "data-driven",
    );

    navigate(
      `/script/advanced/${id}`,
    );
  };

  /* -------------------------------------------------------------------------- */
  /* Clear test                                                                 */
  /* -------------------------------------------------------------------------- */

  const clearSelectedTest =
    () => {
      setSelectedId(
        "",
      );

      setSelectedCase(
        null,
      );

      setScript(
        "",
      );

      setTestSearch(
        "",
      );

      setShowDropdown(
        false,
      );

      setActiveAdvancedTab(
        "data-driven",
      );

      navigate(
        "/script/advanced",
      );
    };

  /* -------------------------------------------------------------------------- */
  /* Copy complete script                                                       */
  /* -------------------------------------------------------------------------- */

  const copyScript =
    async () => {
      if (
        !script
      ) {
        return;
      }

      try {
        await navigator
          .clipboard
          .writeText(
            script,
          );

        setCopied(
          true,
        );

        window.setTimeout(
          () => {
            setCopied(
              false,
            );
          },
          1500,
        );
      } catch (
        error
      ) {
        console.error(
          "Failed to copy script:",
          error,
        );

        setAlert({
          type: "error",
          message:
            "Failed to copy script.",
        });
      }
    };

  /* -------------------------------------------------------------------------- */
  /* Keyword conversion                                                        */
  /* -------------------------------------------------------------------------- */

  const handleKeywordConversion =
    (
      convertedCode: string,
    ) => {
      setScript(
        convertedCode,
      );

      setAlert({
        type: "success",

        message:
          "Keyword script converted successfully.",
      });
    };

  /* -------------------------------------------------------------------------- */
  /* Render module                                                              */
  /* -------------------------------------------------------------------------- */

  const renderAdvancedContent =
    () => {
      if (
        !selectedCase
      ) {
        return null;
      }

      const selectedTestCaseId =
        selectedCase.id;

      switch (
        activeAdvancedTab
      ) {
        case "data-driven":
          return (
            <DataDrivenTestConfig
              testCaseId={
                selectedTestCaseId
              }
            />
          );

        case "api-testing":
          return (
            <APITestingBuilder
              testCaseId={
                selectedTestCaseId
              }
            />
          );

        case "conditional":
          return (
            <ConditionalBlockBuilder
              testCaseId={
                selectedTestCaseId
              }
            />
          );

        case "keywords":
          return (
            <KeywordScriptEditor
              testCaseId={
                selectedTestCaseId
              }
              onConvert={
                handleKeywordConversion
              }
            />
          );

        case "transformation":
          return (
            <DataTransformationBuilder />
          );

        case "ai":
          return (
            <AISuggestions
              testCaseId={
                selectedTestCaseId
              }
              script={
                script
              }
            />
          );

        default:
          return null;
      }
    };

  return (
    <div>
      <PageMeta
        title="Advanced Automation"
        description="Configure advanced test automation capabilities"
      />

      <PageBreadcrumb
        pageTitle="Advanced Automation"
      />

      <div className="mt-4 space-y-4">
        {/* -------------------------------------------------------------- */}
        {/* Alert                                                          */}
        {/* -------------------------------------------------------------- */}

        {alert && (
          <Alert
            variant={
              alert.type
            }
            title={
              alert.type ===
              "success"
                ? "Success"
                : "Error"
            }
            message={
              alert.message
            }
          />
        )}

        {/* -------------------------------------------------------------- */}
        {/* Top bar                                                        */}
        {/* -------------------------------------------------------------- */}

        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="flex flex-wrap items-center gap-3">
            {/* Back */}
            <Link
              to={
                selectedCase
                  ? `/script/editor/${selectedCase.id}`
                  : "/script/editor"
              }
              className="inline-flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              <FaArrowLeft className="h-3.5 w-3.5" />

              Script Editor
            </Link>

            {/* Test case picker */}
            <div className="relative min-w-[280px] flex-1">
              <div
                className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
                onClick={() =>
                  setShowDropdown(
                    (
                      current,
                    ) =>
                      !current,
                  )
                }
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
                  onChange={(
                    event,
                  ) => {
                    setTestSearch(
                      event
                        .target
                        .value,
                    );

                    setShowDropdown(
                      true,
                    );
                  }}
                  onFocus={() => {
                    setTestSearch(
                      "",
                    );

                    setShowDropdown(
                      true,
                    );
                  }}
                  placeholder="Search and select a test case…"
                  className="flex-1 bg-transparent text-sm text-gray-900 focus:outline-none dark:text-white"
                />

                {selectedCase &&
                !showDropdown ? (
                  <button
                    type="button"
                    onClick={(
                      event,
                    ) => {
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
                      showDropdown
                        ? "rotate-180"
                        : ""
                    }`}
                  />
                )}
              </div>

              {showDropdown && (
                <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900">
                  {filteredTests.length ===
                  0 ? (
                    <div className="px-4 py-6 text-center text-sm text-gray-500">
                      No test
                      cases
                      found.
                    </div>
                  ) : (
                    filteredTests.map(
                      (
                        testCase,
                      ) => (
                        <button
                          type="button"
                          key={
                            testCase.id
                          }
                          onClick={() =>
                            selectTest(
                              testCase,
                            )
                          }
                          className="w-full border-b border-gray-100 px-4 py-3 text-left last:border-0 hover:bg-gray-50 dark:border-gray-700/50 dark:hover:bg-gray-800"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-sm font-medium text-gray-900 dark:text-white">
                              #
                              {
                                testCase.id
                              }{" "}
                              —{" "}
                              {
                                testCase.title
                              }
                            </span>

                            {!testCase.playwright_script && (
                              <span className="flex-shrink-0 text-xs text-amber-500">
                                No
                                script
                              </span>
                            )}
                          </div>

                          <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                            {testCase.project_name ||
                              "—"}{" "}
                            /{" "}
                            {testCase.suite_name ||
                              "—"}
                          </div>
                        </button>
                      ),
                    )
                  )}
                </div>
              )}

              {showDropdown && (
                <div
                  className="fixed inset-0 z-40"
                  onClick={() =>
                    setShowDropdown(
                      false,
                    )
                  }
                />
              )}
            </div>
          </div>

          {/* Meta */}
          {selectedCase && (
            <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-gray-100 pt-3 dark:border-gray-700">
              <div className="flex items-center gap-2">
                <FaBrain className="text-purple-500" />

                <span className="text-sm font-semibold text-gray-900 dark:text-white">
                  Advanced
                  Automation
                </span>
              </div>

              <span className="text-xs text-gray-500 dark:text-gray-400">
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  {selectedCase.project_name ||
                    "—"}
                </span>

                {" / "}

                <span className="font-medium text-gray-700 dark:text-gray-300">
                  {selectedCase.suite_name ||
                    "—"}
                </span>
              </span>

              <span
                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                  {
                    Low:
                      "bg-gray-100 text-gray-600",

                    Medium:
                      "bg-blue-100 text-blue-700",

                    High:
                      "bg-orange-100 text-orange-700",

                    Critical:
                      "bg-red-100 text-red-700",
                  }[
                    selectedCase
                      .priority
                  ] || ""
                }`}
              >
                {
                  selectedCase
                    .priority
                }
              </span>

              <span
                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                  {
                    Draft:
                      "bg-yellow-100 text-yellow-700",

                    Ready:
                      "bg-green-100 text-green-700",

                    Deprecated:
                      "bg-gray-100 text-gray-500",
                  }[
                    selectedCase
                      .status
                  ] || ""
                }`}
              >
                {
                  selectedCase
                    .status
                }
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

        {/* -------------------------------------------------------------- */}
        {/* Script reference                                               */}
        {/* -------------------------------------------------------------- */}

        {selectedCase && (
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-5 py-3 dark:border-gray-700">
              <div>
                <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
                  <FaCode className="text-blue-500" />

                  Script Reference
                </h2>

                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Select and
                  copy
                  placeholders
                  directly from
                  the current
                  Playwright
                  script.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {
                    script
                      .split(
                        "\n",
                      )
                      .length
                  }{" "}
                  lines
                </span>

                <button
                  type="button"
                  onClick={
                    copyScript
                  }
                  disabled={
                    !script
                  }
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  <FaCopy />

                  {copied
                    ? "Copied"
                    : "Copy Script"}
                </button>
              </div>
            </div>

            {script ? (
              <textarea
                value={
                  script
                }
                readOnly
                spellCheck={
                  false
                }
                className="block h-[220px] w-full resize-none overflow-auto bg-white p-5 font-mono text-sm leading-6 text-gray-900 outline-none selection:bg-blue-200 selection:text-gray-900 dark:bg-gray-900 dark:text-gray-100 dark:selection:bg-blue-700 dark:selection:text-white"
              />
            ) : (
              <div className="flex h-[160px] items-center justify-center p-6 text-center text-sm text-gray-500 dark:text-gray-400">
                No
                Playwright
                script is
                available
                for this test
                case.
              </div>
            )}
          </div>
        )}

        {/* -------------------------------------------------------------- */}
        {/* Advanced Automation                                            */}
        {/* -------------------------------------------------------------- */}

        <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="border-b border-gray-200 px-4 py-4 sm:px-5 dark:border-gray-700">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-purple-100 p-2 text-purple-600 dark:bg-purple-950/50 dark:text-purple-300">
                <FaBrain />
              </div>

              <div>
                <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                  Advanced
                  Automation
                </h2>

                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Configure
                  data-driven,
                  API,
                  conditional,
                  keyword-driven,
                  transformation,
                  and
                  AI-assisted
                  test
                  capabilities.
                </p>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="p-6">
              <div className="rounded-xl border border-gray-200 bg-gray-50 px-6 py-10 text-center dark:border-gray-700 dark:bg-gray-800/50">
                <FaBrain className="mx-auto mb-3 animate-pulse text-2xl text-gray-400" />

                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Loading
                  test
                  case...
                </p>
              </div>
            </div>
          ) : !selectedCase ? (
            <div className="p-6">
              <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-6 py-10 text-center dark:border-gray-700 dark:bg-gray-800/50">
                <FaBrain className="mx-auto mb-3 text-2xl text-gray-400" />

                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Select a
                  test case
                  to use the
                  advanced
                  automation
                  tools.
                </p>

                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Select a
                  test case
                  above to
                  configure
                  its advanced
                  automation
                  capabilities.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Tabs */}
              <div className="overflow-x-auto border-b border-gray-200 dark:border-gray-700">
                <div className="flex min-w-max gap-1 p-2">
                  {ADVANCED_TABS.map(
                    (
                      tab,
                    ) => {
                      const Icon =
                        tab.icon;

                      const isActive =
                        activeAdvancedTab ===
                        tab.id;

                      return (
                        <button
                          type="button"
                          key={
                            tab.id
                          }
                          onClick={() =>
                            setActiveAdvancedTab(
                              tab.id,
                            )
                          }
                          title={
                            tab.description
                          }
                          className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                            isActive
                              ? "bg-blue-600 text-white shadow-sm"
                              : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white"
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5" />

                          {
                            tab.label
                          }
                        </button>
                      );
                    },
                  )}
                </div>
              </div>

              {/* Description */}
              <div className="border-b border-gray-100 bg-gray-50 px-5 py-3 dark:border-gray-800 dark:bg-gray-800/40">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {
                    selectedAdvancedTab
                      ?.description
                  }
                </p>
              </div>

              {/* Content */}
              <div className="p-4 sm:p-5">
                {
                  renderAdvancedContent()
                }
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}