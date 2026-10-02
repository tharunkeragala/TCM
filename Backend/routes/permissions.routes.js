const express = require("express");
const router = express.Router();

const { verifyToken } = require("../middleware/auth");
const permissionController = require("../controllers/permissionController");

// No route-level project fallback is needed here.
// This endpoint returns the current user's permissions. If the frontend uses
// /api/permissions/mine to decide whether menu items are visible, then
// permissionController.getMyPermissions should expose effective project-member
// permissions for the relevant project-aware modules.
router.get(
  "/mine",
  verifyToken,
  permissionController.getMyPermissions,
);

module.exports = router;
