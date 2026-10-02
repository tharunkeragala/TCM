const express = require("express");
const router = express.Router();

const { verifyToken } = require("../middleware/auth");
const checkPermission = require("../middleware/checkPermission");
const {
  getProjectIdFromTestCase,
  getProjectIdFromRun,
} = require("../middleware/projectAccess");

const recorderController = require("../controllers/playwrightRecorderController");
const runController = require("../controllers/playwrightRunController");

const MENU = "/test-cases";

// =========================================================
// PERMISSION HELPERS
// =========================================================

const anyProjectMemberPermission = (permissionType) =>
  checkPermission(MENU, permissionType, {
    allowAnyProjectMember: true,
  });

const testCasePermission = (permissionType, paramName = "id") =>
  checkPermission(MENU, permissionType, {
    resolveProjectId: async (req, pool) =>
      getProjectIdFromTestCase(pool, req.params[paramName]),
  });

const runPermission = (permissionType) =>
  checkPermission(MENU, permissionType, {
    resolveProjectId: async (req, pool) =>
      getProjectIdFromRun(pool, req.params.runId),
  });

// =========================================================
// PLAYWRIGHT RECORDER
//
// Recorder start/stop does not yet belong to one saved test case, so there
// is no concrete project ID to resolve. A user with normal role permission OR
// membership in at least one project may use the recorder.
// =========================================================

router.post(
  "/recorder/start",
  verifyToken,
  anyProjectMemberPermission("can_create"),
  recorderController.startRecording,
);

router.post(
  "/recorder/stop/:id",
  verifyToken,
  anyProjectMemberPermission("can_create"),
  recorderController.stopRecording,
);

// =========================================================
// PLAYWRIGHT SCRIPT / EDITOR SAVE
//
// Exact project is resolved from test case -> suite -> project.
// =========================================================

router.put(
  "/test-cases/:id/script",
  verifyToken,
  testCasePermission("can_edit"),
  recorderController.updateTestCaseScript,
);

// =========================================================
// PARSE / PREVIEW PLAYWRIGHT SCRIPT
//
// Parsing is stateless and has no test-case/project identifier, therefore an
// assigned user to any project may use it if normal role permission is absent.
// =========================================================

router.post(
  "/parse-steps",
  verifyToken,
  anyProjectMemberPermission("can_view"),
  runController.parseSteps,
);

// =========================================================
// RUN TEST CASE
// =========================================================

router.post(
  "/test-cases/:id/run",
  verifyToken,
  testCasePermission("can_edit"),
  runController.runTestCase,
);

// =========================================================
// TEST CASE RUN HISTORY
// =========================================================

router.get(
  "/test-cases/:id/runs",
  verifyToken,
  testCasePermission("can_view"),
  runController.getRunsByTestCase,
);

// =========================================================
// INDIVIDUAL RUN DETAILS
// =========================================================

router.get(
  "/runs/:runId",
  verifyToken,
  runPermission("can_view"),
  runController.getRunById,
);

router.get(
  "/runs/:runId/steps",
  verifyToken,
  runPermission("can_view"),
  runController.getRunSteps,
);

// =========================================================
// CANCEL RUN
// =========================================================

router.post(
  "/runs/:runId/cancel",
  verifyToken,
  runPermission("can_edit"),
  runController.cancelRun,
);

// =========================================================
// PLAYWRIGHT STATISTICS
//
// Controller must return only runs belonging to projects visible to the user.
// =========================================================

router.get(
  "/stats",
  verifyToken,
  anyProjectMemberPermission("can_view"),
  runController.getStats,
);

// =========================================================
// LEGACY TEST CASE RUN ROUTE
// Keep only while frontend references /api/playwright/:id/runs
// =========================================================

router.get(
  "/:id/runs",
  verifyToken,
  testCasePermission("can_view"),
  runController.getRunsByTestCase,
);

module.exports = router;
