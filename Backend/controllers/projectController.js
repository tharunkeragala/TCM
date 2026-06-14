const { poolPromise } = require("../config/db");
const sql = require("mssql");
const logAudit = require("./auditController");

// ===============================
// REMOVE TIMESTAMP + META FIELDS FOR AUDIT
// ===============================
const cleanAuditData = (obj = {}) => {
  const {
    created_at,
    updated_at,
    created_by_name,
    updated_by_name,
    created_by,
    updated_by,
    ...cleaned
  } = obj;

  return cleaned;
};

// ===============================
// GET ALL PROJECTS
// ===============================
exports.getProjects = async (req, res) => {
  try {
    const pool = await poolPromise;

    const userResult = await pool
      .request()
      .input("user_id", sql.Int, req.user.id)
      .query(`
        SELECT department_id 
        FROM users 
        WHERE id = @user_id
      `);

    const userDeptId = userResult.recordset[0]?.department_id;

    const result = await pool
      .request()
      .input("department_id", sql.Int, userDeptId)
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

// ===============================
// GET PROJECT BY ID
// ===============================
exports.getProjectById = async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await poolPromise;

    const result = await pool
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

    if (!result.recordset.length) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    res.status(200).json({
      success: true,
      data: result.recordset[0],
    });
  } catch (err) {
    console.error("GET Project By ID Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch project",
      error: err.message,
    });
  }
};

// ===============================
// GET SUITE COUNT
// ===============================
exports.getProjectSuiteCount = async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await poolPromise;

    const result = await pool
      .request()
      .input("project_id", sql.Int, id)
      .query(`
        SELECT COUNT(*) AS suite_count
        FROM test_case_manager.dbo.test_suites
        WHERE project_id = @project_id
      `);

    res.json({
      success: true,
      count: result.recordset[0]?.suite_count ?? 0,
    });
  } catch (err) {
    console.error("GET Suite Count Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch suite count",
      error: err.message,
    });
  }
};

// ===============================
// CREATE PROJECT
// ===============================
exports.createProject = async (req, res) => {
  try {
    const { project_name, description, is_active } = req.body;
    const userId = req.user?.id || null;

    if (!project_name?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Project name is required",
      });
    }

    const pool = await poolPromise;

    const existing = await pool
      .request()
      .input("project_name", sql.VarChar, project_name)
      .query(`
        SELECT id FROM test_case_manager.dbo.projects
        WHERE project_name = @project_name
      `);

    if (existing.recordset.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Project name already exists",
      });
    }

    const insertResult = await pool
      .request()
      .input("project_name", sql.VarChar, project_name)
      .input("description", sql.VarChar(sql.MAX), description || null)
      .input("is_active", sql.Bit, is_active ?? 1)
      .input("created_by", sql.Int, userId)
      .input("updated_by", sql.Int, userId)
      .query(`
        INSERT INTO test_case_manager.dbo.projects
          (project_name, description, is_active, created_by, updated_by)
        OUTPUT INSERTED.*
        VALUES
          (@project_name, @description, @is_active, @created_by, @updated_by)
      `);

    const project = cleanAuditData(insertResult.recordset[0]);

    await logAudit({
      userId,
      action: "CREATE",
      module: "PROJECT",
      entityType: "PROJECT",
      entityId: project.id,
      entityName: project.project_name,
      description: `Created project ${project.project_name}`,
      newValues: project,
    });

    res.status(201).json({
      success: true,
      message: "Project created successfully",
    });
  } catch (err) {
    console.error("CREATE Project Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to create project",
      error: err.message,
    });
  }
};

// ===============================
// UPDATE PROJECT
// ===============================
exports.updateProject = async (req, res) => {
  try {
    const { id } = req.params;
    const { project_name, description, is_active } = req.body;
    const userId = req.user?.id || null;

    const pool = await poolPromise;

    const oldResult = await pool
      .request()
      .input("id", sql.Int, id)
      .query(`SELECT * FROM test_case_manager.dbo.projects WHERE id = @id`);

    if (!oldResult.recordset[0]) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    const oldProject = cleanAuditData(oldResult.recordset[0]);

    await pool
      .request()
      .input("id", sql.Int, id)
      .input("project_name", sql.VarChar, project_name)
      .input("description", sql.VarChar, description || null)
      .input("is_active", sql.Bit, is_active)
      .input("updated_by", sql.Int, userId)
      .query(`
        UPDATE test_case_manager.dbo.projects
        SET project_name = @project_name,
            description  = @description,
            is_active    = @is_active,
            updated_by   = @updated_by,
            updated_at   = GETDATE()
        WHERE id = @id
      `);

    const newResult = await pool
      .request()
      .input("id", sql.Int, id)
      .query(`SELECT * FROM test_case_manager.dbo.projects WHERE id = @id`);

    const newProject = cleanAuditData(newResult.recordset[0]);

    await logAudit({
      userId,
      action: "UPDATE",
      module: "PROJECT",
      entityType: "PROJECT",
      entityId: Number(id),
      entityName: newProject.project_name,
      description: `Updated project ${newProject.project_name}`,
      oldValues: oldProject,
      newValues: newProject,
    });

    res.json({
      success: true,
      message: "Project updated successfully",
    });
  } catch (err) {
    console.error("UPDATE Project Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to update project",
      error: err.message,
    });
  }
};

// ===============================
// DELETE (ARCHIVE PROJECT)
// ===============================
exports.deleteProject = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || null;
    const pool = await poolPromise;

    const projectResult = await pool
      .request()
      .input("id", sql.Int, id)
      .query(`SELECT * FROM test_case_manager.dbo.projects WHERE id = @id`);

    const project = cleanAuditData(projectResult.recordset[0]);

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

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

    await logAudit({
      userId,
      action: "ARCHIVE",
      module: "PROJECT",
      entityType: "PROJECT",
      entityId: project.id,
      entityName: project.project_name,
      description: `Archived project ${project.project_name}`,
      oldValues: project,
    });

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

// ===============================
// TOGGLE PROJECT STATUS
// ===============================
exports.toggleProject = async (req, res) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;
    const userId = req.user?.id || null;

    const pool = await poolPromise;

    const oldResult = await pool
      .request()
      .input("id", sql.Int, id)
      .query(`SELECT * FROM test_case_manager.dbo.projects WHERE id = @id`);

    const oldProject = cleanAuditData(oldResult.recordset[0]);

    await pool
      .request()
      .input("id", sql.Int, id)
      .input("is_active", sql.Bit, is_active)
      .input("updated_by", sql.Int, userId)
      .query(`
        UPDATE test_case_manager.dbo.projects
        SET is_active  = @is_active,
            updated_by = @updated_by,
            updated_at = GETDATE()
        WHERE id = @id
      `);

    const newProject = {
      ...oldProject,
      is_active,
    };

    await logAudit({
      userId,
      action: "STATUS_CHANGE",
      module: "PROJECT",
      entityType: "PROJECT",
      entityId: Number(id),
      entityName: oldProject.project_name,
      description: `Project status changed to ${
        is_active ? "Active" : "Inactive"
      }`,
      oldValues: oldProject,
      newValues: newProject,
    });

    res.json({
      success: true,
      message: "Project status updated",
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