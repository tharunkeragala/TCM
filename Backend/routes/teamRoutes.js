const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/auth");
const teamController = require("../controllers/teamController");

//
// ✅ GET ALL TEAMS
//
router.get("/", verifyToken, teamController.getTeams);

//
// ✅ CREATE TEAM
//
router.post("/create", verifyToken, teamController.createTeam);

//
// ✅ UPDATE TEAM
//
router.put("/update/:id", verifyToken, teamController.updateTeam);

//
// ✅ DELETE TEAM
//
router.delete("/delete/:id", verifyToken, teamController.deleteTeam);

//
// ✅ TOGGLE TEAM STATUS
//
router.put("/toggle/:id", verifyToken, teamController.toggleTeam);

//
// ✅ GET TEAMS BY DEPARTMENT
//
router.get(
  "/department/:department_id",
  verifyToken,
  teamController.getTeamsByDepartment
);

//
// ─── Assigned User Count (for delete warning) ───────────────────────────────
// IMPORTANT: Keep this LAST to avoid route conflicts
//
router.get(
  "/:id/assigned-users",
  verifyToken,
  teamController.getAssignedUserCount
);

module.exports = router;