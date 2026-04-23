const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/auth");
const checkPermission = require("../middleware/checkPermission");
const testCaseController = require("../controllers/testCaseController");

const MENU = "/test-cases";

router.get(
  "/",
  verifyToken,
  checkPermission(MENU, "can_view"),
  testCaseController.getTestCases
);
router.get(
  "/:id/step-count",
  verifyToken,
  checkPermission(MENU, "can_view"),
  testCaseController.getTestCaseStepCount
);
router.get(
  "/:id",
  verifyToken,
  checkPermission(MENU, "can_view"),
  testCaseController.getTestCaseById
);
router.post(
  "/create",
  verifyToken,
  checkPermission(MENU, "can_create"),
  testCaseController.createTestCase
);
router.put(
  "/update/:id",
  verifyToken,
  checkPermission(MENU, "can_edit"),
  testCaseController.updateTestCase
);
router.delete(
  "/delete/:id",
  verifyToken,
  checkPermission(MENU, "can_delete"),
  testCaseController.deleteTestCase
);

module.exports = router;