/**
 * APITestingBuilder.tsx
 * Place at: same feature folder as PlaywrightEditor.tsx, under a `components/` subfolder
 *   e.g. .../Playwright/components/APITestingBuilder.tsx
 */
import React, { useState } from "react";
import { FaPlus, FaPlay, FaSave } from "react-icons/fa";
import API from "../services/api";
import { authHeaders } from "../pages/TestManagement/Playwright/helpers";

interface Endpoint {
  id: string;
  savedId?: number;
  name: string;
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  url: string;
}

interface Props {
  testCaseId: number | string;
}

export default function APITestingBuilder({ testCaseId }: Props) {
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [response, setResponse] = useState<any>(null);
  const [message, setMessage] = useState<string | null>(null);

  const current = endpoints.find((e) => e.id === selectedId);

  const addEndpoint = () => {
    const ep: Endpoint = { id: `api-${Date.now()}`, name: "New API", method: "GET", url: "" };
    setEndpoints([...endpoints, ep]);
    setSelectedId(ep.id);
  };

  const patchCurrent = (patch: Partial<Endpoint>) => {
    if (!current) return;
    setEndpoints(endpoints.map((e) => (e.id === current.id ? { ...e, ...patch } : e)));
  };

  const saveEndpoint = async () => {
    if (!current) return;
    try {
      const res = await API.post(
        "/api/advanced/api-testing/endpoints",
        { testCaseId, name: current.name, method: current.method, url: current.url },
        { headers: authHeaders() }
      );
      if (res.data.success) {
        patchCurrent({ savedId: res.data.data.endpointId });
        setMessage("Endpoint saved.");
      }
    } catch (err: any) {
      setMessage(err.response?.data?.error || "Save failed.");
    }
  };

  const testEndpoint = async () => {
    if (!current?.savedId) {
      setMessage("Save the endpoint before testing it.");
      return;
    }
    try {
      const res = await API.post(
        "/api/advanced/api-testing/execute",
        { apiEndpointId: current.savedId, variables: {} },
        { headers: authHeaders() }
      );
      setResponse(res.data.data);
    } catch (err: any) {
      setMessage(err.response?.data?.error || "Request failed.");
    }
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">API Testing</h3>

      {message && <div className="mb-4 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">{message}</div>}

      <div className="grid gap-6 lg:grid-cols-3">
        <div>
          <h4 className="mb-2 text-sm font-medium text-gray-900 dark:text-white">Endpoints</h4>
          <div className="mb-3 space-y-2">
            {endpoints.map((ep) => (
              <button
                key={ep.id}
                onClick={() => setSelectedId(ep.id)}
                className={`w-full rounded-lg px-3 py-2 text-left text-sm ${selectedId === ep.id ? "bg-blue-100 text-blue-900 dark:bg-blue-900/40 dark:text-blue-200" : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300"}`}
              >
                <div className="font-medium">{ep.name}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">{ep.method}</div>
              </button>
            ))}
          </div>
          <button onClick={addEndpoint} className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-sm text-white hover:bg-green-700">
            <FaPlus /> Add Endpoint
          </button>
        </div>

        {current && (
          <div>
            <h4 className="mb-2 text-sm font-medium text-gray-900 dark:text-white">Configuration</h4>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Name</label>
                <input value={current.name} onChange={(e) => patchCurrent({ name: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Method</label>
                <select value={current.method} onChange={(e) => patchCurrent({ method: e.target.value as Endpoint["method"] })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white">
                  <option>GET</option>
                  <option>POST</option>
                  <option>PUT</option>
                  <option>DELETE</option>
                  <option>PATCH</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">URL</label>
                <input value={current.url} onChange={(e) => patchCurrent({ url: e.target.value })} placeholder="https://api.example.com/{{resource}}" className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-xs dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
              </div>

              <div className="flex gap-2">
                <button onClick={saveEndpoint} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-gray-800 px-3 py-2 text-sm text-white hover:bg-gray-900 dark:bg-gray-700">
                  <FaSave /> Save
                </button>
                <button onClick={testEndpoint} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700">
                  <FaPlay /> Test
                </button>
              </div>
            </div>
          </div>
        )}

        {response && (
          <div>
            <h4 className="mb-2 text-sm font-medium text-gray-900 dark:text-white">Response</h4>
            <div className="space-y-2 text-sm">
              <div>
                <span className="font-medium text-gray-700 dark:text-gray-300">Status:</span>{" "}
                <span className={`rounded px-2 py-0.5 text-xs ${response.statusCode >= 200 && response.statusCode < 300 ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                  {response.statusCode}
                </span>
              </div>
              <div>
                <span className="font-medium text-gray-700 dark:text-gray-300">Duration:</span> {response.duration_ms}ms
              </div>
              <pre className="max-h-56 overflow-auto rounded-lg bg-gray-50 p-2 text-xs dark:bg-gray-800">
                {JSON.stringify(response.body, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
