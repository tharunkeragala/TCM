export interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface ManualTestStep {
  id?: number;
  step_number: number;
  action: string;
  expected_result?: string;
}

export interface TestCase {
  id: number;
  suite_id: number;
  title: string;
  preconditions?: string;
  priority: "Low" | "Medium" | "High" | "Critical";
  status: "Draft" | "Ready" | "Deprecated";
  suite_name?: string;
  project_name?: string;
  created_by_name?: string;
  updated_by_name?: string;
  created_at?: string;
  updated_at?: string;
  playwright_script?: string;
  steps?: ManualTestStep[];
}

export interface ParsedStep {
  action: string;
  selector?: string | Record<string, unknown> | null;
  value?: string | null;
  raw?: string;
  status?: "pending" | "running" | "passed" | "failed" | "aborted";
  error?: string;
  error_message?: string;
  screenshotPath?: string;
  screenshot_path?: string;
  duration_ms?: number;
  stepNum?: number;
  step_number?: number;
  stepId?: number;
  id?: number;
}

export interface PlaywrightRun {
  id: number;
  test_case_id: number;
  test_case_title?: string;
  status: "pending" | "running" | "passed" | "failed" | "aborted";
  started_at?: string;
  completed_at?: string;
  duration_ms?: number;
  error_message?: string;
  created_at?: string;
  created_by_name?: string;
}

export interface PlaywrightRunStep {
  id: number;
  run_id: number;
  step_number: number;
  action: string;
  selector?: string;
  value?: string;
  status: "pending" | "running" | "passed" | "failed" | "aborted";
  duration_ms?: number;
  screenshot_path?: string;
  error_message?: string;
  created_at?: string;
}

export interface RecorderAction {
  action: string;
  selector?: string | Record<string, unknown> | null;
  value?: string;
  url?: string;
}
