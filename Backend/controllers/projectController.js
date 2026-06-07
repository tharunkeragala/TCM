const { poolPromise } = require("../config/db");
const sql = require("mssql");

// ✅ GET ALL
exports.getProjects = async (req, res) => {
  try {
    const pool = await poolPromise;

    // 1. Get logged-in user's department from DB
    const userResult = await pool
      .request()
      .input("user_id", req.user.id)
      .query(`
        SELECT department_id 
        FROM users 
        WHERE id = @user_id
      `);

    const userDeptId = userResult.recordset[0]?.department_id;

    // 2. Main query with safe filtering
    const result = await pool
      .request()
      .input("department_id", userDeptId)
      .query(`
        SELECT 
          p.*,
          u1.username AS created_by_name,
          u2.username AS updated_by_name
        FROM test_case_manager.dbo.projects p
        LEFT JOIN test_case_manager.dbo.users u1 
          ON u1.id = p.created_by
        LEFT JOIN test_case_manager.dbo.users u2 
          ON u2.id = p.updated_by
        WHERE 
          p.is_archived = 0
          AND (
            u1.department_id = @department_id
            OR u1.department_id IS NULL
          )
        ORDER BY p.id ASC
      `);

    res.status(200).json({
      success: true,
      data: result.recordset,
    });
  } catch (err) {
    console.error("GET Projects Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch projects",
      error: err.message,
    });
  }
};

// ✅ GET BY ID
exports.getProjectById = async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await poolPromise;

    const result = await pool.request().input("id", sql.Int, id).query(`
        SELECT 
          p.*,
          u1.username AS created_by_name,
          u2.username AS updated_by_name
        FROM test_case_manager.dbo.projects p
        LEFT JOIN test_case_manager.dbo.users u1 ON u1.id = p.created_by
        LEFT JOIN test_case_manager.dbo.users u2 ON u2.id = p.updated_by
        WHERE p.id = @id
      `);

    if (!result.recordset.length) {
      return res
        .status(404)
        .json({ success: false, message: "Project not found" });
    }

    res.status(200).json({ success: true, data: result.recordset[0] });
  } catch (err) {
    console.error("GET Project By ID Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch project",
      error: err.message,
    });
  }
};

// ✅ GET SUITE COUNT (for delete warning)
exports.getProjectSuiteCount = async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await poolPromise;

    const result = await pool.request().input("project_id", sql.Int, id).query(`
        SELECT COUNT(*) AS suite_count
        FROM test_case_manager.dbo.test_suites
        WHERE project_id = @project_id
      `);

    res.json({ success: true, count: result.recordset[0]?.suite_count ?? 0 });
  } catch (err) {
    console.error("GET Suite Count Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch suite count",
      error: err.message,
    });
  }
};

// ✅ CREATE
exports.createProject = async (req, res) => {
  try {
    const { project_name, description, is_active } = req.body;
    const userId = req.user?.id || null;

    if (!project_name?.trim()) {
      return res
        .status(400)
        .json({ success: false, message: "Project name is required" });
    }

    const pool = await poolPromise;

    const existing = await pool
      .request()
      .input("project_name", sql.VarChar, project_name).query(`
        SELECT id FROM test_case_manager.dbo.projects
        WHERE project_name = @project_name
      `);

    if (existing.recordset.length > 0) {
      return res
        .status(400)
        .json({ success: false, message: "Project name already exists" });
    }

    await pool
      .request()
      .input("project_name", sql.VarChar, project_name)
      .input("description", sql.VarChar(sql.MAX), description || null)
      .input("is_active", sql.Bit, is_active ?? 1)
      .input("created_by", sql.Int, userId)
      .input("updated_by", sql.Int, userId).query(`
        INSERT INTO test_case_manager.dbo.projects
          (project_name, description, is_active, created_by, updated_by)
        VALUES
          (@project_name, @description, @is_active, @created_by, @updated_by)
      `);

    await pool
      .request()
      .input("description", sql.VarChar, `Project "${project_name}" created`)
      .input("user_id", sql.Int, userId).query(`
        INSERT INTO audit_logs (action, module, description, user_id)
        VALUES ('CREATE', 'PROJECT', @description, @user_id)
      `);

    res
      .status(201)
      .json({ success: true, message: "Project created successfully" });
  } catch (err) {
    console.error("CREATE Project Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to create project",
      error: err.message,
    });
  }
};

// ✅ UPDATE
exports.updateProject = async (req, res) => {
  try {
    const { id } = req.params;
    const { project_name, description, is_active } = req.body;
    const userId = req.user?.id || null;

    if (!project_name?.trim()) {
      return res
        .status(400)
        .json({ success: false, message: "Project name is required" });
    }

    const pool = await poolPromise;

    const existing = await pool
      .request()
      .input("project_name", sql.VarChar, project_name)
      .input("id", sql.Int, id).query(`
        SELECT id FROM test_case_manager.dbo.projects
        WHERE project_name = @project_name AND id != @id
      `);

    if (existing.recordset.length > 0) {
      return res
        .status(400)
        .json({ success: false, message: "Project name already exists" });
    }

    await pool
      .request()
      .input("id", sql.Int, id)
      .input("project_name", sql.VarChar, project_name)
      .input("description", sql.VarChar, description || null)
      .input("is_active", sql.Bit, is_active)
      .input("updated_by", sql.Int, userId).query(`
        UPDATE test_case_manager.dbo.projects
        SET project_name = @project_name,
            description  = @description,
            is_active    = @is_active,
            updated_by   = @updated_by,
            updated_at   = GETDATE()
        WHERE id = @id
      `);

    await pool
      .request()
      .input("description", sql.VarChar, `Project ID ${id} updated`)
      .input("user_id", sql.Int, userId).query(`
        INSERT INTO audit_logs (action, module, description, user_id)
        VALUES ('UPDATE', 'PROJECT', @description, @user_id)
      `);

    res.json({ success: true, message: "Project updated successfully" });
  } catch (err) {
    console.error("UPDATE Project Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to update project",
      error: err.message,
    });
  }
};

// ✅ DELETE
exports.deleteProject = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || null;
    const pool = await poolPromise;

    // Check ONLY active tasks
    const taskCheck = await pool
      .request()
      .input("project_id", sql.Int, id)
      .query(`
        SELECT
          t.id,
          t.task_code,
          t.title,
          ISNULL(
            STRING_AGG(u.username, ', '),
            'Unassigned'
          ) AS assignees
        FROM test_case_manager.dbo.tasks t

        LEFT JOIN test_case_manager.dbo.task_assignments ta
          ON ta.task_id = t.id
          AND ta.role = 'Assignee'

        LEFT JOIN test_case_manager.dbo.users u
          ON u.id = ta.user_id

        WHERE t.project_id = @project_id
          AND t.is_archived = 0

        GROUP BY
          t.id,
          t.task_code,
          t.title
        ORDER BY t.id
      `);

    // ❌ Block if active tasks exist
    if (taskCheck.recordset.length > 0) {
      const tasksText = taskCheck.recordset
        .map(
          (t, index) =>
            `${index + 1}. ${t.task_code} - ${t.title} (Assignees: ${t.assignees})`
        )
        .join("\n");

      return res.status(400).json({
        success: false,
        message:
          `Cannot archive project. ${taskCheck.recordset.length} active task(s) exist. Archive them first:\n\n` +
          tasksText,
        linked_tasks: taskCheck.recordset,
      });
    }

    // ✅ ARCHIVE PROJECT (instead of delete)
    await pool
      .request()
      .input("id", sql.Int, id)
      .input("updated_by", sql.Int, userId)
      .query(`
        UPDATE test_case_manager.dbo.projects
        SET is_archived = 1,
            updated_by = @updated_by,
            updated_at = GETDATE()
        WHERE id = @id
      `);

    // Audit log
    await pool
      .request()
      .input("description", sql.VarChar, `Project ID ${id} archived`)
      .input("user_id", sql.Int, userId)
      .query(`
        INSERT INTO audit_logs
          (action, module, description, user_id)
        VALUES
          ('ARCHIVE', 'PROJECT', @description, @user_id)
      `);

    res.json({
      success: true,
      message: "Project archived successfully",
    });
  } catch (err) {
    console.error("ARCHIVE Project Error:", err);

    res.status(500).json({
      success: false,
      message: "Failed to archive project",
      error: err.message,
    });
  }
};

// ✅ TOGGLE ACTIVE — cascades to suites and test cases
exports.toggleProject = async (req, res) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;
    const userId = req.user?.id || null;
    const pool = await poolPromise;

    // 1. Toggle the project itself
    await pool
      .request()
      .input("id", sql.Int, id)
      .input("is_active", sql.Bit, is_active)
      .input("updated_by", sql.Int, userId).query(`
        UPDATE test_case_manager.dbo.projects
        SET is_active  = @is_active,
            updated_by = @updated_by,
            updated_at = GETDATE()
        WHERE id = @id
      `);

    // 2. Cascade to all suites under this project
    await pool
      .request()
      .input("project_id", sql.Int, id)
      .input("is_active", sql.Bit, is_active)
      .input("updated_by", sql.Int, userId).query(`
        UPDATE test_case_manager.dbo.test_suites
        SET is_active  = @is_active,
            updated_by = @updated_by,
            updated_at = GETDATE()
        WHERE project_id = @project_id
      `);

    // 3. Audit log
    await pool
      .request()
      .input(
        "description",
        sql.VarChar,
        `Project ID ${id} and its suites set to ${is_active ? "Active" : "Inactive"}`,
      )
      .input("user_id", sql.Int, userId).query(`
        INSERT INTO audit_logs (action, module, description, user_id)
        VALUES ('STATUS_CHANGE', 'PROJECT', @description, @user_id)
      `);

    res.json({
      success: true,
      message: "Project and all linked suites status updated",
    });
  } catch (err) {
    console.error("TOGGLE Project Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to update status",
      error: err.message,
    });
  }
};
