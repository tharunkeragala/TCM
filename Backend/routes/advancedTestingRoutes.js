const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

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

const MENU = "/test-cases";

const uploadDirectory = path.join(__dirname, "..", "uploads", "test-data");

if (!fs.existsSync(uploadDirectory)) {
  fs.mkdirSync(uploadDirectory, {
    recursive: true,
  });
}

/**
 * Convert date into:
 * 20260811-161015
 */
const createTimestamp = () => {
  const now = new Date();

  const pad = (value) => String(value).padStart(2, "0");

  return (
    [now.getFullYear(), pad(now.getMonth() + 1), pad(now.getDate())].join("") +
    "-" +
    [pad(now.getHours()), pad(now.getMinutes()), pad(now.getSeconds())].join("")
  );
};

/**
 * Convert:"Login Test Users (Final).csv" into: "Login_Test_Users_Final.csv"
 */
const sanitizeFileName = (originalName) => {
  const extension = path.extname(originalName).toLowerCase();

  const baseName = path
    .basename(originalName, extension)
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

  return `${baseName || "test_data"}${extension}`;
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDirectory);
  },

  filename: (_req, file, cb) => {
    const cleanFileName = sanitizeFileName(file.originalname);

    const storedFileName = `${createTimestamp()}-${cleanFileName}`;

    cb(null, storedFileName);
  },
});

const upload = multer({
  storage,

  limits: {
    fileSize: 10 * 1024 * 1024,
  },

  fileFilter: (_req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();

    const allowedExtensions = [".csv", ".xlsx", ".json"];

    if (!allowedExtensions.includes(extension)) {
      return cb(new Error("Only CSV, XLSX and JSON files are supported."));
    }

    cb(null, true);
  },
});

const handleTestDataUpload = (req, res, next) => {
  upload.single("file")(req, res, (error) => {
    if (!error) {
      return next();
    }

    if (error instanceof multer.MulterError) {
      if (error.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          success: false,
          error: "Maximum upload size is 10 MB.",
        });
      }

      return res.status(400).json({
        success: false,
        error: error.message,
      });
    }

    return res.status(400).json({
      success: false,
      error: error.message || "Upload failed.",
    });
  });
};
/* -------------------------------------------------------------------------- */
/* Data Driven                                                                 */
/* -------------------------------------------------------------------------- */

router.get(
  "/data-drive/sources/:testCaseId",
  verifyToken,
  checkPermission(MENU, "can_view"),
  dataTestingController.getSavedDataSources,
);

router.get(
  "/data-drive/source/:sourceId",
  verifyToken,
  checkPermission(MENU, "can_view"),
  dataTestingController.getSavedDataSource,
);

/*
 * Load previously saved parameter mappings
 * for the selected test case.
 */
router.get(
  "/data-drive/mappings/:testCaseId",
  verifyToken,
  checkPermission(MENU, "can_view"),
  dataTestingController.getParameterMappings,
);

router.post(
  "/data-drive/upload",
  verifyToken,
  checkPermission(MENU, "can_create"),
  handleTestDataUpload,
  dataTestingController.uploadTestData,
);

router.post(
  "/data-drive/configure",
  verifyToken,
  checkPermission(MENU, "can_create"),
  dataTestingController.configureParameterMappings,
);

router.post(
  "/data-drive/run-parameterized",
  verifyToken,
  checkPermission(MENU, "can_edit"),
  dataTestingController.runParameterizedTest,
);

router.post(
  "/data-drive/test-transformation",
  verifyToken,
  checkPermission(MENU, "can_view"),
  dataTestingController.testTransformation,
);

router.get(
  "/data-drive/transformation-templates",
  verifyToken,
  checkPermission(MENU, "can_view"),
  dataTestingController.getTransformationTemplates,
);

/* -------------------------------------------------------------------------- */
/* API Testing                                                                 */
/* -------------------------------------------------------------------------- */

router.post(
  "/api-testing/endpoints",
  verifyToken,
  checkPermission(MENU, "can_create"),
  apiTestingController.createEndpoint,
);

router.get(
  "/api-testing/endpoints",
  verifyToken,
  checkPermission(MENU, "can_view"),
  apiTestingController.listEndpoints,
);

router.post(
  "/api-testing/execute",
  verifyToken,
  checkPermission(MENU, "can_edit"),
  apiTestingController.executeAPI,
);

router.post(
  "/api-testing/chains/execute",
  verifyToken,
  checkPermission(MENU, "can_edit"),
  apiTestingController.executeChain,
);

/* -------------------------------------------------------------------------- */
/* Keywords                                                                    */
/* -------------------------------------------------------------------------- */

router.get(
  "/keywords/available",
  verifyToken,
  checkPermission(MENU, "can_view"),
  keywordController.getAvailableKeywords,
);

router.post(
  "/keywords/convert-to-playwright",
  verifyToken,
  checkPermission(MENU, "can_view"),
  keywordController.convertToPlaywright,
);

router.post(
  "/keywords/execute",
  verifyToken,
  checkPermission(MENU, "can_edit"),
  keywordController.executeKeywordScript,
);

/* -------------------------------------------------------------------------- */
/* Variables                                                                   */
/* -------------------------------------------------------------------------- */

router.get(
  "/variables/available",
  verifyToken,
  checkPermission(MENU, "can_view"),
  variableController.getAvailableVariables,
);

router.post(
  "/variables/set",
  verifyToken,
  checkPermission(MENU, "can_edit"),
  variableController.setVariable,
);

router.post(
  "/variables/evaluate",
  verifyToken,
  checkPermission(MENU, "can_view"),
  variableController.evaluateExpression,
);

/* -------------------------------------------------------------------------- */
/* Conditional                                                                 */
/* -------------------------------------------------------------------------- */

router.post(
  "/conditional/validate",
  verifyToken,
  checkPermission(MENU, "can_view"),
  conditionalController.validateBlocks,
);

router.post(
  "/conditional/save",
  verifyToken,
  checkPermission(MENU, "can_edit"),
  conditionalController.saveBlocks,
);

/* -------------------------------------------------------------------------- */
/* AI                                                                          */
/* -------------------------------------------------------------------------- */

router.post(
  "/ai/suggestions",
  verifyToken,
  checkPermission(MENU, "can_view"),
  aiController.generateSuggestions,
);

router.post(
  "/ai/detect-duplicates",
  verifyToken,
  checkPermission(MENU, "can_view"),
  aiController.detectDuplicates,
);

router.post(
  "/ai/recommend-components",
  verifyToken,
  checkPermission(MENU, "can_view"),
  aiController.recommendComponents,
);

router.post(
  "/ai/generate-page-object",
  verifyToken,
  checkPermission(MENU, "can_view"),
  aiController.generatePageObject,
);

router.post(
  "/ai/suggest-stable-locators",
  verifyToken,
  checkPermission(MENU, "can_view"),
  aiController.suggestStableLocators,
);

/* -------------------------------------------------------------------------- */
/* Maintenance                                                                 */
/* -------------------------------------------------------------------------- */

router.post(
  "/maintenance/version",
  verifyToken,
  checkPermission(MENU, "can_edit"),
  maintenanceController.versionScript,
);

router.get(
  "/maintenance/report",
  verifyToken,
  checkPermission(MENU, "can_view"),
  maintenanceController.generateReport,
);

router.get(
  "/maintenance/export",
  verifyToken,
  checkPermission(MENU, "can_view"),
  maintenanceController.exportTestCase,
);

router.get(
  "/maintenance/versions",
  verifyToken,
  checkPermission(MENU, "can_view"),
  maintenanceController.getVersionHistory,
);

router.get(
  "/maintenance/locators",
  verifyToken,
  checkPermission(MENU, "can_view"),
  maintenanceController.getLocatorHistory,
);

router.post(
  "/locators/generate-alternatives",
  verifyToken,
  checkPermission(MENU, "can_view"),
  maintenanceController.generateAlternatives,
);

module.exports = router;
