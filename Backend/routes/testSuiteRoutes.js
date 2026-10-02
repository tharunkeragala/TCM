const express = require("express");
const router = express.Router();

const { verifyToken } = require("../middleware/auth");
const checkPermission = require("../middleware/checkPermission");
const {
  getProjectIdFromSuite,
} = require("../middleware/projectAccess");

const testSuiteController = require("../controllers/testSuiteController");

const MENU = "/test-suites";

// ---------------------------------------------------------
// Permission helpers
// ---------------------------------------------------------
// Preserve normal role permissions first. If the role does not grant the
// requested action, checkPermission can fall back to project membership.

const listPermission = (permissionType) => {
  return (req, res, next) => {
    const hasProjectFilter = Number(req.query?.project_id) > 0;

    const middleware = hasProjectFilter
      ? checkPermission(MENU, permissionType, {
          resolveProjectId: async () => Number(req.query.project_id),
        })
      : checkPermission(MENU, permissionType, {
          allowAnyProjectMember: true,
        });

    return middleware(req, res, next);
  };
};

const suitePermission = (permissionType) =>
  checkPermission(MENU, permissionType, {
    resolveProjectId: async (req, pool) =>
      getProjectIdFromSuite(pool, req.params.id),
  });

// ---------------------------------------------------------
// GET ALL TEST SUITES
// ---------------------------------------------------------
router.get(
  "/",
  verifyToken,
  listPermission("can_view"),
  testSuiteController.getTestSuites,
);

// ---------------------------------------------------------
// GET CASE COUNT FOR A SUITE
// ---------------------------------------------------------
router.get(
  "/:id/case-count",
  verifyToken,
  suitePermission("can_view"),
  testSuiteController.getSuiteCaseCount,
);

// ---------------------------------------------------------
// CREATE TEST SUITE
// ---------------------------------------------------------
router.post(
  "/create",
  verifyToken,
  checkPermission(MENU, "can_create", {
    resolveProjectId: async (req) => Number(req.body?.project_id) || null,
  }),
  testSuiteController.createTestSuite,
);

// ---------------------------------------------------------
// UPDATE TEST SUITE
// ---------------------------------------------------------
router.put(
  "/update/:id",
  verifyToken,
  suitePermission("can_edit"),
  testSuiteController.updateTestSuite,
);

// ---------------------------------------------------------
// DELETE TEST SUITE
// ---------------------------------------------------------
router.delete(
  "/delete/:id",
  verifyToken,
  suitePermission("can_delete"),
  testSuiteController.deleteTestSuite,
);

// ---------------------------------------------------------
// TOGGLE TEST SUITE STATUS
// ---------------------------------------------------------
router.put(
  "/toggle/:id",
  verifyToken,
  suitePermission("can_edit"),
  testSuiteController.toggleTestSuite,
);

module.exports = router;
