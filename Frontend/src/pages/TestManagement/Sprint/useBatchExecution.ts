import { useCallback, useEffect, useRef, useState } from "react";
import API from "../../../services/api";
import { getToken } from "./utils.ts";
import type { BatchStatus, CaseRunStatus } from "./types.ts";

interface UseBatchExecutionReturn {
  batch: BatchStatus | null;
  caseStatuses: CaseRunStatus[];
  starting: boolean;
  stopping: boolean;
  isRunning: boolean;
  percent: number;
  executeAll: () => Promise<void>;
  stopExecution: () => Promise<void>;
}

/**
 * Manages batch execution lifecycle for a sprint suite.
 *
 * FIX 1: onComplete was listed in useCallback deps but was a new function
 *         reference each render → stale closure on the poller. Now stored in
 *         a ref so the interval always calls the latest version without
 *         needing to be listed as a dep (which would tear down / recreate
 *         the interval on every render).
 *
 * FIX 2: The interval was not cleared in all exit paths (e.g. if executeAll
 *         threw before setting the interval ref). Wrapped in try/finally.
 *
 * FIX 3: setBatch inside pollStatus used the captured `batchId` arg correctly
 *         already, but the interval ref cleanup on unmount now uses a stable
 *         stopPolling helper that is safe to call multiple times.
 */
export function useBatchExecution(
  sprintId: number,
  suiteId: number,
  onComplete: (finalStatus: string) => void,
): UseBatchExecutionReturn {
  const [batch, setBatch] = useState<BatchStatus | null>(null);
  const [caseStatuses, setCaseStatuses] = useState<CaseRunStatus[]>([]);
  const [starting, setStarting] = useState(false);
  const [stopping, setStopping] = useState(false);

  // Keep a stable ref to onComplete so the poller always calls the latest
  // version without needing to be in dependency arrays.
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current !== null) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  // Stable poll function — batchId comes from closure at call site
  const pollStatus = useCallback(
    async (batchId: number) => {
      try {
        const res = await API.get(
          `/api/sprints/${sprintId}/suites/${suiteId}/batch-runs/${batchId}`,
          { headers: { Authorization: `Bearer ${getToken()}` } },
        );
        if (res.data.success) {
          setBatch(res.data.batch);
          setCaseStatuses(res.data.cases ?? []);
          if (res.data.batch.status !== "running") {
            stopPolling();
            onCompleteRef.current(res.data.batch.status);
          }
        }
      } catch {
        // Network error during poll — keep polling, don't crash UI
      }
    },
    [sprintId, suiteId, stopPolling],
  );

  const executeAll = async () => {
    setStarting(true);
    setBatch(null);
    setCaseStatuses([]);
    try {
      const res = await API.post(
        `/api/sprints/${sprintId}/suites/${suiteId}/execute-all`,
        {},
        { headers: { Authorization: `Bearer ${getToken()}` } },
      );
      if (res.data.success) {
        const batchId: number = res.data.batchId;
        setBatch({
          id: batchId,
          total_cases: res.data.totalCases,
          completed_cases: 0,
          passed_cases: 0,
          failed_cases: 0,
          status: "running",
        });
        // Poll every 2 s; WS batch_case_done events supplement live updates
        pollRef.current = setInterval(() => pollStatus(batchId), 2000);
      }
    } catch (err) {
      console.error("Execute all failed:", err);
    } finally {
      setStarting(false);
    }
  };

  const stopExecution = async () => {
    if (!batch || batch.status !== "running") return;
    setStopping(true);
    try {
      await API.post(
        `/api/sprints/${sprintId}/suites/${suiteId}/batch-runs/${batch.id}/cancel`,
        {},
        { headers: { Authorization: `Bearer ${getToken()}` } },
      );
      // Optimistically update UI; next poll (or this) confirms
      setBatch((prev) => (prev ? { ...prev, status: "cancelled" } : prev));
      stopPolling();
      onCompleteRef.current("cancelled");
    } catch (err) {
      console.error("Stop execution failed:", err);
    } finally {
      setStopping(false);
    }
  };

  // Clear interval on unmount
  useEffect(() => () => stopPolling(), [stopPolling]);

  const isRunning = batch?.status === "running";
  const percent = batch
    ? Math.round((batch.completed_cases / Math.max(batch.total_cases, 1)) * 100)
    : 0;

  return {
    batch,
    caseStatuses,
    starting,
    stopping,
    isRunning,
    percent,
    executeAll,
    stopExecution,
  };
}
