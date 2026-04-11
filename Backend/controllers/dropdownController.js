const { poolPromise } = require("../config/db");
const sql = require("mssql");

// ─── Roles ────────────────────────────────────────────────────────────────────
exports.getRolesDropdown = async (req, res) => {
  try {
    const pool = await poolPromise;

    const result = await pool.request().query(`
      SELECT id, role_name
      FROM test_case_manager.dbo.roles
      ORDER BY role_name ASC
    `);

    res.status(200).json({ success: true, data: result.recordset });
  } catch (err) {
    console.error("GET Roles Dropdown Error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch roles", error: err.message });
  }
};

// ─── Departments ──────────────────────────────────────────────────────────────
exports.getDepartmentsDropdown = async (req, res) => {
  try {
    const pool = await poolPromise;

    const result = await pool.request().query(`
      SELECT id, department_name, is_active
      FROM test_case_manager.dbo.departments
      WHERE is_active = 1
      ORDER BY department_name ASC
    `);

    res.status(200).json({ success: true, data: result.recordset });
  } catch (err) {
    console.error("GET Departments Dropdown Error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch departments", error: err.message });
  }
};

// ─── Teams (all active) ───────────────────────────────────────────────────────
exports.getTeamsDropdown = async (req, res) => {
  try {
    const pool = await poolPromise;

    const result = await pool.request().query(`
      SELECT id, team_name, is_active, department_id
      FROM test_case_manager.dbo.teams
      WHERE is_active = 1
      ORDER BY team_name ASC
    `);

    res.status(200).json({ success: true, data: result.recordset });
  } catch (err) {
    console.error("GET Teams Dropdown Error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch teams", error: err.message });
  }
};

// ─── Teams by Department ──────────────────────────────────────────────────────
exports.getTeamsByDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await poolPromise;

    const result = await pool
      .request()
      .input("department_id", sql.Int, id)
      .query(`
        SELECT id, team_name, is_active, department_id
        FROM test_case_manager.dbo.teams
        WHERE department_id = @department_id AND is_active = 1
        ORDER BY team_name ASC
      `);

    res.status(200).json({ success: true, data: result.recordset });
  } catch (err) {
    console.error("GET Teams By Department Error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch teams", error: err.message });
  }
};