// import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router";
// import SignIn from "./pages/AuthPages/SignIn";
// import SignUp from "./pages/AuthPages/SignUp";
// import NotFound from "./pages/OtherPage/NotFound";
// import Home from "./pages/Dashboard/Home";
// import Calendar from "./pages/Calendar";
// import UserProfiles from "./pages/UserProfiles";
// import AppLayout from "./layout/AppLayout";
// import ProtectedRoute from "./components/auth/ProtectedRoute";
// import PublicRoute from "./components/auth/PublicRoute";
// import Users from "./pages/Users";
// import Departments from "./pages/Departments";
// import Roles from "./pages/Roles";
// import Unauthorized from "./pages/Unauthorized"; // ✅ add this
// import Teams from "./pages/Teams";
// import UserReport from './pages/Reports/UserReport';
// import Projects from "./pages/TestManagement/Projects";
// import TestSuites from "./pages/TestManagement/TestSuites";
// import TestCases from "./pages/TestManagement/TestCases";
// import { PlaywrightRecorder, PlaywrightEditor, PlaywrightRunner, PlaywrightPreview } from "./pages/TestManagement/Playwright";
// import Tasks from "./pages/Tasks/Tasks";
// import TasksReport from "./pages/Reports/TasksReport";
// import TestCaseDetails from "./pages/TestManagement/TestCaseDetails";

// export default function App() {
//   return (
//     <Router>
//       <Routes>
//         {/* Public Routes */}
//         <Route
//           path="/signin"
//           element={
//             <PublicRoute>
//               <SignIn />
//             </PublicRoute>
//           }
//         />
//         <Route
//           path="/signup"
//           element={
//             <PublicRoute>
//               <SignUp />
//             </PublicRoute>
//           }
//         />

//         {/* Unauthorized Route */}
//         <Route path="/unauthorized" element={<Unauthorized />} />

//         {/* Protected Routes */}
//         <Route element={<ProtectedRoute />}>
//           <Route element={<AppLayout />}>
//             {/* Default redirect */}
//             <Route path="/" element={<Navigate to="/home" replace />} />

//             {/* Protected pages */}
//             <Route path="/home" element={<Home />} />
//             <Route path="/calendar" element={<Calendar />} />
//             <Route path="/profile" element={<UserProfiles />} />
//             <Route path="/users" element={<Users />} />
//             <Route path="/departments" element={<Departments />} />
//             <Route path="/roles" element={<Roles />} />
//             <Route path="/teams" element={<Teams />} />
//             <Route path="/reports/users" element={<UserReport />} />
//             <Route path="/reports/tasks" element={<TasksReport />} />
//             <Route path="/projects" element={<Projects />} />
//             <Route path="/test-suites" element={<TestSuites />} />
//             <Route path="/test-cases" element={<TestCases />} />
//             <Route path="/test-cases/:id" element={<TestCaseDetails />} />
//             <Route path="/playwright/recorder" element={<PlaywrightRecorder />} />
//             <Route path="/playwright/editor" element={<PlaywrightEditor />} />
//             <Route path="/playwright/editor/:testCaseId" element={<PlaywrightEditor />} />
//             <Route path="/playwright/runner" element={<PlaywrightRunner />} />
//             <Route path="/playwright/runner/:testCaseId" element={<PlaywrightRunner />} />
//             <Route path="/playwright/preview" element={<PlaywrightPreview />} />
//             <Route path="/playwright/preview/:runId" element={<PlaywrightPreview />} />
//             <Route path="/tasks" element={<Tasks />} />
//           </Route>
//         </Route>

//         {/* 404 */}
//         <Route path="*" element={<NotFound />} />
//       </Routes>
//     </Router>
//   );
// }


import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router";
import { lazy, Suspense } from "react";

import ProtectedRoute from "./components/auth/ProtectedRoute";
import PublicRoute from "./components/auth/PublicRoute";

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

// Tasks
const Tasks = lazy(() => import("./pages/Tasks/Tasks"));

// Test Management
const Projects = lazy(() => import("./pages/TestManagement/Projects"));
const TestSuites = lazy(() => import("./pages/TestManagement/TestSuites"));
const TestCases = lazy(() => import("./pages/TestManagement/TestCases"));
const TestCaseDetails = lazy(
  () => import("./pages/TestManagement/TestCaseDetails")
);

// Playwright
const PlaywrightRecorder = lazy(() =>
  import("./pages/TestManagement/Playwright").then((m) => ({
    default: m.PlaywrightRecorder,
  }))
);

const PlaywrightEditor = lazy(() =>
  import("./pages/TestManagement/Playwright").then((m) => ({
    default: m.PlaywrightEditor,
  }))
);

const PlaywrightRunner = lazy(() =>
  import("./pages/TestManagement/Playwright").then((m) => ({
    default: m.PlaywrightRunner,
  }))
);

const PlaywrightPreview = lazy(() =>
  import("./pages/TestManagement/Playwright").then((m) => ({
    default: m.PlaywrightPreview,
  }))
);

function Loader() {
  return (
    <div className="flex items-center justify-center h-screen bg-[#03045e] dark:bg-gray-900">
      <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
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

              <Route path="/reports/users" element={<UserReport />} />
              <Route path="/reports/tasks" element={<TasksReport />} />

              <Route path="/tasks" element={<Tasks />} />

              <Route path="/projects" element={<Projects />} />
              <Route path="/test-suites" element={<TestSuites />} />
              <Route path="/test-cases" element={<TestCases />} />
              <Route
                path="/test-cases/:id"
                element={<TestCaseDetails />}
              />

              <Route
                path="/playwright/recorder"
                element={<PlaywrightRecorder />}
              />

              <Route
                path="/playwright/editor"
                element={<PlaywrightEditor />}
              />

              <Route
                path="/playwright/editor/:testCaseId"
                element={<PlaywrightEditor />}
              />

              <Route
                path="/playwright/runner"
                element={<PlaywrightRunner />}
              />

              <Route
                path="/playwright/runner/:testCaseId"
                element={<PlaywrightRunner />}
              />

              <Route
                path="/playwright/preview"
                element={<PlaywrightPreview />}
              />

              <Route
                path="/playwright/preview/:runId"
                element={<PlaywrightPreview />}
              />
            </Route>
          </Route>

          {/* 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </Router>
  );
}