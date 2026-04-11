const { poolPromise } = require("../config/db");
const sql = require("mssql");

// ─── Helper ───────────────────────────────────────────────────────────────────
function buildTree(data, parentId = null) {
  return data
    .filter((item) => item.parent_id === parentId)
    .map((item) => ({
      ...item,
      children: buildTree(data, item.id),
    }));
}

// ─── Menu Tree ────────────────────────────────────────────────────────────────
exports.getMenuTree = async (req, res) => {
  try {
    const pool = await poolPromise;

    const result = await pool.request().query(`
      SELECT * FROM test_case_manager.dbo.menus
    `);

    const tree = buildTree(result.recordset);

    res.status(200).json({
      success: true,
      data: tree,
    });
  } catch (err) {
    console.error("SQL Server Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch menu tree",
      error: err.message,
    });
  }
};

// ─── Get All Roles ────────────────────────────────────────────────────────────
exports.getRoles = async (req, res) => {
  try {
    const pool = await poolPromise;

    const result = await pool.request().query(`
      SELECT id, role_name
      FROM test_case_manager.dbo.roles
      ORDER BY id ASC
    `);

    res.status(200).json({
      success: true,
      data: result.recordset,
    });
  } catch (err) {
    console.error("SQL Server Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch roles",
      error: err.message,
    });
  }
};

// ─── Get Assigned User Count For A Role ───────────────────────────────────────
exports.getAssignedUserCount = async (req, res) => {
  try {
    const { id } = req.params;

    const pool = await poolPromise;

    const result = await pool
      .request()
      .input("role_id", sql.Int, id)
      .query(`
        SELECT COUNT(*) AS user_count
        FROM test_case_manager.dbo.users
        WHERE role_id = @role_id
      `);

    const count = result.recordset[0]?.user_count ?? 0;

    res.status(200).json({
      success: true,
      count,
    });
  } catch (err) {
    console.error("GET Assigned User Count (Role) Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch assigned user count",
      error: err.message,
    });
  }
};

// ─── Create Role ──────────────────────────────────────────────────────────────
exports.createRole = async (req, res) => {
  try {
    const { role_name } = req.body;

    if (!role_name || !role_name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Role name is required",
      });
    }

    const pool = await poolPromise;

    // ✅ Check duplicate
    const existing = await pool
      .request()
      .input("role_name", sql.VarChar, role_name.trim())
      .query(`
        SELECT id FROM test_case_manager.dbo.roles
        WHERE role_name = @role_name
      `);

    if (existing.recordset.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Role already exists",
      });
    }

    // ✅ Insert
    await pool
      .request()
      .input("role_name", sql.VarChar, role_name.trim())
      .query(`
        INSERT INTO test_case_manager.dbo.roles (role_name)
        VALUES (@role_name)
      `);

    // ✅ Audit log
    await pool
      .request()
      .input("description", sql.VarChar, `Role '${role_name}' created`)
      .query(`
        INSERT INTO test_case_manager.dbo.audit_logs (action, module, description)
        VALUES ('CREATE', 'ROLE', @description)
      `);

    res.status(201).json({
      success: true,
      message: "Role created successfully",
    });
  } catch (err) {
    console.error("SQL Server Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to create role",
      error: err.message,
    });
  }
};

// ─── Edit Role ────────────────────────────────────────────────────────────────
exports.updateRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role_name } = req.body;

    if (!role_name || !role_name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Role name is required",
      });
    }

    const pool = await poolPromise;

    // ✅ Check role exists
    const existing = await pool
      .request()
      .input("id", sql.Int, id)
      .query(`
        SELECT id FROM test_case_manager.dbo.roles
        WHERE id = @id
      `);

    if (existing.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Role not found",
      });
    }

    // ✅ Check duplicate name (excluding current)
    const duplicate = await pool
      .request()
      .input("role_name", sql.VarChar, role_name.trim())
      .input("id", sql.Int, id)
      .query(`
        SELECT id FROM test_case_manager.dbo.roles
        WHERE role_name = @role_name AND id != @id
      `);

    if (duplicate.recordset.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Another role with this name already exists",
      });
    }

    // ✅ Update
    await pool
      .request()
      .input("id", sql.Int, id)
      .input("role_name", sql.VarChar, role_name.trim())
      .query(`
        UPDATE test_case_manager.dbo.roles
        SET role_name = @role_name
        WHERE id = @id
      `);

    // ✅ Audit log
    await pool
      .request()
      .input("description", sql.VarChar, `Role ID ${id} updated to '${role_name}'`)
      .query(`
        INSERT INTO test_case_manager.dbo.audit_logs (action, module, description)
        VALUES ('UPDATE', 'ROLE', @description)
      `);

    res.status(200).json({
      success: true,
      message: "Role updated successfully",
    });
  } catch (err) {
    console.error("SQL Server Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to update role",
      error: err.message,
    });
  }
};

// ─── Delete Role ──────────────────────────────────────────────────────────────
exports.deleteRole = async (req, res) => {
  try {
    const { id } = req.params;

    const pool = await poolPromise;

    // ✅ Check role exists
    const existing = await pool
      .request()
      .input("id", sql.Int, id)
      .query(`
        SELECT id, role_name FROM test_case_manager.dbo.roles
        WHERE id = @id
      `);

    if (existing.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Role not found",
      });
    }

    const roleName = existing.recordset[0].role_name;

    // ✅ Count assigned users
    const assignedUsersResult = await pool
      .request()
      .input("id", sql.Int, id)
      .query(`
        SELECT COUNT(*) AS user_count
        FROM test_case_manager.dbo.users
        WHERE role_id = @id
      `);

    const userCount = assignedUsersResult.recordset[0]?.user_count ?? 0;

    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      // ✅ Detach users from role
      if (userCount > 0) {
        await transaction
          .request()
          .input("id", sql.Int, id)
          .query(`
            UPDATE test_case_manager.dbo.users
            SET role_id = NULL
            WHERE role_id = @id
          `);

        await transaction
          .request()
          .input("description", sql.VarChar, `${userCount} user(s) detached from Role '${roleName}' (ID: ${id}) before deletion`)
          .query(`
            INSERT INTO test_case_manager.dbo.audit_logs (action, module, description)
            VALUES ('DETACH', 'ROLE', @description)
          `);
      }

      // ✅ Delete role permissions
      await transaction
        .request()
        .input("id", sql.Int, id)
        .query(`
          DELETE FROM test_case_manager.dbo.role_permissions
          WHERE role_id = @id
        `);

      // ✅ Delete role
      await transaction
        .request()
        .input("id", sql.Int, id)
        .query(`
          DELETE FROM test_case_manager.dbo.roles
          WHERE id = @id
        `);

      await transaction
        .request()
        .input("description", sql.VarChar, `Role '${roleName}' (ID: ${id}) deleted`)
        .query(`
          INSERT INTO test_case_manager.dbo.audit_logs (action, module, description)
          VALUES ('DELETE', 'ROLE', @description)
        `);

      await transaction.commit();

      res.status(200).json({
        success: true,
        message:
          userCount > 0
            ? `Role deleted. ${userCount} user(s) have been detached and need to be reassigned.`
            : "Role deleted successfully",
      });
    } catch (innerErr) {
      await transaction.rollback();
      throw innerErr;
    }
  } catch (err) {
    console.error("SQL Server Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to delete role",
      error: err.message,
    });
  }
};

// ─── Get Role Permissions ─────────────────────────────────────────────────────
exports.getRolePermissions = async (req, res) => {
  try {
    const { roleId } = req.params;

    const pool = await poolPromise;

    const result = await pool
      .request()
      .input("roleId", sql.Int, roleId)
      .query(`
        SELECT menu_id, can_view, can_create, can_edit, can_delete
        FROM test_case_manager.dbo.role_permissions
        WHERE role_id = @roleId
      `);

    res.status(200).json({
      success: true,
      data: result.recordset,
    });
  } catch (err) {
    console.error("SQL Server Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch role permissions",
      error: err.message,
    });
  }
};

// ─── Save Role Permissions ────────────────────────────────────────────────────
exports.saveRolePermissions = async (req, res) => {
  try {
    const { roleId, permissions } = req.body;

    if (!roleId || !Array.isArray(permissions)) {
      return res.status(400).json({
        success: false,
        message: "roleId and permissions array are required",
      });
    }

    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);

    await transaction.begin();

    try {
      // ✅ Delete old permissions
      await transaction
        .request()
        .input("roleId", sql.Int, roleId)
        .query(`
          DELETE FROM test_case_manager.dbo.role_permissions
          WHERE role_id = @roleId
        `);

      // ✅ Insert new permissions
      for (const p of permissions) {
        await transaction
          .request()
          .input("roleId", sql.Int, roleId)
          .input("menuId", sql.Int, p.menu_id)
          .input("canView", sql.Bit, p.can_view)
          .input("canCreate", sql.Bit, p.can_create)
          .input("canEdit", sql.Bit, p.can_edit)
          .input("canDelete", sql.Bit, p.can_delete)
          .query(`
            INSERT INTO test_case_manager.dbo.role_permissions
              (role_id, menu_id, can_view, can_create, can_edit, can_delete)
            VALUES
              (@roleId, @menuId, @canView, @canCreate, @canEdit, @canDelete)
          `);
      }

      // ✅ Audit log
      await transaction
        .request()
        .input("description", sql.VarChar, `Permissions updated for role ${roleId}`)
        .query(`
          INSERT INTO test_case_manager.dbo.audit_logs (action, module, description)
          VALUES ('UPDATE', 'ROLE', @description)
        `);

      await transaction.commit();

      res.status(200).json({
        success: true,
        message: "Permissions saved successfully",
      });
    } catch (innerErr) {
      await transaction.rollback();
      throw innerErr;
    }
  } catch (err) {
    console.error("SQL Server Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to save role permissions",
      error: err.message,
    });
  }
};

// ─── Get My Permissions (logged-in user) ──────────────────────────────────────
exports.getMyPermissions = async (req, res) => {
  try {
    const userId = req.user.id;

    const pool = await poolPromise;

    const result = await pool
      .request()
      .input("userId", sql.Int, userId)
      .query(`
        SELECT m.menu_name, m.path
        FROM test_case_manager.dbo.role_permissions rp
        JOIN test_case_manager.dbo.users u ON u.role_id = rp.role_id
        JOIN test_case_manager.dbo.menus m ON m.id = rp.menu_id
        WHERE u.id = @userId AND rp.can_view = 1
      `);

    res.status(200).json({
      success: true,
      data: result.recordset,
    });
  } catch (err) {
    console.error("SQL Server Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch user permissions",
      error: err.message,
    });
  }
};