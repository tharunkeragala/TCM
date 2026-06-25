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

router.get(
  "/:id",
  verifyToken,
  checkPermission(MENU, "can_view"),
  sprintController.getSprintById
);

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

router.put(
  "/:id/status",
  verifyToken,
  checkPermission(MENU, "can_edit"),
  sprintController.changeSprintStatus
);

router.delete(
  "/delete/:id",
  verifyToken,
  checkPermission(MENU, "can_delete"),
  sprintController.deleteSprint
);

// ─── Board (suites on the sprint) ──────────────────────────
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

// ─── Test cases inside a suite, for a given sprint ─────────
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

module.exports = router;