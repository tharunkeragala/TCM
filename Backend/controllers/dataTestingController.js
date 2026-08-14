const sql = require("mssql");
const path = require("path");
const fs = require("fs");

const { poolPromise } = require("../config/db");

const { runEnhancedTestCase } = require("../services/playwrightRunner");

const dataEngineService = require("../services/dataEngineService");

function parseTransformation(value) {
  if (!value) {
    return "None";
  }

  if (typeof value === "object") {
    return value.type || "None";
  }

  try {
    const parsed = JSON.parse(value);

    return parsed?.type || "None";
  } catch {
    return String(value);
  }
}

function serializeTransformation(value) {
  if (!value || value === "None") {
    return null;
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return JSON.stringify({
    type: value,
  });
}

function isValidObjectRow(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function getColumnsFromRows(rows = []) {
  const columns = new Set();

  for (const row of rows) {
    if (!isValidObjectRow(row)) {
      continue;
    }

    Object.keys(row).forEach((column) => {
      columns.add(column);
    });
  }

  return Array.from(columns);
}

function safeParseJSON(value) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "object") {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

async function cleanupUploadedFile(filePath) {
  if (!filePath) {
    return;
  }

  try {
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
    }
  } catch (error) {
    console.warn(
      "[dataTestingController] Unable to clean uploaded file:",
      error.message,
    );
  }
}

/* ========================================================================== */
/* DATA SOURCES                                                               */
/* ========================================================================== */

/* -------------------------------------------------------------------------- */
/* Upload test data                                                           */
/* POST /data-drive/upload                                                    */
/* -------------------------------------------------------------------------- */

/* -------------------------------------------------------------------------- */
/* Upload test data                                                           */
/* POST /data-drive/upload                                                    */
/* -------------------------------------------------------------------------- */

exports.uploadTestData = async (req, res) => {
  let transaction = null;

  try {
    const file = req.file;

    const testCaseId = Number(req.body.testCaseId);

    const sourceType = String(req.body.sourceType || "")
      .trim()
      .toUpperCase();

    if (!file) {
      return res.status(400).json({
        success: false,
        error: "Test data file is required.",
      });
    }

    if (!testCaseId || testCaseId <= 0) {
      await cleanupUploadedFile(file.path);

      return res.status(400).json({
        success: false,
        error: "Valid testCaseId is required.",
      });
    }

    if (!["CSV", "XLSX", "JSON"].includes(sourceType)) {
      await cleanupUploadedFile(file.path);

      return res.status(400).json({
        success: false,
        error: "sourceType must be CSV, XLSX or JSON.",
      });
    }

    const absolutePath = path.resolve(file.path);

    const parsedRows = await dataEngineService.loadTestData(
      sourceType,
      absolutePath,
    );

    if (!Array.isArray(parsedRows) || parsedRows.length === 0) {
      await cleanupUploadedFile(absolutePath);

      return res.status(400).json({
        success: false,
        error: "Uploaded dataset contains no rows.",
      });
    }

    const rows = parsedRows.filter(isValidObjectRow);

    if (!rows.length) {
      await cleanupUploadedFile(absolutePath);

      return res.status(400).json({
        success: false,
        error: "Uploaded dataset contains no valid object rows.",
      });
    }

    const pool = await poolPromise;

    const testCaseResult = await pool
      .request()
      .input("testCaseId", sql.Int, testCaseId).query(`
          SELECT id
          FROM dbo.test_cases
          WHERE id = @testCaseId
        `);

    if (!testCaseResult.recordset.length) {
      await cleanupUploadedFile(absolutePath);

      return res.status(404).json({
        success: false,
        error: "Test case was not found.",
      });
    }

    transaction = new sql.Transaction(pool);

    await transaction.begin();

    const sourceResult = await new sql.Request(transaction)
      .input("testCaseId", sql.Int, testCaseId)
      .input("sourceType", sql.NVarChar(50), sourceType)
      .input("sourcePath", sql.NVarChar(sql.MAX), absolutePath).query(`
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

    for (let index = 0; index < rows.length; index += 1) {
      await new sql.Request(transaction)
        .input("dataSourceId", sql.Int, sourceId)
        .input("rowNumber", sql.Int, index + 1)
        .input("data", sql.NVarChar(sql.MAX), JSON.stringify(rows[index]))
        .query(`
          INSERT INTO dbo.test_data_rows
          (
            data_source_id,
            row_number,
            data
          )
          VALUES
          (
            @dataSourceId,
            @rowNumber,
            @data
          )
        `);
    }

    await transaction.commit();

    transaction = null;

    return res.status(201).json({
      success: true,

      data: {
        sourceId,
        testCaseId,

        fileName: file.originalname,

        storedFileName: file.filename,

        sourceType,

        rowCount: rows.length,

        preview: rows.slice(0, 50),

        columns: getColumnsFromRows(rows),
      },
    });
  } catch (error) {
    if (transaction) {
      try {
        await transaction.rollback();
      } catch {
        // ignore
      }
    }

    console.error("[dataTestingController] uploadTestData error:", error);

    if (req.file?.path) {
      await cleanupUploadedFile(req.file.path);
    }

    return res.status(500).json({
      success: false,

      error: error.message || "Failed to upload test data.",
    });
  }
};

/* -------------------------------------------------------------------------- */
/* Get saved datasets for test case                                           */
/* GET /data-drive/sources/:testCaseId                                        */
/* -------------------------------------------------------------------------- */

exports.getSavedDataSources = async (req, res) => {
  try {
    const testCaseId = Number(req.params.testCaseId);

    if (!testCaseId || testCaseId <= 0) {
      return res.status(400).json({
        success: false,

        error: "Valid testCaseId is required.",
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
            COUNT(r.id) AS row_count
          FROM dbo.test_data_sources s
          LEFT JOIN dbo.test_data_rows r
            ON r.data_source_id = s.id
          WHERE s.test_case_id = @testCaseId
          GROUP BY
            s.id,
            s.test_case_id,
            s.data_source_type,
            s.source_path
          ORDER BY s.id DESC
        `);

    const sources = result.recordset.map((row) => ({
      id: row.id,

      testCaseId: row.test_case_id,

      sourceType: row.data_source_type,

      sourcePath: row.source_path,

      fileName: row.source_path
        ? path.basename(row.source_path)
        : `Source #${row.id}`,

      rowCount: Number(row.row_count) || 0,
    }));

    return res.status(200).json({
      success: true,

      data: {
        testCaseId,
        sources,
        count: sources.length,
      },
    });
  } catch (error) {
    console.error("[dataTestingController] getSavedDataSources error:", error);

    return res.status(500).json({
      success: false,

      error: error.message || "Failed to load saved test data.",
    });
  }
};

/* -------------------------------------------------------------------------- */
/* Get one saved dataset                                                      */
/* GET /data-drive/source/:sourceId                                           */
/* -------------------------------------------------------------------------- */

exports.getSavedDataSource = async (req, res) => {
  try {
    const sourceId = Number(req.params.sourceId);

    if (!sourceId || sourceId <= 0) {
      return res.status(400).json({
        success: false,

        error: "Valid sourceId is required.",
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

    if (!sourceResult.recordset.length) {
      return res.status(404).json({
        success: false,

        error: "Saved data source was not found.",
      });
    }

    const source = sourceResult.recordset[0];

    const rowsResult = await pool.request().input("sourceId", sql.Int, sourceId)
      .query(`
          SELECT
            id,
            row_number,
            data
          FROM dbo.test_data_rows
          WHERE data_source_id = @sourceId
          ORDER BY row_number ASC, id ASC
        `);

    const rows = [];

    const invalidRows = [];

    for (const row of rowsResult.recordset) {
      const parsed = safeParseJSON(row.data);

      if (!isValidObjectRow(parsed)) {
        invalidRows.push(row.row_number);

        continue;
      }

      rows.push(parsed);
    }

    if (!rows.length) {
      return res.status(400).json({
        success: false,

        error: "Saved data source contains no valid rows.",
      });
    }

    return res.status(200).json({
      success: true,

      data: {
        sourceId: source.id,

        testCaseId: source.test_case_id,

        sourceType: source.data_source_type,

        sourcePath: source.source_path,

        fileName: source.source_path
          ? path.basename(source.source_path)
          : `Source #${source.id}`,

        /*
         * Actual persisted row count.
         */
        rowCount: rows.length,

        preview: rows.slice(0, 50),

        columns: getColumnsFromRows(rows),

        invalidRows: invalidRows.length,
      },
    });
  } catch (error) {
    console.error("[dataTestingController] getSavedDataSource error:", error);

    return res.status(500).json({
      success: false,

      error: error.message || "Failed to load saved data source.",
    });
  }
};

/* ========================================================================== */
/* PARAMETER MAPPING SETS                                                     */
/* ========================================================================== */

/* -------------------------------------------------------------------------- */
/* Get mapping sets for test case                                             */
/* GET /mapping-sets/:testCaseId                                              */
/* -------------------------------------------------------------------------- */

exports.getMappingSets = async (req, res) => {
  try {
    const testCaseId = Number(req.params.testCaseId);

    if (!testCaseId || testCaseId <= 0) {
      return res.status(400).json({
        success: false,

        error: "Valid testCaseId is required.",
      });
    }

    const pool = await poolPromise;

    const result = await pool.request().input("testCaseId", sql.Int, testCaseId)
      .query(`
          SELECT
            s.id,
            s.test_case_id,
            s.name,
            s.description,
            s.created_at,
            s.updated_at,
            COUNT(m.id) AS rows_count
          FROM dbo.test_parameter_mapping_sets s
          LEFT JOIN dbo.test_parameter_mappings m
            ON m.mapping_set_id = s.id
          WHERE s.test_case_id = @testCaseId
          GROUP BY
            s.id,
            s.test_case_id,
            s.name,
            s.description,
            s.created_at,
            s.updated_at
          ORDER BY
            s.updated_at DESC,
            s.id DESC
        `);

    return res.status(200).json({
      success: true,

      data: {
        testCaseId,

        mappingSets: result.recordset.map((row) => ({
          id: row.id,

          testCaseId: row.test_case_id,

          name: row.name,

          description: row.description,

          rowsCount: Number(row.rows_count) || 0,

          createdAt: row.created_at,

          updatedAt: row.updated_at,
        })),
      },
    });
  } catch (error) {
    console.error("[dataTestingController] getMappingSets error:", error);

    return res.status(500).json({
      success: false,

      error: error.message || "Failed to load mapping sets.",
    });
  }
};

/* -------------------------------------------------------------------------- */
/* Get one mapping set                                                        */
/* GET /mapping-set/:mappingSetId                                             */
/* -------------------------------------------------------------------------- */

exports.getMappingSet = async (req, res) => {
  try {
    const mappingSetId = Number(req.params.mappingSetId);

    if (!mappingSetId || mappingSetId <= 0) {
      return res.status(400).json({
        success: false,

        error: "Valid mappingSetId is required.",
      });
    }

    const pool = await poolPromise;

    const setResult = await pool
      .request()
      .input("mappingSetId", sql.Int, mappingSetId).query(`
          SELECT
            id,
            test_case_id,
            name,
            description,
            created_at,
            updated_at
          FROM dbo.test_parameter_mapping_sets
          WHERE id = @mappingSetId
        `);

    if (!setResult.recordset.length) {
      return res.status(404).json({
        success: false,

        error: "Mapping set was not found.",
      });
    }

    const mappingSet = setResult.recordset[0];

    const rowsResult = await pool
      .request()
      .input("mappingSetId", sql.Int, mappingSetId).query(`
          SELECT
            id,
            test_case_id,
            mapping_set_id,
            parameter_name,
            variable_placeholder,
            data_column_name,
            transformation_rules
          FROM dbo.test_parameter_mappings
          WHERE mapping_set_id = @mappingSetId
          ORDER BY id ASC
        `);

    return res.status(200).json({
      success: true,

      data: {
        id: mappingSet.id,

        testCaseId: mappingSet.test_case_id,

        name: mappingSet.name,

        description: mappingSet.description,

        createdAt: mappingSet.created_at,

        updatedAt: mappingSet.updated_at,

        rows: rowsResult.recordset.map((row) => ({
          id: row.id,

          placeholder: row.variable_placeholder,

          dataColumn: row.data_column_name,

          transformation: parseTransformation(row.transformation_rules),
        })),
      },
    });
  } catch (error) {
    console.error("[dataTestingController] getMappingSet error:", error);

    return res.status(500).json({
      success: false,

      error: error.message || "Failed to load mapping set.",
    });
  }
};

/* -------------------------------------------------------------------------- */
/* Create mapping set                                                         */
/* POST /mapping-set                                                          */
/* -------------------------------------------------------------------------- */

exports.createMappingSet = async (req, res) => {
  const testCaseId = Number(req.body.testCaseId);

  const name = String(req.body.name || "").trim();

  const description = req.body.description
    ? String(req.body.description).trim()
    : null;

  const rows = Array.isArray(req.body.rows) ? req.body.rows : [];

  if (!testCaseId || testCaseId <= 0) {
    return res.status(400).json({
      success: false,

      error: "Valid testCaseId is required.",
    });
  }

  if (!name) {
    return res.status(400).json({
      success: false,

      error: "Mapping name is required.",
    });
  }

  if (!rows.length) {
    return res.status(400).json({
      success: false,

      error: "At least one mapping row is required.",
    });
  }

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];

    if (
      !String(row.placeholder || "").trim() ||
      !String(row.dataColumn || "").trim()
    ) {
      return res.status(400).json({
        success: false,

        error: `Mapping row ${index + 1} requires placeholder and dataColumn.`,
      });
    }
  }

  let transaction = null;

  try {
    const pool = await poolPromise;

    /*
     * Validate parent test case.
     */
    const testCaseResult = await pool
      .request()
      .input("testCaseId", sql.Int, testCaseId).query(`
          SELECT id
          FROM dbo.test_cases
          WHERE id = @testCaseId
        `);

    if (!testCaseResult.recordset.length) {
      return res.status(404).json({
        success: false,

        error: "Test case was not found.",
      });
    }

    transaction = new sql.Transaction(pool);

    await transaction.begin();

    /*
     * Prevent duplicate mapping-set names
     * within the same test case.
     */
    const duplicate = await new sql.Request(transaction)
      .input("testCaseId", sql.Int, testCaseId)
      .input("name", sql.NVarChar(255), name).query(`
          SELECT id
          FROM dbo.test_parameter_mapping_sets
          WHERE
            test_case_id = @testCaseId
            AND LOWER(name) = LOWER(@name)
        `);

    if (duplicate.recordset.length) {
      await transaction.rollback();

      transaction = null;

      return res.status(409).json({
        success: false,

        error: "A mapping with this name already exists for the test case.",
      });
    }

    const setResult = await new sql.Request(transaction)
      .input("testCaseId", sql.Int, testCaseId)
      .input("name", sql.NVarChar(255), name)
      .input("description", sql.NVarChar(500), description).query(`
          INSERT INTO dbo.test_parameter_mapping_sets
          (
            test_case_id,
            name,
            description,
            created_at,
            updated_at
          )
          OUTPUT INSERTED.id
          VALUES
          (
            @testCaseId,
            @name,
            @description,
            SYSUTCDATETIME(),
            SYSUTCDATETIME()
          )
        `);

    const mappingSetId = setResult.recordset[0].id;

    for (const row of rows) {
      const placeholder = String(row.placeholder).trim();

      const dataColumn = String(row.dataColumn).trim();

      const transformation = serializeTransformation(row.transformation);

      await new sql.Request(transaction)
        .input("testCaseId", sql.Int, testCaseId)
        .input("mappingSetId", sql.Int, mappingSetId)
        .input("parameterName", sql.NVarChar(255), placeholder)
        .input("placeholder", sql.NVarChar(255), placeholder)
        .input("dataColumn", sql.NVarChar(255), dataColumn)
        .input("transformation", sql.NVarChar(sql.MAX), transformation).query(`
          INSERT INTO dbo.test_parameter_mappings
          (
            test_case_id,
            mapping_set_id,
            parameter_name,
            variable_placeholder,
            data_column_name,
            transformation_rules
          )
          VALUES
          (
            @testCaseId,
            @mappingSetId,
            @parameterName,
            @placeholder,
            @dataColumn,
            @transformation
          )
        `);
    }

    await transaction.commit();

    transaction = null;

    return res.status(201).json({
      success: true,

      data: {
        mappingSetId,

        testCaseId,

        name,

        description,

        rowsCount: rows.length,
      },
    });
  } catch (error) {
    if (transaction) {
      try {
        await transaction.rollback();
      } catch {
        // Ignore rollback failure.
      }
    }

    console.error("[dataTestingController] createMappingSet error:", error);

    return res.status(500).json({
      success: false,

      error: error.message || "Failed to create mapping set.",
    });
  }
};

/* -------------------------------------------------------------------------- */
/* Update mapping set                                                         */
/* PUT /mapping-set/:mappingSetId                                             */
/* -------------------------------------------------------------------------- */

exports.updateMappingSet = async (req, res) => {
  const mappingSetId = Number(req.params.mappingSetId);

  const testCaseId = Number(req.body.testCaseId);

  const name = String(req.body.name || "").trim();

  const description = req.body.description
    ? String(req.body.description).trim()
    : null;

  const rows = Array.isArray(req.body.rows) ? req.body.rows : [];

  if (!mappingSetId || mappingSetId <= 0) {
    return res.status(400).json({
      success: false,

      error: "Valid mappingSetId is required.",
    });
  }

  if (!testCaseId || testCaseId <= 0) {
    return res.status(400).json({
      success: false,

      error: "Valid testCaseId is required.",
    });
  }

  if (!name) {
    return res.status(400).json({
      success: false,

      error: "Mapping name is required.",
    });
  }

  if (!rows.length) {
    return res.status(400).json({
      success: false,

      error: "At least one mapping row is required.",
    });
  }

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];

    if (
      !String(row.placeholder || "").trim() ||
      !String(row.dataColumn || "").trim()
    ) {
      return res.status(400).json({
        success: false,

        error: `Mapping row ${index + 1} requires placeholder and dataColumn.`,
      });
    }
  }

  let transaction = null;

  try {
    const pool = await poolPromise;

    transaction = new sql.Transaction(pool);

    await transaction.begin();

    /*
     * Confirm mapping set belongs
     * to this test case.
     */
    const existing = await new sql.Request(transaction)
      .input("mappingSetId", sql.Int, mappingSetId)
      .input("testCaseId", sql.Int, testCaseId).query(`
          SELECT id
          FROM dbo.test_parameter_mapping_sets
          WHERE
            id = @mappingSetId
            AND test_case_id = @testCaseId
        `);

    if (!existing.recordset.length) {
      await transaction.rollback();

      transaction = null;

      return res.status(404).json({
        success: false,

        error: "Mapping set was not found for this test case.",
      });
    }

    /*
     * Prevent duplicate names.
     */
    const duplicate = await new sql.Request(transaction)
      .input("mappingSetId", sql.Int, mappingSetId)
      .input("testCaseId", sql.Int, testCaseId)
      .input("name", sql.NVarChar(255), name).query(`
          SELECT id
          FROM dbo.test_parameter_mapping_sets
          WHERE
            test_case_id = @testCaseId
            AND LOWER(name) = LOWER(@name)
            AND id <> @mappingSetId
        `);

    if (duplicate.recordset.length) {
      await transaction.rollback();

      transaction = null;

      return res.status(409).json({
        success: false,

        error: "Another mapping with this name already exists.",
      });
    }

    /*
     * Update parent.
     */
    await new sql.Request(transaction)
      .input("mappingSetId", sql.Int, mappingSetId)
      .input("name", sql.NVarChar(255), name)
      .input("description", sql.NVarChar(500), description).query(`
        UPDATE dbo.test_parameter_mapping_sets
        SET
          name = @name,
          description = @description,
          updated_at = SYSUTCDATETIME()
        WHERE id = @mappingSetId
      `);

    /*
     * Replace only this set's child rows.
     */
    await new sql.Request(transaction).input(
      "mappingSetId",
      sql.Int,
      mappingSetId,
    ).query(`
        DELETE FROM dbo.test_parameter_mappings
        WHERE mapping_set_id = @mappingSetId
      `);

    /*
     * Insert updated child rows.
     */
    for (const row of rows) {
      const placeholder = String(row.placeholder).trim();

      const dataColumn = String(row.dataColumn).trim();

      const transformation = serializeTransformation(row.transformation);

      await new sql.Request(transaction)
        .input("testCaseId", sql.Int, testCaseId)
        .input("mappingSetId", sql.Int, mappingSetId)
        .input("parameterName", sql.NVarChar(255), placeholder)
        .input("placeholder", sql.NVarChar(255), placeholder)
        .input("dataColumn", sql.NVarChar(255), dataColumn)
        .input("transformation", sql.NVarChar(sql.MAX), transformation).query(`
          INSERT INTO dbo.test_parameter_mappings
          (
            test_case_id,
            mapping_set_id,
            parameter_name,
            variable_placeholder,
            data_column_name,
            transformation_rules
          )
          VALUES
          (
            @testCaseId,
            @mappingSetId,
            @parameterName,
            @placeholder,
            @dataColumn,
            @transformation
          )
        `);
    }

    await transaction.commit();

    transaction = null;

    return res.status(200).json({
      success: true,

      data: {
        mappingSetId,

        testCaseId,

        name,

        description,

        rowsCount: rows.length,
      },
    });
  } catch (error) {
    if (transaction) {
      try {
        await transaction.rollback();
      } catch {
        // Ignore rollback failure.
      }
    }

    console.error("[dataTestingController] updateMappingSet error:", error);

    return res.status(500).json({
      success: false,

      error: error.message || "Failed to update mapping set.",
    });
  }
};

/* -------------------------------------------------------------------------- */
/* Delete mapping set                                                         */
/* DELETE /mapping-set/:mappingSetId                                          */
/* -------------------------------------------------------------------------- */

exports.deleteMappingSet = async (req, res) => {
  const mappingSetId = Number(req.params.mappingSetId);

  if (!mappingSetId || mappingSetId <= 0) {
    return res.status(400).json({
      success: false,

      error: "Valid mappingSetId is required.",
    });
  }

  let transaction = null;

  try {
    const pool = await poolPromise;

    transaction = new sql.Transaction(pool);

    await transaction.begin();

    /*
     * Delete child rows first.
     */
    await new sql.Request(transaction).input(
      "mappingSetId",
      sql.Int,
      mappingSetId,
    ).query(`
        DELETE FROM dbo.test_parameter_mappings
        WHERE mapping_set_id = @mappingSetId
      `);

    /*
     * Delete mapping-set parent.
     */
    const result = await new sql.Request(transaction).input(
      "mappingSetId",
      sql.Int,
      mappingSetId,
    ).query(`
          DELETE FROM dbo.test_parameter_mapping_sets
          OUTPUT DELETED.id
          WHERE id = @mappingSetId
        `);

    if (!result.recordset.length) {
      await transaction.rollback();

      transaction = null;

      return res.status(404).json({
        success: false,

        error: "Mapping set was not found.",
      });
    }

    await transaction.commit();

    transaction = null;

    return res.status(200).json({
      success: true,

      data: {
        mappingSetId,
      },
    });
  } catch (error) {
    if (transaction) {
      try {
        await transaction.rollback();
      } catch {
        // Ignore rollback failure.
      }
    }

    console.error("[dataTestingController] deleteMappingSet error:", error);

    return res.status(500).json({
      success: false,

      error: error.message || "Failed to delete mapping set.",
    });
  }
};

/* ========================================================================== */
/* PARAMETERIZED RUN                                                          */
/* ========================================================================== */

/* -------------------------------------------------------------------------- */
/* Run data-driven test                                                       */
/* POST /data-drive/run-parameterized                                         */
/* -------------------------------------------------------------------------- */

exports.runParameterizedTest = async (req, res) => {
  try {
    const testCaseId = Number(req.body.testCaseId);

    const dataSourceId = Number(req.body.dataSourceId);

    const mappingSetId = Number(req.body.mappingSetId);

    const continueOnFailure = Boolean(req.body.continueOnFailure);

    if (!testCaseId || testCaseId <= 0) {
      return res.status(400).json({
        success: false,

        error: "Valid testCaseId is required.",
      });
    }

    if (!dataSourceId || dataSourceId <= 0) {
      return res.status(400).json({
        success: false,

        error: "Valid dataSourceId is required.",
      });
    }

    if (!mappingSetId || mappingSetId <= 0) {
      return res.status(400).json({
        success: false,

        error: "Valid mappingSetId is required.",
      });
    }

    const pool = await poolPromise;

    /* ---------------------------------------------------------------------- */
    /* Verify selected data source                                            */
    /* ---------------------------------------------------------------------- */

    const dataSourceResult = await pool
      .request()
      .input("dataSourceId", sql.Int, dataSourceId)
      .input("testCaseId", sql.Int, testCaseId).query(`
          SELECT
            id,
            test_case_id
          FROM dbo.test_data_sources
          WHERE
            id = @dataSourceId
            AND test_case_id = @testCaseId
        `);

    if (!dataSourceResult.recordset.length) {
      return res.status(404).json({
        success: false,

        error: "Selected data source does not belong to this test case.",
      });
    }

    /* ---------------------------------------------------------------------- */
    /* Verify selected mapping set                                            */
    /* ---------------------------------------------------------------------- */

    const setResult = await pool
      .request()
      .input("mappingSetId", sql.Int, mappingSetId)
      .input("testCaseId", sql.Int, testCaseId).query(`
          SELECT
            id,
            name
          FROM dbo.test_parameter_mapping_sets
          WHERE
            id = @mappingSetId
            AND test_case_id = @testCaseId
        `);

    if (!setResult.recordset.length) {
      return res.status(404).json({
        success: false,

        error: "Selected mapping set does not belong to this test case.",
      });
    }

    const mappingSet = setResult.recordset[0];

    /* ---------------------------------------------------------------------- */
    /* Load every child mapping row                                           */
    /* ---------------------------------------------------------------------- */

    const mappingsResult = await pool
      .request()
      .input("mappingSetId", sql.Int, mappingSetId).query(`
          SELECT
            id,
            test_case_id,
            mapping_set_id,
            parameter_name,
            variable_placeholder,
            data_column_name,
            transformation_rules
          FROM dbo.test_parameter_mappings
          WHERE mapping_set_id = @mappingSetId
          ORDER BY id ASC
        `);

    if (!mappingsResult.recordset.length) {
      return res.status(400).json({
        success: false,

        error: "Selected mapping set does not contain mapping rows.",
      });
    }

    /* ---------------------------------------------------------------------- */
    /* Execute                                                                */
    /* ---------------------------------------------------------------------- */

    const runIds = await runEnhancedTestCase(testCaseId, {
      dataSourceId,

      parameterMappings: mappingsResult.recordset,

      continueOnFailure,

      userId: req.user?.id || null,
    });

    return res.status(200).json({
      success: true,

      data: {
        testCaseId,

        dataSourceId,

        mappingSetId,

        mappingSetName: mappingSet.name,

        mappingRowsCount: mappingsResult.recordset.length,

        runIds,

        totalRuns: runIds.length,
      },
    });
  } catch (error) {
    console.error("[dataTestingController] runParameterizedTest error:", error);

    return res.status(500).json({
      success: false,

      error: error.message || "Failed to execute parameterized test.",
    });
  }
};
