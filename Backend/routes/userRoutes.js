const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");

router.get("/", userController.getUsers);
router.post("/create", userController.createUser);
router.post("/ad-user", userController.addADUser);

module.exports = router;