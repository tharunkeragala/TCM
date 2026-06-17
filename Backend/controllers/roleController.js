const { poolPromise } = require("../config/db");
const sql = require("mssql");
const logAudit = require("./auditController");

// ─── Helper ───────────────────────────────────────────────────────────────────
function buildTree(data, parentId = null) {
  return data
    .filter((item) => item.parent_id === parentId)
    .map((item) => ({
      ...item,
      children: buildTree(data, item.id),
    }));
}

function getPermissionDiff(oldPermissions, newPermissions) {
  const oldChanges = [];
  const newChanges = [];

  const oldMap = Object.fromEntries(
    oldPermissions.map((p) => [p.menu_name, p]),
  );

  const newMap = Object.fromEntries(
    newPermissions.map((p) => [p.menu_name, p]),
  );

  const allMenus = new Set([...Object.keys(oldMap), ...Object.keys(newMap)]);

  for (const menuName of allMenus) {
    const oldPerm = oldMap[menuName] || {};
    const newPerm = newMap[menuName] || {};

    for (const field of ["can_view", "can_create", "can_edit", "can_delete"]) {
      const oldVal = Number(oldPerm[field] || 0);
      const newVal = Number(newPerm[field] || 0);

      if (oldVal !== newVal) {
        oldChanges.push({
          menu: menuName,
          permission: field,
          value: oldVal,
        });

        newChanges.push({
          menu: menuName,
          permission: field,
          value: newVal,
        });
      }
    }
  }

  return {
    oldChanges,
    newChanges,
  };
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

    const result = await pool.request().input("role_id", sql.Int, id).query(`
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

    const existing = await pool
      .request()
      .input("role_name", sql.VarChar, role_name.trim()).query(`
        SELECT id FROM test_case_manager.dbo.roles
        WHERE role_name = @role_name
      `);

    if (existing.recordset.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Role already exists",
      });
    }

    await pool.request().input("role_name", sql.VarChar, role_name.trim())
      .query(`
        INSERT INTO test_case_manager.dbo.roles (role_name)
        VALUES (@role_name)
      `);

    // ✅ AUDIT
    await logAudit({
      userId: req.user?.id,
      action: "CREATE",
      module: "ROLE",
      entityType: "ROLE",
      entityName: role_name,
      description: `Role '${role_name}' created`,
      newValues: { role_name },
    });

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

// ─── Update Role ──────────────────────────────────────────────────────────────
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

    const existing = await pool.request().input("id", sql.Int, id).query(`
      SELECT id, role_name FROM test_case_manager.dbo.roles
      WHERE id = @id
    `);

    if (existing.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Role not found",
      });
    }

    const oldRole = existing.recordset[0];

    const duplicate = await pool
      .request()
      .input("role_name", sql.VarChar, role_name.trim())
      .input("id", sql.Int, id).query(`
        SELECT id FROM test_case_manager.dbo.roles
        WHERE role_name = @role_name AND id != @id
      `);

    if (duplicate.recordset.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Another role with this name already exists",
      });
    }

    await pool
      .request()
      .input("id", sql.Int, id)
      .input("role_name", sql.VarChar, role_name.trim()).query(`
        UPDATE test_case_manager.dbo.roles
        SET role_name = @role_name
        WHERE id = @id
      `);

    // ✅ AUDIT
    await logAudit({
      userId: req.user?.id,
      action: "UPDATE",
      module: "ROLE",
      entityType: "ROLE",
      entityId: parseInt(id),
      entityName: role_name,
      description: `Role updated`,
      oldValues: { role_name: oldRole.role_name },
      newValues: { role_name },
    });

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

    const existing = await pool.request().input("id", sql.Int, id).query(`
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

    const assignedUsersResult = await pool.request().input("id", sql.Int, id)
      .query(`
        SELECT COUNT(*) AS user_count
        FROM test_case_manager.dbo.users
        WHERE role_id = @id
      `);

    const userCount = assignedUsersResult.recordset[0]?.user_count ?? 0;

    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      if (userCount > 0) {
        await transaction.request().input("id", sql.Int, id).query(`
          UPDATE test_case_manager.dbo.users
          SET role_id = NULL
          WHERE role_id = @id
        `);

        await logAudit({
          userId: req.user?.id,
          action: "DETACH",
          module: "ROLE",
          entityType: "ROLE",
          entityId: parseInt(id),
          entityName: roleName,
          description: `Users detached before role deletion`,
          oldValues: { role_id: id, user_count: userCount },
        });
      }

      await transaction.request().input("id", sql.Int, id).query(`
        DELETE FROM test_case_manager.dbo.role_permissions
        WHERE role_id = @id
      `);

      await transaction.request().input("id", sql.Int, id).query(`
        DELETE FROM test_case_manager.dbo.roles
        WHERE id = @id
      `);

      await transaction.commit();

      await logAudit({
        userId: req.user?.id,
        action: "DELETE",
        module: "ROLE",
        entityType: "ROLE",
        entityId: parseInt(id),
        entityName: roleName,
        description: `Role deleted`,
        oldValues: { role_id: id, role_name: roleName },
      });

      res.status(200).json({
        success: true,
        message:
          userCount > 0
            ? `Role deleted. ${userCount} user(s) detached.`
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

// ─── Role Permissions ────────────────────────────────────────────────────────
exports.getRolePermissions = async (req, res) => {
  try {
    const { roleId } = req.params;
    const pool = await poolPromise;

    const result = await pool.request().input("roleId", sql.Int, roleId).query(`
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

// ─── Save Role Permissions ───────────────────────────────────────────────────
// ─── Save Role Permissions ───────────────────────────────────────────────────
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

    // Get role details
    const roleResult = await pool.request().input("roleId", sql.Int, roleId)
      .query(`
        SELECT id, role_name
        FROM test_case_manager.dbo.roles
        WHERE id = @roleId
      `);

    const role = roleResult.recordset[0];

    if (!role) {
      return res.status(404).json({
        success: false,
        message: "Role not found",
      });
    }

    // Get OLD permissions with menu names
    const oldPermissionsResult = await pool
      .request()
      .input("roleId", sql.Int, roleId).query(`
        SELECT
          m.menu_name,
          rp.can_view,
          rp.can_create,
          rp.can_edit,
          rp.can_delete
        FROM test_case_manager.dbo.role_permissions rp
        INNER JOIN test_case_manager.dbo.menus m
          ON m.id = rp.menu_id
        WHERE rp.role_id = @roleId
        ORDER BY m.menu_name
      `);

    const oldPermissions = oldPermissionsResult.recordset;

    const transaction = new sql.Transaction(pool);

    await transaction.begin();

    try {
      // Delete existing permissions
      await transaction.request().input("roleId", sql.Int, roleId).query(`
          DELETE FROM test_case_manager.dbo.role_permissions
          WHERE role_id = @roleId
        `);

      // Insert new permissions
      for (const p of permissions) {
        await transaction
          .request()
          .input("roleId", sql.Int, roleId)
          .input("menuId", sql.Int, p.menu_id)
          .input("canView", sql.Bit, p.can_view)
          .input("canCreate", sql.Bit, p.can_create)
          .input("canEdit", sql.Bit, p.can_edit)
          .input("canDelete", sql.Bit, p.can_delete).query(`
            INSERT INTO test_case_manager.dbo.role_permissions
            (
              role_id,
              menu_id,
              can_view,
              can_create,
              can_edit,
              can_delete
            )
            VALUES
            (
              @roleId,
              @menuId,
              @canView,
              @canCreate,
              @canEdit,
              @canDelete
            )
          `);
      }

      await transaction.commit();

      // Get menu names for NEW permissions
      let newPermissions = [];

      if (permissions.length > 0) {
        const menuIds = permissions.map((p) => p.menu_id);

        const menuResult = await pool.request().query(`
          SELECT id, menu_name
          FROM test_case_manager.dbo.menus
          WHERE id IN (${menuIds.join(",")})
        `);

        const menuMap = {};

        menuResult.recordset.forEach((menu) => {
          menuMap[menu.id] = menu.menu_name;
        });

        newPermissions = permissions.map((p) => ({
          menu_name: menuMap[p.menu_id] || `Menu ${p.menu_id}`,
          can_view: p.can_view,
          can_create: p.can_create,
          can_edit: p.can_edit,
          can_delete: p.can_delete,
        }));
      }

      // Audit log
      const { oldChanges, newChanges } = getPermissionDiff(
        oldPermissions,
        newPermissions,
      );

      if (oldChanges.length > 0) {
        await logAudit({
          userId: req.user?.id,
          action: "UPDATE",
          module: "ROLE_PERMISSIONS",
          entityType: "ROLE",
          entityId: Number(roleId),
          entityName: role.role_name,
          description: `Permissions updated for role '${role.role_name}'`,
          oldValues: oldChanges,
          newValues: newChanges,
        });
      }

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
// ─── My Permissions ──────────────────────────────────────────────────────────
exports.getMyPermissions = async (req, res) => {
  try {
    const userId = req.user.id;
    const pool = await poolPromise;

    const result = await pool.request().input("userId", sql.Int, userId).query(`
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
