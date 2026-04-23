const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/auth");
const checkPermission = require("../middleware/checkPermission");
const testSuiteController = require("../controllers/testSuiteController");

const MENU = "/test-suites";

router.get(
  "/",
  verifyToken,
  checkPermission(MENU, "can_view"),
  testSuiteController.getTestSuites
);
router.get(
  "/:id/case-count",
  verifyToken,
  checkPermission(MENU, "can_view"),
  testSuiteController.getSuiteCaseCount
);
router.post(
  "/create",
  verifyToken,
  checkPermission(MENU, "can_create"),
  testSuiteController.createTestSuite
);
router.put(
  "/update/:id",
  verifyToken,
  checkPermission(MENU, "can_edit"),
  testSuiteController.updateTestSuite
);
router.delete(
  "/delete/:id",
  verifyToken,
  checkPermission(MENU, "can_delete"),
  testSuiteController.deleteTestSuite
);
router.put(
  "/toggle/:id",
  verifyToken,
  checkPermission(MENU, "can_edit"),
  testSuiteController.toggleTestSuite
);

module.exports = router;