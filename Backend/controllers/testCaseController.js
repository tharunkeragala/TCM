const { poolPromise } = require("../config/db");
const sql = require("mssql");

// ✅ GET ALL (optionally filtered by suite_id)
exports.getTestCases = async (req, res) => {
  try {
    const { suite_id } = req.query;
    const pool = await poolPromise;

    const request = pool.request();
    let whereClause = "";

    if (suite_id) {
      request.input("suite_id", sql.Int, suite_id);
      whereClause = "WHERE tc.suite_id = @suite_id";
    }

    const result = await request.query(`
  SELECT 
    tc.*, 
    ts.suite_name, 
    p.project_name,
    u1.username AS created_by_name,
    u2.username AS updated_by_name
  FROM test_case_manager.dbo.test_cases tc
  LEFT JOIN test_case_manager.dbo.test_suites ts ON ts.id = tc.suite_id
  LEFT JOIN test_case_manager.dbo.projects p ON p.id = ts.project_id
  LEFT JOIN test_case_manager.dbo.users u1 ON u1.id = tc.created_by
  LEFT JOIN test_case_manager.dbo.users u2 ON u2.id = tc.updated_by
  ${whereClause}
  ORDER BY tc.id ASC
`);

    res.status(200).json({ success: true, data: result.recordset });
  } catch (err) {
    console.error("GET Test Cases Error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch test cases", error: err.message });
  }
};

// ✅ GET BY ID (with steps)
exports.getTestCaseById = async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await poolPromise;

    const caseResult = await pool
      .request()
      .input("id", sql.Int, id)
      .query(`
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
      return res.status(404).json({ success: false, message: "Test case not found" });
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
    res.status(500).json({ success: false, message: "Failed to fetch test case", error: err.message });
  }
};

// ✅ GET STEP COUNT (for delete warning)
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

    res.json({ success: true, count: result.recordset[0]?.step_count ?? 0 });
  } catch (err) {
    console.error("GET Step Count Error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch step count", error: err.message });
  }
};

// ✅ CREATE (with steps)
exports.createTestCase = async (req, res) => {
  try {
    const { suite_id, title, preconditions, priority, status, steps } = req.body;
    const userId = req.user?.id || null;

    if (!title?.trim()) {
      return res.status(400).json({ success: false, message: "Title is required" });
    }
    if (!suite_id) {
      return res.status(400).json({ success: false, message: "Suite is required" });
    }

    const pool = await poolPromise;

    // Insert test case and get new ID using OUTPUT
    const caseResult = await pool
      .request()
      .input("suite_id", sql.Int, suite_id)
      .input("title", sql.VarChar, title)
      .input("preconditions", sql.VarChar, preconditions || null)
      .input("priority", sql.VarChar, priority || "Medium")
      .input("status", sql.VarChar, status || "Draft")
      .input("created_by", sql.Int, userId)
      .input("updated_by", sql.Int, userId)
      .query(`
        INSERT INTO test_case_manager.dbo.test_cases
          (suite_id, title, preconditions, priority, status, created_by, updated_by)
        OUTPUT INSERTED.id
        VALUES
          (@suite_id, @title, @preconditions, @priority, @status, @created_by, @updated_by)
      `);

    const testCaseId = caseResult.recordset[0].id;

    // Insert steps
    if (Array.isArray(steps) && steps.length > 0) {
      for (const step of steps) {
        await pool
          .request()
          .input("test_case_id", sql.Int, testCaseId)
          .input("step_number", sql.Int, step.step_number)
          .input("action", sql.VarChar, step.action)
          .input("expected_result", sql.VarChar, step.expected_result || null)
          .input("created_by", sql.Int, userId)
          .input("updated_by", sql.Int, userId)
          .query(`
            INSERT INTO test_case_manager.dbo.test_steps
              (test_case_id, step_number, action, expected_result, created_by, updated_by)
            VALUES
              (@test_case_id, @step_number, @action, @expected_result, @created_by, @updated_by)
          `);
      }
    }

    await pool
      .request()
      .input("description", sql.VarChar, `Test case "${title}" created under suite ID ${suite_id}`)
      .input("user_id", sql.Int, userId)
      .query(`
        INSERT INTO audit_logs (action, module, description, user_id)
        VALUES ('CREATE', 'TEST_CASE', @description, @user_id)
      `);

    res.status(201).json({ success: true, message: "Test case created successfully", id: testCaseId });
  } catch (err) {
    console.error("CREATE Test Case Error:", err);
    res.status(500).json({ success: false, message: "Failed to create test case", error: err.message });
  }
};

// ✅ UPDATE (replaces all steps)
exports.updateTestCase = async (req, res) => {
  try {
    const { id } = req.params;
    const { suite_id, title, preconditions, priority, status, steps } = req.body;
    const userId = req.user?.id || null;

    if (!title?.trim()) {
      return res.status(400).json({ success: false, message: "Title is required" });
    }

    const pool = await poolPromise;

    await pool
      .request()
      .input("id", sql.Int, id)
      .input("suite_id", sql.Int, suite_id)
      .input("title", sql.VarChar, title)
      .input("preconditions", sql.VarChar, preconditions || null)
      .input("priority", sql.VarChar, priority)
      .input("status", sql.VarChar, status)
      .input("updated_by", sql.Int, userId)
      .query(`
        UPDATE test_case_manager.dbo.test_cases
        SET suite_id      = @suite_id,
            title         = @title,
            preconditions = @preconditions,
            priority      = @priority,
            status        = @status,
            updated_by    = @updated_by,
            updated_at    = GETDATE()
        WHERE id = @id
      `);

    // Delete existing steps and re-insert
    await pool
      .request()
      .input("test_case_id", sql.Int, id)
      .query(`
        DELETE FROM test_case_manager.dbo.test_steps
        WHERE test_case_id = @test_case_id
      `);

    if (Array.isArray(steps) && steps.length > 0) {
      for (const step of steps) {
        await pool
          .request()
          .input("test_case_id", sql.Int, id)
          .input("step_number", sql.Int, step.step_number)
          .input("action", sql.VarChar, step.action)
          .input("expected_result", sql.VarChar, step.expected_result || null)
          .input("created_by", sql.Int, userId)
          .input("updated_by", sql.Int, userId)
          .query(`
            INSERT INTO test_case_manager.dbo.test_steps
              (test_case_id, step_number, action, expected_result, created_by, updated_by)
            VALUES
              (@test_case_id, @step_number, @action, @expected_result, @created_by, @updated_by)
          `);
      }
    }

    await pool
      .request()
      .input("description", sql.VarChar, `Test case ID ${id} updated`)
      .input("user_id", sql.Int, userId)
      .query(`
        INSERT INTO audit_logs (action, module, description, user_id)
        VALUES ('UPDATE', 'TEST_CASE', @description, @user_id)
      `);

    res.json({ success: true, message: "Test case updated successfully" });
  } catch (err) {
    console.error("UPDATE Test Case Error:", err);
    res.status(500).json({ success: false, message: "Failed to update test case", error: err.message });
  }
};

// ✅ DELETE (removes steps first, then the case)
exports.deleteTestCase = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || null;
    const pool = await poolPromise;

    await pool
      .request()
      .input("test_case_id", sql.Int, id)
      .query(`
        DELETE FROM test_case_manager.dbo.test_steps
        WHERE test_case_id = @test_case_id
      `);

    await pool
      .request()
      .input("id", sql.Int, id)
      .query(`DELETE FROM test_case_manager.dbo.test_cases WHERE id = @id`);

    await pool
      .request()
      .input("description", sql.VarChar, `Test case ID ${id} deleted`)
      .input("user_id", sql.Int, userId)
      .query(`
        INSERT INTO audit_logs (action, module, description, user_id)
        VALUES ('DELETE', 'TEST_CASE', @description, @user_id)
      `);

    res.json({ success: true, message: "Test case deleted successfully" });
  } catch (err) {
    console.error("DELETE Test Case Error:", err);
    res.status(500).json({ success: false, message: "Failed to delete test case", error: err.message });
  }
};