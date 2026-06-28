// ─── Domain Types ─────────────────────────────────────────────────────────────

export interface TestStep {
  step_number: number;
  action: string;
  expected_result: string;
}

export interface RunStep {
  id?: number;
  step_number: number;
  action: string;
  expected_result?: string;
  status: string;
  duration_ms?: number;
  screenshot_path?: string;
  error_message?: string;
}

export interface TestRun {
  id: number;
  status: string;
  started_at?: string;
  completed_at?: string;
  duration_ms?: number;
  error_message?: string;
  executed_by_name?: string;
  steps?: RunStep[];
}

export interface SprintTestCase {
  id: number;
  title: string;
  priority: string;
  status: string;
  preconditions?: string;
  owning_suite_id: number;
  owning_suite_name?: string;
  linked_by_name?: string;
  linked_at?: string;
  steps: TestStep[];
  runs?: TestRun[];
  latest_run?: TestRun;
}

export interface BoardSuite {
  sprint_suite_id: number;
  suite_id: number;
  suite_name: string;
  description?: string;
  is_active: boolean;
  project_name?: string;
  board_status: string;
}

export interface SprintAssignee {
  id: number;
  username: string;
}

export interface SprintComment {
  id: number;
  comment: string;
  created_by_name?: string;
  created_at: string;
  user_id?: number;
}

export interface AvailableUser {
  id: number;
  username: string;
}

export interface BatchStatus {
  id: number;
  total_cases: number;
  completed_cases: number;
  passed_cases: number;
  failed_cases: number;
  status: string;
}

export interface CaseRunStatus {
  test_case_id: number;
  title: string;
  run_status: string | null;
  duration_ms: number | null;
  error_message: string | null;
}

export interface ActivityEvent {
  id: string;
  type: string;
  actor: string;
  title: string;
  detail: string;
  timestamp: string;
  meta?: Record<string, unknown>;
}
