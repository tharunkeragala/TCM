import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { lazy, Suspense } from "react";

import ProtectedRoute from "./components/auth/ProtectedRoute";
import PublicRoute from "./components/auth/PublicRoute";
import ProjectOverview from "./pages/Projects/ProjectOverview";
import AdvancedAutomation from "./pages/TestManagement/Playwright/AdvancedAutomation";
import BugReports from "./pages/BugReports/BugReports";

// Auth pages
const SignIn = lazy(() => import("./pages/AuthPages/SignIn"));
const SignUp = lazy(() => import("./pages/AuthPages/SignUp"));

// Layout
const AppLayout = lazy(() => import("./layout/AppLayout"));

// General pages
const NotFound = lazy(() => import("./pages/OtherPage/NotFound"));
const Unauthorized = lazy(() => import("./pages/Unauthorized"));

// Dashboard pages
const Home = lazy(() => import("./pages/Dashboard/Home"));
const Calendar = lazy(() => import("./pages/Calendar"));
const UserProfiles = lazy(() => import("./pages/UserProfiles"));
const Users = lazy(() => import("./pages/Users"));
const Departments = lazy(() => import("./pages/Departments"));
const Roles = lazy(() => import("./pages/Roles"));
const Teams = lazy(() => import("./pages/Teams"));

// Reports
const UserReport = lazy(() => import("./pages/Reports/UserReport"));
const TasksReport = lazy(() => import("./pages/Reports/TasksReport"));
const BugReport = lazy(() => import("./pages/Reports/BugReport"));

// Tasks
const Tasks = lazy(() => import("./pages/Tasks/Tasks"));
const TaskDetails = lazy(() => import("./pages/Tasks/TaskDetails"));

// Test Management
const Projects = lazy(() => import("./pages/Projects/Projects"));
const TestSuites = lazy(() => import("./pages/TestManagement/TestSuites"));
const TestCases = lazy(() => import("./pages/TestManagement/TestCases"));
const TestCaseDetails = lazy(
  () => import("./pages/TestManagement/TestCaseDetails"),
);
const Sprintboard = lazy(() => import("./pages/TestManagement/Sprintboard"));
const Sprints = lazy(() => import("./pages/TestManagement/Sprints"));

// Flow Diagrams
const FlowDiagramEditor = lazy(
  () => import("./pages/Projects/FlowDiagramEditor"),
);

// Playwright
const PlaywrightRecorder = lazy(() =>
  import("./pages/TestManagement/Playwright").then((m) => ({
    default: m.PlaywrightRecorder,
  })),
);

const PlaywrightEditor = lazy(() =>
  import("./pages/TestManagement/Playwright").then((m) => ({
    default: m.PlaywrightEditor,
  })),
);

const PlaywrightRunner = lazy(() =>
  import("./pages/TestManagement/Playwright").then((m) => ({
    default: m.PlaywrightRunner,
  })),
);

const PlaywrightPreview = lazy(() =>
  import("./pages/TestManagement/Playwright").then((m) => ({
    default: m.PlaywrightPreview,
  })),
);

function Loader() {
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-white dark:bg-gray-900">
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-blue-500/20 blur-lg animate-pulse" />

        <div className="w-10 h-10 rounded-full border-2 border-gray-300/30 dark:border-white/20 border-t-blue-500 dark:border-t-white animate-spin" />
      </div>

      <p className="mt-4 text-sm tracking-wide text-gray-500 dark:text-gray-400">
        Loading...
      </p>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <Suspense fallback={<Loader />}>
        <Routes>
          {/* Public Routes */}
          <Route
            path="/signin"
            element={
              <PublicRoute>
                <SignIn />
              </PublicRoute>
            }
          />

          <Route
            path="/signup"
            element={
              <PublicRoute>
                <SignUp />
              </PublicRoute>
            }
          />

          {/* Unauthorized */}
          <Route path="/unauthorized" element={<Unauthorized />} />

          {/* Protected */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/" element={<Navigate to="/home" replace />} />

              <Route path="/home" element={<Home />} />
              <Route path="/calendar" element={<Calendar />} />
              <Route path="/profile" element={<UserProfiles />} />
              <Route path="/users" element={<Users />} />
              <Route path="/departments" element={<Departments />} />
              <Route path="/roles" element={<Roles />} />
              <Route path="/teams" element={<Teams />} />
              <Route path="/sprints" element={<Sprints />} />
              <Route path="/sprints/:id" element={<Sprintboard />} />

              <Route path="/reports/users" element={<UserReport />} />
              <Route path="/reports/tasks" element={<TasksReport />} />
              <Route path="/reports/bugs" element={<BugReport />} />

              <Route path="/tasks" element={<Tasks />} />
              <Route path="/tasks/:id" element={<TaskDetails />} />

              <Route path="/projects" element={<Projects />} />
              <Route path="/projects/:id" element={<ProjectOverview />} />
              <Route
                path="/projects/:id/diagram"
                element={<FlowDiagramEditor />}
              />
              <Route path="/test-suites" element={<TestSuites />} />
              <Route path="/test-cases" element={<TestCases />} />
              <Route path="/test-cases/:id" element={<TestCaseDetails />} />

              <Route path="/script/recorder" element={<PlaywrightRecorder />} />

              <Route path="/script/editor" element={<PlaywrightEditor />} />

              <Route
                path="/script/editor/:testCaseId"
                element={<PlaywrightEditor />}
              />

              <Route path="/script/runner" element={<PlaywrightRunner />} />
              <Route path="/script/advanced" element={<AdvancedAutomation />} />

              <Route
                path="/script/advanced/:testCaseId"
                element={<AdvancedAutomation />}
              />

              <Route
                path="/script/runner/:testCaseId"
                element={<PlaywrightRunner />}
              />

              <Route path="/script/preview" element={<PlaywrightPreview />} />

              <Route
                path="/script/preview/:runId"
                element={<PlaywrightPreview />}
              />
              <Route path="/bug-reports" element={<BugReports />} />
            </Route>
          </Route>

          {/* 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </Router>
  );
}
