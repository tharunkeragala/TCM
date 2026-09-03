const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/auth");
const checkPermission = require("../middleware/checkPermission");
const bugReportController = require("../controllers/bugReportController");
const upload = require("../middleware/upload");

const MENU = "/bug-reports";

// ===============================
// BUG REPORT MANAGEMENT
// ===============================

// Create bug report with screenshots
router.post(
  "/",
  verifyToken,
  checkPermission(MENU, "can_create"),
  upload.array("screenshots", 10),
  bugReportController.createBugReport
);

// Get all bug reports (with filtering)
router.get(
  "/",
  verifyToken,
  checkPermission(MENU, "can_view"),
  bugReportController.getBugReports
);

// Get bug statistics and sprint summary report
router.get(
  "/reports/statistics",
  verifyToken,
  checkPermission(MENU, "can_view"),
  bugReportController.getBugStatistics
);

// Get bug report by ID with full details
router.get(
  "/:id",
  verifyToken,
  checkPermission(MENU, "can_view"),
  bugReportController.getBugReportById
);

// Update bug report
router.put(
  "/:id",
  verifyToken,
  checkPermission(MENU, "can_edit"),
  bugReportController.updateBugReport
);

// Delete bug report (soft delete)
router.delete(
  "/:id",
  verifyToken,
  checkPermission(MENU, "can_delete"),
  bugReportController.deleteBugReport
);

// ===============================
// BUG ITERATION / CYCLE TRACKING
// ===============================

// Record bug iteration for a new sprint/cycle
router.post(
  "/:id/iterations",
  verifyToken,
  checkPermission(MENU, "can_edit"),
  bugReportController.recordBugIteration
);

// Get bug history/timeline
router.get(
  "/:id/history",
  verifyToken,
  checkPermission(MENU, "can_view"),
  bugReportController.getBugHistory
);

// ===============================
// COMMENTS
// ===============================

// Add comment to bug report
router.post(
  "/:id/comments",
  verifyToken,
  checkPermission(MENU, "can_edit"),
  bugReportController.addBugComment
);

// ===============================
// SCREENSHOTS
// ===============================

// Upload screenshots to existing bug report
router.post(
  "/:id/screenshots",
  verifyToken,
  checkPermission(MENU, "can_edit"),
  upload.array("screenshots", 10),
  bugReportController.uploadBugScreenshots
);

// ===============================
// REPORTS & STATISTICS
// ===============================

module.exports = router;
