const { poolPromise } = require("../config/db");
const sql = require("mssql");
const {
  hasProjectAccess,
  hasAnyProjectAccess,
} = require("./projectAccess");

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

function clearMenuCache() {
  menuCache = null;
}

/**
 * Original role permission check with an optional project-member fallback.
 *
 * options:
 * - allowAnyProjectMember: true
 *     Use for project-related utilities that do not yet have a concrete project
 *     identifier at request time, such as recorder start/stop or parse preview.
 *
 * - resolveProjectId: async (req, pool) => projectId | null
 *     Use where the request can be resolved to one exact project.
 */
const checkPermission = (menuPath, permissionType, options = {}) => {
  if (!ALLOWED_PERMISSION_TYPES.has(permissionType)) {
    throw new Error(`Invalid permission type '${permissionType}'`);
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
        console.error(`checkPermission: no menu found for path '${menuPath}'`);
        return res.status(500).json({
          success: false,
          message: "Permission check failed: unknown menu path",
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

      // First preserve your original role-based permission behavior.
      if (user?.role_id !== null && user?.role_id !== undefined) {
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
        if (record?.[permissionType] === true) {
          return next();
        }
      }

      // If role permission is missing, optionally allow access because the user
      // is explicitly related to the relevant project.
      if (typeof options.resolveProjectId === "function") {
        const projectId = await options.resolveProjectId(req, pool);

        if (projectId) {
          const allowed = await hasProjectAccess(pool, req.user.id, projectId);
          if (allowed) {
            req.projectAccessId = Number(projectId);
            return next();
          }
        }
      }

      if (options.allowAnyProjectMember === true) {
        const allowed = await hasAnyProjectAccess(pool, req.user.id);
        if (allowed) {
          return next();
        }
      }

      return res.status(403).json({
        success: false,
        message: "Access denied: insufficient permissions",
      });
    } catch (err) {
      console.error("Permission check error:", err);
      return res.status(500).json({
        success: false,
        message: "Permission check failed",
        error: err.message,
      });
    }
  };
};

checkPermission.clearMenuCache = clearMenuCache;
module.exports = checkPermission;
