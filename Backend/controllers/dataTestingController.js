const sql = require("mssql");
const path = require("path");
const fs = require("fs");

const { poolPromise } = require("../config/db");

const dataEngineService = require("../services/dataEngineService");
const dataTransformationEngine = require("../services/dataTransformationEngine");

const { runEnhancedTestCase } = require("../services/enhancedPlaywrightRunner");

const uploadsDir = path.join(__dirname, "..", "uploads", "test-data");

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, {
    recursive: true,
  });
}

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
        /*
         * Remove unsupported upload
         * from filesystem.
         */
        if (file.path && fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }

        return res.status(400).json({
          success: false,
          error: `Unsupported file type: ${extension}`,
        });
    }

    /*
     * Physical path.
     *
     * Used only to read the uploaded
     * document on the server.
     *
     * Example:
     * C:\project\uploads\test-data\
     * 20260811-161015-login_users.csv
     */
    const physicalFilePath = file.path;

    /*
     * Friendly/original filename.
     *
     * THIS is stored in source_path.
     *
     * Example:
     * login_users.csv
     */
    const originalFileName = path.basename(file.originalname);

    const testData = await dataEngineService.loadTestData(
      dataSourceType,
      physicalFilePath,
    );

    if (!Array.isArray(testData)) {
      return res.status(400).json({
        success: false,
        error: "Uploaded test data could not be parsed into rows.",
      });
    }

    if (testData.length === 0) {
      return res.status(400).json({
        success: false,
        error: "The uploaded test data file contains no rows.",
      });
    }

    const pool = await poolPromise;

    /*
     * Store the user-facing filename
     * instead of the filesystem path.
     */
    const sourceResult = await pool
      .request()
      .input("testCaseId", sql.Int, Number(testCaseId))
      .input("sourceType", sql.VarChar, dataSourceType)
      .input("sourcePath", sql.NVarChar, originalFileName).query(`
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

    const sourceId = sourceResult.recordset[0].id;

    /*
     * Store every parsed row.
     */
    for (let index = 0; index < testData.length; index += 1) {
      await pool
        .request()
        .input("sourceId", sql.Int, sourceId)
        .input("rowNumber", sql.Int, index + 1)
        .input("data", sql.NVarChar(sql.MAX), JSON.stringify(testData[index]))
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

    const columns = Object.keys(testData[0] || {});

    console.log("[DataDriven] Uploaded:", {
      sourceId,
      originalFileName,
      storedFileName: file.filename,
      physicalPath: physicalFilePath,
      dataSourceType,
      rows: testData.length,
    });

    return res.status(200).json({
      success: true,

      data: {
        sourceId,

        /*
         * User-friendly filename
         */
        fileName: originalFileName,

        sourceType: dataSourceType,

        preview: testData,

        rowCount: testData.length,

        columns,
      },
    });
  } catch (error) {
    console.error("[dataTestingController] uploadTestData error:", error);

    return res.status(500).json({
      success: false,
      error: error.message || "Failed to upload test data.",
    });
  }
};

exports.getParameterMappings = async (req, res) => {
  try {
    const testCaseId = Number(req.params.testCaseId);

    if (!testCaseId) {
      return res.status(400).json({
        success: false,
        error: "Valid testCaseId is required",
      });
    }

    const pool = await poolPromise;

    const result = await pool.request().input("testCaseId", sql.Int, testCaseId)
      .query(`
        SELECT
          id,
          test_case_id,
          parameter_name,
          variable_placeholder,
          data_column_name,
          transformation_rules
        FROM dbo.test_parameter_mappings
        WHERE test_case_id = @testCaseId
        ORDER BY id ASC
      `);

    const mappings = result.recordset.map((row) => {
      let transformation = "None";

      if (row.transformation_rules) {
        try {
          const parsed =
            typeof row.transformation_rules === "string"
              ? JSON.parse(row.transformation_rules)
              : row.transformation_rules;

          if (typeof parsed === "string") {
            transformation = parsed;
          } else if (parsed?.type) {
            transformation = parsed.type;
          }
        } catch (error) {
          console.warn(
            `[DataDriven] Invalid transformation_rules for mapping ${row.id}:`,
            error.message,
          );
        }
      }

      return {
        id: row.id,
        testCaseId: row.test_case_id,

        placeholder: row.variable_placeholder || row.parameter_name || "",

        dataColumn: row.data_column_name || "",

        transformation,
      };
    });

    return res.status(200).json({
      success: true,

      data: {
        testCaseId,
        mappings,
        mappingsCount: mappings.length,
      },
    });
  } catch (error) {
    console.error("[dataTestingController] getParameterMappings error:", error);

    return res.status(500).json({
      success: false,
      error: error.message || "Failed to load parameter mappings.",
    });
  }
};

exports.configureParameterMappings = async (req, res) => {
  try {
    const { testCaseId, mappings } = req.body;

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
    await pool.request().input("testCaseId", sql.Int, Number(testCaseId))
      .query(`
        DELETE FROM dbo.test_parameter_mappings
        WHERE test_case_id = @testCaseId
      `);

    for (const mapping of mappings) {
      if (!mapping.placeholder || !mapping.dataColumn) {
        continue;
      }

      let transformationRules = null;

      if (mapping.transformation && mapping.transformation !== "None") {
        transformationRules =
          typeof mapping.transformation === "string"
            ? JSON.stringify({
                type: mapping.transformation,
              })
            : JSON.stringify(mapping.transformation);
      }

      await pool
        .request()
        .input("testCaseId", sql.Int, Number(testCaseId))
        .input("paramName", sql.VarChar, mapping.placeholder)
        .input("varPlaceholder", sql.VarChar, mapping.placeholder)
        .input("columnName", sql.VarChar, mapping.dataColumn)
        .input("transformation", sql.NVarChar(sql.MAX), transformationRules)
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
        mappingsCount: mappings.length,
      },
    });
  } catch (error) {
    console.error(
      "[dataTestingController] configureParameterMappings error:",
      error,
    );

    return res.status(500).json({
      success: false,
      error: error.message || "Failed to configure mappings.",
    });
  }
};

exports.runParameterizedTest = async (req, res) => {
  try {
    const { testCaseId, dataSourceId, continueOnFailure } = req.body;

    if (!testCaseId) {
      return res.status(400).json({
        success: false,
        error: "testCaseId is required",
      });
    }

    if (!dataSourceId) {
      return res.status(400).json({
        success: false,
        error: "dataSourceId is required. Upload a test data source first.",
      });
    }

    const pool = await poolPromise;

    const mappingsResult = await pool
      .request()
      .input("testCaseId", sql.Int, Number(testCaseId)).query(`
        SELECT *
        FROM dbo.test_parameter_mappings
        WHERE test_case_id = @testCaseId
        ORDER BY id ASC
      `);

    const runIds = await runEnhancedTestCase(Number(testCaseId), {
      dataSourceId: Number(dataSourceId),

      parameterMappings: mappingsResult.recordset,

      continueOnFailure: Boolean(continueOnFailure),

      userId: req.user?.id || null,
    });

    return res.status(200).json({
      success: true,

      data: {
        runIds,
        totalRuns: runIds.length,
      },
    });
  } catch (error) {
    console.error("[dataTestingController] runParameterizedTest error:", error);

    return res.status(500).json({
      success: false,
      error: error.message || "Failed to run parameterized test.",
    });
  }
};

exports.testTransformation = async (req, res) => {
  try {
    const { data, transformation } = req.body;

    if (data === undefined || data === null) {
      return res.status(400).json({
        success: false,
        error: "Transformation test data is required.",
      });
    }

    if (!transformation) {
      return res.status(400).json({
        success: false,
        error: "Transformation configuration is required.",
      });
    }

    const result = await dataTransformationEngine.transformData(
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
    console.error("[dataTestingController] testTransformation error:", error);

    return res.status(500).json({
      success: false,
      error: error.message || "Transformation failed.",
    });
  }
};

exports.getTransformationTemplates = async (_req, res) => {
  try {
    return res.status(200).json({
      success: true,
      data: dataTransformationEngine.getTemplates(),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to load transformation templates.",
    });
  }
};

exports.getSavedDataSources = async (req, res) => {
  try {
    const testCaseId = Number(req.params.testCaseId);

    if (!testCaseId) {
      return res.status(400).json({
        success: false,
        error: "Valid testCaseId is required",
      });
    }

    const pool = await poolPromise;

    const result = await pool.request().input("testCaseId", sql.Int, testCaseId)
      .query(`
        SELECT
          s.id,
          s.test_case_id,
          s.data_source_type,
          s.source_path,
          (
            SELECT COUNT(*)
            FROM dbo.test_data_rows r
            WHERE r.data_source_id = s.id
          ) AS row_count
        FROM dbo.test_data_sources s
        WHERE s.test_case_id = @testCaseId
        ORDER BY s.id DESC
      `);

    return res.status(200).json({
      success: true,
      data: {
        sources: result.recordset.map((source) => ({
          id: source.id,
          testCaseId: source.test_case_id,
          sourceType: source.data_source_type,
          fileName: source.source_path
            ? path.basename(source.source_path)
            : `Source #${source.id}`,
          rowCount: Number(source.row_count || 0),
        })),
      },
    });
  } catch (error) {
    console.error("[dataTestingController] getSavedDataSources error:", error);

    return res.status(500).json({
      success: false,
      error: error.message || "Failed to load saved test data sources.",
    });
  }
};

exports.getSavedDataSource = async (req, res) => {
  try {
    const sourceId = Number(req.params.sourceId);

    if (!sourceId) {
      return res.status(400).json({
        success: false,
        error: "Valid sourceId is required",
      });
    }

    const pool = await poolPromise;

    const sourceResult = await pool
      .request()
      .input("sourceId", sql.Int, sourceId).query(`
        SELECT
          id,
          test_case_id,
          data_source_type,
          source_path
        FROM dbo.test_data_sources
        WHERE id = @sourceId
      `);

    if (sourceResult.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Saved data source was not found",
      });
    }

    const source = sourceResult.recordset[0];

    const rowsResult = await pool.request().input("sourceId", sql.Int, sourceId)
      .query(`
        SELECT
          row_number,
          data
        FROM dbo.test_data_rows
        WHERE data_source_id = @sourceId
        ORDER BY row_number ASC
      `);

    const rows = [];

    for (const row of rowsResult.recordset) {
      try {
        rows.push(
          typeof row.data === "string" ? JSON.parse(row.data) : row.data,
        );
      } catch (error) {
        console.warn(
          `Invalid JSON in data source ${sourceId}, row ${row.row_number}`,
        );
      }
    }

    return res.status(200).json({
      success: true,

      data: {
        sourceId: source.id,
        testCaseId: source.test_case_id,
        sourceType: source.data_source_type,

        fileName: source.source_path
          ? path.basename(source.source_path)
          : `Source #${source.id}`,

        preview: rows,
        rowCount: rows.length,

        columns: rows.length > 0 ? Object.keys(rows[0]) : [],
      },
    });
  } catch (error) {
    console.error("[dataTestingController] getSavedDataSource error:", error);

    return res.status(500).json({
      success: false,
      error: error.message || "Failed to load saved test data.",
    });
  }
};
