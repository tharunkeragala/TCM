const express = require("express");
const router = express.Router();
const departmentController = require("../controllers/departmentController");

router.get("/", departmentController.getDepartments);
// router.post("/create", departmentController.createDepartment);
// router.post("/ad-user", departmentController.addADUser);

module.exports = router;