const { poolPromise } = require("../config/db");
const sql = require("mssql");
const logAudit = require("./auditController");

// ===============================
// REMOVE SYSTEM / UI FIELDS
// ===============================
const cleanAuditData = (obj = {}) => {
  const {
    created_at,
    updated_at,
    created_by_name,
    updated_by_name,
    created_by,
    updated_by,
    ...cleaned
  } = obj;

  return cleaned;
};

// ===============================
// GET ALL TEST SUITES
// ===============================
exports.getTestSuites = async (req, res) => {
  try {
    const { project_id } = req.query;
    const pool = await poolPromise;

    const request = pool.request();

    const userResult = await pool
      .request()
      .input("user_id", req.user.id)
      .query(`
        SELECT department_id 
        FROM users 
        WHERE id = @user_id
      `);

    const userDeptId = userResult.recordset[0]?.department_id;

    let conditions = [];

    if (project_id) {
      request.input("project_id", sql.Int, project_id);
      conditions.push("ts.project_id = @project_id");
    }

    request.input("department_id", userDeptId);
    conditions.push(`
      (
        u1.department_id = @department_id
        OR u1.department_id IS NULL
      )
    `);

    const whereClause = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    const result = await request.query(`
      SELECT
        ts.*,
        p.project_name,
        u1.username AS created_by_name,
        u2.username AS updated_by_name
      FROM test_case_manager.dbo.test_suites ts
      LEFT JOIN test_case_manager.dbo.projects p  
        ON p.id = ts.project_id
      LEFT JOIN test_case_manager.dbo.users u1    
        ON u1.id = ts.created_by
      LEFT JOIN test_case_manager.dbo.users u2    
        ON u2.id = ts.updated_by
      ${whereClause}
      ORDER BY ts.id ASC
    `);

    res.status(200).json({
      success: true,
      data: result.recordset,
    });
  } catch (err) {
    console.error("GET Test Suites Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch test suites",
      error: err.message,
    });
  }
};

// ===============================
// GET CASE COUNT
// ===============================
exports.getSuiteCaseCount = async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await poolPromise;

    const result = await pool
      .request()
      .input("suite_id", sql.Int, id)
      .query(`
        SELECT COUNT(*) AS case_count
        FROM test_case_manager.dbo.test_cases
        WHERE suite_id = @suite_id
      `);

    res.json({
      success: true,
      count: result.recordset[0]?.case_count ?? 0,
    });
  } catch (err) {
    console.error("GET Case Count Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch case count",
      error: err.message,
    });
  }
};

// ===============================
// CREATE TEST SUITE
// ===============================
exports.createTestSuite = async (req, res) => {
  try {
    const { project_id, suite_name, description, is_active } = req.body;
    const userId = req.user?.id || null;

    const pool = await poolPromise;

    const existing = await pool
      .request()
      .input("suite_name", sql.VarChar, suite_name)
      .input("project_id", sql.Int, project_id)
      .query(`
        SELECT id 
        FROM test_case_manager.dbo.test_suites
        WHERE suite_name = @suite_name 
          AND project_id = @project_id
      `);

    if (existing.recordset.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Suite name already exists in this project",
      });
    }

    const insertResult = await pool
      .request()
      .input("project_id", sql.Int, project_id)
      .input("suite_name", sql.VarChar, suite_name)
      .input("description", sql.VarChar, description || null)
      .input("is_active", sql.Bit, is_active ?? 1)
      .input("created_by", sql.Int, userId)
      .input("updated_by", sql.Int, userId)
      .query(`
        INSERT INTO test_case_manager.dbo.test_suites
          (project_id, suite_name, description, is_active, created_by, updated_by)
        OUTPUT INSERTED.*
        VALUES
          (@project_id, @suite_name, @description, @is_active, @created_by, @updated_by)
      `);

    const suite = cleanAuditData(insertResult.recordset[0]);

    await logAudit({
      userId,
      action: "CREATE",
      module: "TEST_SUITE",
      entityType: "TEST_SUITE",
      entityId: suite.id,
      entityName: suite.suite_name,
      description: `Created test suite ${suite.suite_name}`,
      newValues: suite,
      status: "SUCCESS",
    });

    res.status(201).json({
      success: true,
      message: "Test suite created successfully",
    });

  } catch (err) {
    console.error("CREATE Test Suite Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to create test suite",
      error: err.message,
    });
  }
};

// ===============================
// UPDATE TEST SUITE
// ===============================
exports.updateTestSuite = async (req, res) => {
  try {
    const { id } = req.params;
    const { project_id, suite_name, description, is_active } = req.body;
    const userId = req.user?.id || null;

    const pool = await poolPromise;

    const oldResult = await pool
      .request()
      .input("id", sql.Int, id)
      .query(`SELECT * FROM test_suites WHERE id = @id`);

    const oldSuite = cleanAuditData(oldResult.recordset[0]);

    if (!oldSuite) {
      return res.status(404).json({
        success: false,
        message: "Suite not found",
      });
    }

    await pool
      .request()
      .input("id", sql.Int, id)
      .input("project_id", sql.Int, project_id)
      .input("suite_name", sql.VarChar, suite_name)
      .input("description", sql.VarChar, description || null)
      .input("is_active", sql.Bit, is_active)
      .input("updated_by", sql.Int, userId)
      .query(`
        UPDATE test_case_manager.dbo.test_suites
        SET project_id  = @project_id,
            suite_name  = @suite_name,
            description = @description,
            is_active   = @is_active,
            updated_by  = @updated_by,
            updated_at  = GETDATE()
        WHERE id = @id
      `);

    const newResult = await pool
      .request()
      .input("id", sql.Int, id)
      .query(`SELECT * FROM test_suites WHERE id = @id`);

    const newSuite = cleanAuditData(newResult.recordset[0]);

    await logAudit({
      userId,
      action: "UPDATE",
      module: "TEST_SUITE",
      entityType: "TEST_SUITE",
      entityId: Number(id),
      entityName: newSuite.suite_name,
      description: `Updated test suite ${newSuite.suite_name}`,
      oldValues: oldSuite,
      newValues: newSuite,
      status: "SUCCESS",
    });

    res.json({
      success: true,
      message: "Test suite updated successfully",
    });

  } catch (err) {
    console.error("UPDATE Test Suite Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to update test suite",
      error: err.message,
    });
  }
};

// ===============================
// DELETE TEST SUITE
// ===============================
exports.deleteTestSuite = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || null;
    const pool = await poolPromise;

    const suiteResult = await pool
      .request()
      .input("id", sql.Int, id)
      .query(`SELECT * FROM test_suites WHERE id = @id`);

    const suite = cleanAuditData(suiteResult.recordset[0]);

    if (!suite) {
      return res.status(404).json({
        success: false,
        message: "Suite not found",
      });
    }

    const caseCheck = await pool
      .request()
      .input("suite_id", sql.Int, id)
      .query(`
        SELECT COUNT(*) AS case_count
        FROM test_case_manager.dbo.test_cases
        WHERE suite_id = @suite_id
      `);

    if (caseCheck.recordset[0].case_count > 0) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete suite with existing test cases",
      });
    }

    await pool
      .request()
      .input("id", sql.Int, id)
      .query(`DELETE FROM test_case_manager.dbo.test_suites WHERE id = @id`);

    await logAudit({
      userId,
      action: "DELETE",
      module: "TEST_SUITE",
      entityType: "TEST_SUITE",
      entityId: suite.id,
      entityName: suite.suite_name,
      description: `Deleted test suite ${suite.suite_name}`,
      oldValues: suite,
      status: "SUCCESS",
    });

    res.json({
      success: true,
      message: "Test suite deleted successfully",
    });

  } catch (err) {
    console.error("DELETE Test Suite Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to delete test suite",
      error: err.message,
    });
  }
};

// ===============================
// TOGGLE TEST SUITE
// ===============================
exports.toggleTestSuite = async (req, res) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;
    const userId = req.user?.id || null;
    const pool = await poolPromise;

    const oldResult = await pool
      .request()
      .input("id", sql.Int, id)
      .query(`SELECT * FROM test_suites WHERE id = @id`);

    const oldSuite = cleanAuditData(oldResult.recordset[0]);

    await pool
      .request()
      .input("id", sql.Int, id)
      .input("is_active", sql.Bit, is_active)
      .input("updated_by", sql.Int, userId)
      .query(`
        UPDATE test_case_manager.dbo.test_suites
        SET is_active  = @is_active,
            updated_by = @updated_by,
            updated_at = GETDATE()
        WHERE id = @id
      `);

    const newSuite = {
      ...oldSuite,
      is_active,
    };

    await logAudit({
      userId,
      action: "STATUS_CHANGE",
      module: "TEST_SUITE",
      entityType: "TEST_SUITE",
      entityId: Number(id),
      entityName: oldSuite.suite_name,
      description: `Suite status changed to ${is_active ? "Active" : "Inactive"}`,
      oldValues: oldSuite,
      newValues: newSuite,
      status: "SUCCESS",
    });

    res.json({
      success: true,
      message: "Test suite status updated",
    });

  } catch (err) {
    console.error("TOGGLE Test Suite Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to update status",
      error: err.message,
    });
  }
};