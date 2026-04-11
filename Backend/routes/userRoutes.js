// const express = require("express");
// const router = express.Router();
// const { verifyToken } = require("../middleware/auth");
// const checkPermission = require("../middleware/checkPermission");
// const userController = require("../controllers/userController");

// const MENU = "/users";

// router.get(
//   "/",
//   verifyToken,
//   checkPermission(MENU, "can_view"),
//   userController.getUsers
// );
// router.post(
//   "/create",
//   verifyToken,
//   checkPermission(MENU, "can_create"),
//   userController.createUser
// );
// router.post(
//   "/add-ad",
//   verifyToken,
//   checkPermission(MENU, "can_create"),
//   userController.addADUser
// );
// router.put(
//   "/:id",
//   verifyToken,
//   checkPermission(MENU, "can_edit"),
//   userController.updateUser
// );
// router.delete(
//   "/:id",
//   verifyToken,
//   checkPermission(MENU, "can_delete"),
//   userController.deleteUser
// );
// router.patch(
//   "/:id/toggle",
//   verifyToken,
//   checkPermission(MENU, "can_edit"),
//   userController.toggleUser
// );

// module.exports = router;


const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/auth");
const checkPermission = require("../middleware/checkPermission");
const userController = require("../controllers/userController");

const MENU = "/users";

router.get(
  "/",
  verifyToken,
  checkPermission(MENU, "can_view"),
  userController.getUsers
);
router.post(
  "/create",
  verifyToken,
  checkPermission(MENU, "can_create"),
  userController.createUser
);
router.post(
  "/ad-user",
  verifyToken,
  checkPermission(MENU, "can_create"),
  userController.addADUser
);
router.put(
  "/update/:id",
  verifyToken,
  checkPermission(MENU, "can_edit"),
  userController.updateUser
);
router.delete(
  "/delete/:id",
  verifyToken,
  checkPermission(MENU, "can_delete"),
  userController.deleteUser
);
router.put(
  "/toggle/:id",
  verifyToken,
  checkPermission(MENU, "can_edit"),
  userController.toggleUser
);

module.exports = router;