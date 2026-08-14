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

/* ========================================================================== */
/* Upload Configuration                                                       */
/* ========================================================================== */

const uploadDirectory = path.join(__dirname, "..", "uploads", "test-data");

if (!fs.existsSync(uploadDirectory)) {
  fs.mkdirSync(uploadDirectory, {
    recursive: true,
  });
}

/**
 * Example:
 * 20260814-181000
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
 * Example:
 *
 * Login Test Users (Final).csv
 *
 * becomes:
 *
 * Login_Test_Users_Final.csv
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
  destination: (_req, _file, callback) => {
    callback(null, uploadDirectory);
  },

  filename: (_req, file, callback) => {
    const cleanFileName = sanitizeFileName(file.originalname);

    const storedFileName = `${createTimestamp()}-${cleanFileName}`;

    callback(null, storedFileName);
  },
});

const upload = multer({
  storage,

  limits: {
    fileSize: 10 * 1024 * 1024,
  },

  fileFilter: (_req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();

    const allowedExtensions = [".csv", ".xlsx", ".json"];

    if (!allowedExtensions.includes(extension)) {
      return callback(
        new Error("Only CSV, XLSX and JSON files are supported."),
      );
    }

    callback(null, true);
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

/* ========================================================================== */
/* Controller Validation                                                      */
/* ========================================================================== */

/**
 * Gives a useful startup error instead of:
 *
 * TypeError: argument handler must be a function
 */
const requiredDataControllerMethods = [
  "getSavedDataSources",
  "getSavedDataSource",
  "uploadTestData",

  "getMappingSets",
  "getMappingSet",
  "createMappingSet",
  "updateMappingSet",
  "deleteMappingSet",

  "runParameterizedTest",
];

for (const methodName of requiredDataControllerMethods) {
  if (typeof dataTestingController[methodName] !== "function") {
    throw new Error(
      `[advancedTestingRoutes] dataTestingController.${methodName} is missing or is not a function.`,
    );
  }
}

/* ========================================================================== */
/* Data-Driven Testing                                                        */
/* ========================================================================== */

/* -------------------------------------------------------------------------- */
/* Saved Test Data                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Get all saved data sources belonging to a test case.
 *
 * GET
 * /api/advanced/data-drive/sources/:testCaseId
 */
router.get(
  "/data-drive/sources/:testCaseId",

  verifyToken,

  checkPermission(MENU, "can_view"),

  dataTestingController.getSavedDataSources,
);

/**
 * Get one saved data source and its preview/data rows.
 *
 * GET
 * /api/advanced/data-drive/source/:sourceId
 */
router.get(
  "/data-drive/source/:sourceId",

  verifyToken,

  checkPermission(MENU, "can_view"),

  dataTestingController.getSavedDataSource,
);

/* -------------------------------------------------------------------------- */
/* Upload Test Data                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Upload CSV, XLSX or JSON data.
 *
 * POST
 * /api/advanced/data-drive/upload
 */
router.post(
  "/data-drive/upload",

  verifyToken,

  checkPermission(MENU, "can_create"),

  handleTestDataUpload,

  dataTestingController.uploadTestData,
);

/* ========================================================================== */
/* Parameter Mapping Sets                                                     */
/* ========================================================================== */

/**
 * Get all mapping sets belonging to a test case.
 *
 * Example:
 *
 * Login Data Mapping
 * Admin Login Mapping
 * Invalid Login Mapping
 *
 * GET
 * /api/advanced/data-drive/mapping-sets/:testCaseId
 */
router.get(
  "/data-drive/mapping-sets/:testCaseId",

  verifyToken,

  checkPermission(MENU, "can_view"),

  dataTestingController.getMappingSets,
);

/**
 * Load one mapping set together with all child rows.
 *
 * Example:
 *
 * Login Data Mapping
 *
 * {{username}} -> username
 * {{password}} -> password
 *
 * GET
 * /api/advanced/data-drive/mapping-set/:mappingSetId
 */
router.get(
  "/data-drive/mapping-set/:mappingSetId",

  verifyToken,

  checkPermission(MENU, "can_view"),

  dataTestingController.getMappingSet,
);

/**
 * Create a new mapping set.
 *
 * POST
 * /api/advanced/data-drive/mapping-set
 *
 * Body:
 *
 * {
 *   "testCaseId": 123,
 *   "name": "Login Data Mapping",
 *   "description": "Login credentials",
 *   "rows": [
 *     {
 *       "placeholder": "{{username}}",
 *       "dataColumn": "username",
 *       "transformation": "None"
 *     },
 *     {
 *       "placeholder": "{{password}}",
 *       "dataColumn": "password",
 *       "transformation": "None"
 *     }
 *   ]
 * }
 */
router.post(
  "/data-drive/mapping-set",

  verifyToken,

  checkPermission(MENU, "can_create"),

  dataTestingController.createMappingSet,
);

/**
 * Update an existing mapping set and its rows.
 *
 * PUT
 * /api/advanced/data-drive/mapping-set/:mappingSetId
 */
router.put(
  "/data-drive/mapping-set/:mappingSetId",

  verifyToken,

  checkPermission(MENU, "can_edit"),

  dataTestingController.updateMappingSet,
);

/**
 * Delete a mapping set and its child rows.
 *
 * DELETE
 * /api/advanced/data-drive/mapping-set/:mappingSetId
 */
router.delete(
  "/data-drive/mapping-set/:mappingSetId",

  verifyToken,

  checkPermission(MENU, "can_delete"),

  dataTestingController.deleteMappingSet,
);

/* ========================================================================== */
/* Parameterized Execution                                                    */
/* ========================================================================== */

/**
 * Run selected test-data source using selected mapping set.
 *
 * POST
 * /api/advanced/data-drive/run-parameterized
 *
 * Body:
 *
 * {
 *   "testCaseId": 123,
 *   "dataSourceId": 15,
 *   "mappingSetId": 7,
 *   "continueOnFailure": false
 * }
 */
router.post(
  "/data-drive/run-parameterized",

  verifyToken,

  checkPermission(MENU, "can_edit"),

  dataTestingController.runParameterizedTest,
);

/* ========================================================================== */
/* API Testing                                                                */
/* ========================================================================== */

/**
 * Create API endpoint.
 */
router.post(
  "/api-testing/endpoints",

  verifyToken,

  checkPermission(MENU, "can_create"),

  apiTestingController.createEndpoint,
);

/**
 * List API endpoints.
 */
router.get(
  "/api-testing/endpoints",

  verifyToken,

  checkPermission(MENU, "can_view"),

  apiTestingController.listEndpoints,
);

/**
 * Execute API request.
 */
router.post(
  "/api-testing/execute",

  verifyToken,

  checkPermission(MENU, "can_edit"),

  apiTestingController.executeAPI,
);

/**
 * Execute chained API requests.
 */
router.post(
  "/api-testing/chains/execute",

  verifyToken,

  checkPermission(MENU, "can_edit"),

  apiTestingController.executeChain,
);

/* ========================================================================== */
/* Keywords                                                                   */
/* ========================================================================== */

/**
 * Get available automation keywords.
 */
router.get(
  "/keywords/available",

  verifyToken,

  checkPermission(MENU, "can_view"),

  keywordController.getAvailableKeywords,
);

/**
 * Convert keyword script into Playwright.
 */
router.post(
  "/keywords/convert-to-playwright",

  verifyToken,

  checkPermission(MENU, "can_view"),

  keywordController.convertToPlaywright,
);

/**
 * Execute keyword script.
 */
router.post(
  "/keywords/execute",

  verifyToken,

  checkPermission(MENU, "can_edit"),

  keywordController.executeKeywordScript,
);

/* ========================================================================== */
/* Variables                                                                  */
/* ========================================================================== */

/**
 * Get available variables.
 */
router.get(
  "/variables/available",

  verifyToken,

  checkPermission(MENU, "can_view"),

  variableController.getAvailableVariables,
);

/**
 * Set runtime variable.
 */
router.post(
  "/variables/set",

  verifyToken,

  checkPermission(MENU, "can_edit"),

  variableController.setVariable,
);

/**
 * Evaluate variable expression.
 */
router.post(
  "/variables/evaluate",

  verifyToken,

  checkPermission(MENU, "can_view"),

  variableController.evaluateExpression,
);

/* ========================================================================== */
/* Conditional Testing                                                        */
/* ========================================================================== */

/**
 * Validate conditional blocks.
 */
router.post(
  "/conditional/validate",

  verifyToken,

  checkPermission(MENU, "can_view"),

  conditionalController.validateBlocks,
);

/**
 * Save conditional blocks.
 */
router.post(
  "/conditional/save",

  verifyToken,

  checkPermission(MENU, "can_edit"),

  conditionalController.saveBlocks,
);

/* ========================================================================== */
/* AI                                                                         */
/* ========================================================================== */

/**
 * Generate test suggestions.
 */
router.post(
  "/ai/suggestions",

  verifyToken,

  checkPermission(MENU, "can_view"),

  aiController.generateSuggestions,
);

/**
 * Detect duplicate test cases.
 */
router.post(
  "/ai/detect-duplicates",

  verifyToken,

  checkPermission(MENU, "can_view"),

  aiController.detectDuplicates,
);

/**
 * Recommend reusable components.
 */
router.post(
  "/ai/recommend-components",

  verifyToken,

  checkPermission(MENU, "can_view"),

  aiController.recommendComponents,
);

/**
 * Generate page object.
 */
router.post(
  "/ai/generate-page-object",

  verifyToken,

  checkPermission(MENU, "can_view"),

  aiController.generatePageObject,
);

/**
 * Suggest stable locators.
 */
router.post(
  "/ai/suggest-stable-locators",

  verifyToken,

  checkPermission(MENU, "can_view"),

  aiController.suggestStableLocators,
);

/* ========================================================================== */
/* Maintenance                                                                */
/* ========================================================================== */

/**
 * Save script version.
 */
router.post(
  "/maintenance/version",

  verifyToken,

  checkPermission(MENU, "can_edit"),

  maintenanceController.versionScript,
);

/**
 * Generate maintenance report.
 */
router.get(
  "/maintenance/report",

  verifyToken,

  checkPermission(MENU, "can_view"),

  maintenanceController.generateReport,
);

/**
 * Export test case.
 */
router.get(
  "/maintenance/export",

  verifyToken,

  checkPermission(MENU, "can_view"),

  maintenanceController.exportTestCase,
);

/**
 * Get version history.
 */
router.get(
  "/maintenance/versions",

  verifyToken,

  checkPermission(MENU, "can_view"),

  maintenanceController.getVersionHistory,
);

/**
 * Get locator history.
 */
router.get(
  "/maintenance/locators",

  verifyToken,

  checkPermission(MENU, "can_view"),

  maintenanceController.getLocatorHistory,
);

/**
 * Generate alternative locators.
 */
router.post(
  "/locators/generate-alternatives",

  verifyToken,

  checkPermission(MENU, "can_view"),

  maintenanceController.generateAlternatives,
);

module.exports = router;
