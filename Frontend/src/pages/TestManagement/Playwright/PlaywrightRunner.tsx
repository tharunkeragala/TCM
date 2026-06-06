import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { FaPlay, FaStop, FaEye, FaCode, FaSearch, FaVideo } from "react-icons/fa";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import PageMeta from "../../../components/common/PageMeta";
import Alert from "../../../components/ui/alert/Alert";
import API from "../../../services/api";
import { authHeaders, formatSelector, getWsUrl, statusClass } from "./helpers";
import type { ParsedStep, PlaywrightRun, TestCase } from "./types";

export default function PlaywrightRunner() {
  const { testCaseId } = useParams();
  const navigate = useNavigate();

  const [tests, setTests] = useState<TestCase[]>([]);
  const [selectedId, setSelectedId] = useState<string>(testCaseId || "");
  const [selectedCase, setSelectedCase] = useState<TestCase | null>(null);
  const [history, setHistory] = useState<PlaywrightRun[]>([]);
  const [currentRun, setCurrentRun] = useState<PlaywrightRun | null>(null);
  const [liveSteps, setLiveSteps] = useState<ParsedStep[]>([]);
  const [liveFrame, setLiveFrame] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [filter, setFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [alert, setAlert] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const currentRunId = useRef<number | null>(null);
  const stepsEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    API.get("/api/test-cases", { headers: authHeaders() })
      .then((res) => {
        const data: TestCase[] = res.data.data || [];
        setTests(data);
        if (testCaseId) {
          const found = data.find((t) => String(t.id) === String(testCaseId));
          if (found) setSelectedCase(found);
        }
      })
      .catch(() => setTests([]));
  }, [testCaseId]);

  useEffect(() => {
    if (!selectedId) return;
    API.get(`/api/test-cases/${selectedId}`, { headers: authHeaders() })
      .then((res) => res.data.success && setSelectedCase(res.data.data))
      .catch(() => undefined);
    API.get(`/api/playwright/test-cases/${selectedId}/runs`, { headers: authHeaders() })
      .then((res) => setHistory(res.data.data || []))
      .catch(() => setHistory([]));
  }, [selectedId]);

  useEffect(() => {
    const ws = new WebSocket(getWsUrl());
    ws.onmessage = (event) => {
      let msg: any;
      try { msg = JSON.parse(event.data); } catch { return; }
      if (msg.runId && currentRunId.current && Number(msg.runId) !== currentRunId.current) return;

      switch (msg.type) {
        case "run_started":
          currentRunId.current = Number(msg.runId);
          setRunning(true); setStopping(false); setLiveFrame(null); setLiveSteps([]);
          setCurrentRun({ id: Number(msg.runId), test_case_id: Number(msg.testCaseId), status: "running" });
          break;
        case "live_frame":
          if (msg.frame) setLiveFrame(`data:image/jpeg;base64,${msg.frame}`);
          break;
        case "step_started":
          setLiveSteps((prev) => [...prev, { ...(msg.step || {}), id: msg.stepId, stepId: msg.stepId, stepNum: msg.stepNum, status: "running" }]);
          break;
        case "step_completed":
        case "step_failed":
          setLiveSteps((prev) => prev.map((s) =>
            s.stepId === msg.stepId || s.id === msg.stepId || s.stepNum === msg.stepNum
              ? { ...s, status: msg.status, error: msg.error, screenshotPath: msg.screenshotPath, duration_ms: msg.duration_ms }
              : s
          ));
          break;
        case "run_completed":
          setRunning(false); setStopping(false);
          setCurrentRun((prev) => prev ? { ...prev, status: msg.status, duration_ms: msg.duration } : null);
          if (selectedId) {
            API.get(`/api/playwright/test-cases/${selectedId}/runs`, { headers: authHeaders() })
              .then((res) => setHistory(res.data.data || [])).catch(console.error);
          }
          break;
      }
    };
    return () => { if (ws.readyState === WebSocket.OPEN) ws.close(); };
  }, []);

  useEffect(() => { stepsEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [liveSteps]);

  const filteredTests = useMemo(() => {
    const q = filter.toLowerCase();
    return tests.filter((t) => {
      const matchText = `${t.title} ${t.project_name || ""} ${t.suite_name || ""}`.toLowerCase().includes(q);
      const matchPriority = !priorityFilter || t.priority === priorityFilter;
      const matchStatus = !statusFilter || t.status === statusFilter;
      return matchText && matchPriority && matchStatus;
    });
  }, [tests, filter, priorityFilter, statusFilter]);

  const runTest = async () => {
    if (!selectedCase) return;
    if (!selectedCase.playwright_script?.trim()) {
      setAlert({ type: "error", message: "No Playwright script found. Open the script editor to add one." });
      return;
    }
    setAlert(null); setRunning(true); setStopping(false); setLiveSteps([]); setLiveFrame(null); setCurrentRun(null);
    currentRunId.current = null;
    try {
      const res = await API.post(`/api/playwright/test-cases/${selectedCase.id}/run`, {}, { headers: authHeaders() });
      if (res.data.runId) currentRunId.current = Number(res.data.runId);
    } catch (err: any) {
      setRunning(false);
      setAlert({ type: "error", message: err?.response?.data?.message || err?.message || "Failed to start run." });
    }
  };

  const stopTest = async () => {
    if (!currentRunId.current || stopping) return;
    setStopping(true);
    try {
      await API.post(`/api/playwright/runs/${currentRunId.current}/cancel`, {}, { headers: authHeaders() });
    } catch (err: any) {
      setAlert({ type: "error", message: err.response?.data?.message || "Failed to cancel run." });
      setStopping(false);
    }
  };

  const passed = liveSteps.filter((s) => s.status === "passed").length;
  const failed = liveSteps.filter((s) => s.status === "failed").length;

  return (
    <div>
      <PageMeta title="Playwright Runner" description="Run automated Playwright tests" />
      <PageBreadcrumb pageTitle="Playwright Runner" />

      <div className="mt-4 space-y-4">
        {alert && <Alert variant={alert.type} title={alert.type === "success" ? "Success" : "Error"} message={alert.message} />}

        {/* Action bar */}
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <div className="text-sm font-semibold text-gray-900 dark:text-white">
                {selectedCase ? selectedCase.title : "Select a test case"}
              </div>
              {selectedCase && (
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {selectedCase.project_name || "—"} / {selectedCase.suite_name || "—"}
                  {!selectedCase.playwright_script && <span className="ml-2 text-amber-500">⚠ No script</span>}
                </div>
              )}
            </div>

            <div className="ml-auto flex flex-wrap gap-2">
              <Link to="/playwright/recorder" className="inline-flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700">
                <FaVideo className="h-3.5 w-3.5" /> Record
              </Link>
              {selectedCase && (
                <Link to={`/playwright/editor/${selectedCase.id}`} className="inline-flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700">
                  <FaCode className="h-3.5 w-3.5" /> Edit Script
                </Link>
              )}
              {selectedCase && !running && (
                <button
                  onClick={runTest}
                  disabled={!selectedCase.playwright_script?.trim()}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  <FaPlay className="h-3.5 w-3.5" /> Run Test
                </button>
              )}
              {running && (
                <button onClick={stopTest} disabled={stopping} className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60">
                  <FaStop className="h-3.5 w-3.5" /> {stopping ? "Stopping…" : "Stop"}
                </button>
              )}
              {currentRun && currentRun.status !== "running" && (
                <Link to={`/playwright/preview/${currentRun.id}`} className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700">
                  <FaEye className="h-3.5 w-3.5" /> View Report
                </Link>
              )}
            </div>
          </div>
        </div>

        <div className="grid min-h-[680px] gap-4 lg:grid-cols-[300px_1fr_280px]">
          {/* Test list */}
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900 flex flex-col">
            <div className="border-b border-gray-200 p-3 space-y-2 dark:border-gray-700">
              <div className="relative">
                <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                <input
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder="Search tests…"
                  className="w-full rounded-lg border border-gray-300 bg-white pl-8 pr-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                />
              </div>
              <div className="flex gap-2">
                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  className="flex-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
                >
                  <option value="">All Priority</option>
                  {["Low", "Medium", "High", "Critical"].map((p) => <option key={p}>{p}</option>)}
                </select>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="flex-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
                >
                  <option value="">All Status</option>
                  {["Draft", "Ready", "Deprecated"].map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div className="text-xs text-gray-400 dark:text-gray-500">{filteredTests.length} of {tests.length} tests</div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {filteredTests.length === 0 ? (
                <div className="p-6 text-center text-sm text-gray-500 dark:text-gray-400">No tests match filters.</div>
              ) : (
                filteredTests.map((test) => (
                  <button
                    key={test.id}
                    onClick={() => {
                      if (running) return;
                      setSelectedId(String(test.id));
                      setSelectedCase(test);
                      navigate(`/playwright/runner/${test.id}`);
                    }}
                    className={`block w-full border-l-4 px-4 py-3 text-left transition ${
                      selectedCase?.id === test.id
                        ? "border-blue-600 bg-blue-50 dark:bg-blue-900/20"
                        : "border-transparent hover:bg-gray-50 dark:hover:bg-gray-800/60"
                    } ${running && selectedCase?.id !== test.id ? "opacity-40 cursor-not-allowed" : ""}`}
                  >
                    <div className="text-sm font-medium text-gray-900 dark:text-white truncate">{test.title}</div>
                    <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400 truncate">{test.project_name || "—"} / {test.suite_name || "—"}</div>
                    {!test.playwright_script && <div className="mt-1 text-xs text-amber-500">No script</div>}
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Live browser + steps */}
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Live Browser</h2>
              {running && <span className="flex items-center gap-1.5 text-xs font-semibold text-red-500"><span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" /> LIVE</span>}
            </div>
            <div className="flex h-[340px] items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-gray-950 dark:border-gray-700">
              {liveFrame ? (
                <img src={liveFrame} alt="live browser" className="h-full w-full object-contain" />
              ) : (
                <span className="text-sm text-gray-500">{running ? "Waiting for stream…" : "No active run"}</span>
              )}
            </div>

            <div className="mt-4 grid grid-cols-4 gap-3">
              <div className="rounded-xl bg-gray-50 p-3 text-center dark:bg-gray-800">
                <div className="text-lg font-bold text-gray-900 dark:text-white">{liveSteps.length}</div>
                <div className="text-xs text-gray-500">Total</div>
              </div>
              <div className="rounded-xl bg-green-50 p-3 text-center dark:bg-green-900/20">
                <div className="text-lg font-bold text-green-600">{passed}</div>
                <div className="text-xs text-gray-500">Passed</div>
              </div>
              <div className="rounded-xl bg-red-50 p-3 text-center dark:bg-red-900/20">
                <div className="text-lg font-bold text-red-600">{failed}</div>
                <div className="text-xs text-gray-500">Failed</div>
              </div>
              <div className="rounded-xl bg-blue-50 p-3 text-center dark:bg-blue-900/20">
                <div className="text-lg font-bold text-blue-600">
                  {liveSteps.filter(s => s.status === "running").length}
                </div>
                <div className="text-xs text-gray-500">Running</div>
              </div>
            </div>

            {/* Live step log */}
            <div className="mt-4">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Step Log</h3>
              <div className="max-h-[200px] space-y-1.5 overflow-y-auto pr-1">
                {liveSteps.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-gray-300 p-5 text-center text-sm text-gray-500 dark:border-gray-700">Run a test to see live steps.</div>
                ) : (
                  liveSteps.map((step, index) => (
                    <div key={`${index}-${step.stepId || step.id}`} className="rounded-lg border border-gray-200 bg-gray-50 p-2.5 dark:border-gray-700 dark:bg-gray-800">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex items-center gap-2">
                          {step.status === "running" && <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse flex-shrink-0" />}
                          <span className="font-mono text-xs font-semibold text-gray-900 dark:text-white truncate">{index + 1}. {step.action}</span>
                        </div>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold flex-shrink-0 ${statusClass[step.status || "pending"]}`}>{step.status || "pending"}</span>
                      </div>
                      <div className="mt-0.5 truncate font-mono text-xs text-gray-500 dark:text-gray-400">{formatSelector(step.selector) || step.raw || "—"}</div>
                      {(step.error || step.error_message) && <div className="mt-1 text-xs text-red-600">{step.error || step.error_message}</div>}
                    </div>
                  ))
                )}
                <div ref={stepsEndRef} />
              </div>
            </div>
          </div>

          {/* Run history */}
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">
              Run History
              {history.length > 0 && <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-300">{history.length}</span>}
            </h3>
            <div className="max-h-[600px] space-y-2 overflow-y-auto pr-1">
              {history.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500 dark:border-gray-700">
                  {selectedCase ? "No runs yet for this test." : "Select a test case."}
                </div>
              ) : (
                history.map((run) => (
                  <Link
                    key={run.id}
                    to={`/playwright/preview/${run.id}`}
                    className="block rounded-lg border border-gray-200 p-3 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800 transition"
                  >
                    <div className="flex items-center justify-between">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusClass[run.status]}`}>{run.status}</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">#{run.id}</span>
                    </div>
                    <div className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">{run.created_at ? new Date(run.created_at).toLocaleString() : "—"}</div>
                    {run.duration_ms != null && <div className="text-xs text-gray-400">{run.duration_ms}ms</div>}
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}