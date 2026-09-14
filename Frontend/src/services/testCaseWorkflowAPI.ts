import API from "./api";

const headers = () => ({
  headers: {
    Authorization: `Bearer ${
      localStorage.getItem("token") || sessionStorage.getItem("token")
    }`,
  },
});


export interface WorkflowRequest {
  id: number;
  test_case_id: number;
  request_type: "CREATE" | "UPDATE";
  request_status:
    | "PENDING"
    | "APPROVED"
    | "REJECTED"
    | "RETURNED"
    | "CANCELLED";
  from_workflow_status: "Draft" | "Review" | "Approved" | null;
  requested_workflow_status: "Approved";
  proposed_suite_id: number;
  proposed_title: string;
  proposed_preconditions?: string | null;
  proposed_priority: "Low" | "Medium" | "High" | "Critical";
  proposed_playwright_script?: string | null;
  proposed_steps: Array<{
    step_number: number;
    action: string;
    expected_result: string;
  }>;
  submitted_by: number;
  submitted_by_name?: string;
  submitted_at: string;
  revision_no: number;
  current_title?: string;
  current_workflow_status?: string;
  proposed_suite_name?: string;
  proposed_project_name?: string;
}

export const testCaseWorkflowAPI = {

  async pending(): Promise<WorkflowRequest[]> {
    const res = await API.get(
      "/api/test-cases/workflow/approvals",
      headers(),
    );
    return res.data.data;
  },

  async request(requestId: number) {
    const res = await API.get(
      `/api/test-cases/workflow/requests/${requestId}`,
      headers(),
    );
    return res.data.data;
  },

  async approve(requestId: number, comment = "") {
    return API.post(
      `/api/test-cases/workflow/requests/${requestId}/approve`,
      { comment },
      headers(),
    );
  },

  async reject(requestId: number, comment: string) {
    return API.post(
      `/api/test-cases/workflow/requests/${requestId}/reject`,
      { comment },
      headers(),
    );
  },

  async returnForChanges(requestId: number, comment: string) {
    return API.post(
      `/api/test-cases/workflow/requests/${requestId}/return`,
      { comment },
      headers(),
    );
  },

  async submitForReview(testCaseId: number) {
    return API.post(
      `/api/test-cases/${testCaseId}/submit-review`,
      {},
      headers(),
    );
  },

  async history(testCaseId: number) {
    const res = await API.get(
      `/api/test-cases/${testCaseId}/workflow-history`,
      headers(),
    );
    return res.data.data;
  },
};
