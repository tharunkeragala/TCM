const express = require("express");
const router = express.Router();

const { verifyToken } = require("../middleware/auth");
const checkPermission = require("../middleware/checkPermission");
const bugReportController = require("../controllers/bugReportController");
const upload = require("../middleware/upload");

const MENU = "/bug-reports";

router.post(
  "/",
  verifyToken,
  checkPermission(MENU, "can_create"),
  upload.array("screenshots", 10),
  bugReportController.createBugReport,
);

router.get(
  "/",
  verifyToken,
  checkPermission(MENU, "can_view"),
  bugReportController.getBugReports,
);

router.get(
  "/reports/statistics",
  verifyToken,
  checkPermission(MENU, "can_view"),
  bugReportController.getBugStatistics,
);

router.get(
  "/:id",
  verifyToken,
  checkPermission(MENU, "can_view"),
  bugReportController.getBugReportById,
);

router.put(
  "/:id",
  verifyToken,
  checkPermission(MENU, "can_edit"),
  bugReportController.updateBugReport,
);

router.delete(
  "/:id",
  verifyToken,
  checkPermission(MENU, "can_delete"),
  bugReportController.deleteBugReport,
);

router.post(
  "/:id/iterations",
  verifyToken,
  checkPermission(MENU, "can_edit"),
  bugReportController.recordBugIteration,
);

router.get(
  "/:id/history",
  verifyToken,
  checkPermission(MENU, "can_view"),
  bugReportController.getBugHistory,
);

router.post(
  "/:id/comments",
  verifyToken,
  checkPermission(MENU, "can_edit"),
  bugReportController.addBugComment,
);

router.post(
  "/:id/screenshots",
  verifyToken,
  checkPermission(MENU, "can_edit"),
  upload.array("screenshots", 10),
  bugReportController.uploadBugScreenshots,
);

// Link one test case to a bug.
router.post(
  "/:id/test-cases",
  verifyToken,
  checkPermission(MENU, "can_edit"),
  bugReportController.linkTestCaseToBug,
);

// Unlink one test case from a bug.
router.delete(
  "/:id/test-cases/:testCaseId",
  verifyToken,
  checkPermission(MENU, "can_edit"),
  bugReportController.unlinkTestCaseFromBug,
);

module.exports = router;
