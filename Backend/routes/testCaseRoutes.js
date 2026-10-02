const express = require("express");
const router = express.Router();

const { verifyToken } = require("../middleware/auth");
const checkPermission = require("../middleware/checkPermission");
const {
  getProjectIdFromSuite,
  getProjectIdFromTestCase,
} = require("../middleware/projectAccess");

const testCaseController = require("../controllers/testCaseController");
const workflowController = require("../controllers/testCaseWorkflowController");

const MENU = "/test-cases";

// =====================================================
// PERMISSION HELPERS
// =====================================================

const testCasePermission = (permissionType, paramName = "id") =>
  checkPermission(MENU, permissionType, {
    resolveProjectId: async (req, pool) =>
      getProjectIdFromTestCase(pool, req.params[paramName]),
  });

const listPermission = (permissionType) => {
  return (req, res, next) => {
    const suiteId = Number(req.query?.suite_id);

    const middleware = suiteId > 0
      ? checkPermission(MENU, permissionType, {
          resolveProjectId: async (_req, pool) =>
            getProjectIdFromSuite(pool, suiteId),
        })
      : checkPermission(MENU, permissionType, {
          allowAnyProjectMember: true,
        });

    return middleware(req, res, next);
  };
};

// =====================================================
// TEST CASE WORKFLOW APPROVAL PAGE
//
// Approval permissions remain role-based and separate from normal
// project-member access. Being assigned to a project does NOT make a user
// an approver automatically.
// =====================================================

router.get(
  "/workflow/approvals",
  verifyToken,
  checkPermission("/test-case-approvals", "can_view"),
  workflowController.getPendingApprovals,
);

router.get(
  "/workflow/requests/:requestId",
  verifyToken,
  checkPermission("/test-case-approvals", "can_view"),
  workflowController.getWorkflowRequest,
);

router.post(
  "/workflow/requests/:requestId/approve",
  verifyToken,
  checkPermission("/test-case-approvals", "can_edit"),
  workflowController.approveRequest,
);

router.post(
  "/workflow/requests/:requestId/reject",
  verifyToken,
  checkPermission("/test-case-approvals", "can_edit"),
  workflowController.rejectRequest,
);

router.post(
  "/workflow/requests/:requestId/return",
  verifyToken,
  checkPermission("/test-case-approvals", "can_edit"),
  workflowController.returnRequest,
);

// =====================================================
// TEST CASE WORKFLOW HISTORY
// =====================================================

router.get(
  "/:id/workflow-history",
  verifyToken,
  testCasePermission("can_view"),
  workflowController.getTestCaseWorkflowHistory,
);

// =====================================================
// TEST CASE CRUD
// =====================================================

router.get(
  "/",
  verifyToken,
  listPermission("can_view"),
  testCaseController.getTestCases,
);

router.get(
  "/:id/activity",
  verifyToken,
  testCasePermission("can_view"),
  testCaseController.getTestCaseActivity,
);

router.get(
  "/:id/step-count",
  verifyToken,
  testCasePermission("can_view"),
  testCaseController.getTestCaseStepCount,
);

router.get(
  "/:id",
  verifyToken,
  testCasePermission("can_view"),
  testCaseController.getTestCaseById,
);

router.post(
  "/create",
  verifyToken,
  checkPermission(MENU, "can_create", {
    resolveProjectId: async (req, pool) =>
      getProjectIdFromSuite(pool, req.body?.suite_id),
  }),
  testCaseController.createTestCase,
);

router.post(
  "/:id/submit-review",
  verifyToken,
  testCasePermission("can_edit"),
  testCaseController.submitForReview,
);

router.put(
  "/update/:id",
  verifyToken,
  testCasePermission("can_edit"),
  testCaseController.updateTestCase,
);

router.delete(
  "/delete/:id",
  verifyToken,
  testCasePermission("can_delete"),
  testCaseController.deleteTestCase,
);

module.exports = router;
