const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/auth");
const checkPermission = require("../middleware/checkPermission");
const projectController = require("../controllers/projectController");
const upload = require("../middleware/upload");
const documentController = require("../controllers/documentController");
const projectOverviewController = require("../controllers/projectOverviewController");
  const projectNotesController = require("../controllers/projectNotesController");
  const projectDiagramController = require("../controllers/projectDiagramController");

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

  router.get(
    "/:id/overview",
    verifyToken,
    checkPermission(MENU, "can_view"),
    projectOverviewController.getProjectOverview,
  );



router.get("/:id/notes", verifyToken, checkPermission(MENU, "can_view"), projectNotesController.getProjectNotes);
router.post("/:id/notes", verifyToken, checkPermission(MENU, "can_edit"), projectNotesController.createProjectNote);
router.delete("/notes/:noteId", verifyToken, checkPermission(MENU, "can_edit"), projectNotesController.deleteProjectNote);

// ── Flow diagrams ────────────────────────────────────────────────────────
// One diagram (draft) per project + an explicit, immutable version history.
router.get("/:id/diagram", verifyToken, checkPermission(MENU, "can_view"), projectDiagramController.getDiagram);
router.put("/:id/diagram", verifyToken, checkPermission(MENU, "can_edit"), projectDiagramController.saveDraft);
router.get("/:id/diagram/versions", verifyToken, checkPermission(MENU, "can_view"), projectDiagramController.listVersions);
router.post("/:id/diagram/versions", verifyToken, checkPermission(MENU, "can_edit"), projectDiagramController.createVersion);

// Note: these two are keyed by version id, not project id, so they sit
// outside the "/:id/..." project-scoped block above (same pattern as the
// existing "/documents/:docId" routes).
router.get("/diagram-versions/:versionId", verifyToken, checkPermission(MENU, "can_view"), projectDiagramController.getVersion);
router.post("/diagram-versions/:versionId/restore", verifyToken, checkPermission(MENU, "can_edit"), projectDiagramController.restoreVersion);
router.delete("/diagram-versions/:versionId", verifyToken, checkPermission(MENU, "can_delete"), projectDiagramController.deleteVersion);

module.exports = router;