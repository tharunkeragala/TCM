const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const router = express.Router();

const { verifyToken } = require("../middleware/auth");
const checkPermission = require("../middleware/checkPermission");

const dataTestingController = require("../controllers/dataTestingController");

const MENU = "/test-data-sources";

/* ========================================================================== */
/* UPLOAD CONFIGURATION                                                       */
/* ========================================================================== */

const uploadDirectory = path.join(__dirname, "../uploads/test-data");

if (!fs.existsSync(uploadDirectory)) {
  fs.mkdirSync(uploadDirectory, {
    recursive: true,
  });
}

/*
 * User-visible name remains file.originalname.
 * System storage uses a unique internal filename.
 *
 * Example:
 *   User sees: CustomerData.xlsx
 *   System stores: DATA-<timestamp>-<random>.xlsx
 */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDirectory);
  },

  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();

    const uniqueId = crypto.randomBytes(8).toString("hex");

    const storedFileName = `DATA-${Date.now()}-${uniqueId}${extension}`;

    cb(null, storedFileName);
  },
});

const fileFilter = (req, file, cb) => {
  const extension = path.extname(file.originalname).toLowerCase();

  const allowedExtensions = [".csv", ".xlsx", ".json"];

  if (!allowedExtensions.includes(extension)) {
    return cb(new Error("Only CSV, XLSX and JSON files are allowed."));
  }

  cb(null, true);
};

const upload = multer({
  storage,

  fileFilter,

  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

/* ========================================================================== */
/* DATASET MASTER                                                             */
/* ========================================================================== */

router.get(
  "/data-drive/sources",

  verifyToken,

  checkPermission(MENU, "can_view"),

  dataTestingController.getAllSavedDataSources,
);

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

router.post(
  "/data-drive/upload",

  verifyToken,

  checkPermission(MENU, "can_create"),

  upload.single("file"),

  dataTestingController.uploadTestData,
);

router.delete(
  "/data-drive/source/:sourceId",

  verifyToken,

  checkPermission(MENU, "can_delete"),

  dataTestingController.deleteSavedDataSource,
);

/* ========================================================================== */
/* PARAMETER MAPPING SETS                                                     */
/* ========================================================================== */

router.get(
  "/mapping-sets/:testCaseId",

  verifyToken,

  checkPermission(MENU, "can_view"),

  dataTestingController.getMappingSets,
);

router.get(
  "/mapping-set/:mappingSetId",

  verifyToken,

  checkPermission(MENU, "can_view"),

  dataTestingController.getMappingSet,
);

router.post(
  "/mapping-set",

  verifyToken,

  checkPermission(MENU, "can_create"),

  dataTestingController.createMappingSet,
);

router.put(
  "/mapping-set/:mappingSetId",

  verifyToken,

  checkPermission(MENU, "can_edit"),

  dataTestingController.updateMappingSet,
);

router.delete(
  "/mapping-set/:mappingSetId",

  verifyToken,

  checkPermission(MENU, "can_delete"),

  dataTestingController.deleteMappingSet,
);

/* ========================================================================== */
/* PARAMETERIZED EXECUTION                                                    */
/* ========================================================================== */

router.post(
  "/data-drive/run-parameterized",

  verifyToken,

  checkPermission(MENU, "can_view"),

  dataTestingController.runParameterizedTest,
);

/* ========================================================================== */
/* MULTER ERROR HANDLER                                                       */
/* ========================================================================== */

router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,

        error: "Dataset file is too large. Maximum file size is 10 MB.",
      });
    }

    return res.status(400).json({
      success: false,

      error: error.message || "Dataset upload failed.",
    });
  }

  if (error) {
    return res.status(400).json({
      success: false,

      error: error.message || "Dataset upload failed.",
    });
  }

  next();
});

module.exports = router;
