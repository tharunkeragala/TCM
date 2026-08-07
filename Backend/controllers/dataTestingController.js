/**
 * dataTestingController.js
 * Place at: server/controllers/dataTestingController.js
 *
 * Endpoints for:
 * - uploading test data
 * - configuring parameter mappings
 * - executing data-driven tests
 * - testing data transformations
 */

const sql = require("mssql");
const path = require("path");
const fs = require("fs");

const { poolPromise } = require("../config/db");

const dataEngineService = require("../services/dataEngineService");
const dataTransformationEngine = require(
  "../services/dataTransformationEngine",
);

const {
  runEnhancedTestCase,
} = require("../services/enhancedPlaywrightRunner");

const uploadsDir = path.join(
  __dirname,
  "..",
  "uploads",
  "test-data",
);

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, {
    recursive: true,
  });
}

/* -------------------------------------------------------------------------- */
/*                              Upload test data                              */
/* -------------------------------------------------------------------------- */

exports.uploadTestData = async (req, res) => {
  try {
    const { testCaseId } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({
        success: false,
        error: "No file uploaded",
      });
    }

    if (!testCaseId) {
      return res.status(400).json({
        success: false,
        error: "testCaseId is required",
      });
    }

    const extension = path
      .extname(file.originalname)
      .replace(".", "")
      .toUpperCase();

    let dataSourceType;

    switch (extension) {
      case "CSV":
        dataSourceType = "CSV";
        break;

      case "XLSX":
        dataSourceType = "XLSX";
        break;

      case "JSON":
        dataSourceType = "JSON";
        break;

      default:
        return res.status(400).json({
          success: false,
          error: `Unsupported file type: ${extension}`,
        });
    }

    const testData =
      await dataEngineService.loadTestData(
        dataSourceType,
        file.path,
      );

    if (!Array.isArray(testData)) {
      return res.status(400).json({
        success: false,
        error:
          "Uploaded test data could not be parsed into rows.",
      });
    }

    if (testData.length === 0) {
      return res.status(400).json({
        success: false,
        error:
          "The uploaded test data file contains no rows.",
      });
    }

    const pool = await poolPromise;

    const sourceResult = await pool
      .request()
      .input(
        "testCaseId",
        sql.Int,
        Number(testCaseId),
      )
      .input(
        "sourceType",
        sql.VarChar,
        dataSourceType,
      )
      .input(
        "sourcePath",
        sql.NVarChar,
        file.path,
      )
      .query(`
        INSERT INTO dbo.test_data_sources
          (
            test_case_id,
            data_source_type,
            source_path
          )
        OUTPUT INSERTED.id
        VALUES
          (
            @testCaseId,
            @sourceType,
            @sourcePath
          )
      `);

    const sourceId =
      sourceResult.recordset[0].id;

    /*
     * Persist every uploaded data row.
     */
    for (
      let index = 0;
      index < testData.length;
      index += 1
    ) {
      await pool
        .request()
        .input(
          "sourceId",
          sql.Int,
          sourceId,
        )
        .input(
          "rowNumber",
          sql.Int,
          index + 1,
        )
        .input(
          "data",
          sql.NVarChar(sql.MAX),
          JSON.stringify(testData[index]),
        )
        .query(`
          INSERT INTO dbo.test_data_rows
            (
              data_source_id,
              row_number,
              data
            )
          VALUES
            (
              @sourceId,
              @rowNumber,
              @data
            )
        `);
    }

    const columns =
      testData.length > 0
        ? Object.keys(testData[0])
        : [];

    return res.status(200).json({
      success: true,

      data: {
        sourceId,

        /*
         * IMPORTANT:
         * Send ALL rows to the frontend.
         *
         * The frontend will restrict the visible
         * area to approximately 3 rows and use
         * a scrollbar for the rest.
         */
        preview: testData,

        rowCount: testData.length,

        columns,
      },
    });
  } catch (error) {
    console.error(
      "[dataTestingController] uploadTestData error:",
      error,
    );

    return res.status(500).json({
      success: false,
      error:
        error.message ||
        "Failed to upload test data.",
    });
  }
};

/* -------------------------------------------------------------------------- */
/*                        Configure parameter mappings                        */
/* -------------------------------------------------------------------------- */

exports.configureParameterMappings = async (
  req,
  res,
) => {
  try {
    const {
      testCaseId,
      mappings,
    } = req.body;

    if (!testCaseId) {
      return res.status(400).json({
        success: false,
        error: "testCaseId is required",
      });
    }

    if (!Array.isArray(mappings)) {
      return res.status(400).json({
        success: false,
        error: "mappings must be an array",
      });
    }

    const pool = await poolPromise;

    /*
     * Remove previous mappings so repeatedly
     * clicking Save does not create duplicates.
     */
    await pool
      .request()
      .input(
        "testCaseId",
        sql.Int,
        Number(testCaseId),
      )
      .query(`
        DELETE FROM dbo.test_parameter_mappings
        WHERE test_case_id = @testCaseId
      `);

    for (const mapping of mappings) {
      if (
        !mapping.placeholder ||
        !mapping.dataColumn
      ) {
        continue;
      }

      let transformationRules = null;

      if (
        mapping.transformation &&
        mapping.transformation !== "None"
      ) {
        transformationRules =
          typeof mapping.transformation ===
          "string"
            ? JSON.stringify({
                type:
                  mapping.transformation,
              })
            : JSON.stringify(
                mapping.transformation,
              );
      }

      await pool
        .request()
        .input(
          "testCaseId",
          sql.Int,
          Number(testCaseId),
        )
        .input(
          "paramName",
          sql.VarChar,
          mapping.placeholder,
        )
        .input(
          "varPlaceholder",
          sql.VarChar,
          mapping.placeholder,
        )
        .input(
          "columnName",
          sql.VarChar,
          mapping.dataColumn,
        )
        .input(
          "transformation",
          sql.NVarChar(sql.MAX),
          transformationRules,
        )
        .query(`
          INSERT INTO dbo.test_parameter_mappings
            (
              test_case_id,
              parameter_name,
              variable_placeholder,
              data_column_name,
              transformation_rules
            )
          VALUES
            (
              @testCaseId,
              @paramName,
              @varPlaceholder,
              @columnName,
              @transformation
            )
        `);
    }

    return res.status(200).json({
      success: true,
      data: {
        mappingsCount:
          mappings.length,
      },
    });
  } catch (error) {
    console.error(
      "[dataTestingController] configureParameterMappings error:",
      error,
    );

    return res.status(500).json({
      success: false,
      error:
        error.message ||
        "Failed to configure mappings.",
    });
  }
};

/* -------------------------------------------------------------------------- */
/*                          Run parameterized test                            */
/* -------------------------------------------------------------------------- */

exports.runParameterizedTest = async (
  req,
  res,
) => {
  try {
    const {
      testCaseId,
      dataSourceId,
      continueOnFailure,
    } = req.body;

    if (!testCaseId) {
      return res.status(400).json({
        success: false,
        error: "testCaseId is required",
      });
    }

    if (!dataSourceId) {
      return res.status(400).json({
        success: false,
        error:
          "dataSourceId is required. Upload a test data source first.",
      });
    }

    const pool = await poolPromise;

    const mappingsResult = await pool
      .request()
      .input(
        "testCaseId",
        sql.Int,
        Number(testCaseId),
      )
      .query(`
        SELECT *
        FROM dbo.test_parameter_mappings
        WHERE test_case_id = @testCaseId
        ORDER BY id ASC
      `);

    const runIds =
      await runEnhancedTestCase(
        Number(testCaseId),
        {
          dataSourceId:
            Number(dataSourceId),

          parameterMappings:
            mappingsResult.recordset,

          continueOnFailure:
            Boolean(
              continueOnFailure,
            ),

          userId:
            req.user?.id || null,
        },
      );

    return res.status(200).json({
      success: true,

      data: {
        runIds,
        totalRuns: runIds.length,
      },
    });
  } catch (error) {
    console.error(
      "[dataTestingController] runParameterizedTest error:",
      error,
    );

    return res.status(500).json({
      success: false,
      error:
        error.message ||
        "Failed to run parameterized test.",
    });
  }
};

/* -------------------------------------------------------------------------- */
/*                           Test transformation                              */
/* -------------------------------------------------------------------------- */

exports.testTransformation = async (
  req,
  res,
) => {
  try {
    const {
      data,
      transformation,
    } = req.body;

    if (
      data === undefined ||
      data === null
    ) {
      return res.status(400).json({
        success: false,
        error:
          "Transformation test data is required.",
      });
    }

    if (!transformation) {
      return res.status(400).json({
        success: false,
        error:
          "Transformation configuration is required.",
      });
    }

    const result =
      await dataTransformationEngine.transformData(
        data,
        transformation,
      );

    return res.status(200).json({
      success: true,
      data: {
        result,
      },
    });
  } catch (error) {
    console.error(
      "[dataTestingController] testTransformation error:",
      error,
    );

    return res.status(500).json({
      success: false,
      error:
        error.message ||
        "Transformation failed.",
    });
  }
};

/* -------------------------------------------------------------------------- */
/*                         Transformation templates                           */
/* -------------------------------------------------------------------------- */

exports.getTransformationTemplates = async (
  _req,
  res,
) => {
  try {
    return res.status(200).json({
      success: true,
      data:
        dataTransformationEngine.getTemplates(),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error:
        error.message ||
        "Failed to load transformation templates.",
    });
  }
};