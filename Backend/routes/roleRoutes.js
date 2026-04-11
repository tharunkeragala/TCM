const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/auth");
const checkPermission = require("../middleware/checkPermission");
const roleController = require("../controllers/roleController");

const MENU = "/roles";

router.get("/menus", verifyToken, roleController.getMenuTree);
router.get("/my-permissions", verifyToken, roleController.getMyPermissions);

router.get(
  "/:roleId/permissions",
  verifyToken,
  checkPermission(MENU, "can_view"),
  roleController.getRolePermissions
);
router.post(
  "/save",
  verifyToken,
  checkPermission(MENU, "can_edit"),
  roleController.saveRolePermissions
);
router.get(
  "/",
  verifyToken,
  checkPermission(MENU, "can_view"),
  roleController.getRoles
);
router.post(
  "/create",
  verifyToken,
  checkPermission(MENU, "can_create"),
  roleController.createRole
);
router.put(
  "/:id",
  verifyToken,
  checkPermission(MENU, "can_edit"),
  roleController.updateRole
);
router.delete(
  "/:id",
  verifyToken,
  checkPermission(MENU, "can_delete"),
  roleController.deleteRole
);
router.get(
  "/:id/assigned-users",
  verifyToken,
  checkPermission(MENU, "can_view"),
  roleController.getAssignedUserCount
);

module.exports = router;