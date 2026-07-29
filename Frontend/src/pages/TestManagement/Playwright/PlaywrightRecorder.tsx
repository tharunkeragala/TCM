import { useEffect, useRef, useState } from "react";

import { useNavigate, Link } from "react-router-dom";

import {
  FaCircle,
  FaStop,
  FaVideo,
  FaCode,
  FaCopy,
  FaCheck,
  FaPlay,
  FaSave,
} from "react-icons/fa";

import PageBreadcrumb from "../../../components/common/PageBreadCrumb";

import PageMeta from "../../../components/common/PageMeta";

import Alert from "../../../components/ui/alert/Alert";

import API from "../../../services/api";

import { authHeaders, formatSelector, getWsUrl } from "./helpers";

import type { RecorderAction, TestCase } from "./types";

export default function PlaywrightRecorder() {
  const navigate = useNavigate();

  const [url, setUrl] = useState("");

  const [sessionId, setSessionId] = useState<string | null>(null);

  const [recording, setRecording] = useState(false);

  const [actions, setActions] = useState<RecorderAction[]>([]);

  const [alert, setAlert] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const [busy, setBusy] = useState(false);

  // Recorded script is kept in state — never auto-cleared

  const [recordedScript, setRecordedScript] = useState<string | null>(null);

  const [copied, setCopied] = useState(false);

  // Test-case picker (after stop)

  const [tests, setTests] = useState<TestCase[]>([]);

  const [testSearch, setTestSearch] = useState("");

  const [selectedTestId, setSelectedTestId] = useState<string>("");

  const [saving, setSaving] = useState(false);

  const [saveAlert, setSaveAlert] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const [showSaveConfirm, setShowSaveConfirm] = useState(false);

  const [pendingTestId, setPendingTestId] = useState<string>("");

  const sessionIdRef = useRef<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);

  const actionsListRef = useRef<HTMLDivElement | null>(null);

  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const liveCardRef = useRef<HTMLDivElement | null>(null);
  const liveBodyRef = useRef<HTMLDivElement | null>(null);
  const scriptCardRef = useRef<HTMLDivElement | null>(null);
  const scriptBodyRef = useRef<HTMLTextAreaElement | null>(null);
  const saveCardRef = useRef<HTMLDivElement | null>(null);
  const saveListRef = useRef<HTMLDivElement | null>(null);

  const [desktopMaxHeight, setDesktopMaxHeight] = useState(736);
  const [desktopWorkspaceHeight, setDesktopWorkspaceHeight] = useState(420);

  // Load test cases

  useEffect(() => {
    API.get("/api/test-cases", { headers: authHeaders() })

      .then((res) => setTests(res.data.data || []))

      .catch(() => setTests([]));
  }, []);

  // WebSocket for live actions

  useEffect(() => {
    if (!recording || !sessionId) return;

    sessionIdRef.current = sessionId;

    const ws = new WebSocket(getWsUrl());

    wsRef.current = ws;

    ws.onmessage = (event) => {
      let msg: any;

      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }

      if (
        msg.type !== "record_action" ||
        msg.sessionId !== sessionIdRef.current
      )
        return;

      const incoming: RecorderAction = msg.action;

      setActions((prev) => {
        const last = prev[prev.length - 1];

        if (
          incoming.action === "fill" &&
          last?.action === "fill" &&
          JSON.stringify(last.selector) === JSON.stringify(incoming.selector)
        ) {
          return [...prev.slice(0, -1), incoming];
        }

        return [...prev, incoming];
      });
    };

    ws.onerror = () =>
      setAlert({ type: "error", message: "WebSocket connection failed." });

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [recording, sessionId]);

  useEffect(() => {
    const list = actionsListRef.current;
    if (!list) return;

    list.scrollTo({
      top: list.scrollHeight,
      behavior: "smooth",
    });
  }, [actions]);

  useEffect(() => {
    const updateDesktopMaxHeight = () => {
      const workspace = workspaceRef.current;
      if (!workspace || window.innerWidth < 1280) return;

      const top = workspace.getBoundingClientRect().top;
      const availableHeight = Math.max(360, window.innerHeight - top - 16);
      setDesktopMaxHeight(Math.min(736, availableHeight));
    };

    updateDesktopMaxHeight();

    window.addEventListener("resize", updateDesktopMaxHeight);
    window.visualViewport?.addEventListener("resize", updateDesktopMaxHeight);

    return () => {
      window.removeEventListener("resize", updateDesktopMaxHeight);
      window.visualViewport?.removeEventListener(
        "resize",
        updateDesktopMaxHeight,
      );
    };
  }, [alert, recordedScript, saveAlert, selectedTestId]);

  useEffect(() => {
    if (window.innerWidth < 1280) return;

    const measureNaturalCardHeight = (
      card: HTMLElement | null,
      scrollBody: HTMLElement | null,
      minimumBodyHeight: number,
    ) => {
      if (!card || !scrollBody) return 0;

      const bodyViewportHeight = scrollBody.clientHeight;
      const naturalBodyHeight = Math.max(
        scrollBody.scrollHeight,
        minimumBodyHeight,
      );

      return card.scrollHeight - bodyViewportHeight + naturalBodyHeight;
    };

    const updateSharedHeight = () => {
      const liveHeight = measureNaturalCardHeight(
        liveCardRef.current,
        liveBodyRef.current,
        180,
      );

      const scriptHeight =
        recordedScript !== null
          ? measureNaturalCardHeight(
              scriptCardRef.current,
              scriptBodyRef.current,
              180,
            )
          : 0;

      const leftHeight =
        liveHeight + scriptHeight + (scriptHeight > 0 ? 16 : 0);

      const rightHeight = measureNaturalCardHeight(
        saveCardRef.current,
        saveListRef.current,
        180,
      );

      const desiredHeight = Math.max(420, leftHeight, rightHeight);
      setDesktopWorkspaceHeight(Math.min(desktopMaxHeight, desiredHeight));
    };

    const frame = window.requestAnimationFrame(updateSharedHeight);
    const observer = new ResizeObserver(updateSharedHeight);

    [
      liveCardRef.current,
      liveBodyRef.current,
      scriptCardRef.current,
      scriptBodyRef.current,
      saveCardRef.current,
      saveListRef.current,
    ].forEach((element) => {
      if (element) observer.observe(element);
    });

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [
    actions,
    tests.length,
    testSearch,
    recordedScript,
    saveAlert,
    selectedTestId,
    desktopMaxHeight,
  ]);

  const start = async () => {
    if (!url.trim()) {
      setAlert({ type: "error", message: "Enter the URL to record." });

      return;
    }

    setBusy(true);

    setAlert(null);

    setRecordedScript(null);

    setSaveAlert(null);

    setSelectedTestId("");

    try {
      const res = await API.post(
        "/api/playwright/recorder/start",
        { url: url.trim() },
        { headers: authHeaders() },
      );

      if (res.data.success) {
        setActions([]);

        setSessionId(res.data.sessionId);

        setRecording(true);
      }
    } catch (err: any) {
      setAlert({
        type: "error",
        message: err.response?.data?.message || "Failed to start recorder.",
      });
    } finally {
      setBusy(false);
    }
  };

  const stop = async () => {
    if (!sessionId) return;

    setBusy(true);

    setAlert(null);

    try {
      const res = await API.post(
        `/api/playwright/recorder/stop/${sessionId}`,
        {},
        { headers: authHeaders() },
      );

      if (res.data.success) {
        const script = res.data.script || "";

        setRecordedScript(script);

        // Keep in localStorage as fallback too

        localStorage.setItem("recordedPlaywrightScript", script);

        localStorage.setItem(
          "recordedPlaywrightActions",
          JSON.stringify(res.data.actions || []),
        );

        setRecording(false);

        setSessionId(null);

        sessionIdRef.current = null;

        wsRef.current?.close();
      }
    } catch (err: any) {
      setAlert({
        type: "error",
        message: err.response?.data?.message || "Failed to stop recorder.",
      });

      setRecording(false);
    } finally {
      setBusy(false);
    }
  };

  const copyScript = async () => {
    if (!recordedScript) return;

    try {
      await navigator.clipboard.writeText(recordedScript);

      setCopied(true);

      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback

      const el = document.createElement("textarea");

      el.value = recordedScript;

      document.body.appendChild(el);

      el.select();

      document.execCommand("copy");

      document.body.removeChild(el);

      setCopied(true);

      setTimeout(() => setCopied(false), 2000);
    }
  };

  const openEditor = () => {
    if (!recordedScript) return;

    localStorage.setItem("recordedPlaywrightScript", recordedScript);

    navigate("/script/editor");
  };

  // When user picks a test case — if script not yet copied, show confirm

  const handleTestSelect = (id: string) => {
    if (!copied && recordedScript) {
      setPendingTestId(id);

      setShowSaveConfirm(true);
    } else {
      setSelectedTestId(id);
    }
  };

  const confirmSaveToCase = async () => {
    setShowSaveConfirm(false);

    setSelectedTestId(pendingTestId);

    await saveToTestCase(pendingTestId);
  };

  const saveToTestCase = async (id?: string) => {
    const targetId = id || selectedTestId;

    if (!targetId || !recordedScript) return;

    const tc = tests.find((t) => String(t.id) === targetId);

    if (!tc) return;

    setSaving(true);

    setSaveAlert(null);

    try {
      const payload = {
        suite_id: tc.suite_id,

        title: tc.title,

        preconditions: tc.preconditions || "",

        priority: tc.priority || "Medium",

        status: tc.status || "Draft",

        steps: tc.steps || [],

        playwright_script: recordedScript,
      };

      const res = await API.put(`/api/test-cases/update/${tc.id}`, payload, {
        headers: authHeaders(),
      });

      if (res.data.success) {
        setSaveAlert({
          type: "success",
          message: `Script saved to "${tc.title}" successfully.`,
        });
      }
    } catch (err: any) {
      setSaveAlert({
        type: "error",
        message: err.response?.data?.message || "Failed to save script.",
      });
    } finally {
      setSaving(false);
    }
  };

  const filteredTests = tests.filter((t) =>
    `${t.title} ${t.project_name || ""} ${t.suite_name || ""}`
      .toLowerCase()
      .includes(testSearch.toLowerCase()),
  );

  return (
    <div>
      <PageMeta
        title="Script Recorder"
        description="Record browser actions into Scripts"
      />

      <PageBreadcrumb pageTitle="Script Recorder" />

      {/* Confirm modal */}

      {showSaveConfirm && (
        <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="max-h-[calc(100vh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl dark:bg-gray-900 sm:p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900">
                <svg
                  className="w-5 h-5 text-amber-600 dark:text-amber-400"
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

              <div>
                <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
                  Haven't copied the script yet
                </h3>

                <p className="text-sm text-gray-600 dark:text-gray-400">
                  You haven't copied your recorded script. Do you still want to
                  save it to{" "}
                  <strong>
                    {tests.find((t) => String(t.id) === pendingTestId)?.title}
                  </strong>
                  ? The script will be saved to the test case.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowSaveConfirm(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 rounded-lg"
              >
                Go Back
              </button>

              <button
                onClick={confirmSaveToCase}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
              >
                Yes, Save It
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-4 space-y-4">
        {alert && (
          <Alert
            variant={alert.type}
            title={alert.type === "success" ? "Success" : "Error"}
            message={alert.message}
          />
        )}

        {/* Top Control Bar */}

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300">
              <FaVideo />
            </div>

            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                Record a Browser Flow
              </h2>

              <p className="text-sm text-gray-500 dark:text-gray-400">
                Start recording, interact with the Chromium window, then save or
                copy the generated script.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="flex-1 min-w-[240px]">
              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                Application URL
              </label>

              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" &&
                  !recording &&
                  !busy &&
                  url.trim() &&
                  start()
                }
                placeholder="https://example.com"
                disabled={recording || busy}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white disabled:opacity-50"
              />
            </div>

            {!recording ? (
              <button
                onClick={start}
                disabled={busy || !url.trim()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60 sm:w-auto"
              >
                <FaCircle className="h-3 w-3 text-red-300" /> Start Recording
              </button>
            ) : (
              <button
                onClick={stop}
                disabled={busy}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 px-5 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60 sm:w-auto"
              >
                <FaStop className="h-3 w-3" /> Stop & Save
              </button>
            )}

            {recording && (
              <span className="flex items-center gap-2 text-sm font-medium text-red-500 dark:text-red-400">
                <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />{" "}
                Recording…
              </span>
            )}
          </div>
        </div>

        <div
          ref={workspaceRef}
          className="grid items-stretch gap-4 overflow-visible xl:h-[var(--workspace-height)] xl:grid-cols-[minmax(0,1fr)_420px] xl:overflow-hidden"
          style={
            {
              "--workspace-height": `${desktopWorkspaceHeight}px`,
            } as React.CSSProperties
          }
        >
          {/* Left: Recorded Script (shown after stop) OR live actions */}

          <div
            className={`grid min-w-0 min-h-0 gap-4 ${
              recordedScript !== null
                ? "xl:h-full xl:grid-rows-[minmax(220px,0.9fr)_minmax(180px,1.1fr)]"
                : "xl:h-full xl:grid-rows-1"
            }`}
          >
            {recordedScript !== null && (
              <div
                ref={scriptCardRef}
                className="flex min-h-[280px] max-h-[70vh] min-w-0 flex-col overflow-hidden rounded-2xl border border-green-200 bg-white shadow-sm dark:border-green-800 dark:bg-gray-900 xl:min-h-0 xl:max-h-none"
              >
                <div className="flex flex-col gap-3 border-b border-green-200 px-4 py-3 dark:border-green-800 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                  <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
                    <FaCode className="text-green-500" /> Recorded Script
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700 dark:bg-green-900 dark:text-green-300">
                      Ready
                    </span>
                  </h2>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={copyScript}
                      className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                        copied
                          ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                      }`}
                    >
                      {copied ? (
                        <>
                          <FaCheck className="h-3 w-3" /> Copied!
                        </>
                      ) : (
                        <>
                          <FaCopy className="h-3 w-3" /> Copy Script
                        </>
                      )}
                    </button>

                    <button
                      onClick={openEditor}
                      className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                    >
                      <FaCode className="h-3 w-3" /> Open in Editor
                    </button>
                  </div>
                </div>

                <textarea
                  ref={scriptBodyRef}
                  value={recordedScript}
                  onChange={(e) => setRecordedScript(e.target.value)}
                  spellCheck={false}
                  className="min-h-0 flex-1 resize-none overflow-y-auto bg-white p-5 font-mono text-xs text-gray-900 outline-none dark:bg-gray-900 dark:text-gray-100"
                />
              </div>
            )}

            {/* Live Actions during recording */}

            <div
              ref={liveCardRef}
              className="flex min-h-[320px] max-h-[70vh] min-w-0 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900 xl:min-h-0 xl:max-h-none"
            >
              <div className="mb-3 flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
                  <FaCode className="text-blue-500" /> Live Actions
                </h3>

                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                  {actions.length}
                </span>
              </div>

              {actions.length === 0 ? (
                <div
                  ref={liveBodyRef}
                  className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400"
                >
                  {recording
                    ? "Waiting for browser interactions…"
                    : "No recorded actions yet."}
                </div>
              ) : (
                <div
                  ref={(element) => {
                    liveBodyRef.current = element;
                    actionsListRef.current = element;
                  }}
                  className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1"
                >
                  {actions.map((action, index) => (
                    <div
                      key={`${index}-${action.action}`}
                      className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs dark:border-gray-700 dark:bg-gray-800"
                    >
                      <div className="mb-1 flex items-center justify-between">
                        <span className="font-mono font-semibold text-blue-600 dark:text-blue-300">
                          {index + 1}. {action.action}
                        </span>

                        {action.value && (
                          <span className="max-w-[160px] truncate text-green-600 dark:text-green-400">
                            {action.value}
                          </span>
                        )}
                      </div>

                      <div className="break-all font-mono text-gray-500 dark:text-gray-400">
                        {action.url || formatSelector(action.selector) || "—"}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: Save to Test Case */}

          <div
            ref={saveCardRef}
            className="flex min-h-[320px] max-h-[70vh] min-w-0 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900 xl:h-full xl:min-h-0 xl:max-h-none"
          >
            <h3 className="mb-1 text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <FaSave className="text-blue-500" /> Save to Test Case
            </h3>

            <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">
              {recordedScript
                ? "Select a test case to save the recorded script to it. Copy the script first to keep it safe."
                : "Stop recording first to save the script to a test case."}
            </p>

            {saveAlert && (
              <div className="mb-3">
                <Alert
                  variant={saveAlert.type}
                  title={saveAlert.type === "success" ? "Success" : "Error"}
                  message={saveAlert.message}
                />
              </div>
            )}

            <div className="mb-3">
              <input
                value={testSearch}
                onChange={(e) => setTestSearch(e.target.value)}
                placeholder="Search test cases…"
                disabled={!recordedScript}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white disabled:opacity-50"
              />
            </div>

            <div
              ref={saveListRef}
              className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1"
            >
              {!recordedScript ? (
                <div className="flex min-h-full items-center justify-center rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-400 dark:border-gray-700">
                  Record something first.
                </div>
              ) : filteredTests.length === 0 ? (
                <div className="flex min-h-full items-center justify-center rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-400 dark:border-gray-700">
                  No test cases found.
                </div>
              ) : (
                filteredTests.map((tc) => (
                  <button
                    key={tc.id}
                    onClick={() => handleTestSelect(String(tc.id))}
                    className={`w-full text-left rounded-lg border px-4 py-3 transition ${
                      selectedTestId === String(tc.id)
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                        : "border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
                    }`}
                  >
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {tc.title}
                    </div>

                    <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                      {tc.project_name || "—"} / {tc.suite_name || "—"}
                    </div>
                  </button>
                ))
              )}
            </div>

            {selectedTestId && recordedScript && (
              <div className="mt-4 flex-shrink-0 border-t border-gray-200 pt-4 dark:border-gray-700">
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => saveToTestCase()}
                    disabled={saving}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                  >
                    <FaSave className="h-3.5 w-3.5" />{" "}
                    {saving ? "Saving…" : "Save Script to Test Case"}
                  </button>

                  <Link
                    to={`/script/editor/${selectedTestId}`}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-gray-100 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                    onClick={() =>
                      localStorage.setItem(
                        "recordedPlaywrightScript",
                        recordedScript || "",
                      )
                    }
                  >
                    <FaCode className="h-3.5 w-3.5" /> Open Editor for This Case
                  </Link>

                  <Link
                    to={`/script/runner/${selectedTestId}`}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-700"
                  >
                    <FaPlay className="h-3.5 w-3.5" /> Run This Test
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

