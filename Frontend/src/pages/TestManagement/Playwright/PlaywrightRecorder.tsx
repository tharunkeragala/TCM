import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { FaCircle, FaStop, FaVideo, FaCode } from "react-icons/fa";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import PageMeta from "../../../components/common/PageMeta";
import Alert from "../../../components/ui/alert/Alert";
import API from "../../../services/api";
import { authHeaders, formatSelector, getWsUrl } from "./helpers";
import type { RecorderAction } from "./types";

export default function PlaywrightRecorder() {
  const navigate = useNavigate();
  const [url, setUrl] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [actions, setActions] = useState<RecorderAction[]>([]);
  const [alert, setAlert] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const sessionIdRef = useRef<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

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

      if (msg.type !== "record_action" || msg.sessionId !== sessionIdRef.current) return;
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

    ws.onerror = () => setAlert({ type: "error", message: "WebSocket connection failed." });

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [recording, sessionId]);

  const start = async () => {
    if (!url.trim()) {
      setAlert({ type: "error", message: "Enter the URL to record." });
      return;
    }

    setBusy(true);
    setAlert(null);
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
      setAlert({ type: "error", message: err.response?.data?.message || "Failed to start recorder." });
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
        localStorage.setItem("recordedPlaywrightScript", res.data.script || "");
        localStorage.setItem("recordedPlaywrightActions", JSON.stringify(res.data.actions || []));
        setRecording(false);
        setSessionId(null);
        sessionIdRef.current = null;
        wsRef.current?.close();
        navigate("/playwright/editor");
      }
    } catch (err: any) {
      setAlert({ type: "error", message: err.response?.data?.message || "Failed to stop recorder." });
      setRecording(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageMeta title="Playwright Recorder" description="Record browser actions into Playwright scripts" />
      <PageBreadcrumb pageTitle="Playwright Recorder" />

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_420px]">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300">
              <FaVideo />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Record a browser flow</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Start recording, interact with the opened Chromium window, then save the generated script.</p>
            </div>
          </div>

          {alert && (
            <div className="mb-4">
              <Alert variant={alert.type} title={alert.type === "success" ? "Success" : "Error"} message={alert.message} />
            </div>
          )}

          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Application URL</label>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            disabled={recording || busy}
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          />

          <div className="mt-4 flex flex-wrap items-center gap-3">
            {!recording ? (
              <button
                onClick={start}
                disabled={busy || !url.trim()}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
              >
                <FaCircle className="h-3 w-3" /> Start Recording
              </button>
            ) : (
              <button
                onClick={stop}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-60"
              >
                <FaStop className="h-3 w-3" /> Stop & Save
              </button>
            )}

            {recording && (
              <span className="text-sm font-medium text-red-600 dark:text-red-400">● Recording — interact with the browser window</span>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
              <FaCode className="text-blue-500" /> Live Actions
            </h3>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-300">{actions.length}</span>
          </div>

          {actions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
              {recording ? "Waiting for browser interactions..." : "No recorded actions yet."}
            </div>
          ) : (
            <div className="max-h-[520px] space-y-2 overflow-y-auto pr-1">
              {actions.map((action, index) => (
                <div key={`${index}-${action.action}`} className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs dark:border-gray-700 dark:bg-gray-800">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="font-mono font-semibold text-blue-600 dark:text-blue-300">{index + 1}. {action.action}</span>
                    {action.value && <span className="max-w-[160px] truncate text-green-600 dark:text-green-400">{action.value}</span>}
                  </div>
                  <div className="break-all font-mono text-gray-500 dark:text-gray-400">{action.url || formatSelector(action.selector) || "—"}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
