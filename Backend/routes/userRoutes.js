const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/auth");
const userController = require("../controllers/userController");

router.get("/",verifyToken, userController.getUsers);
router.post("/create",verifyToken, userController.createUser);
router.post("/ad-user",verifyToken, userController.addADUser);

module.exports = router;