const express = require("express");
const router = express.Router();

const { verifyToken } = require("../middleware/auth");
const checkPermission = require("../middleware/checkPermission");

const testCaseController = require("../controllers/testCaseController");
const workflowController = require("../controllers/testCaseWorkflowController");

// =====================================================
// TEST CASE WORKFLOW APPROVAL PAGE
//
// /test-case-approvals permissions:
//   can_view -> view queue/details
//   can_edit -> Approve / Reject / Return
// =====================================================

router.get(
  "/workflow/approvals",
  verifyToken,
  checkPermission("/test-case-approvals", "can_view"),
  workflowController.getPendingApprovals
);

router.get(
  "/workflow/requests/:requestId",
  verifyToken,
  checkPermission("/test-case-approvals", "can_view"),
  workflowController.getWorkflowRequest
);

router.post(
  "/workflow/requests/:requestId/approve",
  verifyToken,
  checkPermission("/test-case-approvals", "can_edit"),
  workflowController.approveRequest
);

router.post(
  "/workflow/requests/:requestId/reject",
  verifyToken,
  checkPermission("/test-case-approvals", "can_edit"),
  workflowController.rejectRequest
);

router.post(
  "/workflow/requests/:requestId/return",
  verifyToken,
  checkPermission("/test-case-approvals", "can_edit"),
  workflowController.returnRequest
);

// =====================================================
// TEST CASE WORKFLOW HISTORY
// Uses normal Test Cases view permission.
// =====================================================

router.get(
  "/:id/workflow-history",
  verifyToken,
  checkPermission("/test-cases", "can_view"),
  workflowController.getTestCaseWorkflowHistory
);

// =====================================================
// TEST CASE CRUD
// =====================================================

router.get(
  "/",
  verifyToken,
  checkPermission("/test-cases", "can_view"),
  testCaseController.getTestCases
);

router.get(
  "/:id/activity",
  verifyToken,
  checkPermission("/test-cases", "can_view"),
  testCaseController.getTestCaseActivity
);

router.get(
  "/:id/step-count",
  verifyToken,
  checkPermission("/test-cases", "can_view"),
  testCaseController.getTestCaseStepCount
);

router.get(
  "/:id",
  verifyToken,
  checkPermission("/test-cases", "can_view"),
  testCaseController.getTestCaseById
);

router.post(
  "/create",
  verifyToken,
  checkPermission("/test-cases", "can_create"),
  testCaseController.createTestCase
);

router.post(
  "/:id/submit-review",
  verifyToken,
  checkPermission("/test-cases", "can_edit"),
  testCaseController.submitForReview
);

router.put(
  "/update/:id",
  verifyToken,
  checkPermission("/test-cases", "can_edit"),
  testCaseController.updateTestCase
);

router.delete(
  "/delete/:id",
  verifyToken,
  checkPermission("/test-cases", "can_delete"),
  testCaseController.deleteTestCase
);

module.exports = router;
