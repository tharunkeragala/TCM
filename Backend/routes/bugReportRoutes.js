const express = require("express");

const router = express.Router();

const { verifyToken } = require("../middleware/auth");

const checkPermission = require("../middleware/checkPermission");

const bugReportController = require("../controllers/bugReportController");

const upload = require("../middleware/upload");

const MENU = "/bug-reports";

// ===============================
// CREATE BUG REPORT
// ===============================
router.post(
  "/",
  verifyToken,
  checkPermission(MENU, "can_create"),
  upload.array("screenshots", 10),
  bugReportController.createBugReport,
);

// ===============================
// GET ALL BUG REPORTS
// ===============================
router.get(
  "/",
  verifyToken,
  checkPermission(MENU, "can_view"),
  bugReportController.getBugReports,
);

// ===============================
// BUG REPORT STATISTICS
// Keep this route before "/:id".
// ===============================
router.get(
  "/reports/statistics",
  verifyToken,
  checkPermission(MENU, "can_view"),
  bugReportController.getBugStatistics,
);

// ===============================
// GET BUG REPORT BY ID
// ===============================
router.get(
  "/:id",
  verifyToken,
  checkPermission(MENU, "can_view"),
  bugReportController.getBugReportById,
);

// ===============================
// UPDATE BUG REPORT
// ===============================
router.put(
  "/:id",
  verifyToken,
  checkPermission(MENU, "can_edit"),
  bugReportController.updateBugReport,
);

// ===============================
// DELETE BUG REPORT
// ===============================
router.delete(
  "/:id",
  verifyToken,
  checkPermission(MENU, "can_delete"),
  bugReportController.deleteBugReport,
);

// ===============================
// RECORD ITERATION
// ===============================
router.post(
  "/:id/iterations",
  verifyToken,
  checkPermission(MENU, "can_edit"),
  bugReportController.recordBugIteration,
);

// ===============================
// GET BUG HISTORY
// ===============================
router.get(
  "/:id/history",
  verifyToken,
  checkPermission(MENU, "can_view"),
  bugReportController.getBugHistory,
);

// ===============================
// ADD COMMENT
// ===============================
router.post(
  "/:id/comments",
  verifyToken,
  checkPermission(MENU, "can_edit"),
  bugReportController.addBugComment,
);

// ===============================
// UPLOAD SCREENSHOTS
// ===============================
router.post(
  "/:id/screenshots",
  verifyToken,
  checkPermission(MENU, "can_edit"),
  upload.array("screenshots", 10),
  bugReportController.uploadBugScreenshots,
);

router.delete(
  "/:id/screenshots/:screenshotId",
  verifyToken,
  checkPermission(MENU, "can_edit"),
  bugReportController.deleteBugScreenshot,
);

// ===============================
// LINK TEST CASE TO BUG
// ===============================
router.post(
  "/:id/test-cases",
  verifyToken,
  checkPermission(MENU, "can_edit"),
  bugReportController.linkTestCaseToBug,
);

// ===============================
// UNLINK TEST CASE FROM BUG
// ===============================
router.delete(
  "/:id/test-cases/:testCaseId",
  verifyToken,
  checkPermission(MENU, "can_edit"),
  bugReportController.unlinkTestCaseFromBug,
);

module.exports = router;
