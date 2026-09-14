const { poolPromise } = require("../config/db");
const sql = require("mssql");

let menuCache = null;

const ALLOWED_PERMISSION_TYPES = new Set([
  "can_view",
  "can_create",
  "can_edit",
  "can_delete",
]);

async function getMenuIdByPath(path) {
  if (!menuCache) {
    const pool = await poolPromise;

    const result = await pool.request().query(`
      SELECT id, path
      FROM test_case_manager.dbo.menus
      WHERE path IS NOT NULL
    `);

    menuCache = {};

    for (const row of result.recordset) {
      menuCache[row.path] = row.id;
    }
  }

  return menuCache[path] ?? null;
}

exports.clearMenuCache = () => {
  menuCache = null;
};

/**
 * @param {string} menuPath
 * @param {'can_view'|'can_create'|'can_edit'|'can_delete'} permissionType
 */
const checkPermission = (menuPath, permissionType) => {
  if (!ALLOWED_PERMISSION_TYPES.has(permissionType)) {
    throw new Error(
      `Invalid permission type '${permissionType}'`,
    );
  }

  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const pool = await poolPromise;

      const menuId = await getMenuIdByPath(menuPath);

      if (!menuId) {
        console.error(
          `checkPermission: no menu found for path '${menuPath}'`,
        );

        return res.status(500).json({
          success: false,
          message:
            "Permission check failed: unknown menu path",
        });
      }

      const userResult = await pool
        .request()
        .input("userId", sql.Int, req.user.id)
        .query(`
          SELECT role_id
          FROM test_case_manager.dbo.users
          WHERE id = @userId
        `);

      const user = userResult.recordset[0];

      if (
        !user ||
        user.role_id === null ||
        user.role_id === undefined
      ) {
        return res.status(403).json({
          success: false,
          message: "Access denied: no role assigned",
        });
      }

      const permResult = await pool
        .request()
        .input("role_id", sql.Int, user.role_id)
        .input("menu_id", sql.Int, menuId)
        .query(`
          SELECT ${permissionType}
          FROM test_case_manager.dbo.role_permissions
          WHERE role_id = @role_id
            AND menu_id = @menu_id
        `);

      const record = permResult.recordset[0];

      if (
        !record ||
        record[permissionType] !== true
      ) {
        return res.status(403).json({
          success: false,
          message:
            "Access denied: insufficient permissions",
        });
      }

      next();
    } catch (err) {
      console.error("Permission check error:", err);

      res.status(500).json({
        success: false,
        message: "Permission check failed",
      });
    }
  };
};

module.exports = checkPermission;
