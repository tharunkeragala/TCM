const { poolPromise } = require("../config/db");
const sql = require("mssql");

// GET /api/projects/:id/overview
// One call that feeds the whole Project Overview page.
exports.getProjectOverview = async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await poolPromise;

    const projectResult = await pool.request().input("id", sql.Int, id).query(`
        SELECT
          p.*,
          u1.username AS created_by_name,
          u2.username AS updated_by_name,
          pm.username AS project_manager_name
        FROM test_case_manager.dbo.projects p
        LEFT JOIN test_case_manager.dbo.users u1 ON u1.id = p.created_by
        LEFT JOIN test_case_manager.dbo.users u2 ON u2.id = p.updated_by
        LEFT JOIN test_case_manager.dbo.users pm ON pm.id = p.project_manager_id
        WHERE p.id = @id
      `);

    const project = projectResult.recordset[0];
    if (!project) {
      return res
        .status(404)
        .json({ success: false, message: "Project not found" });
    }

    const suitesResult = await pool.request().input("project_id", sql.Int, id)
      .query(`
        SELECT ts.*,
          (SELECT COUNT(*) FROM test_case_manager.dbo.test_cases tc
           WHERE tc.suite_id = ts.id) AS case_count
        FROM test_case_manager.dbo.test_suites ts
        WHERE ts.project_id = @project_id
        ORDER BY ts.id ASC
      `);

    const caseCountResult = await pool
      .request()
      .input("project_id", sql.Int, id).query(`
        SELECT COUNT(*) AS total
        FROM test_case_manager.dbo.test_cases tc
        JOIN test_case_manager.dbo.test_suites ts ON ts.id = tc.suite_id
        WHERE ts.project_id = @project_id
      `);

    const taskCountResult = await pool
      .request()
      .input("project_id", sql.Int, id).query(`
        SELECT COUNT(*) AS total
        FROM test_case_manager.dbo.tasks
        WHERE project_id = @project_id AND is_archived = 0
      `);

    const tasksResult = await pool.request().input("project_id", sql.Int, id)
      .query(`
        SELECT TOP 25
          t.*,
          u1.username AS created_by_name,
          (
            SELECT STRING_AGG(u.username, ', ')
            FROM test_case_manager.dbo.task_assignments ta
            JOIN test_case_manager.dbo.users u ON u.id = ta.user_id
            WHERE ta.task_id = t.id AND ta.role = 'Assignee'
          ) AS assignees
        FROM test_case_manager.dbo.tasks t
        LEFT JOIN test_case_manager.dbo.users u1 ON u1.id = t.created_by
        WHERE t.project_id = @project_id AND t.is_archived = 0
        ORDER BY t.created_at DESC
      `);

    const sprintsResult = await pool.request().input("project_id", sql.Int, id)
      .query(`
        SELECT
          sp.*,
          u1.username AS created_by_name,
          (SELECT COUNT(*) FROM test_case_manager.dbo.sprint_suites ss WHERE ss.sprint_id = sp.id) AS suite_count,
          (SELECT COUNT(*) FROM test_case_manager.dbo.sprint_test_cases stc WHERE stc.sprint_id = sp.id) AS case_count
        FROM test_case_manager.dbo.sprints sp
        LEFT JOIN test_case_manager.dbo.users u1 ON u1.id = sp.created_by
        WHERE sp.project_id = @project_id
        ORDER BY sp.id DESC
      `);

    // Combined assignees:
    // 1) existing task-derived Assignee/Owner users
    // 2) new explicit project-level assignees
    // UNION removes duplicates automatically.
    const assigneesResult = await pool
      .request()
      .input("project_id", sql.Int, id).query(`
        SELECT u.id, u.username
        FROM test_case_manager.dbo.users u
        WHERE u.id IN (
          SELECT ta.user_id
          FROM test_case_manager.dbo.task_assignments ta
          INNER JOIN test_case_manager.dbo.tasks t ON t.id = ta.task_id
          WHERE t.project_id = @project_id
            AND t.is_archived = 0
            AND ta.role IN ('Assignee', 'Owner')

          UNION

          SELECT pa.user_id
          FROM test_case_manager.dbo.project_assignees pa
          WHERE pa.project_id = @project_id
        )
        ORDER BY u.username ASC
      `);

    // Keep explicit project assignees separately too, so other views/edit forms
    // can distinguish them from users inherited through task assignments.
    const explicitAssigneesResult = await pool
      .request()
      .input("project_id", sql.Int, id).query(`
        SELECT u.id, u.username
        FROM test_case_manager.dbo.project_assignees pa
        INNER JOIN test_case_manager.dbo.users u ON u.id = pa.user_id
        WHERE pa.project_id = @project_id
        ORDER BY u.username ASC
      `);

    project.project_assignees = explicitAssigneesResult.recordset;
    project.project_assignee_ids = explicitAssigneesResult.recordset.map(
      (user) => user.id,
    );

    const docCountResult = await pool.request().input("project_id", sql.Int, id)
      .query(`
        SELECT COUNT(*) AS total
        FROM test_case_manager.dbo.project_documents
        WHERE project_id = @project_id AND is_archived = 0
      `);

    return res.status(200).json({
      success: true,
      data: {
        project,
        suites: suitesResult.recordset,
        tasks: tasksResult.recordset,
        sprints: sprintsResult.recordset,
        assignees: assigneesResult.recordset,
        stats: {
          suite_count: suitesResult.recordset.length,
          test_case_count: caseCountResult.recordset[0]?.total ?? 0,
          task_count: taskCountResult.recordset[0]?.total ?? 0,
          document_count: docCountResult.recordset[0]?.total ?? 0,
          sprint_count: sprintsResult.recordset.length,
        },
      },
    });
  } catch (err) {
    console.error("GET Project Overview Error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch project overview",
      error: err.message,
    });
  }
};
