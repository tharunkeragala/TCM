const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/auth");
const notificationController = require("../controllers/notificationController");

router.get("/", verifyToken, notificationController.getUserNotifications);
router.put("/:id/read", verifyToken, notificationController.markNotificationRead);
router.put("/read-all", verifyToken, notificationController.markAllNotificationsRead);

module.exports = router;