const { poolPromise } = require("../config/db");
const sql = require("mssql");

// ✅ GET ALL
exports.getProjects = async (req, res) => {
  try {
    const pool = await poolPromise;

    const result = await pool.request().query(`
      SELECT 
        p.*,
        u1.username AS created_by_name,
        u2.username AS updated_by_name
      FROM test_case_manager.dbo.projects p
      LEFT JOIN test_case_manager.dbo.users u1 ON u1.id = p.created_by
      LEFT JOIN test_case_manager.dbo.users u2 ON u2.id = p.updated_by
      ORDER BY p.id ASC
    `);

    res.status(200).json({ success: true, data: result.recordset });
  } catch (err) {
    console.error("GET Projects Error:", err);
    res
      .status(500)
      .json({
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
    res
      .status(500)
      .json({
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
    res
      .status(500)
      .json({
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
    res
      .status(500)
      .json({
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
    res
      .status(500)
      .json({
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

    const suiteCheck = await pool.request().input("project_id", sql.Int, id)
      .query(`
        SELECT COUNT(*) AS suite_count
        FROM test_case_manager.dbo.test_suites
        WHERE project_id = @project_id
      `);

    const suiteCount = suiteCheck.recordset[0]?.suite_count ?? 0;

    if (suiteCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete: ${suiteCount} test suite(s) are linked to this project. Remove them first.`,
      });
    }

    await pool
      .request()
      .input("id", sql.Int, id)
      .query(`DELETE FROM test_case_manager.dbo.projects WHERE id = @id`);

    await pool
      .request()
      .input("description", sql.VarChar, `Project ID ${id} deleted`)
      .input("user_id", sql.Int, userId).query(`
        INSERT INTO audit_logs (action, module, description, user_id)
        VALUES ('DELETE', 'PROJECT', @description, @user_id)
      `);

    res.json({ success: true, message: "Project deleted successfully" });
  } catch (err) {
    console.error("DELETE Project Error:", err);
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to delete project",
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
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to update status",
        error: err.message,
      });
  }
};
