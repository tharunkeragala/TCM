const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/auth");
const reportController = require("../controllers/reportController");

router.get("/users/list", verifyToken, reportController.getUsersList);
router.get("/tasks/list", verifyToken, reportController.getTasksReport);

module.exports = router;
