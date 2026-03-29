const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/auth");
const departmentController = require("../controllers/departmentController");

router.get("/",verifyToken, departmentController.getDepartments);
router.post("/create",verifyToken, departmentController.createDepartment);
// router.post("/ad-user", departmentController.addADUser);

module.exports = router;