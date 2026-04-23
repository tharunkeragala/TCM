const { poolPromise } = require("../config/db");
const sql = require("mssql");

// ✅ GET ALL (optionally filtered by project_id via query string)
exports.getTestSuites = async (req, res) => {
  try {
    const { project_id } = req.query;
    const pool = await poolPromise;

    const request = pool.request();
    let whereClause = "";

    if (project_id) {
      request.input("project_id", sql.Int, project_id);
      whereClause = "WHERE ts.project_id = @project_id";
    }

    const result = await request.query(`
      SELECT
  ts.*,
  p.project_name,
  u1.username AS created_by_name,
  u2.username AS updated_by_name
FROM test_suites ts
LEFT JOIN projects p  ON p.id  = ts.project_id
LEFT JOIN users u1    ON u1.id = ts.created_by
LEFT JOIN users u2    ON u2.id = ts.updated_by
ORDER BY ts.id ASC
    `);

    res.status(200).json({ success: true, data: result.recordset });
  } catch (err) {
    console.error("GET Test Suites Error:", err);
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to fetch test suites",
        error: err.message,
      });
  }
};

// ✅ GET CASE COUNT (for delete warning)
exports.getSuiteCaseCount = async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await poolPromise;

    const result = await pool.request().input("suite_id", sql.Int, id).query(`
        SELECT COUNT(*) AS case_count
        FROM test_case_manager.dbo.test_cases
        WHERE suite_id = @suite_id
      `);

    res.json({ success: true, count: result.recordset[0]?.case_count ?? 0 });
  } catch (err) {
    console.error("GET Case Count Error:", err);
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to fetch case count",
        error: err.message,
      });
  }
};

// ✅ CREATE
exports.createTestSuite = async (req, res) => {
  try {
    const { project_id, suite_name, description, is_active } = req.body;
    const userId = req.user?.id || req.user?.userId || null;

    if (!suite_name?.trim()) {
      return res
        .status(400)
        .json({ success: false, message: "Suite name is required" });
    }
    if (!project_id) {
      return res
        .status(400)
        .json({ success: false, message: "Project is required" });
    }

    const pool = await poolPromise;

    const existing = await pool
      .request()
      .input("suite_name", sql.VarChar, suite_name)
      .input("project_id", sql.Int, project_id).query(`
        SELECT id FROM test_case_manager.dbo.test_suites
        WHERE suite_name = @suite_name AND project_id = @project_id
      `);

    if (existing.recordset.length > 0) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Suite name already exists in this project",
        });
    }

    await pool
      .request()
      .input("project_id", sql.Int, project_id)
      .input("suite_name", sql.VarChar, suite_name)
      .input("description", sql.VarChar, description || null)
      .input("is_active", sql.Bit, is_active ?? 1)
      .input("created_by", sql.Int, userId)
      .input("updated_by", sql.Int, userId).query(`
        INSERT INTO test_case_manager.dbo.test_suites
          (project_id, suite_name, description, is_active, created_by, updated_by)
        VALUES
          (@project_id, @suite_name, @description, @is_active, @created_by, @updated_by)
      `);

    await pool
      .request()
      .input(
        "description",
        sql.VarChar,
        `Suite "${suite_name}" created under project ID ${project_id}`,
      )
      .input("user_id", sql.Int, userId).query(`
        INSERT INTO audit_logs (action, module, description, user_id)
        VALUES ('CREATE', 'TEST_SUITE', @description, @user_id)
      `);

    res
      .status(201)
      .json({ success: true, message: "Test suite created successfully" });
  } catch (err) {
    console.error("CREATE Test Suite Error:", err);
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to create test suite",
        error: err.message,
      });
  }
};

// ✅ UPDATE
exports.updateTestSuite = async (req, res) => {
  try {
    const { id } = req.params;
    const { project_id, suite_name, description, is_active } = req.body;
    const userId = req.user?.id || req.user?.userId || null;

    if (!suite_name?.trim()) {
      return res
        .status(400)
        .json({ success: false, message: "Suite name is required" });
    }

    const pool = await poolPromise;

    const existing = await pool
      .request()
      .input("suite_name", sql.VarChar, suite_name)
      .input("project_id", sql.Int, project_id)
      .input("id", sql.Int, id).query(`
        SELECT id FROM test_case_manager.dbo.test_suites
        WHERE suite_name = @suite_name AND project_id = @project_id AND id != @id
      `);

    if (existing.recordset.length > 0) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Suite name already exists in this project",
        });
    }

    await pool
      .request()
      .input("id", sql.Int, id)
      .input("project_id", sql.Int, project_id)
      .input("suite_name", sql.VarChar, suite_name)
      .input("description", sql.VarChar, description || null)
      .input("is_active", sql.Bit, is_active)
      .input("updated_by", sql.Int, userId).query(`
        UPDATE test_case_manager.dbo.test_suites
        SET project_id  = @project_id,
            suite_name  = @suite_name,
            description = @description,
            is_active   = @is_active,
            updated_by  = @updated_by,
            updated_at  = GETDATE()
        WHERE id = @id
      `);

    await pool
      .request()
      .input("description", sql.VarChar, `Suite ID ${id} updated`)
      .input("user_id", sql.Int, userId).query(`
        INSERT INTO audit_logs (action, module, description, user_id)
        VALUES ('UPDATE', 'TEST_SUITE', @description, @user_id)
      `);

    res.json({ success: true, message: "Test suite updated successfully" });
  } catch (err) {
    console.error("UPDATE Test Suite Error:", err);
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to update test suite",
        error: err.message,
      });
  }
};

// ✅ DELETE
exports.deleteTestSuite = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || req.user?.userId || null;
    const pool = await poolPromise;

    const caseCheck = await pool.request().input("suite_id", sql.Int, id)
      .query(`
        SELECT COUNT(*) AS case_count
        FROM test_case_manager.dbo.test_cases
        WHERE suite_id = @suite_id
      `);

    const caseCount = caseCheck.recordset[0]?.case_count ?? 0;

    if (caseCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete: ${caseCount} test case(s) are linked to this suite. Remove them first.`,
      });
    }

    await pool
      .request()
      .input("id", sql.Int, id)
      .query(`DELETE FROM test_case_manager.dbo.test_suites WHERE id = @id`);

    await pool
      .request()
      .input("description", sql.VarChar, `Suite ID ${id} deleted`)
      .input("user_id", sql.Int, userId).query(`
        INSERT INTO audit_logs (action, module, description, user_id)
        VALUES ('DELETE', 'TEST_SUITE', @description, @user_id)
      `);

    res.json({ success: true, message: "Test suite deleted successfully" });
  } catch (err) {
    console.error("DELETE Test Suite Error:", err);
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to delete test suite",
        error: err.message,
      });
  }
};

// ✅ TOGGLE ACTIVE
exports.toggleTestSuite = async (req, res) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;
    const userId = req.user?.id || req.user?.userId || null;
    const pool = await poolPromise;

    await pool
      .request()
      .input("id", sql.Int, id)
      .input("is_active", sql.Bit, is_active)
      .input("updated_by", sql.Int, userId).query(`
        UPDATE test_case_manager.dbo.test_suites
        SET is_active  = @is_active,
            updated_by = @updated_by,
            updated_at = GETDATE()
        WHERE id = @id
      `);

    await pool
      .request()
      .input(
        "description",
        sql.VarChar,
        `Suite ID ${id} status changed to ${is_active ? "Active" : "Inactive"}`,
      )
      .input("user_id", sql.Int, userId).query(`
        INSERT INTO audit_logs (action, module, description, user_id)
        VALUES ('STATUS_CHANGE', 'TEST_SUITE', @description, @user_id)
      `);

    res.json({ success: true, message: "Suite status updated" });
  } catch (err) {
    console.error("TOGGLE Test Suite Error:", err);
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to update status",
        error: err.message,
      });
  }
};
