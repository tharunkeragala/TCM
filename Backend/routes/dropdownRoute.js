const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/auth");
const dropdownController = require("../controllers/dropdownController");

router.get("/roles",                        verifyToken, dropdownController.getRolesDropdown);
router.get("/departments",                  verifyToken, dropdownController.getDepartmentsDropdown);
router.get("/teams",                        verifyToken, dropdownController.getTeamsDropdown);
router.get("/teams/department/:id",         verifyToken, dropdownController.getTeamsByDepartment);

module.exports = router;