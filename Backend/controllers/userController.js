const { sql, poolPromise } = require("../config/db");
const bcrypt = require("bcrypt");
const logAudit = require("./auditController");

const getAuditUser = (req) => ({
  userId: req.user?.id ?? null,
  performedBy: req.user?.username ?? null,
});

// -------------------------
// 🔧 HELPERS FOR AUDIT ENRICHMENT
// -------------------------
const buildUserAuditData = async (pool, user) => {
  if (!user) return null;

  let role_name = null;
  let department_name = null;
  let team_name = null;

  if (user.role_id) {
    const r = await pool.request()
      .input("id", sql.Int, user.role_id)
      .query(`SELECT role_name FROM roles WHERE id = @id`);
    role_name = r.recordset[0]?.role_name ?? null;
  }

  if (user.department_id) {
    const d = await pool.request()
      .input("id", sql.Int, user.department_id)
      .query(`SELECT department_name FROM departments WHERE id = @id`);
    department_name = d.recordset[0]?.department_name ?? null;
  }

  if (user.team_id) {
    const t = await pool.request()
      .input("id", sql.Int, user.team_id)
      .query(`SELECT team_name FROM teams WHERE id = @id`);
    team_name = t.recordset[0]?.team_name ?? null;
  }

  return {
    id: user.id,
    username: user.username,
    role_name,
    department_name,
    team_name,
    is_active: user.is_active ?? null,
  };
};

// -------------------------
// ✅ GET ALL USERS
// -------------------------
exports.getUsers = async (req, res) => {
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

// -------------------------
// ✅ CREATE MANUAL USER
// -------------------------
exports.createUser = async (req, res) => {
  try {
    const { username, password, role_id, department_id, team_id } = req.body;

    if (!username || !password || !role_id) {
      return res.status(400).json({
        success: false,
        message: "Username, password, and role are required.",
      });
    }

    const pool = await poolPromise;

    const existing = await pool.request()
      .input("username", sql.VarChar, username)
      .query(`SELECT id FROM users WHERE username = @username`);

    if (existing.recordset.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Username already exists.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const insert = await pool.request()
      .input("username", sql.VarChar, username)
      .input("password", sql.VarChar, hashedPassword)
      .input("role_id", sql.Int, role_id)
      .input("department_id", sql.Int, department_id || null)
      .input("team_id", sql.Int, team_id || null)
      .input("created_by", sql.Int, req.user.id)
      .query(`
        INSERT INTO users 
        (username, password, role_id, department_id, team_id, source, created_by, created_at, updated_at)
        OUTPUT INSERTED.*
        VALUES 
        (@username, @password, @role_id, @department_id, @team_id, 'MANUAL', @created_by, GETDATE(), GETDATE())
      `);

    const user = insert.recordset[0];
    const auditUser = await buildUserAuditData(pool, user);

    await logAudit({
      ...getAuditUser(req),
      action: "CREATE",
      module: "USER",
      entityType: "USER",
      entityId: user.id,
      entityName: user.username,
      description: `User "${user.username}" created`,
      newValues: auditUser,
      status: "SUCCESS",
    });

    return res.status(201).json({
      success: true,
      message: "User created successfully",
    });
  } catch (err) {
    console.error("CREATE User Error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to create user",
      error: err.message,
    });
  }
};

// -------------------------
// ✅ ADD AD USER
// -------------------------
exports.addADUser = async (req, res) => {
  try {
    const { windows_username, role_id, department_id, team_id } = req.body;

    const pool = await poolPromise;

    const existing = await pool.request()
      .input("username", sql.VarChar, windows_username)
      .query(`SELECT id FROM users WHERE username = @username`);

    if (existing.recordset.length > 0) {
      return res.status(400).json({
        success: false,
        message: "AD user already exists.",
      });
    }

    const insert = await pool.request()
      .input("username", sql.VarChar, windows_username)
      .input("role_id", sql.Int, role_id)
      .input("department_id", sql.Int, department_id || null)
      .input("team_id", sql.Int, team_id || null)
      .input("created_by", sql.Int, req.user.id)
      .query(`
        INSERT INTO users 
        (username, windows_username, role_id, department_id, team_id, source, created_by, created_at, updated_at)
        OUTPUT INSERTED.*
        VALUES 
        (@username, @username, @role_id, @department_id, @team_id, 'AD', @created_by, GETDATE(), GETDATE())
      `);

    const user = insert.recordset[0];
    const auditUser = await buildUserAuditData(pool, user);

    await logAudit({
      ...getAuditUser(req),
      action: "CREATE",
      module: "USER",
      entityType: "USER",
      entityName: windows_username,
      description: `AD User "${windows_username}" added`,
      newValues: auditUser,
      status: "SUCCESS",
    });

    return res.status(201).json({
      success: true,
      message: "AD User added successfully",
    });
  } catch (err) {
    console.error("ADD AD User Error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to add AD user",
      error: err.message,
    });
  }
};

// -------------------------
// ✅ UPDATE USER
// -------------------------
exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { role_id, department_id, team_id, is_active, password } = req.body;

    const pool = await poolPromise;

    const oldRecord = await pool.request()
      .input("id", sql.Int, id)
      .query(`SELECT * FROM users WHERE id = @id`);

    const oldUser = oldRecord.recordset[0];

    if (!oldUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    let hashedPassword = null;

    if (password && password.trim()) {
      hashedPassword = await bcrypt.hash(password, 10);
    }

    await pool.request()
      .input("id", sql.Int, id)
      .input("role_id", sql.Int, role_id)
      .input("department_id", sql.Int, department_id || null)
      .input("team_id", sql.Int, team_id || null)
      .input("is_active", sql.Bit, is_active)
      .input("password", sql.VarChar, hashedPassword)
      .input("updated_by", sql.Int, req.user.id)
      .query(`
        UPDATE users
        SET role_id = @role_id,
            department_id = @department_id,
            team_id = @team_id,
            is_active = @is_active,
            password = COALESCE(@password, password),
            updated_by = @updated_by,
            updated_at = GETDATE()
        WHERE id = @id
      `);

    const newRecord = await pool.request()
      .input("id", sql.Int, id)
      .query(`SELECT * FROM users WHERE id = @id`);

    const oldAudit = await buildUserAuditData(pool, oldUser);
    const newAudit = await buildUserAuditData(pool, newRecord.recordset[0]);

    await logAudit({
      ...getAuditUser(req),
      action: "UPDATE",
      module: "USER",
      entityType: "USER",
      entityId: Number(id),
      entityName: oldUser.username,
      description: `User "${oldUser.username}" updated`,
      oldValues: oldAudit,
      newValues: newAudit,
      status: "SUCCESS",
    });

    return res.json({
      success: true,
      message: "User updated successfully",
    });
  } catch (err) {
    console.error("UPDATE User Error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to update user",
      error: err.message,
    });
  }
};

// -------------------------
// ✅ DELETE USER
// -------------------------
exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await poolPromise;

    const userResult = await pool.request()
      .input("id", sql.Int, id)
      .query(`SELECT * FROM users WHERE id = @id`);

    const user = userResult.recordset[0];

    await pool.request()
      .input("id", sql.Int, id)
      .query(`DELETE FROM users WHERE id = @id`);

    const auditUser = await buildUserAuditData(pool, user);

    await logAudit({
      ...getAuditUser(req),
      action: "DELETE",
      module: "USER",
      entityType: "USER",
      entityId: Number(id),
      entityName: user.username,
      description: `User "${user.username}" deleted`,
      oldValues: auditUser,
      status: "SUCCESS",
    });

    return res.json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (err) {
    console.error("DELETE User Error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to delete user",
      error: err.message,
    });
  }
};

// -------------------------
// ✅ TOGGLE USER
// -------------------------
exports.toggleUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;

    const pool = await poolPromise;

    const oldRecord = await pool.request()
      .input("id", sql.Int, id)
      .query(`SELECT * FROM users WHERE id = @id`);

    const oldUser = oldRecord.recordset[0];

    await pool.request()
      .input("id", sql.Int, id)
      .input("is_active", sql.Bit, is_active)
      .input("updated_by", sql.Int, req.user.id)
      .query(`
        UPDATE users
        SET is_active = @is_active,
            updated_by = @updated_by,
            updated_at = GETDATE()
        WHERE id = @id
      `);

    const oldAudit = await buildUserAuditData(pool, oldUser);

    const newAudit = {
      ...oldAudit,
      is_active,
    };

    await logAudit({
      ...getAuditUser(req),
      action: "STATUS_CHANGE",
      module: "USER",
      entityType: "USER",
      entityId: Number(id),
      entityName: oldUser.username,
      description: `User "${oldUser.username}" status changed to ${is_active ? "Active" : "Inactive"}`,
      oldValues: oldAudit,
      newValues: newAudit,
      status: "SUCCESS",
    });

    return res.json({
      success: true,
      message: "User status updated",
    });
  } catch (err) {
    console.error("TOGGLE User Error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to update user status",
      error: err.message,
    });
  }
};