const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/auth");
const checkPermission = require("../middleware/checkPermission");
const departmentController = require("../controllers/departmentController");

const MENU = "/departments";

router.get(
  "/",
  verifyToken,
  checkPermission(MENU, "can_view"),
  departmentController.getDepartments
);
router.get(
  "/:id/assigned-users",
  verifyToken,
  checkPermission(MENU, "can_view"),
  departmentController.getAssignedUserCount
);
router.post(
  "/create",
  verifyToken,
  checkPermission(MENU, "can_create"),
  departmentController.createDepartment
);
router.put(
"/update/:id",
  verifyToken,
  checkPermission(MENU, "can_edit"),
  departmentController.updateDepartment
);
router.delete(
  "/delete/:id",
  verifyToken,
  checkPermission(MENU, "can_delete"),
  departmentController.deleteDepartment
);
router.put(
"/toggle/:id",
  verifyToken,
  checkPermission(MENU, "can_edit"),
  departmentController.toggleDepartment
);

module.exports = router;