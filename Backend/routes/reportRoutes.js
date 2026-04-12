const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/auth");
const reportController = require("../controllers/reportController");


router.get("/users/list",                   verifyToken, reportController.getUsersList);

module.exports = router;