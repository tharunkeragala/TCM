const { poolPromise } = require("../config/db");
const sql = require("mssql");
const {
  runTestCase,
  parseTestScript,
  cancelRun,
} = require("../services/playwrightRunner");
const {
  hasProjectAccess,
  getProjectIdFromTestCase,
  getProjectIdFromRun,
  projectAccessSql,
} = require("../middleware/projectAccess");

async function ensureTestCaseAccess(req, res, testCaseId) {
  const pool = await poolPromise;
  const projectId = await getProjectIdFromTestCase(pool, testCaseId);

  if (!projectId) {
    res.status(404).json({
      success: false,
      message: "Test case not found.",
    });
    return false;
  }

  const allowed = await hasProjectAccess(pool, req.user?.id, projectId);

  if (!allowed) {
    res.status(403).json({
      success: false,
      message: "Access denied: you are not assigned to this project.",
    });
    return false;
  }

  return true;
}

async function ensureRunAccess(req, res, runId) {
  const pool = await poolPromise;
  const projectId = await getProjectIdFromRun(pool, runId);

  if (!projectId) {
    res.status(404).json({
      success: false,
      message: "Run not found.",
    });
    return false;
  }

  const allowed = await hasProjectAccess(pool, req.user?.id, projectId);

  if (!allowed) {
    res.status(403).json({
      success: false,
      message: "Access denied: you are not assigned to this project.",
    });
    return false;
  }

  return true;
}

// Preview/parsing only transforms script text. It does not read/write project data.
// The route permission middleware controls who may use this utility.
exports.parseSteps = async (req, res) => {
  try {
    const { script } = req.body;
    const steps = parseTestScript(script || "");

    return res.status(200).json({
      success: true,
      data: steps,
    });
  } catch (err) {
    console.error("PARSE Playwright Steps Error:", err);

    return res.status(500).json({
      success: false,
      message: "Failed to parse script",
      error: err.message,
    });
  }
};

exports.runTestCase = async (req, res) => {
  try {
    if (!(await ensureTestCaseAccess(req, res, req.params.id))) return;

    const runId = await runTestCase(req.params.id, req.user?.id || null);

    return res.status(202).json({
      success: true,
      runId,
    });
  } catch (err) {
    console.error("RUN Playwright Test Error:", err);

    return res.status(500).json({
      success: false,
      message: "Failed to run Playwright test",
      error: err.message,
    });
  }
};

exports.cancelRun = async (req, res) => {
  try {
    if (!(await ensureRunAccess(req, res, req.params.runId))) return;

    const found = cancelRun(Number(req.params.runId));

    if (!found) {
      return res.status(404).json({
        success: false,
        message: "No active run with that ID",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Cancellation signal sent",
    });
  } catch (err) {
    console.error("CANCEL Playwright Run Error:", err);

    return res.status(500).json({
      success: false,
      message: "Failed to cancel run",
      error: err.message,
    });
  }
};

exports.getRunsByTestCase = async (req, res) => {
  try {
    if (!(await ensureTestCaseAccess(req, res, req.params.id))) return;

    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("test_case_id", sql.Int, req.params.id)
      .query(`
        SELECT r.*, u.username AS created_by_name
        FROM test_case_manager.dbo.playwright_test_runs r
        LEFT JOIN test_case_manager.dbo.users u ON u.id = r.created_by
        WHERE r.test_case_id = @test_case_id
        ORDER BY r.created_at DESC
      `);

    return res.status(200).json({
      success: true,
      data: result.recordset,
    });
  } catch (err) {
    console.error("GET Playwright Runs Error:", err);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch runs",
      error: err.message,
    });
  }
};

exports.getRunById = async (req, res) => {
  try {
    if (!(await ensureRunAccess(req, res, req.params.runId))) return;

    const pool = await poolPromise;

    const runResult = await pool
      .request()
      .input("id", sql.Int, req.params.runId)
      .query(`
        SELECT
          r.*,
          tc.title AS test_case_title,
          u.username AS created_by_name
        FROM test_case_manager.dbo.playwright_test_runs r
        LEFT JOIN test_case_manager.dbo.test_cases tc ON tc.id = r.test_case_id
        LEFT JOIN test_case_manager.dbo.users u ON u.id = r.created_by
        WHERE r.id = @id
      `);

    if (!runResult.recordset.length) {
      return res.status(404).json({
        success: false,
        message: "Run not found",
      });
    }

    const stepsResult = await pool
      .request()
      .input("run_id", sql.Int, req.params.runId)
      .query(`
        SELECT *
        FROM test_case_manager.dbo.playwright_test_run_steps
        WHERE run_id = @run_id
        ORDER BY step_number ASC
      `);

    return res.status(200).json({
      success: true,
      data: {
        run: runResult.recordset[0],
        steps: stepsResult.recordset,
      },
    });
  } catch (err) {
    console.error("GET Playwright Run Error:", err);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch run",
      error: err.message,
    });
  }
};

exports.getRunSteps = async (req, res) => {
  try {
    if (!(await ensureRunAccess(req, res, req.params.runId))) return;

    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("run_id", sql.Int, req.params.runId)
      .query(`
        SELECT *
        FROM test_case_manager.dbo.playwright_test_run_steps
        WHERE run_id = @run_id
        ORDER BY step_number ASC
      `);

    return res.status(200).json({
      success: true,
      data: result.recordset,
    });
  } catch (err) {
    console.error("GET Playwright Run Steps Error:", err);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch run steps",
      error: err.message,
    });
  }
};

exports.getStats = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("user_id", sql.Int, req.user?.id)
      .query(`
        SELECT
          COUNT(*) AS total_runs,
          SUM(CASE WHEN r.status = 'passed' THEN 1 ELSE 0 END) AS passed_runs,
          SUM(CASE WHEN r.status = 'failed' THEN 1 ELSE 0 END) AS failed_runs,
          SUM(CASE WHEN r.status = 'aborted' THEN 1 ELSE 0 END) AS aborted_runs,
          AVG(
            CASE
              WHEN r.status IN ('passed', 'failed', 'aborted')
              THEN CAST(r.duration_ms AS BIGINT)
            END
          ) AS avg_duration_ms
        FROM test_case_manager.dbo.playwright_test_runs r
        INNER JOIN test_case_manager.dbo.test_cases tc ON tc.id = r.test_case_id
        INNER JOIN test_case_manager.dbo.test_suites ts ON ts.id = tc.suite_id
        INNER JOIN test_case_manager.dbo.projects p ON p.id = ts.project_id
        WHERE ISNULL(p.is_archived, 0) = 0
          AND ${projectAccessSql("p")}
      `);

    return res.status(200).json({
      success: true,
      data: result.recordset[0],
    });
  } catch (err) {
    console.error("GET Playwright Stats Error:", err);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch Playwright stats",
      error: err.message,
    });
  }
};
