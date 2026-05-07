export interface User {
  id: number;
  username: string;
  email?: string;
}

export interface Project {
  id: number;
  project_name: string;
}

export interface TestSuite {
  id: number;
  suite_name: string;
  project_id: number;
}

export interface TaskAssignment {
  id: number;
  user_id: number;
  role: "Owner" | "Assignee" | "Watcher";
  username: string;
  email?: string;
}

export interface TaskComment {
  id: number;
  comment: string;
  is_system: boolean;
  created_by: number | null;
  created_by_name: string | null;
  created_at: string;
}

export interface TaskProgress {
  id: number;
  comment: string;
  created_by: number;
  created_by_name: string;
  created_at: string;
}

export interface ETAHistory {
  id: number;
  old_eta: string | null;
  new_eta: string;
  reason: string;
  updated_by_name: string;
  updated_at: string;
}

export interface Task {
  id: number;
  task_code: number;
  title: string;
  description: string;
  status: "Pending" | "In Progress" | "On Hold" | "Completed" | "Cancelled";
  priority: "Low" | "Medium" | "High";
  start_date: string | null;
  due_date: string | null;
  project_id: number | null;
  suite_id: number | null;
  tags: string | null;
  created_by: number;
  created_by_name?: string;
  updated_by_name?: string;
  project_name?: string;
  suite_name?: string;
  assignees?: string;
  comment_count?: number;
  assignments?: TaskAssignment[];
  comments?: TaskComment[];
  progress?: TaskProgress[];
  eta_history?: ETAHistory[];
  created_at?: string;
  updated_at?: string;
}

// Used by the Create/Edit modal form
export interface TaskFormData {
  title: string;
  description: string;
  priority: Task["priority"];
  start_date: string;
  due_date: string;
  project_id: string;
  suite_id: string;
  tags: string;
}

export interface AlertState {
  type: "success" | "error";
  message: string;
}