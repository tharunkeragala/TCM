const { poolPromise } = require("../config/db");
const sql = require("mssql");
const path = require("path");
const fs = require("fs").promises;
const { v4: uuidv4 } = require("uuid");
const logAudit = require("./auditController");

// ===============================
// HELPER FUNCTIONS
// ===============================

// Get next bug report ID (e.g., BUG-001)
async function getNextBugReportId(pool, projectId) {
  const result = await pool
    .request()
    .input("project_id", sql.Int, projectId)
    .query(`
      SELECT COUNT(*) as total
      FROM test_case_manager.dbo.bug_reports
      WHERE project_id = @project_id AND is_archived = 0
    `);

  const nextNum = (result.recordset[0].total + 1).toString().padStart(4, "0");
  return `BUG-${projectId}-${nextNum}`;
}

// Clean audit data
const cleanAuditData = (obj = {}) => {
  const {
    created_at,
    updated_at,
    created_by_name,
    updated_by_name,
    created_by,
    updated_by,
    tested_by_name,
    reported_by_name,
    assigned_to_name,
    function_name,
    project_name,
    sprint_name,
    ...cleaned
  } = obj;
  return cleaned;
};

// Save screenshot to file system
async function saveScreenshot(file) {
  const screenshotDir = path.join(__dirname, "../screenshots/bug-reports");
  try {
    await fs.mkdir(screenshotDir, { recursive: true });
    const filename = `${uuidv4()}_${Date.now()}.png`;
    const filepath = path.join(screenshotDir, filename);
    await fs.writeFile(filepath, file.buffer);
    return `/screenshots/bug-reports/${filename}`;
  } catch (error) {
    console.error("Screenshot save error:", error);
    throw error;
  }
}

// Log audit trail
async function logBugAudit(pool, bugId, actionType, fieldName, oldValue, newValue, userId) {
  await pool
    .request()
    .input("bug_report_id", sql.Int, bugId)
    .input("action_type", sql.NVarChar, actionType)
    .input("field_name", sql.NVarChar, fieldName)
    .input("old_value", sql.NVarChar, oldValue ? JSON.stringify(oldValue) : null)
    .input("new_value", sql.NVarChar, newValue ? JSON.stringify(newValue) : null)
    .input("changed_by", sql.Int, userId)
    .query(`
      INSERT INTO test_case_manager.dbo.bug_audit
        (bug_report_id, action_type, field_name, old_value, new_value, changed_by)
      VALUES
        (@bug_report_id, @action_type, @field_name, @old_value, @new_value, @changed_by)
    `);
}

// Add system comment
async function addSystemComment(pool, bugId, message, userId = 1) {
  await pool
    .request()
    .input("bug_report_id", sql.Int, bugId)
    .input("comment", sql.NVarChar, message)
    .input("commented_by", sql.Int, userId)
    .query(`
      INSERT INTO test_case_manager.dbo.bug_comments
        (bug_report_id, comment, is_system, commented_by)
      VALUES
        (@bug_report_id, @comment, 1, @commented_by)
    `);
}

// ===============================
// CREATE BUG REPORT
// ===============================
exports.createBugReport = async (req, res) => {
  try {
    const pool = await poolPromise;
    const userId = req.user.id;
    const { project_id, function_id, sprint_id, title, description, severity, priority, environment, affected_version } = req.body;

    // Validate required fields
    if (!project_id || !function_id || !title || !description) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Get next report ID
    const reportId = await getNextBugReportId(pool, project_id);

    // Create bug report
    const result = await pool
      .request()
      .input("report_id", sql.NVarChar, reportId)
      .input("project_id", sql.Int, project_id)
      .input("project_function_id", sql.Int, function_id)
      .input("sprint_id", sql.Int, sprint_id || null)
      .input("title", sql.NVarChar, title)
      .input("description", sql.NVarChar, description)
      .input("severity", sql.NVarChar, severity || "Medium")
      .input("priority", sql.Int, priority || 3)
      .input("environment", sql.NVarChar, environment || null)
      .input("affected_version", sql.NVarChar, affected_version || null)
      .input("reported_by", sql.Int, userId)
      .input("created_by", sql.Int, userId)
      .query(`
        INSERT INTO test_case_manager.dbo.bug_reports
          (report_id, project_id, project_function_id, sprint_id, title, description, 
           severity, priority, environment, affected_version, reported_by, created_by)
        VALUES
          (@report_id, @project_id, @project_function_id, @sprint_id, @title, @description,
           @severity, @priority, @environment, @affected_version, @reported_by, @created_by);
        SELECT SCOPE_IDENTITY() as id;
      `);

    const bugId = result.recordset[0].id;

    // Handle screenshot uploads
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const screenshotPath = await saveScreenshot(file);
        await pool
          .request()
          .input("bug_report_id", sql.Int, bugId)
          .input("screenshot_path", sql.NVarChar, screenshotPath)
          .input("screenshot_name", sql.NVarChar, file.originalname)
          .input("created_by", sql.Int, userId)
          .query(`
            INSERT INTO test_case_manager.dbo.bug_screenshots
              (bug_report_id, screenshot_path, screenshot_name, created_by)
            VALUES
              (@bug_report_id, @screenshot_path, @screenshot_name, @created_by)
          `);
      }
    }

    // Log audit
    await logAudit({
      userId,
      action: "CREATE",
      module: "bug_reports",
      entityType: "Bug Report",
      entityId: bugId,
      entityName: reportId,
      description: `Bug report created`,
      newValues: { title, description, severity, project_id, function_id }
    });
    await addSystemComment(pool, bugId, `Bug report created`, userId);

    res.status(201).json({
      success: true,
      message: "Bug report created successfully",
      bugId,
      reportId,
    });
  } catch (error) {
    console.error("Create bug report error:", error);
    res.status(500).json({ error: error.message });
  }
};

// ===============================
// GET ALL BUG REPORTS
// ===============================
exports.getBugReports = async (req, res) => {
  try {
    const pool = await poolPromise;
    const { project_id, sprint_id, status, severity, assigned_to, limit = 50, offset = 0 } = req.query;

    let query = `
      SELECT 
        br.*,
        pf.function_name,
        p.project_name as project_name,
        s.sprint_name,
        u1.username as reported_by_name,
        u2.username as assigned_to_name,
        COUNT(DISTINCT bs.id) as screenshot_count,
        COUNT(DISTINCT bh.id) as history_count
      FROM test_case_manager.dbo.bug_reports br
      LEFT JOIN test_case_manager.dbo.project_functions pf ON pf.id = br.project_function_id
      LEFT JOIN test_case_manager.dbo.projects p ON p.id = br.project_id
      LEFT JOIN test_case_manager.dbo.sprints s ON s.id = br.sprint_id
      LEFT JOIN test_case_manager.dbo.users u1 ON u1.id = br.reported_by
      LEFT JOIN test_case_manager.dbo.users u2 ON u2.id = br.assigned_to
      LEFT JOIN test_case_manager.dbo.bug_screenshots bs ON bs.bug_report_id = br.id
      LEFT JOIN test_case_manager.dbo.bug_history bh ON bh.bug_report_id = br.id
      WHERE br.is_archived = 0
    `;

    const request = pool.request();

    if (project_id) {
      query += ` AND br.project_id = @project_id`;
      request.input("project_id", sql.Int, project_id);
    }

    if (sprint_id) {
      query += ` AND br.sprint_id = @sprint_id`;
      request.input("sprint_id", sql.Int, sprint_id);
    }

    if (status) {
      query += ` AND br.status = @status`;
      request.input("status", sql.NVarChar, status);
    }

    if (severity) {
      query += ` AND br.severity = @severity`;
      request.input("severity", sql.NVarChar, severity);
    }

    if (assigned_to) {
      query += ` AND br.assigned_to = @assigned_to`;
      request.input("assigned_to", sql.Int, assigned_to);
    }

    query += `
      GROUP BY 
        br.id, br.report_id, br.project_id, br.project_function_id, br.sprint_id,
        br.title, br.description, br.severity, br.status, br.priority,
        br.reported_by, br.assigned_to, br.assigned_date,
        br.first_reported_date, br.target_resolution_date, br.actual_resolution_date,
        br.environment, br.affected_version, br.current_cycle_status,
        br.created_at, br.updated_at, br.created_by, br.updated_by, br.is_archived,
        pf.function_name, p.project_name, s.sprint_name, u1.username, u2.username
      ORDER BY br.id DESC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `;

    request.input("offset", sql.Int, parseInt(offset));
    request.input("limit", sql.Int, parseInt(limit));

    const result = await request.query(query);

    res.json({
      success: true,
      data: result.recordset,
      total: result.recordset.length,
    });
  } catch (error) {
    console.error("Get bug reports error:", error);
    res.status(500).json({ error: error.message });
  }
};

// ===============================
// GET BUG REPORT BY ID
// ===============================
exports.getBugReportById = async (req, res) => {
  try {
    const pool = await poolPromise;
    const { id } = req.params;

    // Get main bug report
    const bugResult = await pool
      .request()
      .input("id", sql.Int, id)
      .query(`
        SELECT 
          br.*,
          pf.function_name,
          p.project_name as project_name,
          s.sprint_name,
          u1.username as reported_by_name,
          u2.username as assigned_to_name
        FROM test_case_manager.dbo.bug_reports br
        LEFT JOIN test_case_manager.dbo.project_functions pf ON pf.id = br.project_function_id
        LEFT JOIN test_case_manager.dbo.projects p ON p.id = br.project_id
        LEFT JOIN test_case_manager.dbo.sprints s ON s.id = br.sprint_id
        LEFT JOIN test_case_manager.dbo.users u1 ON u1.id = br.reported_by
        LEFT JOIN test_case_manager.dbo.users u2 ON u2.id = br.assigned_to
        WHERE br.id = @id
      `);

    if (!bugResult.recordset[0]) {
      return res.status(404).json({ error: "Bug report not found" });
    }

    const bug = bugResult.recordset[0];

    // Get screenshots
    const screenshots = await pool
      .request()
      .input("bug_id", sql.Int, id)
      .query(`
        SELECT * FROM test_case_manager.dbo.bug_screenshots
        WHERE bug_report_id = @bug_id
        ORDER BY screenshot_order, id ASC
      `);

    // Get history/iterations
    const history = await pool
      .request()
      .input("bug_id", sql.Int, id)
      .query(`
        SELECT 
          bh.*,
          sp.sprint_name,
          u.username as tested_by_name
        FROM test_case_manager.dbo.bug_history bh
        LEFT JOIN test_case_manager.dbo.sprints sp ON sp.id = bh.sprint_id
        LEFT JOIN test_case_manager.dbo.users u ON u.id = bh.tested_by
        WHERE bh.bug_report_id = @bug_id
        ORDER BY bh.cycle_number ASC
      `);

    const summary = await pool
      .request()
      .input("bug_id", sql.Int, id)
      .query(`
        SELECT
          brs.*,
          s.sprint_name
        FROM test_case_manager.dbo.bug_report_summary brs
        LEFT JOIN test_case_manager.dbo.sprints s ON s.id = brs.sprint_id
        WHERE brs.bug_report_id = @bug_id
        ORDER BY brs.latest_status_date DESC, brs.sprint_id
      `);

    // Get comments
    const comments = await pool
      .request()
      .input("bug_id", sql.Int, id)
      .query(`
        SELECT 
          bc.*,
          u.username as commented_by_name
        FROM test_case_manager.dbo.bug_comments bc
        LEFT JOIN test_case_manager.dbo.users u ON u.id = bc.commented_by
        WHERE bc.bug_report_id = @bug_id
        ORDER BY bc.created_at DESC
      `);

    res.json({
      success: true,
      bug,
      screenshots: screenshots.recordset,
      history: history.recordset,
      summary: summary.recordset,
      comments: comments.recordset,
    });
  } catch (error) {
    console.error("Get bug report error:", error);
    res.status(500).json({ error: error.message });
  }
};

// ===============================
// UPDATE BUG REPORT
// ===============================
exports.updateBugReport = async (req, res) => {
  try {
    const pool = await poolPromise;
    const { id } = req.params;
    const userId = req.user.id;
    const { title, description, severity, priority, status, assigned_to, target_resolution_date, environment, affected_version } = req.body;

    // Get current bug report for comparison
    const currentResult = await pool
      .request()
      .input("id", sql.Int, id)
      .query(`SELECT * FROM test_case_manager.dbo.bug_reports WHERE id = @id`);

    if (!currentResult.recordset[0]) {
      return res.status(404).json({ error: "Bug report not found" });
    }

    const currentBug = currentResult.recordset[0];

    // Update bug report
    await pool
      .request()
      .input("id", sql.Int, id)
      .input("title", sql.NVarChar, title || currentBug.title)
      .input("description", sql.NVarChar, description || currentBug.description)
      .input("severity", sql.NVarChar, severity || currentBug.severity)
      .input("priority", sql.Int, priority !== undefined ? priority : currentBug.priority)
      .input("status", sql.NVarChar, status || currentBug.status)
      .input("assigned_to", sql.Int, assigned_to || null)
      .input("target_resolution_date", sql.DateTime, target_resolution_date || null)
      .input("environment", sql.NVarChar, environment || currentBug.environment)
      .input("affected_version", sql.NVarChar, affected_version || currentBug.affected_version)
      .input("updated_by", sql.Int, userId)
      .query(`
        UPDATE test_case_manager.dbo.bug_reports
        SET 
          title = @title,
          description = @description,
          severity = @severity,
          priority = @priority,
          status = @status,
          assigned_to = @assigned_to,
          target_resolution_date = @target_resolution_date,
          environment = @environment,
          affected_version = @affected_version,
          updated_by = @updated_by,
          updated_at = GETDATE()
        WHERE id = @id
      `);

    // Log changes for audit
    if (title && title !== currentBug.title) {
      await logBugAudit(pool, id, "Updated", "title", currentBug.title, title, userId);
    }
    if (status && status !== currentBug.status) {
      await logBugAudit(pool, id, "Status Changed", "status", currentBug.status, status, userId);
      await addSystemComment(pool, id, `Status changed from ${currentBug.status} to ${status}`, userId);
    }
    if (assigned_to && assigned_to !== currentBug.assigned_to) {
      await logBugAudit(pool, id, "Assigned", "assigned_to", currentBug.assigned_to, assigned_to, userId);
      await addSystemComment(pool, id, `Assigned to user ${assigned_to}`, userId);
    }
    if (severity && severity !== currentBug.severity) {
      await logBugAudit(pool, id, "Updated", "severity", currentBug.severity, severity, userId);
    }

    res.json({
      success: true,
      message: "Bug report updated successfully",
    });
  } catch (error) {
    console.error("Update bug report error:", error);
    res.status(500).json({ error: error.message });
  }
};

// ===============================
// RECORD BUG ITERATION (NEW CYCLE/SPRINT)
// ===============================
exports.recordBugIteration = async (req, res) => {
  try {
    const pool = await poolPromise;
    const { id } = req.params;
    const userId = req.user.id;
    const { sprint_id, status, status_reason, notes } = req.body;

    if (!sprint_id || !status) {
      return res.status(400).json({ error: "sprint_id and status are required" });
    }

    // Get current bug
    const bugResult = await pool
      .request()
      .input("id", sql.Int, id)
      .query(`SELECT * FROM test_case_manager.dbo.bug_reports WHERE id = @id`);

    if (!bugResult.recordset[0]) {
      return res.status(404).json({ error: "Bug report not found" });
    }

    // Get next cycle number
    const cycleResult = await pool
      .request()
      .input("bug_id", sql.Int, id)
      .query(`
        SELECT MAX(cycle_number) as max_cycle
        FROM test_case_manager.dbo.bug_history
        WHERE bug_report_id = @bug_id
      `);

    const nextCycle = (cycleResult.recordset[0].max_cycle || 0) + 1;

    // Record history entry
    const historyResult = await pool
      .request()
      .input("bug_report_id", sql.Int, id)
      .input("sprint_id", sql.Int, sprint_id)
      .input("cycle_number", sql.Int, nextCycle)
      .input("status", sql.NVarChar, status)
      .input("status_reason", sql.NVarChar, status_reason || null)
      .input("notes", sql.NVarChar, notes || null)
      .input("tested_by", sql.Int, userId)
      .input("created_by", sql.Int, userId)
      .query(`
        INSERT INTO test_case_manager.dbo.bug_history
          (bug_report_id, sprint_id, cycle_number, status, status_reason, notes, tested_by, created_by)
        VALUES
          (@bug_report_id, @sprint_id, @cycle_number, @status, @status_reason, @notes, @tested_by, @created_by);
        SELECT SCOPE_IDENTITY() as id;
      `);

    // Keep the per-sprint aggregate in sync with the new history entry.
    await pool
      .request()
      .input("bug_report_id", sql.Int, id)
      .input("sprint_id", sql.Int, sprint_id)
      .input("status", sql.NVarChar, status)
      .query(`
        UPDATE test_case_manager.dbo.bug_report_summary
        SET pass_count = pass_count + CASE WHEN @status = 'Pass' THEN 1 ELSE 0 END,
            fail_count = fail_count + CASE WHEN @status = 'Fail' THEN 1 ELSE 0 END,
            blocked_count = blocked_count + CASE WHEN @status = 'Blocked' THEN 1 ELSE 0 END,
            no_test_count = no_test_count + CASE WHEN @status = 'No Test' THEN 1 ELSE 0 END,
            latest_status = @status,
            latest_status_date = GETDATE()
        WHERE bug_report_id = @bug_report_id AND sprint_id = @sprint_id;

        IF @@ROWCOUNT = 0
        BEGIN
          INSERT INTO test_case_manager.dbo.bug_report_summary
            (bug_report_id, sprint_id, pass_count, fail_count, blocked_count, no_test_count, latest_status, latest_status_date)
          VALUES
            (@bug_report_id, @sprint_id,
             CASE WHEN @status = 'Pass' THEN 1 ELSE 0 END,
             CASE WHEN @status = 'Fail' THEN 1 ELSE 0 END,
             CASE WHEN @status = 'Blocked' THEN 1 ELSE 0 END,
             CASE WHEN @status = 'No Test' THEN 1 ELSE 0 END,
             @status, GETDATE());
        END
      `);

    // Update main bug report with current cycle status
    await pool
      .request()
      .input("id", sql.Int, id)
      .input("current_cycle_status", sql.NVarChar, status)
      .input("updated_by", sql.Int, userId)
      .query(`
        UPDATE test_case_manager.dbo.bug_reports
        SET current_cycle_status = @current_cycle_status,
            updated_by = @updated_by,
            updated_at = GETDATE()
        WHERE id = @id
      `);

    // Add system comment
    await addSystemComment(pool, id, `Cycle ${nextCycle}: ${status} - ${status_reason || ""}`, userId);

    // Log audit
    await logBugAudit(pool, id, "Iteration Added", `Cycle ${nextCycle}`, null, status, userId);

    res.status(201).json({
      success: true,
      message: "Bug iteration recorded successfully",
      historyId: historyResult.recordset[0].id,
      cycle: nextCycle,
    });
  } catch (error) {
    console.error("Record bug iteration error:", error);
    res.status(500).json({ error: error.message });
  }
};

// ===============================
// ADD COMMENT TO BUG
// ===============================
exports.addBugComment = async (req, res) => {
  try {
    const pool = await poolPromise;
    const { id } = req.params;
    const userId = req.user.id;
    const { comment } = req.body;

    if (!comment) {
      return res.status(400).json({ error: "Comment is required" });
    }

    const result = await pool
      .request()
      .input("bug_report_id", sql.Int, id)
      .input("comment", sql.NVarChar, comment)
      .input("commented_by", sql.Int, userId)
      .query(`
        INSERT INTO test_case_manager.dbo.bug_comments
          (bug_report_id, comment, commented_by)
        VALUES
          (@bug_report_id, @comment, @commented_by);
        SELECT SCOPE_IDENTITY() as id;
      `);

    res.status(201).json({
      success: true,
      message: "Comment added successfully",
      commentId: result.recordset[0].id,
    });
  } catch (error) {
    console.error("Add comment error:", error);
    res.status(500).json({ error: error.message });
  }
};

// ===============================
// UPLOAD SCREENSHOTS
// ===============================
exports.uploadBugScreenshots = async (req, res) => {
  try {
    const pool = await poolPromise;
    const { id } = req.params;
    const userId = req.user.id;

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "No screenshots provided" });
    }

    const screenshots = [];
    for (const file of req.files) {
      const screenshotPath = await saveScreenshot(file);
      const result = await pool
        .request()
        .input("bug_report_id", sql.Int, id)
        .input("screenshot_path", sql.NVarChar, screenshotPath)
        .input("screenshot_name", sql.NVarChar, file.originalname)
        .input("created_by", sql.Int, userId)
        .query(`
          INSERT INTO test_case_manager.dbo.bug_screenshots
            (bug_report_id, screenshot_path, screenshot_name, created_by)
          VALUES
            (@bug_report_id, @screenshot_path, @screenshot_name, @created_by);
          SELECT SCOPE_IDENTITY() as id;
        `);

      screenshots.push({
        id: result.recordset[0].id,
        path: screenshotPath,
        name: file.originalname,
      });
    }

    res.status(201).json({
      success: true,
      message: "Screenshots uploaded successfully",
      screenshots,
    });
  } catch (error) {
    console.error("Upload screenshots error:", error);
    res.status(500).json({ error: error.message });
  }
};

// ===============================
// GET BUG REPORT HISTORY/TIMELINE
// ===============================
exports.getBugHistory = async (req, res) => {
  try {
    const pool = await poolPromise;
    const { id } = req.params;

    const history = await pool
      .request()
      .input("bug_id", sql.Int, id)
      .query(`
        SELECT 
          bh.*,
          s.sprint_name,
          u.username as tested_by_name,
          (
            SELECT COUNT(*) 
            FROM test_case_manager.dbo.bug_history bh2 
            WHERE bh2.bug_report_id = bh.bug_report_id 
            AND bh2.cycle_number <= bh.cycle_number
          ) as cycle_count
        FROM test_case_manager.dbo.bug_history bh
        LEFT JOIN test_case_manager.dbo.sprints s ON s.id = bh.sprint_id
        LEFT JOIN test_case_manager.dbo.users u ON u.id = bh.tested_by
        WHERE bh.bug_report_id = @bug_id
        ORDER BY bh.cycle_number ASC
      `);

    res.json({
      success: true,
      data: history.recordset,
    });
  } catch (error) {
    console.error("Get bug history error:", error);
    res.status(500).json({ error: error.message });
  }
};

// ===============================
// GET BUG STATISTICS/REPORT
// ===============================
exports.getBugStatistics = async (req, res) => {
  try {
    const pool = await poolPromise;
    const { project_id, sprint_id } = req.query;

    // ============================================================
    // 1. OVERALL BUG STATISTICS
    // ============================================================
    //
    // IMPORTANT:
    // When a sprint filter is selected, bugs are filtered by their
    // participation in bug_report_summary for that sprint rather than
    // only by bug_reports.sprint_id. A bug can move through multiple
    // sprints/cycles, so the report must use the cycle/sprint data.
    //
    const statsRequest = pool.request();

    let statsWhere = `
      WHERE br.is_archived = 0
    `;

    if (project_id) {
      statsWhere += `
        AND br.project_id = @stats_project_id
      `;

      statsRequest.input(
        "stats_project_id",
        sql.Int,
        Number(project_id),
      );
    }

    if (sprint_id) {
      statsWhere += `
        AND EXISTS (
          SELECT 1
          FROM test_case_manager.dbo.bug_report_summary filter_brs
          WHERE filter_brs.bug_report_id = br.id
            AND filter_brs.sprint_id = @stats_sprint_id
        )
      `;

      statsRequest.input(
        "stats_sprint_id",
        sql.Int,
        Number(sprint_id),
      );
    }

    const stats = await statsRequest.query(`
      SELECT
        COUNT(*) AS total_bugs,

        SUM(
          CASE
            WHEN br.status = 'Open' THEN 1
            ELSE 0
          END
        ) AS open_bugs,

        SUM(
          CASE
            WHEN br.status = 'In Progress' THEN 1
            ELSE 0
          END
        ) AS in_progress_bugs,

        SUM(
          CASE
            WHEN br.status = 'Resolved' THEN 1
            ELSE 0
          END
        ) AS resolved_bugs,

        SUM(
          CASE
            WHEN br.status = 'Closed' THEN 1
            ELSE 0
          END
        ) AS closed_bugs,

        SUM(
          CASE
            WHEN br.severity = 'Critical' THEN 1
            ELSE 0
          END
        ) AS critical_bugs,

        SUM(
          CASE
            WHEN br.severity = 'High' THEN 1
            ELSE 0
          END
        ) AS high_bugs,

        SUM(
          CASE
            WHEN br.severity = 'Medium' THEN 1
            ELSE 0
          END
        ) AS medium_bugs,

        SUM(
          CASE
            WHEN br.severity = 'Low' THEN 1
            ELSE 0
          END
        ) AS low_bugs

      FROM test_case_manager.dbo.bug_reports br

      ${statsWhere}
    `);

    // ============================================================
    // 2. TREND / CYCLE DATA
    // ============================================================
    const trendRequest = pool.request();

    let trendWhere = `
      WHERE br.is_archived = 0
    `;

    if (project_id) {
      trendWhere += `
        AND br.project_id = @trend_project_id
      `;

      trendRequest.input(
        "trend_project_id",
        sql.Int,
        Number(project_id),
      );
    }

    if (sprint_id) {
      trendWhere += `
        AND bh.sprint_id = @trend_sprint_id
      `;

      trendRequest.input(
        "trend_sprint_id",
        sql.Int,
        Number(sprint_id),
      );
    }

    const trend = await trendRequest.query(`
      SELECT
        bh.sprint_id,
        s.sprint_name,
        bh.cycle_number,
        bh.status,
        COUNT(*) AS count

      FROM test_case_manager.dbo.bug_history bh

      INNER JOIN test_case_manager.dbo.bug_reports br
        ON br.id = bh.bug_report_id

      LEFT JOIN test_case_manager.dbo.sprints s
        ON s.id = bh.sprint_id

      ${trendWhere}

      GROUP BY
        bh.sprint_id,
        s.sprint_name,
        bh.cycle_number,
        bh.status

      ORDER BY
        bh.sprint_id DESC,
        bh.cycle_number DESC,
        bh.status
    `);

    // ============================================================
    // 3. SPRINT-WISE SUMMARY REPORT
    // ============================================================
    //
    // One row:
    // Project + Sprint
    //
    // Example:
    // Project A | Sprint 01 | 10 Bugs | 8 Pass | 2 Fail
    //
    const summaryRequest = pool.request();

    let summaryWhere = `
      WHERE br.is_archived = 0
    `;

    if (project_id) {
      summaryWhere += `
        AND br.project_id = @summary_project_id
      `;

      summaryRequest.input(
        "summary_project_id",
        sql.Int,
        Number(project_id),
      );
    }

    if (sprint_id) {
      summaryWhere += `
        AND brs.sprint_id = @summary_sprint_id
      `;

      summaryRequest.input(
        "summary_sprint_id",
        sql.Int,
        Number(sprint_id),
      );
    }

    const summary = await summaryRequest.query(`
      SELECT
        brs.sprint_id,
        s.sprint_name,

        br.project_id,
        p.project_name,

        COUNT(
          DISTINCT brs.bug_report_id
        ) AS bug_count,

        COALESCE(
          SUM(brs.pass_count),
          0
        ) AS pass_count,

        COALESCE(
          SUM(brs.fail_count),
          0
        ) AS fail_count,

        COALESCE(
          SUM(brs.blocked_count),
          0
        ) AS blocked_count,

        COALESCE(
          SUM(brs.no_test_count),
          0
        ) AS no_test_count,

        SUM(
          CASE
            WHEN brs.latest_status = 'Pass' THEN 1
            ELSE 0
          END
        ) AS latest_pass,

        SUM(
          CASE
            WHEN brs.latest_status = 'Fail' THEN 1
            ELSE 0
          END
        ) AS latest_fail,

        SUM(
          CASE
            WHEN brs.latest_status = 'Blocked' THEN 1
            ELSE 0
          END
        ) AS latest_blocked,

        SUM(
          CASE
            WHEN brs.latest_status = 'No Test' THEN 1
            ELSE 0
          END
        ) AS latest_no_test,

        MAX(
          brs.latest_status_date
        ) AS latest_status_date

      FROM test_case_manager.dbo.bug_report_summary brs

      INNER JOIN test_case_manager.dbo.bug_reports br
        ON br.id = brs.bug_report_id

      LEFT JOIN test_case_manager.dbo.projects p
        ON p.id = br.project_id

      LEFT JOIN test_case_manager.dbo.sprints s
        ON s.id = brs.sprint_id

      ${summaryWhere}

      GROUP BY
        brs.sprint_id,
        s.sprint_name,
        br.project_id,
        p.project_name

      ORDER BY
        MAX(brs.latest_status_date) DESC,
        s.sprint_name,
        p.project_name
    `);

    // ============================================================
    // 4. BUG-WISE REPORT
    // ============================================================
    //
    // One row:
    // Bug + Sprint
    //
    // This is intentionally based on bug_report_summary.
    // If BUG-1 was tested in Sprint 1 and Sprint 2, it will appear
    // once for Sprint 1 and once for Sprint 2.
    //
    const bugWiseRequest = pool.request();

    let bugWiseWhere = `
      WHERE br.is_archived = 0
    `;

    if (project_id) {
      bugWiseWhere += `
        AND br.project_id = @bugwise_project_id
      `;

      bugWiseRequest.input(
        "bugwise_project_id",
        sql.Int,
        Number(project_id),
      );
    }

    if (sprint_id) {
      bugWiseWhere += `
        AND brs.sprint_id = @bugwise_sprint_id
      `;

      bugWiseRequest.input(
        "bugwise_sprint_id",
        sql.Int,
        Number(sprint_id),
      );
    }

    const bugWise = await bugWiseRequest.query(`
      SELECT
        br.id AS bug_id,
        br.report_id,
        br.title,

        br.project_id,
        p.project_name,

        brs.sprint_id,
        s.sprint_name,

        br.severity,
        br.status AS bug_status,
        br.priority,

        pf.function_name,

        br.assigned_to,
        u.username AS assigned_to_name,

        COALESCE(
          brs.pass_count,
          0
        ) AS pass_count,

        COALESCE(
          brs.fail_count,
          0
        ) AS fail_count,

        COALESCE(
          brs.blocked_count,
          0
        ) AS blocked_count,

        COALESCE(
          brs.no_test_count,
          0
        ) AS no_test_count,

        brs.latest_status,
        brs.latest_status_date,

        br.first_reported_date,
        br.updated_at

      FROM test_case_manager.dbo.bug_report_summary brs

      INNER JOIN test_case_manager.dbo.bug_reports br
        ON br.id = brs.bug_report_id

      LEFT JOIN test_case_manager.dbo.projects p
        ON p.id = br.project_id

      LEFT JOIN test_case_manager.dbo.sprints s
        ON s.id = brs.sprint_id

      LEFT JOIN test_case_manager.dbo.project_functions pf
        ON pf.id = br.project_function_id

      LEFT JOIN test_case_manager.dbo.users u
        ON u.id = br.assigned_to

      ${bugWiseWhere}

      ORDER BY
        brs.latest_status_date DESC,
        br.id DESC,
        brs.sprint_id DESC
    `);

    // ============================================================
    // RESPONSE
    // ============================================================
    const statisticRow =
      stats.recordset[0] || {};

    res.json({
      success: true,

      statistics: {
        total_bugs:
          Number(statisticRow.total_bugs || 0),

        open_bugs:
          Number(statisticRow.open_bugs || 0),

        in_progress_bugs:
          Number(
            statisticRow.in_progress_bugs || 0,
          ),

        resolved_bugs:
          Number(statisticRow.resolved_bugs || 0),

        closed_bugs:
          Number(statisticRow.closed_bugs || 0),

        critical_bugs:
          Number(statisticRow.critical_bugs || 0),

        high_bugs:
          Number(statisticRow.high_bugs || 0),

        medium_bugs:
          Number(statisticRow.medium_bugs || 0),

        low_bugs:
          Number(statisticRow.low_bugs || 0),
      },

      trend: trend.recordset,

      // Sprint-wise report
      summary: summary.recordset,

      // Bug-wise report
      bugWise: bugWise.recordset,
    });
  } catch (error) {
    console.error(
      "Get bug statistics error:",
      error,
    );

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};


// ===============================
// DELETE BUG REPORT (Soft Delete)
// ===============================
exports.deleteBugReport = async (req, res) => {
  try {
    const pool = await poolPromise;
    const { id } = req.params;
    const userId = req.user.id;

    await pool
      .request()
      .input("id", sql.Int, id)
      .input("updated_by", sql.Int, userId)
      .query(`
        UPDATE test_case_manager.dbo.bug_reports
        SET is_archived = 1,
            updated_by = @updated_by,
            updated_at = GETDATE()
        WHERE id = @id
      `);

    await logBugAudit(pool, id, "Deleted", "is_archived", 0, 1, userId);

    res.json({
      success: true,
      message: "Bug report deleted successfully",
    });
  } catch (error) {
    console.error("Delete bug report error:", error);
    res.status(500).json({ error: error.message });
  }
};
