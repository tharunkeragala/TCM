const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/auth");
const roleController = require("../controllers/roleController");

router.get("/",verifyToken, roleController.getRoles);
// router.post("/create", roleController.createRoles);

module.exports = router;