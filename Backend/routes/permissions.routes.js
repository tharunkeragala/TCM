const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/auth");
const permissionController = require("../controllers/permissionController");

// GET /api/permissions/mine
router.get("/mine", verifyToken, permissionController.getMyPermissions);

module.exports = router;

// In your main app/server file, mount alongside your other routers:
//   const permissionsRoutes = require("./routes/permissions.routes");
//   app.use("/api/permissions", permissionsRoutes);
