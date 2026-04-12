const { poolPromise } = require("../config/db");
const sql = require("mssql");

// ─── Users ──────────────────────────────────────────────────────
exports.getUsersList = async (req, res) => {
  try {
    const pool = await poolPromise;

    const result = await pool.request().query(`
      SELECT 
        u.id, u.username, u.source, u.is_active,
        u.role_id, u.department_id, u.team_id,
        u.created_at, u.updated_at,
        u.created_by,
        u.updated_by,
        uc.username AS created_by_username,
        uu.username AS updated_by_username,
        r.role_name,
        d.department_name,
        t.team_name
      FROM users u
      LEFT JOIN users uc ON u.created_by = uc.id
      LEFT JOIN users uu ON u.updated_by = uu.id
      LEFT JOIN roles r ON u.role_id = r.id
      LEFT JOIN departments d ON u.department_id = d.id
      LEFT JOIN teams t ON u.team_id = t.id
      ORDER BY u.id ASC
    `);

    return res.status(200).json({
      success: true,
      message: "Users fetched successfully",
      count: result.recordset.length,
      data: result.recordset,
    });
  } catch (err) {
    console.error("GET Users Error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch users",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};