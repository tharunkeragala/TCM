/**
 * advancedTestingRoutes.js
 * Place at: server/routes/advancedTestingRoutes.js
 *
 * Mount this alongside your existing playwrightRoutes.js in app.js / server.js, e.g.:
 *
 *   const advancedTestingRoutes = require('./routes/advancedTestingRoutes');
 *   app.use('/api/advanced', advancedTestingRoutes);
 *
 * Adjust the `verifyToken` / `checkPermission` require paths below to match
 * your existing middleware locations (same ones used in playwrightRoutes.js).
 */

const express = require("express");
const multer = require("multer"); // npm install multer --save
const router = express.Router();

const { verifyToken } = require("../middleware/auth");
const checkPermission = require("../middleware/checkPermission");

const dataTestingController = require("../controllers/dataTestingController");
const apiTestingController = require("../controllers/apiTestingController");
const keywordController = require("../controllers/keywordController");
const variableController = require("../controllers/variableController");
const conditionalController = require("../controllers/conditionalController");
const aiController = require("../controllers/aiController");
const maintenanceController = require("../controllers/maintenanceController");

const upload = multer({ dest: "uploads/test-data/" });

const MENU = "/test-cases"; // same permission menu key used by playwrightRoutes.js

/* ---------------------------- Data-Driven Testing ---------------------------- */
router.post("/data-drive/upload", verifyToken, checkPermission(MENU, "can_create"), upload.single("file"), dataTestingController.uploadTestData);
router.post("/data-drive/configure", verifyToken, checkPermission(MENU, "can_create"), dataTestingController.configureParameterMappings);
router.post("/data-drive/run-parameterized", verifyToken, checkPermission(MENU, "can_edit"), dataTestingController.runParameterizedTest);
router.post("/data-drive/test-transformation", verifyToken, checkPermission(MENU, "can_view"), dataTestingController.testTransformation);
router.get("/data-drive/transformation-templates", verifyToken, checkPermission(MENU, "can_view"), dataTestingController.getTransformationTemplates);

/* ------------------------------- API Testing ---------------------------------- */
router.post("/api-testing/endpoints", verifyToken, checkPermission(MENU, "can_create"), apiTestingController.createEndpoint);
router.get("/api-testing/endpoints", verifyToken, checkPermission(MENU, "can_view"), apiTestingController.listEndpoints);
router.post("/api-testing/execute", verifyToken, checkPermission(MENU, "can_edit"), apiTestingController.executeAPI);
router.post("/api-testing/chains/execute", verifyToken, checkPermission(MENU, "can_edit"), apiTestingController.executeChain);

/* ------------------------------ Keyword Engine --------------------------------- */
router.get("/keywords/available", verifyToken, checkPermission(MENU, "can_view"), keywordController.getAvailableKeywords);
router.post("/keywords/convert-to-playwright", verifyToken, checkPermission(MENU, "can_view"), keywordController.convertToPlaywright);
router.post("/keywords/execute", verifyToken, checkPermission(MENU, "can_edit"), keywordController.executeKeywordScript);

/* ------------------------------ Variable Engine --------------------------------- */
router.get("/variables/available", verifyToken, checkPermission(MENU, "can_view"), variableController.getAvailableVariables);
router.post("/variables/set", verifyToken, checkPermission(MENU, "can_edit"), variableController.setVariable);
router.post("/variables/evaluate", verifyToken, checkPermission(MENU, "can_view"), variableController.evaluateExpression);

/* ---------------------------- Conditional Execution ------------------------------ */
router.post("/conditional/validate", verifyToken, checkPermission(MENU, "can_view"), conditionalController.validateBlocks);
router.post("/conditional/save", verifyToken, checkPermission(MENU, "can_edit"), conditionalController.saveBlocks);

/* ------------------------------------- AI ---------------------------------------- */
router.post("/ai/suggestions", verifyToken, checkPermission(MENU, "can_view"), aiController.generateSuggestions);
router.post("/ai/detect-duplicates", verifyToken, checkPermission(MENU, "can_view"), aiController.detectDuplicates);
router.post("/ai/recommend-components", verifyToken, checkPermission(MENU, "can_view"), aiController.recommendComponents);
router.post("/ai/generate-page-object", verifyToken, checkPermission(MENU, "can_view"), aiController.generatePageObject);
router.post("/ai/suggest-stable-locators", verifyToken, checkPermission(MENU, "can_view"), aiController.suggestStableLocators);

/* --------------------------------- Maintenance ------------------------------------ */
router.post("/maintenance/version", verifyToken, checkPermission(MENU, "can_edit"), maintenanceController.versionScript);
router.get("/maintenance/report", verifyToken, checkPermission(MENU, "can_view"), maintenanceController.generateReport);
router.get("/maintenance/export", verifyToken, checkPermission(MENU, "can_view"), maintenanceController.exportTestCase);
router.get("/maintenance/versions", verifyToken, checkPermission(MENU, "can_view"), maintenanceController.getVersionHistory);
router.get("/maintenance/locators", verifyToken, checkPermission(MENU, "can_view"), maintenanceController.getLocatorHistory);
router.post("/locators/generate-alternatives", verifyToken, checkPermission(MENU, "can_view"), maintenanceController.generateAlternatives);

module.exports = router;
