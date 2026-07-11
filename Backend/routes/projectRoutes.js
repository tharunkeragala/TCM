const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/auth");
const checkPermission = require("../middleware/checkPermission");
const projectController = require("../controllers/projectController");
const upload = require("../middleware/upload");
const documentController = require("../controllers/documentController");

const MENU = "/projects";

router.get(
  "/",
  verifyToken,
  checkPermission(MENU, "can_view"),
  projectController.getProjects,
);
router.get(
  "/:id/suite-count",
  verifyToken,
  checkPermission(MENU, "can_view"),
  projectController.getProjectSuiteCount,
);
router.get(
  "/:id",
  verifyToken,
  checkPermission(MENU, "can_view"),
  projectController.getProjectById,
);
router.post(
  "/create",
  verifyToken,
  checkPermission(MENU, "can_create"),
  projectController.createProject,
);
router.put(
  "/update/:id",
  verifyToken,
  checkPermission(MENU, "can_edit"),
  projectController.updateProject,
);
router.delete(
  "/delete/:id",
  verifyToken,
  checkPermission(MENU, "can_delete"),
  projectController.deleteProject,
);
router.put(
  "/toggle/:id",
  verifyToken,
  checkPermission(MENU, "can_edit"),
  projectController.toggleProject,
);

  router.post(
    "/:id/documents",
    verifyToken,
    checkPermission(MENU, "can_edit"),
    upload.array("documents", 10),
    documentController.uploadProjectDocuments,
  );
 
  router.get(
    "/:id/documents",
    verifyToken,
    checkPermission(MENU, "can_view"),
    documentController.getProjectDocuments,
  );
 
  router.get(
    "/documents/:docId/download",
    verifyToken,
    checkPermission(MENU, "can_view"),
    documentController.downloadProjectDocument,
  );
 
  router.delete(
    "/documents/:docId",
    verifyToken,
    checkPermission(MENU, "can_delete"),
    documentController.deleteProjectDocument,
  );
 
  // New: restore an archived document before the retention job purges it
  router.put(
    "/documents/:docId/restore",
    verifyToken,
    checkPermission(MENU, "can_edit"),
    documentController.restoreProjectDocument,
  );

module.exports = router;
