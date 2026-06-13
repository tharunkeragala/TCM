const { poolPromise } = require("../config/db");
const sql = require("mssql");

// Helper: capture only changed fields
const getChangedFields = (oldObj = {}, newObj = {}) => {
  const oldChanges = {};
  const newChanges = {};

  const keys = new Set([
    ...Object.keys(oldObj || {}),
    ...Object.keys(newObj || {}),
  ]);

  for (const key of keys) {
    const oldValue = oldObj?.[key];
    const newValue = newObj?.[key];

    if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
      oldChanges[key] = oldValue;
      newChanges[key] = newValue;
    }
  }

  return {
    oldValues: Object.keys(oldChanges).length ? oldChanges : null,
    newValues: Object.keys(newChanges).length ? newChanges : null,
  };
};

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

    // Get username if only userId is provided
    if (userId && !performedBy) {
      const userResult = await pool
        .request()
        .input("user_id", sql.Int, userId)
        .query(`
          SELECT username
          FROM test_case_manager.dbo.users
          WHERE id = @user_id
        `);

      performedBy = userResult.recordset[0]?.username ?? null;
    }

    // Only keep changed fields
    let changedOldValues = oldValues;
    let changedNewValues = newValues;

    if (oldValues && newValues) {
      const diff = getChangedFields(oldValues, newValues);
      changedOldValues = diff.oldValues;
      changedNewValues = diff.newValues;

      // Skip UPDATE audit if nothing actually changed
      if (
        action?.toUpperCase() === "UPDATE" &&
        !changedOldValues &&
        !changedNewValues
      ) {
        return;
      }
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
      .input(
        "old_values",
        sql.NVarChar(sql.MAX),
        changedOldValues
          ? JSON.stringify(changedOldValues)
          : null
      )
      .input(
        "new_values",
        sql.NVarChar(sql.MAX),
        changedNewValues
          ? JSON.stringify(changedNewValues)
          : null
      )
      .input("status", sql.NVarChar, status)
      .query(`
        INSERT INTO audit_logs (
          user_id,
          performed_by,
          action,
          module,
          status,
          entity_type,
          entity_id,
          entity_name,
          description,
          old_values,
          new_values
        )
        VALUES (
          @user_id,
          @performed_by,
          @action,
          @module,
          @status,
          @entity_type,
          @entity_id,
          @entity_name,
          @description,
          @old_values,
          @new_values
        )
      `);
  } catch (error) {
    console.error("Audit Log Error:", error);
  }
};

module.exports = logAudit;