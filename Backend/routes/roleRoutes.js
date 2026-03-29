const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/auth");
const roleController = require("../controllers/roleController");

// ─── Menu ─────────────────────────────────────────────────────────────────────
router.get("/menus",                verifyToken, roleController.getMenuTree);

// ─── Permissions ──────────────────────────────────────────────────────────────
router.get("/my-permissions",       verifyToken, roleController.getMyPermissions);
router.get("/:roleId/permissions",  verifyToken, roleController.getRolePermissions);
router.post("/save",                verifyToken, roleController.saveRolePermissions);

// ─── Roles CRUD ───────────────────────────────────────────────────────────────
router.get("/",                     verifyToken, roleController.getRoles);
router.post("/create",              verifyToken, roleController.createRole);
router.put("/:id",                  verifyToken, roleController.updateRole);
router.delete("/:id",               verifyToken, roleController.deleteRole);

module.exports = router;