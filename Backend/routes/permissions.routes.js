const express = require("express");

const router = express.Router();

const { verifyToken } = require("../middleware/auth");

const permissionController = require(
  "../controllers/permissionController",
);

router.get(
  "/mine",
  verifyToken,
  permissionController.getMyPermissions,
);

module.exports = router;
