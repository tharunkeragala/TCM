const { poolPromise } = require("../config/db");
const sql = require("mssql");
const logAudit = require("./auditController");

const BOARD_STATUSES = ["To Do", "In Progress", "Done"];
const SPRINT_STATUSES = ["Planned", "Active", "Completed"];

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
// GET ALL SPRINTS
// ===============================
exports.getSprints = async (req, res) => {
  try {
    const { project_id } = req.query;
    const pool = await poolPromise;
    const request = pool.request();

    let where = "";
    if (project_id) {
      request.input("project_id", sql.Int, project_id);
      where = "WHERE sp.project_id = @project_id";
    }

    const result = await request.query(`
      SELECT
        sp.*,
        p.project_name,
        u1.username AS created_by_name,
        u2.username AS updated_by_name,
        (SELECT COUNT(*) FROM test_case_manager.dbo.sprint_suites ss WHERE ss.sprint_id = sp.id) AS suite_count,
        (SELECT COUNT(*) FROM test_case_manager.dbo.sprint_test_cases stc WHERE stc.sprint_id = sp.id) AS case_count
      FROM test_case_manager.dbo.sprints sp
      LEFT JOIN test_case_manager.dbo.projects p ON p.id = sp.project_id
      LEFT JOIN test_case_manager.dbo.users u1 ON u1.id = sp.created_by
      LEFT JOIN test_case_manager.dbo.users u2 ON u2.id = sp.updated_by
      ${where}
      ORDER BY sp.id DESC
    `);

    res.status(200).json({ success: true, data: result.recordset });
  } catch (err) {
    console.error("GET Sprints Error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch sprints", error: err.message });
  }
};

// ===============================
// GET SPRINT BY ID
// ===============================
exports.getSprintById = async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await poolPromise;

    const result = await pool.request().input("id", sql.Int, id).query(`
      SELECT
        sp.*,
        p.project_name,
        u1.username AS created_by_name,
        u2.username AS updated_by_name
      FROM test_case_manager.dbo.sprints sp
      LEFT JOIN test_case_manager.dbo.projects p ON p.id = sp.project_id
      LEFT JOIN test_case_manager.dbo.users u1 ON u1.id = sp.created_by
      LEFT JOIN test_case_manager.dbo.users u2 ON u2.id = sp.updated_by
      WHERE sp.id = @id
    `);

    if (!result.recordset.length) {
      return res.status(404).json({ success: false, message: "Sprint not found" });
    }

    res.status(200).json({ success: true, data: result.recordset[0] });
  } catch (err) {
    console.error("GET Sprint By ID Error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch sprint", error: err.message });
  }
};

// ===============================
// CREATE SPRINT
// ===============================
exports.createSprint = async (req, res) => {
  try {
    const { project_id, sprint_name, goal, start_date, end_date } = req.body;
    const userId = req.user?.id || null;

    if (!project_id || !sprint_name || !sprint_name.trim()) {
      return res.status(400).json({ success: false, message: "Project and sprint name are required" });
    }

    const pool = await poolPromise;

    const insertResult = await pool
      .request()
      .input("project_id", sql.Int, project_id)
      .input("sprint_name", sql.VarChar, sprint_name)
      .input("goal", sql.VarChar(sql.MAX), goal || null)
      .input("start_date", sql.Date, start_date || null)
      .input("end_date", sql.Date, end_date || null)
      .input("status", sql.VarChar, "Planned")
      .input("created_by", sql.Int, userId)
      .input("updated_by", sql.Int, userId)
      .query(`
        INSERT INTO test_case_manager.dbo.sprints
          (project_id, sprint_name, goal, start_date, end_date, status, created_by, updated_by)
        OUTPUT INSERTED.*
        VALUES
          (@project_id, @sprint_name, @goal, @start_date, @end_date, @status, @created_by, @updated_by)
      `);

    const sprint = insertResult.recordset[0];

    await logAudit({
      userId,
      action: "CREATE",
      module: "SPRINT",
      entityType: "SPRINT",
      entityId: sprint.id,
      entityName: sprint.sprint_name,
      description: `Created sprint ${sprint.sprint_name}`,
      newValues: sanitizeAuditObject(sprint),
      status: "SUCCESS",
    });

    res.status(201).json({ success: true, message: "Sprint created successfully", id: sprint.id });
  } catch (err) {
    console.error("CREATE Sprint Error:", err);
    res.status(500).json({ success: false, message: "Failed to create sprint", error: err.message });
  }
};

// ===============================
// UPDATE SPRINT
// ===============================
exports.updateSprint = async (req, res) => {
  try {
    const { id } = req.params;
    const { sprint_name, goal, start_date, end_date } = req.body;
    const userId = req.user?.id || null;
    const pool = await poolPromise;

    const oldResult = await pool.request().input("id", sql.Int, id)
      .query(`SELECT * FROM test_case_manager.dbo.sprints WHERE id = @id`);
    const oldSprint = oldResult.recordset[0];
    if (!oldSprint) return res.status(404).json({ success: false, message: "Sprint not found" });

    await pool
      .request()
      .input("id", sql.Int, id)
      .input("sprint_name", sql.VarChar, sprint_name)
      .input("goal", sql.VarChar(sql.MAX), goal || null)
      .input("start_date", sql.Date, start_date || null)
      .input("end_date", sql.Date, end_date || null)
      .input("updated_by", sql.Int, userId)
      .query(`
        UPDATE test_case_manager.dbo.sprints
        SET sprint_name = @sprint_name,
            goal = @goal,
            start_date = @start_date,
            end_date = @end_date,
            updated_by = @updated_by,
            updated_at = GETDATE()
        WHERE id = @id
      `);

    await logAudit({
      userId,
      action: "UPDATE",
      module: "SPRINT",
      entityType: "SPRINT",
      entityId: Number(id),
      entityName: sprint_name,
      description: `Updated sprint ${sprint_name}`,
      oldValues: sanitizeAuditObject(oldSprint),
      newValues: { sprint_name, goal, start_date, end_date },
      status: "SUCCESS",
    });

    res.json({ success: true, message: "Sprint updated successfully" });
  } catch (err) {
    console.error("UPDATE Sprint Error:", err);
    res.status(500).json({ success: false, message: "Failed to update sprint", error: err.message });
  }
};

// ===============================
// CHANGE SPRINT STATUS
// ===============================
exports.changeSprintStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const userId = req.user?.id || null;

    if (!SPRINT_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid sprint status" });
    }

    const pool = await poolPromise;
    const oldResult = await pool.request().input("id", sql.Int, id)
      .query(`SELECT * FROM test_case_manager.dbo.sprints WHERE id = @id`);
    const oldSprint = oldResult.recordset[0];
    if (!oldSprint) return res.status(404).json({ success: false, message: "Sprint not found" });

    await pool
      .request()
      .input("id", sql.Int, id)
      .input("status", sql.VarChar, status)
      .input("updated_by", sql.Int, userId)
      .query(`
        UPDATE test_case_manager.dbo.sprints
        SET status = @status, updated_by = @updated_by, updated_at = GETDATE()
        WHERE id = @id
      `);

    await logAudit({
      userId,
      action: "STATUS_CHANGE",
      module: "SPRINT",
      entityType: "SPRINT",
      entityId: Number(id),
      entityName: oldSprint.sprint_name,
      description: `Sprint status changed to ${status}`,
      oldValues: { status: oldSprint.status },
      newValues: { status },
      status: "SUCCESS",
    });

    res.json({ success: true, message: "Sprint status updated" });
  } catch (err) {
    console.error("Sprint Status Error:", err);
    res.status(500).json({ success: false, message: "Failed to update sprint status", error: err.message });
  }
};

// ===============================
// DELETE SPRINT
// ===============================
exports.deleteSprint = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || null;
    const pool = await poolPromise;

    const sprintResult = await pool.request().input("id", sql.Int, id)
      .query(`SELECT * FROM test_case_manager.dbo.sprints WHERE id = @id`);
    const sprint = sprintResult.recordset[0];
    if (!sprint) return res.status(404).json({ success: false, message: "Sprint not found" });

    await pool.request().input("id", sql.Int, id)
      .query(`DELETE FROM test_case_manager.dbo.sprints WHERE id = @id`);

    await logAudit({
      userId,
      action: "DELETE",
      module: "SPRINT",
      entityType: "SPRINT",
      entityId: sprint.id,
      entityName: sprint.sprint_name,
      description: `Deleted sprint ${sprint.sprint_name}`,
      oldValues: sanitizeAuditObject(sprint),
      status: "SUCCESS",
    });

    res.json({ success: true, message: "Sprint deleted successfully" });
  } catch (err) {
    console.error("DELETE Sprint Error:", err);
    res.status(500).json({ success: false, message: "Failed to delete sprint", error: err.message });
  }
};

// ===============================
// GET BOARD
// ===============================
exports.getSprintBoard = async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await poolPromise;

    const result = await pool.request().input("sprint_id", sql.Int, id).query(`
      SELECT
        ss.id AS sprint_suite_id,
        ss.board_status,
        ss.sort_order,
        s.id AS suite_id,
        s.suite_name,
        s.description,
        s.is_active,
        p.project_name,
        (SELECT COUNT(*) FROM test_case_manager.dbo.sprint_test_cases stc
           WHERE stc.sprint_id = ss.sprint_id AND stc.suite_id = s.id) AS case_count,
        (SELECT COUNT(*) FROM test_case_manager.dbo.sprint_test_cases stc
           JOIN test_case_manager.dbo.test_cases tc ON tc.id = stc.test_case_id
           WHERE stc.sprint_id = ss.sprint_id AND stc.suite_id = s.id AND tc.status = 'Ready') AS ready_count,
        (SELECT COUNT(*) FROM test_case_manager.dbo.sprint_test_cases stc
           JOIN test_case_manager.dbo.test_cases tc ON tc.id = stc.test_case_id
           WHERE stc.sprint_id = ss.sprint_id AND stc.suite_id = s.id AND tc.status = 'Draft') AS draft_count
      FROM test_case_manager.dbo.sprint_suites ss
      JOIN test_case_manager.dbo.test_suites s ON s.id = ss.suite_id
      LEFT JOIN test_case_manager.dbo.projects p ON p.id = s.project_id
      WHERE ss.sprint_id = @sprint_id
      ORDER BY ss.board_status, ss.sort_order, ss.id
    `);

    res.json({ success: true, data: result.recordset });
  } catch (err) {
    console.error("GET Sprint Board Error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch sprint board", error: err.message });
  }
};

// ===============================
// ADD SUITE TO SPRINT BOARD
// ===============================
exports.addSuiteToSprint = async (req, res) => {
  try {
    const { id } = req.params;
    const { suite_id } = req.body;
    const userId = req.user?.id || null;
    const pool = await poolPromise;

    const existing = await pool
      .request()
      .input("sprint_id", sql.Int, id)
      .input("suite_id", sql.Int, suite_id)
      .query(`
        SELECT id FROM test_case_manager.dbo.sprint_suites
        WHERE sprint_id = @sprint_id AND suite_id = @suite_id
      `);

    if (existing.recordset.length > 0) {
      return res.status(400).json({ success: false, message: "Suite already on this sprint board" });
    }

    const maxOrder = await pool
      .request()
      .input("sprint_id", sql.Int, id)
      .query(`
        SELECT ISNULL(MAX(sort_order), 0) AS max_order
        FROM test_case_manager.dbo.sprint_suites
        WHERE sprint_id = @sprint_id AND board_status = 'To Do'
      `);

    await pool
      .request()
      .input("sprint_id", sql.Int, id)
      .input("suite_id", sql.Int, suite_id)
      .input("board_status", sql.VarChar, "To Do")
      .input("sort_order", sql.Int, (maxOrder.recordset[0].max_order || 0) + 1)
      .input("added_by", sql.Int, userId)
      .query(`
        INSERT INTO test_case_manager.dbo.sprint_suites
          (sprint_id, suite_id, board_status, sort_order, added_by)
        VALUES
          (@sprint_id, @suite_id, @board_status, @sort_order, @added_by)
      `);

    await logAudit({
      userId,
      action: "CREATE",
      module: "SPRINT_BOARD",
      entityType: "SPRINT_SUITE",
      entityId: Number(suite_id),
      description: `Added suite to sprint #${id} board`,
      status: "SUCCESS",
    });

    res.status(201).json({ success: true, message: "Suite added to sprint" });
  } catch (err) {
    console.error("Add Suite To Sprint Error:", err);
    res.status(500).json({ success: false, message: "Failed to add suite to sprint", error: err.message });
  }
};

// ===============================
// UPDATE SUITE BOARD STATUS
// ===============================
exports.updateSuiteBoardStatus = async (req, res) => {
  try {
    const { id, suiteId } = req.params;
    const { board_status } = req.body;
    const userId = req.user?.id || null;

    if (!BOARD_STATUSES.includes(board_status)) {
      return res.status(400).json({ success: false, message: "Invalid board status" });
    }

    const pool = await poolPromise;

    const maxOrder = await pool
      .request()
      .input("sprint_id", sql.Int, id)
      .input("board_status", sql.VarChar, board_status)
      .query(`
        SELECT ISNULL(MAX(sort_order), 0) AS max_order
        FROM test_case_manager.dbo.sprint_suites
        WHERE sprint_id = @sprint_id AND board_status = @board_status
      `);

    await pool
      .request()
      .input("sprint_id", sql.Int, id)
      .input("suite_id", sql.Int, suiteId)
      .input("board_status", sql.VarChar, board_status)
      .input("sort_order", sql.Int, (maxOrder.recordset[0].max_order || 0) + 1)
      .query(`
        UPDATE test_case_manager.dbo.sprint_suites
        SET board_status = @board_status, sort_order = @sort_order
        WHERE sprint_id = @sprint_id AND suite_id = @suite_id
      `);

    await logAudit({
      userId,
      action: "STATUS_CHANGE",
      module: "SPRINT_BOARD",
      entityType: "SPRINT_SUITE",
      entityId: Number(suiteId),
      description: `Suite moved to ${board_status} on sprint #${id} board`,
      newValues: { board_status },
      status: "SUCCESS",
    });

    res.json({ success: true, message: "Board status updated" });
  } catch (err) {
    console.error("Update Suite Board Status Error:", err);
    res.status(500).json({ success: false, message: "Failed to update board status", error: err.message });
  }
};

// ===============================
// REMOVE SUITE FROM SPRINT BOARD
// ===============================
exports.removeSuiteFromSprint = async (req, res) => {
  try {
    const { id, suiteId } = req.params;
    const userId = req.user?.id || null;
    const pool = await poolPromise;

    await pool
      .request()
      .input("sprint_id", sql.Int, id)
      .input("suite_id", sql.Int, suiteId)
      .query(`
        DELETE FROM test_case_manager.dbo.sprint_test_cases
        WHERE sprint_id = @sprint_id AND suite_id = @suite_id;

        DELETE FROM test_case_manager.dbo.sprint_suites
        WHERE sprint_id = @sprint_id AND suite_id = @suite_id;
      `);

    await logAudit({
      userId,
      action: "DELETE",
      module: "SPRINT_BOARD",
      entityType: "SPRINT_SUITE",
      entityId: Number(suiteId),
      description: `Removed suite from sprint #${id} board`,
      status: "SUCCESS",
    });

    res.json({ success: true, message: "Suite removed from sprint" });
  } catch (err) {
    console.error("Remove Suite From Sprint Error:", err);
    res.status(500).json({ success: false, message: "Failed to remove suite from sprint", error: err.message });
  }
};

// ===============================
// GET TEST CASES FOR SUITE IN SPRINT
// — Now includes latest_run per test case
// ===============================
exports.getSprintSuiteTestCases = async (req, res) => {
  try {
    const { id, suiteId } = req.params;
    const pool = await poolPromise;

    const casesResult = await pool
      .request()
      .input("sprint_id", sql.Int, id)
      .input("suite_id", sql.Int, suiteId)
      .query(`
        SELECT
          tc.id, tc.title, tc.priority, tc.status, tc.preconditions,
          tc.suite_id AS owning_suite_id,
          owns.suite_name AS owning_suite_name,
          stc.linked_at,
          u.username AS linked_by_name
        FROM test_case_manager.dbo.sprint_test_cases stc
        JOIN test_case_manager.dbo.test_cases tc ON tc.id = stc.test_case_id
        LEFT JOIN test_case_manager.dbo.test_suites owns ON owns.id = tc.suite_id
        LEFT JOIN test_case_manager.dbo.users u ON u.id = stc.linked_by
        WHERE stc.sprint_id = @sprint_id AND stc.suite_id = @suite_id
        ORDER BY tc.id ASC
      `);

    const caseIds = casesResult.recordset.map((c) => c.id);
    let stepsByCase = {};
    let latestRunByCase = {};

    if (caseIds.length > 0) {
      // Fetch steps
      const stepsResult = await pool.request().query(`
        SELECT * FROM test_case_manager.dbo.test_steps
        WHERE test_case_id IN (${caseIds.join(",")})
        ORDER BY step_number ASC
      `);
      stepsByCase = stepsResult.recordset.reduce((acc, step) => {
        (acc[step.test_case_id] = acc[step.test_case_id] || []).push(step);
        return acc;
      }, {});

      // Fetch latest Playwright run per test case
      const runsResult = await pool.request().query(`
        SELECT pr.*, u.username AS executed_by_name
        FROM test_case_manager.dbo.playwright_test_runs pr
        LEFT JOIN test_case_manager.dbo.users u ON u.id = pr.created_by
        WHERE pr.test_case_id IN (${caseIds.join(",")})
          AND pr.id IN (
            SELECT MAX(id) FROM test_case_manager.dbo.playwright_test_runs
            WHERE test_case_id IN (${caseIds.join(",")})
            GROUP BY test_case_id
          )
      `);
      latestRunByCase = runsResult.recordset.reduce((acc, run) => {
        acc[run.test_case_id] = run;
        return acc;
      }, {});
    }

    const data = casesResult.recordset.map((c) => ({
      ...c,
      steps: stepsByCase[c.id] || [],
      latest_run: latestRunByCase[c.id] || null,
    }));

    res.json({ success: true, data });
  } catch (err) {
    console.error("GET Sprint Suite Test Cases Error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch test cases", error: err.message });
  }
};

// ===============================
// GET AVAILABLE TEST CASES TO LINK
// ===============================
exports.getAvailableTestCasesForSuite = async (req, res) => {
  try {
    const { id, suiteId } = req.params;
    const pool = await poolPromise;

    const result = await pool
      .request()
      .input("sprint_id", sql.Int, id)
      .input("suite_id", sql.Int, suiteId)
      .query(`
        SELECT tc.id, tc.title, tc.priority, tc.status, ts.suite_name, p.project_name
        FROM test_case_manager.dbo.test_cases tc
        JOIN test_case_manager.dbo.test_suites ts ON ts.id = tc.suite_id
        LEFT JOIN test_case_manager.dbo.projects p ON p.id = ts.project_id
        WHERE ts.project_id = (SELECT project_id FROM test_case_manager.dbo.test_suites WHERE id = @suite_id)
          AND tc.id NOT IN (
            SELECT test_case_id FROM test_case_manager.dbo.sprint_test_cases WHERE sprint_id = @sprint_id
          )
        ORDER BY tc.id DESC
      `);

    res.json({ success: true, data: result.recordset });
  } catch (err) {
    console.error("GET Available Test Cases Error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch available test cases", error: err.message });
  }
};

// ===============================
// LINK EXISTING TEST CASE TO SPRINT SUITE
// ===============================
exports.linkTestCaseToSuite = async (req, res) => {
  try {
    const { id, suiteId } = req.params;
    const { test_case_id } = req.body;
    const userId = req.user?.id || null;
    const pool = await poolPromise;

    const existing = await pool
      .request()
      .input("sprint_id", sql.Int, id)
      .input("test_case_id", sql.Int, test_case_id)
      .query(`
        SELECT id FROM test_case_manager.dbo.sprint_test_cases
        WHERE sprint_id = @sprint_id AND test_case_id = @test_case_id
      `);

    if (existing.recordset.length > 0) {
      return res.status(400).json({ success: false, message: "Test case already linked to this sprint" });
    }

    await pool
      .request()
      .input("sprint_id", sql.Int, id)
      .input("suite_id", sql.Int, suiteId)
      .input("test_case_id", sql.Int, test_case_id)
      .input("linked_by", sql.Int, userId)
      .query(`
        INSERT INTO test_case_manager.dbo.sprint_test_cases
          (sprint_id, suite_id, test_case_id, linked_by)
        VALUES
          (@sprint_id, @suite_id, @test_case_id, @linked_by)
      `);

    await logAudit({
      userId,
      action: "CREATE",
      module: "SPRINT_BOARD",
      entityType: "SPRINT_TEST_CASE",
      entityId: Number(test_case_id),
      description: `Linked test case #${test_case_id} to suite #${suiteId} in sprint #${id}`,
      status: "SUCCESS",
    });

    res.status(201).json({ success: true, message: "Test case linked" });
  } catch (err) {
    console.error("Link Test Case Error:", err);
    res.status(500).json({ success: false, message: "Failed to link test case", error: err.message });
  }
};

// ===============================
// CREATE TEST CASE IN SUITE (auto-linked to sprint)
// ===============================
exports.createTestCaseInSuite = async (req, res) => {
  try {
    const { id, suiteId } = req.params;
    const { title, preconditions, priority, status, steps } = req.body;
    const userId = req.user?.id || null;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: "Title is required" });
    }

    const pool = await poolPromise;

    const caseResult = await pool
      .request()
      .input("suite_id", sql.Int, suiteId)
      .input("title", sql.VarChar, title)
      .input("preconditions", sql.VarChar, preconditions || null)
      .input("priority", sql.VarChar, priority || "Medium")
      .input("status", sql.VarChar, status || "Draft")
      .input("created_by", sql.Int, userId)
      .input("updated_by", sql.Int, userId)
      .query(`
        INSERT INTO test_case_manager.dbo.test_cases
          (suite_id, title, preconditions, priority, status, created_by, updated_by)
        OUTPUT INSERTED.*
        VALUES
          (@suite_id, @title, @preconditions, @priority, @status, @created_by, @updated_by)
      `);

    const testCase = caseResult.recordset[0];

    if (Array.isArray(steps)) {
      for (const step of steps) {
        if (!step.action || !step.action.trim()) continue;
        await pool
          .request()
          .input("test_case_id", sql.Int, testCase.id)
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

    await pool
      .request()
      .input("sprint_id", sql.Int, id)
      .input("suite_id", sql.Int, suiteId)
      .input("test_case_id", sql.Int, testCase.id)
      .input("linked_by", sql.Int, userId)
      .query(`
        INSERT INTO test_case_manager.dbo.sprint_test_cases
          (sprint_id, suite_id, test_case_id, linked_by)
        VALUES
          (@sprint_id, @suite_id, @test_case_id, @linked_by)
      `);

    await logAudit({
      userId,
      action: "CREATE",
      module: "TEST_CASE",
      entityType: "TEST_CASE",
      entityId: testCase.id,
      entityName: testCase.title,
      description: `Created test case from sprint #${id} board`,
      newValues: sanitizeAuditObject(testCase),
      status: "SUCCESS",
    });

    res.status(201).json({ success: true, message: "Test case created and linked", id: testCase.id });
  } catch (err) {
    console.error("Create Test Case In Suite Error:", err);
    res.status(500).json({ success: false, message: "Failed to create test case", error: err.message });
  }
};

// ===============================
// UNLINK TEST CASE FROM SPRINT
// ===============================
exports.unlinkTestCaseFromSuite = async (req, res) => {
  try {
    const { id, suiteId, testCaseId } = req.params;
    const userId = req.user?.id || null;
    const pool = await poolPromise;

    await pool
      .request()
      .input("sprint_id", sql.Int, id)
      .input("suite_id", sql.Int, suiteId)
      .input("test_case_id", sql.Int, testCaseId)
      .query(`
        DELETE FROM test_case_manager.dbo.sprint_test_cases
        WHERE sprint_id = @sprint_id AND suite_id = @suite_id AND test_case_id = @test_case_id
      `);

    await logAudit({
      userId,
      action: "DELETE",
      module: "SPRINT_BOARD",
      entityType: "SPRINT_TEST_CASE",
      entityId: Number(testCaseId),
      description: `Unlinked test case #${testCaseId} from suite #${suiteId} in sprint #${id}`,
      status: "SUCCESS",
    });

    res.json({ success: true, message: "Test case unlinked" });
  } catch (err) {
    console.error("Unlink Test Case Error:", err);
    res.status(500).json({ success: false, message: "Failed to unlink test case", error: err.message });
  }
};

// ===============================
// NOTIFY EXECUTION STARTED
// — Called by the Playwright runner when a test case starts executing.
//   Auto-bumps the suite's board_status from "To Do" → "In Progress".
//   Returns updated execution progress for the suite.
// ===============================
exports.notifyExecutionStarted = async (req, res) => {
  try {
    const { id, suiteId, testCaseId } = req.params;
    const userId = req.user?.id || null;
    const pool = await poolPromise;

    // 1. Auto-advance board status: To Do → In Progress only
    const current = await pool
      .request()
      .input("sprint_id", sql.Int, id)
      .input("suite_id", sql.Int, suiteId)
      .query(`
        SELECT board_status FROM test_case_manager.dbo.sprint_suites
        WHERE sprint_id = @sprint_id AND suite_id = @suite_id
      `);

    const currentStatus = current.recordset[0]?.board_status;

    if (currentStatus === "To Do") {
      await pool
        .request()
        .input("sprint_id", sql.Int, id)
        .input("suite_id", sql.Int, suiteId)
        .query(`
          UPDATE test_case_manager.dbo.sprint_suites
          SET board_status = 'In Progress'
          WHERE sprint_id = @sprint_id AND suite_id = @suite_id
        `);

      await logAudit({
        userId,
        action: "STATUS_CHANGE",
        module: "SPRINT_BOARD",
        entityType: "SPRINT_SUITE",
        entityId: Number(suiteId),
        description: `Suite auto-moved to In Progress when test case #${testCaseId} started executing`,
        oldValues: { board_status: "To Do" },
        newValues: { board_status: "In Progress" },
        status: "SUCCESS",
      });
    }

    // 2. Compute updated execution progress for this suite
    const progress = await _computeSuiteProgress(pool, Number(id), Number(suiteId));

    res.json({
      success: true,
      board_status_changed: currentStatus === "To Do",
      new_board_status: currentStatus === "To Do" ? "In Progress" : currentStatus,
      progress,
    });
  } catch (err) {
    console.error("Notify Execution Started Error:", err);
    res.status(500).json({ success: false, message: "Failed to notify execution start", error: err.message });
  }
};

// ===============================
// GET EXECUTION PROGRESS FOR A SUITE IN A SPRINT
// — Returns pass/fail/pending counts and overall % for the live progress bar
// ===============================
exports.getExecutionProgress = async (req, res) => {
  try {
    const { id, suiteId } = req.params;
    const pool = await poolPromise;
    const progress = await _computeSuiteProgress(pool, Number(id), Number(suiteId));
    res.json({ success: true, ...progress });
  } catch (err) {
    console.error("GET Execution Progress Error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch progress", error: err.message });
  }
};

// Internal helper — reused by notifyExecutionStarted + getExecutionProgress
async function _computeSuiteProgress(pool, sprintId, suiteId) {
  const result = await pool
    .request()
    .input("sprint_id", sql.Int, sprintId)
    .input("suite_id", sql.Int, suiteId)
    .query(`
      SELECT
        COUNT(stc.test_case_id) AS total,
        SUM(CASE WHEN pr.status = 'passed'  THEN 1 ELSE 0 END) AS passed,
        SUM(CASE WHEN pr.status = 'failed'  THEN 1 ELSE 0 END) AS failed,
        SUM(CASE WHEN pr.status = 'running' THEN 1 ELSE 0 END) AS running,
        SUM(CASE WHEN pr.status IS NULL OR pr.status NOT IN ('passed','failed','running') THEN 1 ELSE 0 END) AS pending
      FROM test_case_manager.dbo.sprint_test_cases stc
      LEFT JOIN (
        SELECT test_case_id, status
        FROM test_case_manager.dbo.playwright_test_runs pr_inner
        WHERE pr_inner.id = (
          SELECT MAX(id) FROM test_case_manager.dbo.playwright_test_runs
          WHERE test_case_id = pr_inner.test_case_id
        )
      ) pr ON pr.test_case_id = stc.test_case_id
      WHERE stc.sprint_id = @sprint_id AND stc.suite_id = @suite_id
    `);

  const row = result.recordset[0] || {};
  const total = row.total || 0;
  const passed = row.passed || 0;
  const failed = row.failed || 0;
  const running = row.running || 0;
  const pending = row.pending || 0;
  const percent = total > 0 ? Math.round((passed / total) * 100) : 0;

  return { total, passed, failed, running, pending, percent };
}

// ===============================
// GET SPRINT ASSIGNEES
// ===============================
exports.getSprintAssignees = async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await poolPromise;

    const result = await pool.request().input("sprint_id", sql.Int, id).query(`
      SELECT
        sa.id AS assignment_id,
        u.id,
        u.username,
        u.full_name,
        u.email,
        sa.assigned_at,
        assigner.username AS assigned_by_name
      FROM test_case_manager.dbo.sprint_assignees sa
      JOIN test_case_manager.dbo.users u ON u.id = sa.user_id
      LEFT JOIN test_case_manager.dbo.users assigner ON assigner.id = sa.assigned_by
      WHERE sa.sprint_id = @sprint_id
      ORDER BY sa.assigned_at ASC
    `);

    res.json({ success: true, data: result.recordset });
  } catch (err) {
    console.error("GET Sprint Assignees Error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch assignees", error: err.message });
  }
};

// ===============================
// ADD SPRINT ASSIGNEE
// ===============================
exports.addSprintAssignee = async (req, res) => {
  try {
    const { id } = req.params;
    const { user_id } = req.body;
    const assignedBy = req.user?.id || null;
    const pool = await poolPromise;

    if (!user_id) {
      return res.status(400).json({ success: false, message: "user_id is required" });
    }

    const existing = await pool
      .request()
      .input("sprint_id", sql.Int, id)
      .input("user_id", sql.Int, user_id)
      .query(`
        SELECT id FROM test_case_manager.dbo.sprint_assignees
        WHERE sprint_id = @sprint_id AND user_id = @user_id
      `);

    if (existing.recordset.length > 0) {
      return res.status(400).json({ success: false, message: "User already assigned to this sprint" });
    }

    await pool
      .request()
      .input("sprint_id", sql.Int, id)
      .input("user_id", sql.Int, user_id)
      .input("assigned_by", sql.Int, assignedBy)
      .query(`
        INSERT INTO test_case_manager.dbo.sprint_assignees (sprint_id, user_id, assigned_by)
        VALUES (@sprint_id, @user_id, @assigned_by)
      `);

    await logAudit({
      userId: assignedBy,
      action: "CREATE",
      module: "SPRINT",
      entityType: "SPRINT_ASSIGNEE",
      entityId: Number(id),
      description: `User #${user_id} assigned to sprint #${id}`,
      status: "SUCCESS",
    });

    res.status(201).json({ success: true, message: "User assigned to sprint" });
  } catch (err) {
    console.error("Add Sprint Assignee Error:", err);
    res.status(500).json({ success: false, message: "Failed to assign user", error: err.message });
  }
};

// ===============================
// REMOVE SPRINT ASSIGNEE
// ===============================
exports.removeSprintAssignee = async (req, res) => {
  try {
    const { id, userId: targetUserId } = req.params;
    const requesterId = req.user?.id || null;
    const pool = await poolPromise;

    await pool
      .request()
      .input("sprint_id", sql.Int, id)
      .input("user_id", sql.Int, targetUserId)
      .query(`
        DELETE FROM test_case_manager.dbo.sprint_assignees
        WHERE sprint_id = @sprint_id AND user_id = @user_id
      `);

    await logAudit({
      userId: requesterId,
      action: "DELETE",
      module: "SPRINT",
      entityType: "SPRINT_ASSIGNEE",
      entityId: Number(id),
      description: `User #${targetUserId} removed from sprint #${id}`,
      status: "SUCCESS",
    });

    res.json({ success: true, message: "Assignee removed" });
  } catch (err) {
    console.error("Remove Sprint Assignee Error:", err);
    res.status(500).json({ success: false, message: "Failed to remove assignee", error: err.message });
  }
};

// ===============================
// GET SPRINT COMMENTS
// ===============================
exports.getSprintComments = async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await poolPromise;

    const result = await pool.request().input("sprint_id", sql.Int, id).query(`
      SELECT
        sc.id,
        sc.comment,
        sc.created_at,
        sc.updated_at,
        u.username AS created_by_name,
        u.full_name AS created_by_full_name,
        sc.user_id
      FROM test_case_manager.dbo.sprint_comments sc
      JOIN test_case_manager.dbo.users u ON u.id = sc.user_id
      WHERE sc.sprint_id = @sprint_id
      ORDER BY sc.created_at ASC
    `);

    res.json({ success: true, data: result.recordset });
  } catch (err) {
    console.error("GET Sprint Comments Error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch comments", error: err.message });
  }
};

// ===============================
// ADD SPRINT COMMENT
// ===============================
exports.addSprintComment = async (req, res) => {
  try {
    const { id } = req.params;
    const { comment } = req.body;
    const userId = req.user?.id || null;

    if (!comment || !comment.trim()) {
      return res.status(400).json({ success: false, message: "Comment text is required" });
    }

    const pool = await poolPromise;

    const insertResult = await pool
      .request()
      .input("sprint_id", sql.Int, id)
      .input("user_id", sql.Int, userId)
      .input("comment", sql.NVarChar(sql.MAX), comment.trim())
      .query(`
        INSERT INTO test_case_manager.dbo.sprint_comments (sprint_id, user_id, comment)
        OUTPUT INSERTED.*
        VALUES (@sprint_id, @user_id, @comment)
      `);

    const newComment = insertResult.recordset[0];

    // Enrich with username for immediate return
    const enriched = await pool
      .request()
      .input("id", sql.Int, newComment.id)
      .query(`
        SELECT sc.*, u.username AS created_by_name, u.full_name AS created_by_full_name
        FROM test_case_manager.dbo.sprint_comments sc
        JOIN test_case_manager.dbo.users u ON u.id = sc.user_id
        WHERE sc.id = @id
      `);

    res.status(201).json({ success: true, data: enriched.recordset[0] });
  } catch (err) {
    console.error("Add Sprint Comment Error:", err);
    res.status(500).json({ success: false, message: "Failed to add comment", error: err.message });
  }
};

// ===============================
// DELETE SPRINT COMMENT
// ===============================
exports.deleteSprintComment = async (req, res) => {
  try {
    const { id, commentId } = req.params;
    const userId = req.user?.id || null;
    const pool = await poolPromise;

    // Only the author or an admin can delete
    const comment = await pool
      .request()
      .input("id", sql.Int, commentId)
      .input("sprint_id", sql.Int, id)
      .query(`
        SELECT * FROM test_case_manager.dbo.sprint_comments
        WHERE id = @id AND sprint_id = @sprint_id
      `);

    if (!comment.recordset.length) {
      return res.status(404).json({ success: false, message: "Comment not found" });
    }

    if (comment.recordset[0].user_id !== userId) {
      return res.status(403).json({ success: false, message: "You can only delete your own comments" });
    }

    await pool.request().input("id", sql.Int, commentId).query(`
      DELETE FROM test_case_manager.dbo.sprint_comments WHERE id = @id
    `);

    res.json({ success: true, message: "Comment deleted" });
  } catch (err) {
    console.error("Delete Sprint Comment Error:", err);
    res.status(500).json({ success: false, message: "Failed to delete comment", error: err.message });
  }
};