const { poolPromise } = require("../config/db");
const sql = require("mssql");
const logAudit = require("./auditController");

// ===============================
// AUDIT SANITIZER (IMPORTANT)
// ===============================
const sanitizeAuditObject = (obj = {}) => {
  const blacklist = new Set([
    "created_by",
    "updated_by",
    "created_at",
    "updated_at",
    "created_by_name",
    "updated_by_name",
  ]);

  return Object.fromEntries(
    Object.entries(obj).filter(([key]) => !blacklist.has(key))
  );
};

// ===============================
// GET ALL TEST CASES
// ===============================
exports.getTestCases = async (req, res) => {
  try {
    const { suite_id } = req.query;
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

    if (suite_id) {
      request.input("suite_id", sql.Int, suite_id);
      conditions.push("tc.suite_id = @suite_id");
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
        tc.*, 
        ts.suite_name, 
        p.project_name,
        u1.username AS created_by_name,
        u2.username AS updated_by_name
      FROM test_case_manager.dbo.test_cases tc
      LEFT JOIN test_case_manager.dbo.test_suites ts 
        ON ts.id = tc.suite_id
      LEFT JOIN test_case_manager.dbo.projects p 
        ON p.id = ts.project_id
      LEFT JOIN test_case_manager.dbo.users u1 
        ON u1.id = tc.created_by
      LEFT JOIN test_case_manager.dbo.users u2 
        ON u2.id = tc.updated_by
      ${whereClause}
      ORDER BY tc.id ASC
    `);

    res.status(200).json({
      success: true,
      data: result.recordset,
    });
  } catch (err) {
    console.error("GET Test Cases Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch test cases",
      error: err.message,
    });
  }
};

// ===============================
// GET TEST CASE BY ID
// ===============================
exports.getTestCaseById = async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await poolPromise;

    const caseResult = await pool.request().input("id", sql.Int, id).query(`
      SELECT
        tc.*,
        ts.suite_name,
        p.project_name,
        u1.username AS created_by_name,
        u2.username AS updated_by_name
      FROM test_case_manager.dbo.test_cases tc
      LEFT JOIN test_case_manager.dbo.test_suites ts ON ts.id = tc.suite_id
      LEFT JOIN test_case_manager.dbo.projects p     ON p.id  = ts.project_id
      LEFT JOIN test_case_manager.dbo.users u1       ON u1.id = tc.created_by
      LEFT JOIN test_case_manager.dbo.users u2       ON u2.id = tc.updated_by
      WHERE tc.id = @id
    `);

    if (!caseResult.recordset.length) {
      return res.status(404).json({
        success: false,
        message: "Test case not found",
      });
    }

    const testCase = caseResult.recordset[0];

    const stepsResult = await pool
      .request()
      .input("test_case_id", sql.Int, id)
      .query(`
        SELECT *
        FROM test_case_manager.dbo.test_steps
        WHERE test_case_id = @test_case_id
        ORDER BY step_number ASC
      `);

    res.status(200).json({
      success: true,
      data: { ...testCase, steps: stepsResult.recordset },
    });
  } catch (err) {
    console.error("GET Test Case By ID Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch test case",
      error: err.message,
    });
  }
};

// ===============================
// GET STEP COUNT
// ===============================
exports.getTestCaseStepCount = async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await poolPromise;

    const result = await pool
      .request()
      .input("test_case_id", sql.Int, id)
      .query(`
        SELECT COUNT(*) AS step_count
        FROM test_case_manager.dbo.test_steps
        WHERE test_case_id = @test_case_id
      `);

    res.json({
      success: true,
      count: result.recordset[0]?.step_count ?? 0,
    });
  } catch (err) {
    console.error("GET Step Count Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch step count",
      error: err.message,
    });
  }
};

// ===============================
// CREATE TEST CASE
// ===============================
exports.createTestCase = async (req, res) => {
  try {
    const {
      suite_id,
      title,
      preconditions,
      priority,
      status,
      steps,
      playwright_script,
    } = req.body;

    const userId = req.user?.id || null;
    const pool = await poolPromise;

    const caseResult = await pool
      .request()
      .input("suite_id", sql.Int, suite_id)
      .input("title", sql.VarChar, title)
      .input("preconditions", sql.VarChar, preconditions || null)
      .input("priority", sql.VarChar, priority || "Medium")
      .input("status", sql.VarChar, status || "Draft")
      .input("playwright_script", sql.NVarChar(sql.MAX), playwright_script || null)
      .input("created_by", sql.Int, userId)
      .input("updated_by", sql.Int, userId)
      .query(`
        INSERT INTO test_case_manager.dbo.test_cases
          (suite_id, title, preconditions, priority, status, playwright_script, created_by, updated_by)
        OUTPUT INSERTED.*
        VALUES
          (@suite_id, @title, @preconditions, @priority, @status, @playwright_script, @created_by, @updated_by)
      `);

    const testCase = caseResult.recordset[0];
    const testCaseId = testCase.id;

    if (Array.isArray(steps)) {
      for (const step of steps) {
        await pool
          .request()
          .input("test_case_id", sql.Int, testCaseId)
          .input("step_number", sql.Int, step.step_number)
          .input("action", sql.VarChar, step.action)
          .input("expected_result", sql.VarChar, step.expected_result || null)
          .query(`
            INSERT INTO test_case_manager.dbo.test_steps
              (test_case_id, step_number, action, expected_result)
            VALUES
              (@test_case_id, @step_number, @action, @expected_result)
          `);
      }
    }

    await logAudit({
      userId,
      action: "CREATE",
      module: "TEST_CASE",
      entityType: "TEST_CASE",
      entityId: testCaseId,
      entityName: testCase.title,
      description: "Created test case",
      newValues: sanitizeAuditObject(testCase),
      status: "SUCCESS",
    });

    res.status(201).json({
      success: true,
      message: "Test case created successfully",
      id: testCaseId,
    });
  } catch (err) {
    console.error("CREATE Test Case Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to create test case",
      error: err.message,
    });
  }
};

// ===============================
// UPDATE TEST CASE
// ===============================
exports.updateTestCase = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      suite_id,
      title,
      preconditions,
      priority,
      status,
      steps,
      playwright_script,
    } = req.body;

    const userId = req.user?.id || null;
    const pool = await poolPromise;

    const oldResult = await pool
      .request()
      .input("id", sql.Int, id)
      .query(`SELECT * FROM test_case_manager.dbo.test_cases WHERE id = @id`);

    const oldCase = oldResult.recordset[0];

    await pool
      .request()
      .input("id", sql.Int, id)
      .input("suite_id", sql.Int, suite_id)
      .input("title", sql.VarChar, title)
      .input("preconditions", sql.VarChar, preconditions || null)
      .input("priority", sql.VarChar, priority)
      .input("status", sql.VarChar, status)
      .input("playwright_script", sql.NVarChar(sql.MAX), playwright_script || null)
      .query(`
        UPDATE test_case_manager.dbo.test_cases
        SET suite_id = @suite_id,
            title = @title,
            preconditions = @preconditions,
            priority = @priority,
            status = @status,
            playwright_script = @playwright_script,
            updated_at = GETDATE()
        WHERE id = @id
      `);

    await pool.request()
      .input("test_case_id", sql.Int, id)
      .query(`DELETE FROM test_case_manager.dbo.test_steps WHERE test_case_id = @test_case_id`);

    if (Array.isArray(steps)) {
      for (const step of steps) {
        await pool
          .request()
          .input("test_case_id", sql.Int, id)
          .input("step_number", sql.Int, step.step_number)
          .input("action", sql.VarChar, step.action)
          .input("expected_result", sql.VarChar, step.expected_result || null)
          .query(`
            INSERT INTO test_case_manager.dbo.test_steps
              (test_case_id, step_number, action, expected_result)
            VALUES
              (@test_case_id, @step_number, @action, @expected_result)
          `);
      }
    }

    await logAudit({
      userId,
      action: "UPDATE",
      module: "TEST_CASE",
      entityType: "TEST_CASE",
      entityId: Number(id),
      entityName: title,
      description: "Updated test case",
      oldValues: sanitizeAuditObject(oldCase),
      newValues: sanitizeAuditObject({
        suite_id,
        title,
        preconditions,
        priority,
        status,
        playwright_script,
      }),
      status: "SUCCESS",
    });

    res.json({
      success: true,
      message: "Test case updated successfully",
    });
  } catch (err) {
    console.error("UPDATE Test Case Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to update test case",
      error: err.message,
    });
  }
};

// ===============================
// DELETE TEST CASE
// ===============================
exports.deleteTestCase = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || null;
    const pool = await poolPromise;

    const oldCaseResult = await pool
      .request()
      .input("id", sql.Int, id)
      .query(`SELECT * FROM test_case_manager.dbo.test_cases WHERE id = @id`);

    const oldCase = oldCaseResult.recordset[0];

    await pool.request()
      .input("test_case_id", sql.Int, id)
      .query(`DELETE FROM test_case_manager.dbo.test_steps WHERE test_case_id = @test_case_id`);

    await pool.request()
      .input("id", sql.Int, id)
      .query(`DELETE FROM test_case_manager.dbo.test_cases WHERE id = @id`);

    await logAudit({
      userId,
      action: "DELETE",
      module: "TEST_CASE",
      entityType: "TEST_CASE",
      entityId: Number(id),
      entityName: oldCase?.title,
      description: "Deleted test case",
      oldValues: sanitizeAuditObject(oldCase),
      status: "SUCCESS",
    });

    res.json({
      success: true,
      message: "Test case deleted successfully",
    });
  } catch (err) {
    console.error("DELETE Test Case Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to delete test case",
      error: err.message,
    });
  }
};

// ===============================
// ACTIVITY LOG
// ===============================
exports.getTestCaseActivity = async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await poolPromise;

    const result = await pool.request()
      .input("id", sql.Int, id)
      .query(`
        SELECT al.*, u.username
        FROM audit_logs al
        LEFT JOIN users u ON u.id = al.user_id
        WHERE al.description LIKE '%' + CAST(@id AS VARCHAR) + '%'
        ORDER BY al.created_at DESC
      `);

    res.json({
      success: true,
      data: result.recordset,
    });

  } catch (err) {
    console.error("GET Activity Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch activity",
      error: err.message,
    });
  }
};