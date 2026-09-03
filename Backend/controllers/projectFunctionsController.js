const { poolPromise } = require("../config/db");
const sql = require("mssql");
const logAudit = require("./auditController");

const cleanAuditData = (value = {}) => {
  const {
    created_at,
    updated_at,
    created_by,
    updated_by,
    created_by_name,
    updated_by_name,
    project_name,
    ...cleaned
  } = value;
  return cleaned;
};

exports.addFunctionToProject = async (req, res) => {
  try {
    const pool = await poolPromise;
    const userId = req.user.id;
    const { project_id, function_name, description, function_category } = req.body;

    if (!project_id || !function_name?.trim()) {
      return res.status(400).json({ error: "project_id and function_name are required" });
    }

    const result = await pool
      .request()
      .input("project_id", sql.Int, project_id)
      .input("function_name", sql.NVarChar(255), function_name.trim())
      .input("description", sql.NVarChar(sql.MAX), description || null)
      .input("function_category", sql.NVarChar(100), function_category || null)
      .input("created_by", sql.Int, userId)
      .query(`
        INSERT INTO test_case_manager.dbo.project_functions
          (project_id, function_name, description, function_category, created_by)
        VALUES
          (@project_id, @function_name, @description, @function_category, @created_by);
        SELECT CAST(SCOPE_IDENTITY() AS INT) AS id;
      `);

    const functionId = result.recordset[0].id;
    await logAudit({
      userId,
      action: "CREATE",
      module: "project_functions",
      entityType: "Project Function",
      entityId: functionId,
      entityName: function_name.trim(),
      description: "Project function created",
      newValues: cleanAuditData({ function_name: function_name.trim(), function_category }),
    });

    return res.status(201).json({
      success: true,
      message: "Function added to project successfully",
      functionId,
    });
  } catch (error) {
    console.error("Add function error:", error);
    return res.status(500).json({ error: error.message });
  }
};

exports.getProjectFunctions = async (req, res) => {
  try {
    const pool = await poolPromise;
    const { project_id } = req.params;
    const includeArchived = req.query.include_archived === "true";

    const result = await pool
      .request()
      .input("project_id", sql.Int, project_id)
      .query(`
        SELECT
          pf.*,
          p.project_name,
          u1.username AS created_by_name,
          u2.username AS updated_by_name,
          COUNT(DISTINCT br.id) AS bug_count
        FROM test_case_manager.dbo.project_functions pf
        INNER JOIN test_case_manager.dbo.projects p ON p.id = pf.project_id
        LEFT JOIN test_case_manager.dbo.users u1 ON u1.id = pf.created_by
        LEFT JOIN test_case_manager.dbo.users u2 ON u2.id = pf.updated_by
        LEFT JOIN test_case_manager.dbo.bug_reports br
          ON br.project_function_id = pf.id AND br.is_archived = 0
        WHERE pf.project_id = @project_id
          ${includeArchived ? "" : "AND pf.is_archived = 0"}
        GROUP BY
          pf.id, pf.project_id, pf.function_name, pf.description,
          pf.function_category, pf.created_by, pf.updated_by,
          pf.created_at, pf.updated_at, pf.is_archived,
          p.project_name, u1.username, u2.username
        ORDER BY pf.function_name ASC
      `);

    return res.json({ success: true, data: result.recordset });
  } catch (error) {
    console.error("Get project functions error:", error);
    return res.status(500).json({ error: error.message });
  }
};

exports.getAllFunctions = async (req, res) => {
  try {
    const pool = await poolPromise;
    const { category, limit = 50, offset = 0 } = req.query;
    const request = pool.request();
    let whereClause = "WHERE pf.is_archived = 0";

    if (category) {
      whereClause += " AND pf.function_category = @category";
      request.input("category", sql.NVarChar(100), category);
    }

    request.input("offset", sql.Int, Math.max(0, parseInt(offset, 10) || 0));
    request.input("limit", sql.Int, Math.max(1, parseInt(limit, 10) || 50));

    const result = await request.query(`
      SELECT
        pf.*,
        p.project_name,
        u1.username AS created_by_name,
        u2.username AS updated_by_name,
        COUNT(DISTINCT br.id) AS bug_count
      FROM test_case_manager.dbo.project_functions pf
      INNER JOIN test_case_manager.dbo.projects p ON p.id = pf.project_id
      LEFT JOIN test_case_manager.dbo.users u1 ON u1.id = pf.created_by
      LEFT JOIN test_case_manager.dbo.users u2 ON u2.id = pf.updated_by
      LEFT JOIN test_case_manager.dbo.bug_reports br
        ON br.project_function_id = pf.id AND br.is_archived = 0
      ${whereClause}
      GROUP BY
        pf.id, pf.project_id, pf.function_name, pf.description,
        pf.function_category, pf.created_by, pf.updated_by,
        pf.created_at, pf.updated_at, pf.is_archived,
        p.project_name, u1.username, u2.username
      ORDER BY pf.id DESC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `);

    const countRequest = pool.request();
    let countWhere = "WHERE is_archived = 0";
    if (category) {
      countWhere += " AND function_category = @category";
      countRequest.input("category", sql.NVarChar(100), category);
    }
    const countResult = await countRequest.query(`
      SELECT COUNT(*) AS total
      FROM test_case_manager.dbo.project_functions
      ${countWhere}
    `);

    return res.json({
      success: true,
      data: result.recordset,
      total: countResult.recordset[0].total,
    });
  } catch (error) {
    console.error("Get all project functions error:", error);
    return res.status(500).json({ error: error.message });
  }
};

exports.updateFunction = async (req, res) => {
  try {
    const pool = await poolPromise;
    const userId = req.user.id;
    const { id } = req.params;
    const { function_name, description, function_category } = req.body;

    const currentResult = await pool
      .request()
      .input("id", sql.Int, id)
      .query(`SELECT * FROM test_case_manager.dbo.project_functions WHERE id = @id`);

    const current = currentResult.recordset[0];
    if (!current) return res.status(404).json({ error: "Project function not found" });

    const nextName = function_name?.trim() || current.function_name;
    await pool
      .request()
      .input("id", sql.Int, id)
      .input("function_name", sql.NVarChar(255), nextName)
      .input("description", sql.NVarChar(sql.MAX), description !== undefined ? description : current.description)
      .input("function_category", sql.NVarChar(100), function_category !== undefined ? function_category : current.function_category)
      .input("updated_by", sql.Int, userId)
      .query(`
        UPDATE test_case_manager.dbo.project_functions
        SET function_name = @function_name,
            description = @description,
            function_category = @function_category,
            updated_by = @updated_by,
            updated_at = GETDATE()
        WHERE id = @id
      `);

    if (nextName !== current.function_name || description !== undefined || function_category !== undefined) {
      await logAudit({
        userId,
        action: "UPDATE",
        module: "project_functions",
        entityType: "Project Function",
        entityId: Number(id),
        entityName: nextName,
        description: "Project function updated",
        oldValues: cleanAuditData(current),
        newValues: cleanAuditData({ function_name: nextName, description, function_category }),
      });
    }

    return res.json({ success: true, message: "Function updated successfully" });
  } catch (error) {
    console.error("Update function error:", error);
    return res.status(500).json({ error: error.message });
  }
};

exports.deleteFunction = async (req, res) => {
  try {
    const pool = await poolPromise;
    const userId = req.user.id;
    const { id } = req.params;

    const result = await pool
      .request()
      .input("id", sql.Int, id)
      .input("updated_by", sql.Int, userId)
      .query(`
        UPDATE test_case_manager.dbo.project_functions
        SET is_archived = 1, updated_by = @updated_by, updated_at = GETDATE()
        WHERE id = @id AND is_archived = 0;
        SELECT @@ROWCOUNT AS affected;
      `);

    if (!result.recordset[0]?.affected) {
      return res.status(404).json({ error: "Project function not found" });
    }

    await logAudit({
      userId,
      action: "DELETE",
      module: "project_functions",
      entityType: "Project Function",
      entityId: Number(id),
      description: "Project function archived",
    });

    return res.json({ success: true, message: "Function deleted successfully" });
  } catch (error) {
    console.error("Delete function error:", error);
    return res.status(500).json({ error: error.message });
  }
};
