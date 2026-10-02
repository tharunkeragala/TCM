const recorder = require("../services/playwrightRecorder");
const { poolPromise } = require("../config/db");
const sql = require("mssql");
const {
  hasProjectAccess,
  getProjectIdFromTestCase,
} = require("../middleware/projectAccess");

// Starting/stopping the recorder itself is intentionally not tied to project_id.
// The request has no test-case/project relationship at this point. Project access
// is enforced when the recorded/edited script is saved to a concrete test case.
exports.startRecording = async (req, res) => {
  try {
    const { url } = req.body;

    if (!url || !String(url).trim()) {
      return res.status(400).json({
        success: false,
        message: "URL is required",
      });
    }

    const sessionId = await recorder.startRecording(String(url).trim());

    return res.status(200).json({
      success: true,
      sessionId,
    });
  } catch (err) {
    console.error("START Recorder Error:", err);

    return res.status(500).json({
      success: false,
      message: "Failed to start recorder",
      error: err.message,
    });
  }
};

exports.stopRecording = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await recorder.stopRecording(id);

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (err) {
    console.error("STOP Recorder Error:", err);

    return res.status(500).json({
      success: false,
      message: "Failed to stop recorder",
      error: err.message,
    });
  }
};

exports.updateTestCaseScript = async (req, res) => {
  try {
    const testCaseId = Number(req.params.id);
    const playwrightScript = req.body?.playwright_script;
    const userId = Number(req.user?.id);

    if (!Number.isInteger(testCaseId) || testCaseId <= 0) {
      return res.status(400).json({
        success: false,
        message: "A valid test case ID is required.",
      });
    }

    if (typeof playwrightScript !== "string") {
      return res.status(400).json({
        success: false,
        message: "playwright_script must be a string.",
      });
    }

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const pool = await poolPromise;

    // Resolve the exact project through test case -> suite -> project.
    const projectId = await getProjectIdFromTestCase(pool, testCaseId);

    if (!projectId) {
      return res.status(404).json({
        success: false,
        message: "Test case not found.",
      });
    }

    const allowed = await hasProjectAccess(pool, userId, projectId);

    if (!allowed) {
      return res.status(403).json({
        success: false,
        message: "Access denied: you are not assigned to this project.",
      });
    }

    const existingResult = await pool
      .request()
      .input("id", sql.Int, testCaseId)
      .query(`
        SELECT
          tc.id,
          tc.title,
          tc.workflow_status,
          tc.workflow_request_id,
          tc.playwright_script,
          ts.project_id
        FROM test_case_manager.dbo.test_cases tc
        INNER JOIN test_case_manager.dbo.test_suites ts
          ON ts.id = tc.suite_id
        WHERE tc.id = @id
      `);

    const existing = existingResult.recordset[0];

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Test case not found.",
      });
    }

    // Do the update separately so we can verify a row was actually changed.
    const updateResult = await pool
      .request()
      .input("id", sql.Int, testCaseId)
      .input("playwright_script", sql.NVarChar(sql.MAX), playwrightScript)
      .input("updated_by", sql.Int, userId)
      .query(`
        UPDATE test_case_manager.dbo.test_cases
        SET playwright_script = @playwright_script,
            updated_by = @updated_by,
            updated_at = GETDATE()
        WHERE id = @id
      `);

    if (!updateResult.rowsAffected?.[0]) {
      return res.status(500).json({
        success: false,
        message: "The Playwright script was not saved.",
      });
    }

    // Read the saved row back from the database as the source of truth.
    const savedResult = await pool
      .request()
      .input("id", sql.Int, testCaseId)
      .query(`
        SELECT
          id,
          title,
          playwright_script,
          workflow_status,
          workflow_request_id,
          updated_by,
          updated_at
        FROM test_case_manager.dbo.test_cases
        WHERE id = @id
      `);

    const saved = savedResult.recordset[0];

    return res.status(200).json({
      success: true,
      message: "Playwright script saved successfully.",
      data: saved,
    });
  } catch (err) {
    console.error("UPDATE Test Case Script Error:", err);

    return res.status(500).json({
      success: false,
      message: "Failed to save Playwright script.",
      error: err.message,
    });
  }
};
