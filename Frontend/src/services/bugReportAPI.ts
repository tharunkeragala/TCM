// Bug Report API Service
import API from "./api";

export interface BugReport {
  id: number;
  report_id: string;
  project_id: number;
  project_function_id: number;
  sprint_id?: number;
  title: string;
  description: string;
  severity: "Critical" | "High" | "Medium" | "Low";
  status: "Open" | "In Progress" | "Reopened" | "Resolved" | "Closed";
  priority: number;
  reported_by: number;
  reported_by_name?: string;
  assigned_to?: number;
  assigned_to_name?: string;
  assigned_date?: string;
  first_reported_date: string;
  target_resolution_date?: string;
  actual_resolution_date?: string;
  environment?: string;
  affected_version?: string;
  current_cycle_status?: string;
  created_at: string;
  updated_at: string;
  project_name?: string;
  sprint_name?: string;
  function_name?: string;
  screenshot_count?: number;
  history_count?: number;
}

export interface BugScreenshot {
  id: number;
  bug_report_id: number;
  screenshot_path: string;
  screenshot_name: string;
  description?: string;
  screenshot_order: number;
  created_at: string;
  created_by: number;
}

export interface BugHistory {
  id: number;
  bug_report_id: number;
  sprint_id: number;
  cycle_number: number;
  status: "Pass" | "Fail" | "Blocked" | "No Test" | "Reopened";
  status_reason?: string;
  tested_by?: number;
  tested_by_name?: string;
  test_date: string;
  notes?: string;
  created_at: string;
  sprint_name?: string;
  cycle_count?: number;
}

export interface BugReportSummary {
  id: number;
  bug_report_id: number;
  sprint_id: number;
  sprint_name?: string;
  pass_count: number;
  fail_count: number;
  blocked_count: number;
  no_test_count: number;
  latest_status?: BugHistory["status"];
  latest_status_date?: string;
}

export interface BugComment {
  id: number;
  bug_report_id: number;
  comment: string;
  commented_by: number;
  commented_by_name?: string;
  is_system: boolean;
  created_at: string;
}

export interface LinkedTestCase {
  link_id: number;
  bug_report_id: number;
  test_case_id: number;
  linked_at: string;
  linked_by?: number;
  linked_by_name?: string;
  title: string;
  priority?: string;
  status?: string;
  preconditions?: string | null;
  suite_id?: number | null;
  suite_name?: string | null;
  project_id?: number | null;
  project_name?: string | null;
  step_count?: number;
}

export interface TestCaseListItem {
  id: number;
  title: string;
  suite_id?: number | null;
  suite_name?: string | null;
  project_name?: string | null;
  priority?: string;
  status?: string;
  preconditions?: string | null;
}

export interface TestCaseStep {
  id: number;
  test_case_id: number;
  step_number: number;
  action: string;
  expected_result?: string | null;
}

export interface TestCaseDetails extends TestCaseListItem {
  playwright_script?: string | null;
  created_by_name?: string | null;
  updated_by_name?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  steps: TestCaseStep[];
}

export interface ProjectFunction {
  id: number;
  project_id: number;
  function_name: string;
  description?: string;
  function_category?: string;
  created_by?: number;
  created_by_name?: string;
  updated_by?: number;
  updated_at?: string;
  created_at: string;
  is_archived: boolean;
  bug_count?: number;
}

export interface BugStatistics {
  total_bugs: number;
  open_bugs: number;
  in_progress_bugs: number;
  resolved_bugs: number;
  closed_bugs: number;
  critical_bugs: number;
  high_bugs: number;
  medium_bugs: number;
  low_bugs: number;
}

export const bugReportAPI = {
  async createBugReport(formData: FormData) {
    const response = await API.post("/api/bug-reports", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
  },

  async getBugReports(filters?: {
    project_id?: number;
    sprint_id?: number;
    status?: string;
    severity?: string;
    assigned_to?: number;
    limit?: number;
    offset?: number;
  }) {
    const response = await API.get("/api/bug-reports", { params: filters });
    return response.data;
  },

  async getBugReportById(id: number) {
    const response = await API.get(`/api/bug-reports/${id}`);
    return response.data;
  },

  async updateBugReport(
    id: number,
    data: Partial<{
      title: string;
      description: string;
      severity: string;
      priority: number;
      status: string;
      assigned_to: number | null;
      target_resolution_date: string;
      environment: string;
      affected_version: string;
    }>,
  ) {
    const response = await API.put(`/api/bug-reports/${id}`, data);
    return response.data;
  },

  async deleteBugReport(id: number) {
    const response = await API.delete(`/api/bug-reports/${id}`);
    return response.data;
  },

  async recordBugIteration(
    id: number,
    data: {
      sprint_id: number;
      status: string;
      status_reason?: string;
      notes?: string;
    },
  ) {
    const response = await API.post(`/api/bug-reports/${id}/iterations`, data);
    return response.data;
  },

  async getBugHistory(id: number) {
    const response = await API.get(`/api/bug-reports/${id}/history`);
    return response.data;
  },

  async addBugComment(id: number, comment: string) {
    const response = await API.post(`/api/bug-reports/${id}/comments`, {
      comment,
    });
    return response.data;
  },

  async uploadScreenshots(id: number, formData: FormData) {
    const response = await API.post(`/api/bug-reports/${id}/screenshots`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
  },

  async linkTestCase(id: number, testCaseId: number) {
    const response = await API.post(`/api/bug-reports/${id}/test-cases`, {
      test_case_id: testCaseId,
    });
    return response.data;
  },

  async unlinkTestCase(id: number, testCaseId: number) {
    const response = await API.delete(
      `/api/bug-reports/${id}/test-cases/${testCaseId}`,
    );
    return response.data;
  },

  async getAvailableTestCases() {
    const response = await API.get("/api/test-cases");
    return response.data;
  },

  async getTestCaseById(testCaseId: number) {
    const response = await API.get(`/api/test-cases/${testCaseId}`);
    return response.data;
  },

  async getBugStatistics(filters?: {
    project_id?: number;
    sprint_id?: number;
  }) {
    const response = await API.get("/api/bug-reports/reports/statistics", {
      params: filters,
    });
    return response.data;
  },
};

export const projectFunctionsAPI = {
  async addFunctionToProject(data: {
    project_id: number;
    function_name: string;
    description?: string;
    function_category?: string;
  }) {
    const response = await API.post("/api/project-functions", data);
    return response.data;
  },

  async getProjectFunctions(projectId: number, includeArchived = false) {
    const response = await API.get(`/api/project-functions/project/${projectId}`, {
      params: { include_archived: includeArchived },
    });
    return response.data;
  },

  async getAllFunctions(filters?: {
    category?: string;
    limit?: number;
    offset?: number;
  }) {
    const response = await API.get("/api/project-functions", { params: filters });
    return response.data;
  },

  async updateFunction(
    id: number,
    data: Partial<{
      function_name: string;
      description: string;
      function_category: string;
    }>,
  ) {
    const response = await API.put(`/api/project-functions/${id}`, data);
    return response.data;
  },

  async deleteFunction(id: number) {
    const response = await API.delete(`/api/project-functions/${id}`);
    return response.data;
  },
};
