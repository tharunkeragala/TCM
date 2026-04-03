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

module.exports = router;