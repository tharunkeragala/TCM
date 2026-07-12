const { poolPromise } = require("../config/db");
const sql = require("mssql");

// GET /api/projects/:id/overview
// One call that feeds the whole Project Overview page: project details,
// suites (with case counts), a recent task list, sprints (with suite/case
// counts), the project's derived assignee list (from task_assignments), and
// summary stats. Test cases and documents are intentionally left to their
// existing endpoints (the frontend already fetches /api/test-cases and
// /api/projects/:id/documents and filters client-side / by project_id — no
// need to duplicate that data here and bloat the payload).
exports.getProjectOverview = async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await poolPromise;

    const projectResult = await pool
      .request()
      .input("id", sql.Int, id)
      .query(`
        SELECT
          p.*,
          u1.username AS created_by_name,
          u2.username AS updated_by_name
        FROM test_case_manager.dbo.projects p
        LEFT JOIN test_case_manager.dbo.users u1 ON u1.id = p.created_by
        LEFT JOIN test_case_manager.dbo.users u2 ON u2.id = p.updated_by
        WHERE p.id = @id
      `);

    const project = projectResult.recordset[0];
    if (!project) {
      return res.status(404).json({ success: false, message: "Project not found" });
    }

    const suitesResult = await pool
      .request()
      .input("project_id", sql.Int, id)
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
      .input("project_id", sql.Int, id)
      .query(`
        SELECT COUNT(*) AS total
        FROM test_case_manager.dbo.test_cases tc
        JOIN test_case_manager.dbo.test_suites ts ON ts.id = tc.suite_id
        WHERE ts.project_id = @project_id
      `);

    const taskCountResult = await pool
      .request()
      .input("project_id", sql.Int, id)
      .query(`
        SELECT COUNT(*) AS total
        FROM test_case_manager.dbo.tasks
        WHERE project_id = @project_id AND is_archived = 0
      `);

    const tasksResult = await pool
      .request()
      .input("project_id", sql.Int, id)
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

    // Sprints for this project, with board suite/case counts — same shape
    // the Sprints list page uses, just pre-scoped to this project so the
    // overview page doesn't need a second round trip.
    const sprintsResult = await pool
      .request()
      .input("project_id", sql.Int, id)
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

    const assigneesResult = await pool
      .request()
      .input("project_id", sql.Int, id)
      .query(`
        SELECT DISTINCT u.id, u.username
        FROM test_case_manager.dbo.task_assignments ta
        JOIN test_case_manager.dbo.tasks t ON t.id = ta.task_id
        JOIN test_case_manager.dbo.users u ON u.id = ta.user_id
        WHERE t.project_id = @project_id
          AND t.is_archived = 0
          AND ta.role IN ('Assignee', 'Owner')
        ORDER BY u.username ASC
      `);

    const docCountResult = await pool
      .request()
      .input("project_id", sql.Int, id)
      .query(`
        SELECT COUNT(*) AS total
        FROM test_case_manager.dbo.project_documents
        WHERE project_id = @project_id AND is_archived = 0
      `);

    res.status(200).json({
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
    res.status(500).json({
      success: false,
      message: "Failed to fetch project overview",
      error: err.message,
    });
  }
};

// Route (unchanged) in project.routes.js:
//
//   router.get(
//     "/:id/overview",
//     verifyToken,
//     checkPermission(MENU, "can_view"),
//     projectOverviewController.getProjectOverview,
//   );