const express = require("express");

const router = express.Router();

const { verifyToken } = require("../middleware/auth");
const checkPermission = require("../middleware/checkPermission");

const menuController = require("../controllers/menuController");

/* ============================================================
   USER NAVIGATION
   Authenticated users can load the navigation structure.
   Actual pages remain protected by their own permissions.
   ============================================================ */

router.get("/navigation", verifyToken, menuController.getNavigation);

/* ============================================================
   MENU ADMINISTRATION

   Bootstrap using /roles permission because Menu Management
   itself may not yet exist in existing role permission records.

   Later you can change "/roles" -> "/menu-management".
   ============================================================ */

router.get(
  "/",
  verifyToken,
  checkPermission("/roles", "can_view"),
  menuController.getMenus,
);

router.get(
  "/tree",
  verifyToken,
  checkPermission("/roles", "can_view"),
  menuController.getMenuTree,
);

router.get(
  "/:id",
  verifyToken,
  checkPermission("/roles", "can_view"),
  menuController.getMenuById,
);

router.post(
  "/create",
  verifyToken,
  checkPermission("/roles", "can_edit"),
  menuController.createMenu,
);

router.put(
  "/reorder",
  verifyToken,
  checkPermission("/roles", "can_edit"),
  menuController.reorderMenus,
);

router.put(
  "/:id/toggle-active",
  verifyToken,
  checkPermission("/roles", "can_edit"),
  menuController.toggleMenuActive,
);

router.put(
  "/:id",
  verifyToken,
  checkPermission("/roles", "can_edit"),
  menuController.updateMenu,
);

router.delete(
  "/:id",
  verifyToken,
  checkPermission("/roles", "can_delete"),
  menuController.deleteMenu,
);

module.exports = router;
