const recorder = require("../services/playwrightRecorder");

exports.startRecording = async (req, res) => {
  try {
    const { url } = req.body;

    if (!url || !String(url).trim()) {
      return res
        .status(400)
        .json({ success: false, message: "URL is required" });
    }

    const sessionId = await recorder.startRecording(String(url).trim());

    res.status(200).json({ success: true, sessionId });
  } catch (err) {
    console.error("START Recorder Error:", err);
    res.status(500).json({
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

    res.status(200).json({ success: true, ...result });
  } catch (err) {
    console.error("STOP Recorder Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to stop recorder",
      error: err.message,
    });
  }
};

exports.updateTestCaseScript = async (req, res) => {
  try {
    const { poolPromise } = require("../config/db");
    const sql = require("mssql");

    const testCaseId = Number(req.params.id);
    const playwrightScript = req.body?.playwright_script;

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

    const pool = await poolPromise;

    const existing = await pool.request().input("id", sql.Int, testCaseId)
      .query(`
        SELECT id, title, workflow_status, workflow_request_id
        FROM dbo.test_cases
        WHERE id = @id
      `);

    if (!existing.recordset.length) {
      return res.status(404).json({
        success: false,
        message: "Test case not found.",
      });
    }

    const userId = req.user?.id ? Number(req.user.id) : null;

    const request = pool
      .request()
      .input("id", sql.Int, testCaseId)
      .input("playwright_script", sql.NVarChar(sql.MAX), playwrightScript);

    let updateQuery = `
      UPDATE dbo.test_cases
      SET playwright_script = @playwright_script,
          updated_at = GETDATE()
    `;

    if (userId) {
      request.input("updated_by", sql.Int, userId);
      updateQuery += `, updated_by = @updated_by`;
    }

    updateQuery += `
      WHERE id = @id;

      SELECT id,
             title,
             playwright_script,
             workflow_status,
             workflow_request_id
      FROM dbo.test_cases
      WHERE id = @id;
    `;

    const result = await request.query(updateQuery);
    const updated = result.recordsets?.[0]?.[0] || null;

    return res.status(200).json({
      success: true,
      message: "Playwright script saved successfully.",
      data: updated,
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
