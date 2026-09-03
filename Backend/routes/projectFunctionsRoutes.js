const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/auth");
const checkPermission = require("../middleware/checkPermission");
const projectFunctionsController = require("../controllers/projectFunctionsController");

const MENU = "/project-functions";

// ===============================
// PROJECT FUNCTIONS MANAGEMENT
// ===============================

// Add function to a project
router.post(
  "/",
  verifyToken,
  checkPermission(MENU, "can_create"),
  projectFunctionsController.addFunctionToProject
);

// Get all functions for a specific project
router.get(
  "/project/:project_id",
  verifyToken,
  checkPermission(MENU, "can_view"),
  projectFunctionsController.getProjectFunctions
);

// Get all functions (admin/system view)
router.get(
  "/",
  verifyToken,
  checkPermission(MENU, "can_view"),
  projectFunctionsController.getAllFunctions
);

// Update function
router.put(
  "/:id",
  verifyToken,
  checkPermission(MENU, "can_edit"),
  projectFunctionsController.updateFunction
);

// Delete function (soft delete)
router.delete(
  "/:id",
  verifyToken,
  checkPermission(MENU, "can_delete"),
  projectFunctionsController.deleteFunction
);

module.exports = router;
