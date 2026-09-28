const express = require("express");
const router = express.Router();

const { verifyToken } = require("../middleware/auth");
const checkPermission = require("../middleware/checkPermission");

const recorderController = require("../controllers/playwrightRecorderController");
const runController = require("../controllers/playwrightRunController");

const MENU = "/test-cases";

/* =========================================================
   PLAYWRIGHT RECORDER
========================================================= */

router.post(
  "/recorder/start",
  verifyToken,
  checkPermission(MENU, "can_create"),
  recorderController.startRecording,
);

router.post(
  "/recorder/stop/:id",
  verifyToken,
  checkPermission(MENU, "can_create"),
  recorderController.stopRecording,
);

/* =========================================================
   PLAYWRIGHT SCRIPT
   Script-only save:
   - does NOT update test steps
   - does NOT trigger approval workflow
   - does NOT change workflow status
========================================================= */

router.put(
  "/test-cases/:id/script",
  verifyToken,
  checkPermission(MENU, "can_edit"),
  recorderController.updateTestCaseScript,
);

/* =========================================================
   PARSE PLAYWRIGHT SCRIPT
========================================================= */

router.post(
  "/parse-steps",
  verifyToken,
  checkPermission(MENU, "can_view"),
  runController.parseSteps,
);

/* =========================================================
   RUN TEST CASE
========================================================= */

router.post(
  "/test-cases/:id/run",
  verifyToken,
  checkPermission(MENU, "can_edit"),
  runController.runTestCase,
);

/* =========================================================
   TEST CASE RUN HISTORY
========================================================= */

router.get(
  "/test-cases/:id/runs",
  verifyToken,
  checkPermission(MENU, "can_view"),
  runController.getRunsByTestCase,
);

/* =========================================================
   INDIVIDUAL RUN DETAILS
========================================================= */

router.get(
  "/runs/:runId",
  verifyToken,
  checkPermission(MENU, "can_view"),
  runController.getRunById,
);

router.get(
  "/runs/:runId/steps",
  verifyToken,
  checkPermission(MENU, "can_view"),
  runController.getRunSteps,
);

/* =========================================================
   CANCEL RUN
========================================================= */

router.post(
  "/runs/:runId/cancel",
  verifyToken,
  checkPermission(MENU, "can_edit"),
  runController.cancelRun,
);

/* =========================================================
   PLAYWRIGHT STATISTICS
========================================================= */

router.get(
  "/stats",
  verifyToken,
  checkPermission(MENU, "can_view"),
  runController.getStats,
);

/* =========================================================
   LEGACY TEST CASE RUN ROUTE
   Keep only if something in the frontend still uses:
   /api/playwright/:id/runs
========================================================= */

router.get(
  "/:id/runs",
  verifyToken,
  checkPermission(MENU, "can_view"),
  runController.getRunsByTestCase,
);

module.exports = router;
