const { poolPromise } = require("../config/db");
const sql = require("mssql");

// ─── Users ──────────────────────────────────────────────────────
exports.getUsersList = async (req, res) => {
  try {
    const pool = await poolPromise;

    const result = await pool.request().query(`
      SELECT 
        u.id, u.username, u.source, u.is_active,
        u.role_id, u.department_id, u.team_id,
        u.created_at, u.updated_at,
        u.created_by,
        u.updated_by,
        uc.username AS created_by_username,
        uu.username AS updated_by_username,
        r.role_name,
        d.department_name,
        t.team_name
      FROM users u
      LEFT JOIN users uc ON u.created_by = uc.id
      LEFT JOIN users uu ON u.updated_by = uu.id
      LEFT JOIN roles r ON u.role_id = r.id
      LEFT JOIN departments d ON u.department_id = d.id
      LEFT JOIN teams t ON u.team_id = t.id
      ORDER BY u.id ASC
    `);

    return res.status(200).json({
      success: true,
      message: "Users fetched successfully",
      count: result.recordset.length,
      data: result.recordset,
    });
  } catch (err) {
    console.error("GET Users Error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch users",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};


// ─── Tasks ──────────────────────────────────────────────────────
exports.getTasksReport = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT
        t.id, t.task_code, t.title, t.description,
        t.status, t.priority, t.start_date, t.due_date,
        t.project_id, t.suite_id, t.tags,
        t.created_by, t.updated_by, t.created_at, t.updated_at,
        u1.username   AS created_by_name,
        u2.username   AS updated_by_name,
        p.project_name,
        ts.suite_name,
        ISNULL(cc.comment_count, 0) AS comment_count,
        STRING_AGG(u3.username, ', ') AS assignees
      FROM test_case_manager.dbo.tasks t
      LEFT JOIN test_case_manager.dbo.users u1        ON u1.id = t.created_by
      LEFT JOIN test_case_manager.dbo.users u2        ON u2.id = t.updated_by
      LEFT JOIN test_case_manager.dbo.projects p      ON p.id  = t.project_id
      LEFT JOIN test_case_manager.dbo.test_suites ts  ON ts.id = t.suite_id
      LEFT JOIN (
        SELECT task_id, COUNT(*) AS comment_count
        FROM test_case_manager.dbo.task_comments
        GROUP BY task_id
      ) cc ON cc.task_id = t.id
      LEFT JOIN test_case_manager.dbo.task_assignments ta ON ta.task_id = t.id
      LEFT JOIN test_case_manager.dbo.users u3            ON u3.id = ta.user_id
      WHERE t.is_archived = 0
      GROUP BY
        t.id, t.task_code, t.title, t.description,
        t.status, t.priority, t.start_date, t.due_date,
        t.project_id, t.suite_id, t.tags,
        t.created_by, t.updated_by, t.created_at, t.updated_at,
        u1.username, u2.username, p.project_name, ts.suite_name,
        cc.comment_count
      ORDER BY t.created_at DESC
    `);

    res.status(200).json({ success: true, data: result.recordset });
  } catch (err) {
    console.error("GET Tasks Report Error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch tasks report", error: err.message });
  }
};