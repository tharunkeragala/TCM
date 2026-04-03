const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/auth");
const departmentController = require("../controllers/departmentController");

router.get("/",verifyToken, departmentController.getDepartments);
router.post("/create",verifyToken, departmentController.createDepartment);
// router.post("/ad-user", departmentController.addADUser);

router.put("/update/:id", verifyToken, departmentController.updateDepartment);
router.delete("/delete/:id", verifyToken, departmentController.deleteDepartment);
router.put("/toggle/:id", verifyToken, departmentController.toggleDepartment);

// ─── Assigned User Count (for delete warning) ─────────────────────────────────
// NOTE: This must be placed AFTER the specific named routes above
// to avoid ":id" capturing "assigned-users" as a param.
router.get("/:id/assigned-users", verifyToken, departmentController.getAssignedUserCount);

module.exports = router;