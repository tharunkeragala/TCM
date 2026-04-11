const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/auth");
const checkPermission = require("../middleware/checkPermission");
const teamController = require("../controllers/teamController");

const MENU = "/teams";

// ✅ GET ALL TEAMS
router.get(
  "/",
  verifyToken,
  checkPermission(MENU, "can_view"),
  teamController.getTeams
);

// ✅ CREATE TEAM
router.post(
  "/create",
  verifyToken,
  checkPermission(MENU, "can_create"),
  teamController.createTeam
);

// ✅ UPDATE TEAM
router.put(
  "/update/:id",
  verifyToken,
  checkPermission(MENU, "can_edit"),
  teamController.updateTeam
);

// ✅ DELETE TEAM
router.delete(
  "/delete/:id",
  verifyToken,
  checkPermission(MENU, "can_delete"),
  teamController.deleteTeam
);

// ✅ TOGGLE TEAM STATUS
router.put(
  "/toggle/:id",
  verifyToken,
  checkPermission(MENU, "can_edit"),
  teamController.toggleTeam
);

// ✅ ASSIGNED USER COUNT
// NOTE: Keep after named routes to avoid :id capturing them
router.get(
  "/:id/assigned-users",
  verifyToken,
  checkPermission(MENU, "can_view"),
  teamController.getAssignedUserCount
);

module.exports = router;