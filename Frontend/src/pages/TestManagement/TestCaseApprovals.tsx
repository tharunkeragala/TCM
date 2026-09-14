import { useEffect, useMemo, useState } from "react";
import { FaCheck, FaSearch, FaTimes, FaUndo } from "react-icons/fa";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import Alert from "../../components/ui/alert/Alert";
import { usePermissions } from "../../hooks/usePermissions";
import WorkflowStatusBadge from "../../components/workflow/WorkflowStatusBadge";
import {
  testCaseWorkflowAPI,
  WorkflowRequest,
} from "../../services/testCaseWorkflowAPI";

type Decision = "approve" | "reject" | "return";

export default function TestCaseApprovals() {
  const { can } = usePermissions();
  const canManageApprovals = can("/test-case-approvals", "can_edit");
  const [items, setItems] = useState<WorkflowRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<any | null>(null);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [comment, setComment] = useState("");
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setMessage(null);
      setItems(await testCaseWorkflowAPI.pending());
    } catch (err: any) {
      setMessage({
        type: "error",
        text:
          err.response?.data?.message ||
          "Failed to load pending test case approvals.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (decision) {
        setDecision(null);
        setComment("");
      } else {
        setSelected(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [decision]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;

    return items.filter((item) =>
      [
        item.proposed_title,
        item.current_title,
        item.proposed_project_name,
        item.proposed_suite_name,
        item.submitted_by_name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [items, search]);

  const open = async (item: WorkflowRequest) => {
    try {
      setSelected(await testCaseWorkflowAPI.request(item.id));
      setMessage(null);
    } catch (err: any) {
      setMessage({
        type: "error",
        text: err.response?.data?.message || "Failed to load the request.",
      });
    }
  };

  const submitDecision = async () => {
    if (!selected || !decision) return;

    if (decision !== "approve" && !comment.trim()) {
      setMessage({
        type: "error",
        text:
          decision === "reject"
            ? "A rejection reason is required."
            : "A return reason is required.",
      });
      return;
    }

    try {
      setProcessing(true);
      setMessage(null);

      if (decision === "approve") {
        await testCaseWorkflowAPI.approve(selected.id, comment);
      } else if (decision === "reject") {
        await testCaseWorkflowAPI.reject(selected.id, comment);
      } else {
        await testCaseWorkflowAPI.returnForChanges(selected.id, comment);
      }

      setSelected(null);
      setDecision(null);
      setComment("");
      setMessage({
        type: "success",
        text:
          decision === "approve"
            ? "Changes approved and applied to the live test case."
            : decision === "reject"
              ? "Change request rejected. Live data was not changed."
              : "Change request returned to Draft for correction.",
      });
      await load();
    } catch (err: any) {
      setMessage({
        type: "error",
        text: err.response?.data?.message || "Workflow action failed.",
      });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div>
      <PageMeta
        title="Test Case Approvals"
        description="Review test case changes"
      />
      <PageBreadcrumb pageTitle="Test Case Approvals" />

      <div className="mt-4 space-y-4">
        {message && (
          <Alert
            variant={message.type}
            title={message.type === "success" ? "Success" : "Error"}
            message={message.text}
          />
        )}

        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <FaSearch className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search pending approvals..."
                className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              />
            </div>
            <span className="text-sm text-gray-500">
              {items.length} pending
            </span>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
          {loading ? (
            <div className="p-6 text-sm text-gray-500">Loading approvals...</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-sm text-gray-500">
              No pending approvals.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800">
                  <tr>
                    {[
                      "Request",
                      "Test Case",
                      "Project / Suite",
                      "Requested By",
                      "Submitted",
                      "Action",
                    ].map((h) => (
                      <th
                        key={h}
                        className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 ${
                          h === "Action" ? "text-right" : "text-left"
                        }`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {filtered.map((item) => (
                    <tr
                      key={item.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-800/50"
                    >
                      <td className="px-4 py-3">
                        <div className="font-mono text-xs text-gray-500">
                          #{item.id}
                        </div>
                        <div className="mt-1">
                          <WorkflowStatusBadge status="Review" />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900 dark:text-white">
                          {item.proposed_title}
                        </div>
                        <div className="text-xs text-gray-500">
                          TC #{item.test_case_id} · revision {item.revision_no}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs font-medium text-gray-700 dark:text-gray-300">
                          {item.proposed_project_name || "—"}
                        </div>
                        <div className="text-xs text-gray-500">
                          {item.proposed_suite_name || "—"}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-300">
                        {item.submitted_by_name || "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {new Date(item.submitted_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => open(item)}
                          className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                        >
                          Review
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-900">
            <div className="mb-5 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Review Request #{selected.id}
                  </h2>
                  <WorkflowStatusBadge status="Review" />
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Test Case #{selected.test_case_id} · requested by{" "}
                  {selected.submitted_by_name || "Unknown"}
                </p>
              </div>

              <button
                onClick={() => setSelected(null)}
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <FaTimes />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Snapshot
                title="Current Live Version"
                data={{
                  title: selected.current_title,
                  priority: selected.current_priority,
                  preconditions: selected.current_preconditions,
                  script: selected.current_playwright_script,
                  steps: selected.current_steps,
                }}
              />
              <Snapshot
                title="Proposed Version"
                proposed
                data={{
                  title: selected.proposed_title,
                  priority: selected.proposed_priority,
                  preconditions: selected.proposed_preconditions,
                  script: selected.proposed_playwright_script,
                  steps: selected.proposed_steps,
                }}
              />
            </div>

            {canManageApprovals && (
              <div className="mt-6 flex flex-wrap justify-end gap-2">
                <button
                  onClick={() => setDecision("return")}
                  className="inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300"
                >
                  <FaUndo className="h-3.5 w-3.5" />
                  Return
                </button>
                <button
                  onClick={() => setDecision("reject")}
                  className="inline-flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300"
                >
                  <FaTimes className="h-3.5 w-3.5" />
                  Reject
                </button>
                <button
                  onClick={() => setDecision("approve")}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                >
                  <FaCheck className="h-3.5 w-3.5" />
                  Approve
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {selected && decision && (
        <div className="fixed inset-0 z-[1000000] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-900">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {decision === "approve"
                ? "Approve Changes"
                : decision === "reject"
                  ? "Reject Changes"
                  : "Return for Correction"}
            </h3>

            <p className="mt-1 text-sm text-gray-500">
              {decision === "approve"
                ? "Approval will atomically replace the live test case with the proposed version."
                : decision === "reject"
                  ? "The proposal will be closed without changing live data."
                  : "The requester can correct the proposal and resubmit it."}
            </p>

            <textarea
              rows={4}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={
                decision === "approve"
                  ? "Optional approval comment"
                  : "Reason is required"
              }
              className="mt-4 w-full resize-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            />

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => {
                  setDecision(null);
                  setComment("");
                }}
                disabled={processing}
                className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={submitDecision}
                disabled={processing}
                className={`rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-60 ${
                  decision === "approve"
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : decision === "reject"
                      ? "bg-red-600 hover:bg-red-700"
                      : "bg-amber-600 hover:bg-amber-700"
                }`}
              >
                {processing ? "Processing..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Snapshot({
  title,
  data,
  proposed = false,
}: {
  title: string;
  data: any;
  proposed?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        proposed
          ? "border-blue-200 bg-blue-50/40 dark:border-blue-900 dark:bg-blue-900/10"
          : "border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/40"
      }`}
    >
      <h3 className="mb-4 text-sm font-semibold text-gray-900 dark:text-white">
        {title}
      </h3>

      <Field label="Title" value={data.title} />
      <Field label="Priority" value={data.priority} />
      <Field label="Preconditions" value={data.preconditions || "—"} />

      <div className="mt-4">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
          Steps
        </div>
        <div className="space-y-2">
          {(data.steps || []).map((step: any, i: number) => (
            <div
              key={i}
              className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900"
            >
              <div className="text-xs font-semibold text-gray-500">
                Step {step.step_number}
              </div>
              <div className="mt-1 text-sm text-gray-900 dark:text-white">
                {step.action}
              </div>
              <div className="mt-1 text-xs text-gray-500">
                Expected: {step.expected_result || "—"}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4">
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
          Script
        </div>
        <pre className="max-h-52 overflow-auto whitespace-pre-wrap rounded-lg border border-gray-200 bg-white p-3 text-xs text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
          {data.script || "No script"}
        </pre>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: any }) {
  return (
    <div className="mb-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </div>
      <div className="mt-1 text-sm text-gray-900 dark:text-white">
        {value || "—"}
      </div>
    </div>
  );
}
