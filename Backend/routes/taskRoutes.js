const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/auth");
const checkPermission = require("../middleware/checkPermission");
const taskController = require("../controllers/taskController");

const MENU = "/tasks";

router.get(
  "/",
  verifyToken,
  checkPermission(MENU, "can_view"),
  taskController.getTasks
);
router.get(
  "/notifications",
  verifyToken,
  taskController.getNotifications
);
router.get(
  "/:id",
  verifyToken,
  checkPermission(MENU, "can_view"),
  taskController.getTaskById
);
router.post(
  "/create",
  verifyToken,
  checkPermission(MENU, "can_create"),
  taskController.createTask
);
router.put(
  "/update/:id",
  verifyToken,
  checkPermission(MENU, "can_edit"),
  taskController.updateTask
);
router.put(
  "/status/:id",
  verifyToken,
  checkPermission(MENU, "can_edit"),
  taskController.updateTaskStatus
);
router.put(
  "/eta/:id",
  verifyToken,
  checkPermission(MENU, "can_edit"),
  taskController.extendETA
);
router.post(
  "/:id/progress",
  verifyToken,
  checkPermission(MENU, "can_edit"),
  taskController.addProgress
);
router.post(
  "/:id/comments",
  verifyToken,
  checkPermission(MENU, "can_view"),
  taskController.addComment
);
router.delete(
  "/comments/:commentId",
  verifyToken,
  checkPermission(MENU, "can_delete"),
  taskController.deleteComment
);
router.post(
  "/:id/reminders",
  verifyToken,
  taskController.setReminder);
  
router.get(
  "/:id/latestreminders",
  verifyToken,
  taskController.getLatestReminder,
);

router.put(
  "/notifications/read",
  verifyToken,
  taskController.markNotificationsRead
);
router.delete(
  "/delete/:id",
  verifyToken,
  checkPermission(MENU, "can_delete"),
  taskController.deleteTask
);

module.exports = router;