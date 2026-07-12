const { poolPromise } = require("../config/db");
const sql = require("mssql");

// GET /api/permissions/mine
// Returns: { success, data: { "/projects": { can_view, can_create, can_edit, can_delete }, ... } }
// This is the frontend counterpart to middleware/checkPermission — same role_permissions/menus
// tables, just flattened into one payload the UI can use to show/hide buttons.
exports.getMyPermissions = async (req, res) => {
  try {
    const pool = await poolPromise;

    const userResult = await pool
      .request()
      .input("id", sql.Int, req.user.id)
      .query(`SELECT role_id FROM test_case_manager.dbo.users WHERE id = @id`);

    const roleId = userResult.recordset[0]?.role_id;
    if (!roleId) {
      return res.status(200).json({ success: true, data: {} });
    }

    const result = await pool
      .request()
      .input("role_id", sql.Int, roleId)
      .query(`
        SELECT m.path, rp.can_view, rp.can_create, rp.can_edit, rp.can_delete
        FROM test_case_manager.dbo.role_permissions rp
        JOIN test_case_manager.dbo.menus m ON m.id = rp.menu_id
        WHERE rp.role_id = @role_id AND m.path IS NOT NULL
      `);

    const map = {};
    for (const row of result.recordset) {
      map[row.path] = {
        can_view: !!row.can_view,
        can_create: !!row.can_create,
        can_edit: !!row.can_edit,
        can_delete: !!row.can_delete,
      };
    }

    res.status(200).json({ success: true, data: map });
  } catch (err) {
    console.error("GET My Permissions Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch permissions",
      error: err.message,
    });
  }
};
