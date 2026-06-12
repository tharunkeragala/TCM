const { poolPromise } = require("../config/db");
const sql = require("mssql");

// ✅ UTILITY — used by other controllers
const logAudit = async ({
  userId = null,
  performedBy = null,
  action,
  module,
  entityType = null,
  entityId = null,
  entityName = null,
  description = null,
  oldValues = null,
  newValues = null,
  status = "SUCCESS",
}) => {
  try {
    const pool = await poolPromise;
 if (userId && !performedBy) {
      const userResult = await pool
        .request()
        .input("user_id", sql.Int, userId)
        .query(`
          SELECT username FROM test_case_manager.dbo.users WHERE id = @user_id
        `);
      performedBy = userResult.recordset[0]?.username ?? null;
    }
    await pool
      .request()
      .input("user_id", sql.Int, userId)
      .input("performed_by", sql.NVarChar, performedBy)
      .input("action", sql.NVarChar, action)
      .input("module", sql.NVarChar, module)
      .input("entity_type", sql.NVarChar, entityType)
      .input("entity_id", sql.Int, entityId)
      .input("entity_name", sql.NVarChar, entityName)
      .input("description", sql.NVarChar, description)
      .input("old_values", sql.NVarChar(sql.MAX), oldValues ? JSON.stringify(oldValues) : null)
      .input("new_values", sql.NVarChar(sql.MAX), newValues ? JSON.stringify(newValues) : null)
      .input("status", sql.NVarChar, status)
      .query(`
        INSERT INTO audit_logs (
          user_id, performed_by, action, module, status,
          entity_type, entity_id, entity_name,
          description, old_values, new_values
        )
        VALUES (
          @user_id, @performed_by, @action, @module, @status,
          @entity_type, @entity_id, @entity_name,
          @description, @old_values, @new_values
        )
      `);
  } catch (error) {
    console.error("Audit Log Error:", error);
  }
};

// ✅ GET ALL — with filters + pagination
exports.getAuditLogs = async (req, res) => {
  try {
    const {
      module,
      action,
      entity_type,
      entity_id,
      status,
      performed_by,
      from_date,
      to_date,
      page = 1,
      limit = 50,
    } = req.query;

    const pool = await poolPromise;
    const request = pool.request();
    const countRequest = pool.request();
    const filters = [];

    if (module) {
      request.input("module", sql.NVarChar, module);
      countRequest.input("module", sql.NVarChar, module);
      filters.push("module = @module");
    }
    if (action) {
      request.input("action", sql.NVarChar, action);
      countRequest.input("action", sql.NVarChar, action);
      filters.push("action = @action");
    }
    if (entity_type) {
      request.input("entity_type", sql.NVarChar, entity_type);
      countRequest.input("entity_type", sql.NVarChar, entity_type);
      filters.push("entity_type = @entity_type");
    }
    if (entity_id) {
      request.input("entity_id", sql.Int, Number(entity_id));
      countRequest.input("entity_id", sql.Int, Number(entity_id));
      filters.push("entity_id = @entity_id");
    }
    if (status) {
      request.input("status", sql.NVarChar, status);
      countRequest.input("status", sql.NVarChar, status);
      filters.push("status = @status");
    }
    if (performed_by) {
      request.input("performed_by", sql.NVarChar, `%${performed_by}%`);
      countRequest.input("performed_by", sql.NVarChar, `%${performed_by}%`);
      filters.push("performed_by LIKE @performed_by");
    }
    if (from_date) {
      request.input("from_date", sql.DateTime, new Date(from_date));
      countRequest.input("from_date", sql.DateTime, new Date(from_date));
      filters.push("created_at >= @from_date");
    }
    if (to_date) {
      request.input("to_date", sql.DateTime, new Date(to_date));
      countRequest.input("to_date", sql.DateTime, new Date(to_date));
      filters.push("created_at <= @to_date");
    }

    const whereClause = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";
    const offset = (Number(page) - 1) * Number(limit);

    request.input("offset", sql.Int, offset);
    request.input("limit", sql.Int, Number(limit));

    const [dataResult, countResult] = await Promise.all([
      request.query(`
        SELECT id, created_at, user_id, performed_by, action, module,
               status, entity_type, entity_id, entity_name, description,
               old_values, new_values, correlation_id, ip_address, user_agent
        FROM test_case_manager.dbo.audit_logs
        ${whereClause}
        ORDER BY created_at DESC
        OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
      `),
      countRequest.query(`
        SELECT COUNT(*) AS total
        FROM test_case_manager.dbo.audit_logs
        ${whereClause}
      `),
    ]);

    res.json({
      success: true,
      data: dataResult.recordset,
      pagination: {
        total: countResult.recordset[0]?.total ?? 0,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil((countResult.recordset[0]?.total ?? 0) / Number(limit)),
      },
    });
  } catch (err) {
    console.error("GET Audit Logs Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch audit logs",
      error: err.message,
    });
  }
};

// ✅ GET BY ID
exports.getAuditLogById = async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await poolPromise;

    const result = await pool
      .request()
      .input("id", sql.Int, id)
      .query(`
        SELECT * FROM test_case_manager.dbo.audit_logs WHERE id = @id
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ success: false, message: "Log not found" });
    }

    res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    console.error("GET Audit Log By ID Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch audit log",
      error: err.message,
    });
  }
};

// ✅ DEFAULT EXPORT — for use in other controllers
module.exports = logAudit;