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
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const result = await pool.request().input("user_id", sql.Int, userId)
      .query(`
        SELECT
          p.*,
          u1.username AS created_by_name,
          u2.username AS updated_by_name,
          pm.username AS project_manager_name
        FROM test_case_manager.dbo.projects p
        LEFT JOIN test_case_manager.dbo.users u1 ON u1.id = p.created_by
        LEFT JOIN test_case_manager.dbo.users u2 ON u2.id = p.updated_by
        LEFT JOIN test_case_manager.dbo.users pm ON pm.id = p.project_manager_id
        WHERE p.is_archived = 0
          AND (
            p.created_by = @user_id
            OR p.project_manager_id = @user_id
            OR EXISTS (
              SELECT 1
              FROM test_case_manager.dbo.project_assignees pa
              WHERE pa.project_id = p.id
                AND pa.user_id = @user_id
            )
            OR EXISTS (
              SELECT 1
              FROM test_case_manager.dbo.tasks t
              INNER JOIN test_case_manager.dbo.task_assignments ta
                ON ta.task_id = t.id
              WHERE t.project_id = p.id
                AND t.is_archived = 0
                AND ta.user_id = @user_id
                AND ta.role IN ('Assignee', 'Owner')
            )
          )
        ORDER BY p.id ASC
      `);

    if (result.recordset.length > 0) {
      const projectIds = result.recordset.map((project) => project.id);
      const assignmentsResult = await pool.request().query(`
          SELECT pa.project_id, u.id, u.username
          FROM test_case_manager.dbo.project_assignees pa
          INNER JOIN test_case_manager.dbo.users u ON u.id = pa.user_id
          WHERE pa.project_id IN (${projectIds.map((id) => Number(id)).join(",")})
          ORDER BY u.username ASC
        `);

      const byProject = new Map();
      for (const row of assignmentsResult.recordset) {
        if (!byProject.has(row.project_id)) byProject.set(row.project_id, []);
        byProject
          .get(row.project_id)
          .push({ id: row.id, username: row.username });
      }

      for (const project of result.recordset) {
        project.project_assignees = byProject.get(project.id) || [];
        project.project_assignee_ids = project.project_assignees.map(
          (user) => user.id,
        );
      }
    }

    return res.status(200).json({
      success: true,
      data: result.recordset,
    });
  } catch (err) {
    console.error("GET Projects Error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch projects",
      error: err.message,
    });
  }
};

// ===============================
// SEARCH USERS FOR PROJECT MANAGER / ASSIGNEES
// GET /api/projects/user-search?q=ab
// ===============================
exports.searchProjectUsers = async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();

    if (q.length < 2) {
      return res.status(200).json({
        success: true,
        data: [],
      });
    }

    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("search", sql.NVarChar(150), `%${q}%`).query(`
        SELECT TOP (20)
          u.id,
          u.username
        FROM test_case_manager.dbo.users u
        WHERE u.username LIKE @search
        ORDER BY u.username ASC
      `);

    return res.status(200).json({
      success: true,
      data: result.recordset,
    });
  } catch (err) {
    console.error("SEARCH Project Users Error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to search users",
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

    const result = await pool.request().input("id", sql.Int, id).query(`
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

    if (!result.recordset.length) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    const assigneesResult = await pool
      .request()
      .input("project_id", sql.Int, id).query(`
        SELECT u.id, u.username
        FROM test_case_manager.dbo.project_assignees pa
        INNER JOIN test_case_manager.dbo.users u ON u.id = pa.user_id
        WHERE pa.project_id = @project_id
        ORDER BY u.username ASC
      `);

    const project = result.recordset[0];
    project.project_assignees = assigneesResult.recordset;
    project.project_assignee_ids = assigneesResult.recordset.map(
      (user) => user.id,
    );

    return res.status(200).json({
      success: true,
      data: project,
    });
  } catch (err) {
    console.error("GET Project By ID Error:", err);
    return res.status(500).json({
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

      .input("project_id", sql.Int, id).query(`

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
  let transaction;

  try {
    const {
      project_name,
      description,
      is_active,
      project_manager_id,
      project_assignee_ids = [],
    } = req.body;
    const userId = req.user?.id || null;

    if (!project_name?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Project name is required",
      });
    }

    const normalizedAssigneeIds = [
      ...new Set(
        (Array.isArray(project_assignee_ids) ? project_assignee_ids : [])
          .map(Number)
          .filter((value) => Number.isInteger(value) && value > 0),
      ),
    ];

    const managerId = project_manager_id ? Number(project_manager_id) : null;
    const pool = await poolPromise;

    const existing = await pool
      .request()
      .input("project_name", sql.VarChar, project_name.trim()).query(`
        SELECT id
        FROM test_case_manager.dbo.projects
        WHERE project_name = @project_name
          AND is_archived = 0
      `);

    if (existing.recordset.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Project name already exists",
      });
    }

    transaction = new sql.Transaction(pool);
    await transaction.begin();

    const insertResult = await new sql.Request(transaction)
      .input("project_name", sql.VarChar, project_name.trim())
      .input("description", sql.VarChar(sql.MAX), description || null)
      .input("is_active", sql.Bit, is_active ?? 1)
      .input("project_manager_id", sql.Int, managerId)
      .input("created_by", sql.Int, userId)
      .input("updated_by", sql.Int, userId).query(`
        INSERT INTO test_case_manager.dbo.projects
          (project_name, description, is_active, project_manager_id, created_by, updated_by)
        OUTPUT INSERTED.*
        VALUES
          (@project_name, @description, @is_active, @project_manager_id, @created_by, @updated_by)
      `);

    const insertedProject = insertResult.recordset[0];

    for (const assigneeId of normalizedAssigneeIds) {
      await new sql.Request(transaction)
        .input("project_id", sql.Int, insertedProject.id)
        .input("user_id", sql.Int, assigneeId)
        .input("created_by", sql.Int, userId).query(`
          INSERT INTO test_case_manager.dbo.project_assignees
            (project_id, user_id, created_by)
          VALUES
            (@project_id, @user_id, @created_by)
        `);
    }

    await transaction.commit();
    transaction = null;

    const project = cleanAuditData(insertedProject);

    await logAudit({
      userId,
      action: "CREATE",
      module: "PROJECT",
      entityType: "PROJECT",
      entityId: project.id,
      entityName: project.project_name,
      description: `Created project ${project.project_name}`,
      newValues: {
        ...project,
        project_manager_id: managerId,
        project_assignee_ids: normalizedAssigneeIds,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Project created successfully",
      data: {
        ...insertedProject,
        project_assignee_ids: normalizedAssigneeIds,
      },
    });
  } catch (err) {
    if (transaction) {
      try {
        await transaction.rollback();
      } catch (rollbackErr) {
        console.error("CREATE Project Rollback Error:", rollbackErr);
      }
    }

    console.error("CREATE Project Error:", err);
    return res.status(500).json({
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
  let transaction;

  try {
    const { id } = req.params;
    const {
      project_name,
      description,
      is_active,
      project_manager_id,
      project_assignee_ids = [],
    } = req.body;
    const userId = req.user?.id || null;

    if (!project_name?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Project name is required",
      });
    }

    const normalizedAssigneeIds = [
      ...new Set(
        (Array.isArray(project_assignee_ids) ? project_assignee_ids : [])
          .map(Number)
          .filter((value) => Number.isInteger(value) && value > 0),
      ),
    ];

    const managerId = project_manager_id ? Number(project_manager_id) : null;
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

    const duplicateResult = await pool
      .request()
      .input("id", sql.Int, id)
      .input("project_name", sql.VarChar, project_name.trim()).query(`
        SELECT id
        FROM test_case_manager.dbo.projects
        WHERE project_name = @project_name
          AND id <> @id
          AND is_archived = 0
      `);

    if (duplicateResult.recordset.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Project name already exists",
      });
    }

    const oldAssignmentsResult = await pool
      .request()
      .input("project_id", sql.Int, id).query(`
        SELECT user_id
        FROM test_case_manager.dbo.project_assignees
        WHERE project_id = @project_id
      `);

    const oldProject = {
      ...cleanAuditData(oldResult.recordset[0]),
      project_assignee_ids: oldAssignmentsResult.recordset.map(
        (row) => row.user_id,
      ),
    };

    transaction = new sql.Transaction(pool);
    await transaction.begin();

    await new sql.Request(transaction)
      .input("id", sql.Int, id)
      .input("project_name", sql.VarChar, project_name.trim())
      .input("description", sql.VarChar(sql.MAX), description || null)
      .input("is_active", sql.Bit, is_active)
      .input("project_manager_id", sql.Int, managerId)
      .input("updated_by", sql.Int, userId).query(`
        UPDATE test_case_manager.dbo.projects
        SET project_name = @project_name,
            description = @description,
            is_active = @is_active,
            project_manager_id = @project_manager_id,
            updated_by = @updated_by,
            updated_at = GETDATE()
        WHERE id = @id
      `);

    await new sql.Request(transaction).input("project_id", sql.Int, id).query(`
        DELETE FROM test_case_manager.dbo.project_assignees
        WHERE project_id = @project_id
      `);

    for (const assigneeId of normalizedAssigneeIds) {
      await new sql.Request(transaction)
        .input("project_id", sql.Int, id)
        .input("user_id", sql.Int, assigneeId)
        .input("created_by", sql.Int, userId).query(`
          INSERT INTO test_case_manager.dbo.project_assignees
            (project_id, user_id, created_by)
          VALUES
            (@project_id, @user_id, @created_by)
        `);
    }

    await transaction.commit();
    transaction = null;

    const newResult = await pool
      .request()
      .input("id", sql.Int, id)
      .query(`SELECT * FROM test_case_manager.dbo.projects WHERE id = @id`);

    const newProject = {
      ...cleanAuditData(newResult.recordset[0]),
      project_assignee_ids: normalizedAssigneeIds,
    };

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

    return res.json({
      success: true,
      message: "Project updated successfully",
    });
  } catch (err) {
    if (transaction) {
      try {
        await transaction.rollback();
      } catch (rollbackErr) {
        console.error("UPDATE Project Rollback Error:", rollbackErr);
      }
    }

    console.error("UPDATE Project Error:", err);
    return res.status(500).json({
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

      .input("updated_by", sql.Int, userId).query(`

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

      .input("updated_by", sql.Int, userId).query(`

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
