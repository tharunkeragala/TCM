const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/auth");
const userController = require("../controllers/userController");

// ✅ GET all users
router.get("/", verifyToken, userController.getUsers);

// ✅ CREATE manual user
router.post("/create", verifyToken, userController.createUser);

// ✅ ADD AD user
router.post("/ad-user", verifyToken, userController.addADUser);

// ✅ UPDATE user (role, department, is_active, optional password)
router.put("/update/:id", verifyToken, userController.updateUser);

// ✅ DELETE user
router.delete("/delete/:id", verifyToken, userController.deleteUser);

// ✅ TOGGLE active status
router.put("/toggle/:id", verifyToken, userController.toggleUser);

module.exports = router;