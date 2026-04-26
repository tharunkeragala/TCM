const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/auth");
const checkPermission = require("../middleware/checkPermission");
const projectController = require("../controllers/projectController");

const MENU = "/projects";

router.get(
  "/",
  verifyToken,
  checkPermission(MENU, "can_view"),
  projectController.getProjects,
);
router.get(
  "/:id/suite-count",
  verifyToken,
  checkPermission(MENU, "can_view"),
  projectController.getProjectSuiteCount,
);
router.get(
  "/:id",
  verifyToken,
  checkPermission(MENU, "can_view"),
  projectController.getProjectById,
);
router.post(
  "/create",
  verifyToken,
  checkPermission(MENU, "can_create"),
  projectController.createProject,
);
router.put(
  "/update/:id",
  verifyToken,
  checkPermission(MENU, "can_edit"),
  projectController.updateProject,
);
router.delete(
  "/delete/:id",
  verifyToken,
  checkPermission(MENU, "can_delete"),
  projectController.deleteProject,
);
router.put(
  "/toggle/:id",
  verifyToken,
  checkPermission(MENU, "can_edit"),
  projectController.toggleProject,
);

module.exports = router;
