const { poolPromise } = require("../config/db");
const sql = require("mssql");
const {
  runTestCase,
  parseTestScript,
  cancelRun,
} = require("../services/playwrightRunner");

exports.parseSteps = async (req, res) => {
  try {
    const { script } = req.body;
    const steps = parseTestScript(script || "");
    res.status(200).json({ success: true, data: steps });
  } catch (err) {
    console.error("PARSE Playwright Steps Error:", err);
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to parse script",
        error: err.message,
      });
  }
};

exports.runTestCase = async (req, res) => {
  try {
    const runId = await runTestCase(req.params.id, req.user?.id || null);
    res.status(202).json({ success: true, runId });
  } catch (err) {
    console.error("RUN Playwright Test Error:", err);
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to run Playwright test",
        error: err.message,
      });
  }
};

exports.cancelRun = async (req, res) => {
  try {
    const found = cancelRun(Number(req.params.runId));

    if (!found) {
      return res
        .status(404)
        .json({ success: false, message: "No active run with that ID" });
    }

    res
      .status(200)
      .json({ success: true, message: "Cancellation signal sent" });
  } catch (err) {
    console.error("CANCEL Playwright Run Error:", err);
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to cancel run",
        error: err.message,
      });
  }
};

exports.getRunsByTestCase = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("test_case_id", sql.Int, req.params.id).query(`
        SELECT r.*, u.username AS created_by_name
        FROM test_case_manager.dbo.playwright_test_runs r
        LEFT JOIN test_case_manager.dbo.users u ON u.id = r.created_by
        WHERE r.test_case_id = @test_case_id
        ORDER BY r.created_at DESC
      `);

    res.status(200).json({ success: true, data: result.recordset });
  } catch (err) {
    console.error("GET Playwright Runs Error:", err);
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to fetch runs",
        error: err.message,
      });
  }
};

exports.getRunById = async (req, res) => {
  try {
    const pool = await poolPromise;

    const runResult = await pool
      .request()
      .input("id", sql.Int, req.params.runId).query(`
        SELECT r.*, tc.title AS test_case_title, u.username AS created_by_name
        FROM test_case_manager.dbo.playwright_test_runs r
        LEFT JOIN test_case_manager.dbo.test_cases tc ON tc.id = r.test_case_id
        LEFT JOIN test_case_manager.dbo.users u ON u.id = r.created_by
        WHERE r.id = @id
      `);

    if (!runResult.recordset.length) {
      return res.status(404).json({ success: false, message: "Run not found" });
    }

    const stepsResult = await pool
      .request()
      .input("run_id", sql.Int, req.params.runId).query(`
        SELECT *
        FROM test_case_manager.dbo.playwright_test_run_steps
        WHERE run_id = @run_id
        ORDER BY step_number ASC
      `);

    res.status(200).json({
      success: true,
      data: {
        run: runResult.recordset[0],
        steps: stepsResult.recordset,
      },
    });
  } catch (err) {
    console.error("GET Playwright Run Error:", err);
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to fetch run",
        error: err.message,
      });
  }
};

exports.getRunSteps = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("run_id", sql.Int, req.params.runId).query(`
        SELECT *
        FROM test_case_manager.dbo.playwright_test_run_steps
        WHERE run_id = @run_id
        ORDER BY step_number ASC
      `);

    res.status(200).json({ success: true, data: result.recordset });
  } catch (err) {
    console.error("GET Playwright Run Steps Error:", err);
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to fetch run steps",
        error: err.message,
      });
  }
};

exports.getStats = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT
        (SELECT COUNT(*) FROM test_case_manager.dbo.playwright_test_runs) AS total_runs,
        (SELECT COUNT(*) FROM test_case_manager.dbo.playwright_test_runs WHERE status = 'passed') AS passed_runs,
        (SELECT COUNT(*) FROM test_case_manager.dbo.playwright_test_runs WHERE status = 'failed') AS failed_runs,
        (SELECT COUNT(*) FROM test_case_manager.dbo.playwright_test_runs WHERE status = 'aborted') AS aborted_runs,
        (SELECT AVG(duration_ms) FROM test_case_manager.dbo.playwright_test_runs WHERE status IN ('passed', 'failed', 'aborted')) AS avg_duration_ms
    `);

    res.status(200).json({ success: true, data: result.recordset[0] });
  } catch (err) {
    console.error("GET Playwright Stats Error:", err);
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to fetch Playwright stats",
        error: err.message,
      });
  }
};
