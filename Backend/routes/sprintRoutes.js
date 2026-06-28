const express = require("express");
const router = express.Router();

const sprintController = require("../controllers/sprintcontroller");
const { verifyToken } = require("../middleware/auth");
const checkPermission = require("../middleware/checkPermission");

const MENU = "/sprints";

// ─── Sprints ────────────────────────────────────────────────
router.get(
  "/",
  verifyToken,
  checkPermission(MENU, "can_view"),
  sprintController.getSprints
);

// ⚠️ CRITICAL: ALL specific routes must come BEFORE /:id
router.post(
  "/create",
  verifyToken,
  checkPermission(MENU, "can_create"),
  sprintController.createSprint
);

router.put(
  "/update/:id",
  verifyToken,
  checkPermission(MENU, "can_edit"),
  sprintController.updateSprint
);

router.delete(
  "/delete/:id",
  verifyToken,
  checkPermission(MENU, "can_delete"),
  sprintController.deleteSprint
);

// ─── Sprint by ID (keep AFTER static-segment routes) ───────
router.get(
  "/:id",
  verifyToken,
  checkPermission(MENU, "can_view"),
  sprintController.getSprintById
);

router.put(
  "/:id/status",
  verifyToken,
  checkPermission(MENU, "can_edit"),
  sprintController.changeSprintStatus
);

// ─── Board ──────────────────────────────────────────────────
router.get(
  "/:id/board",
  verifyToken,
  checkPermission(MENU, "can_view"),
  sprintController.getSprintBoard
);

router.post(
  "/:id/suites",
  verifyToken,
  checkPermission(MENU, "can_edit"),
  sprintController.addSuiteToSprint
);

router.put(
  "/:id/suites/:suiteId/board-status",
  verifyToken,
  checkPermission(MENU, "can_edit"),
  sprintController.updateSuiteBoardStatus
);

router.delete(
  "/:id/suites/:suiteId",
  verifyToken,
  checkPermission(MENU, "can_edit"),
  sprintController.removeSuiteFromSprint
);

// ─── Test cases ─────────────────────────────────────────────
router.get(
  "/:id/suites/:suiteId/test-cases",
  verifyToken,
  checkPermission(MENU, "can_view"),
  sprintController.getSprintSuiteTestCases
);

router.get(
  "/:id/suites/:suiteId/available-test-cases",
  verifyToken,
  checkPermission(MENU, "can_view"),
  sprintController.getAvailableTestCasesForSuite
);

router.post(
  "/:id/suites/:suiteId/test-cases/link",
  verifyToken,
  checkPermission(MENU, "can_edit"),
  sprintController.linkTestCaseToSuite
);

router.post(
  "/:id/suites/:suiteId/test-cases",
  verifyToken,
  checkPermission(MENU, "can_create"),
  sprintController.createTestCaseInSuite
);

router.delete(
  "/:id/suites/:suiteId/test-cases/:testCaseId",
  verifyToken,
  checkPermission(MENU, "can_edit"),
  sprintController.unlinkTestCaseFromSuite
);

// ─── Execution progress ─────────────────────────────────────
router.post(
  "/:id/suites/:suiteId/test-cases/:testCaseId/execution-started",
  verifyToken,
  sprintController.notifyExecutionStarted
);

router.get(
  "/:id/suites/:suiteId/progress",
  verifyToken,
  checkPermission(MENU, "can_view"),
  sprintController.getExecutionProgress
);

// ─── Assignees ──────────────────────────────────────────────
router.get(
  "/:id/assignees",
  verifyToken,
  checkPermission(MENU, "can_view"),
  sprintController.getSprintAssignees
);

router.post(
  "/:id/assignees",
  verifyToken,
  checkPermission(MENU, "can_edit"),
  sprintController.addSprintAssignee
);

router.delete(
  "/:id/assignees/:assigneeUserId",
  verifyToken,
  checkPermission(MENU, "can_edit"),
  sprintController.removeSprintAssignee
);

// ─── Comments ───────────────────────────────────────────────
router.get(
  "/:id/comments",
  verifyToken,
  checkPermission(MENU, "can_view"),
  sprintController.getSprintComments
);

router.post(
  "/:id/comments",
  verifyToken,
  checkPermission(MENU, "can_edit"),
  sprintController.addSprintComment
);

router.delete(
  "/:id/comments/:commentId",
  verifyToken,
  checkPermission(MENU, "can_edit"),
  sprintController.deleteSprintComment
);

// ─── Activity ───────────────────────────────────────────────
router.get(
  "/:id/activity",
  verifyToken,
  checkPermission(MENU, "can_view"),
  sprintController.getSprintActivity
);

// ─── Batch execution ────────────────────────────────────────
router.post(
  "/:id/suites/:suiteId/execute-all",
  verifyToken,
  checkPermission(MENU, "can_edit"),
  sprintController.executeAllInSuite
);

router.get(
  "/:id/suites/:suiteId/batch-runs/:batchId",
  verifyToken,
  checkPermission(MENU, "can_view"),
  sprintController.getBatchRunStatus
);

router.post(
  "/:id/suites/:suiteId/batch-runs/:batchId/cancel",
  verifyToken,
  checkPermission(MENU, "can_edit"),
  sprintController.cancelBatch
);

module.exports = router;