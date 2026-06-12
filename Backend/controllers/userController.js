const { sql, poolPromise } = require("../config/db");
const bcrypt = require("bcrypt");
const logAudit = require("./auditController");

const getAuditUser = (req) => ({
  userId: req.user?.id ?? null,
  performedBy: req.user?.username ?? null,
});

// ✅ GET ALL USERS
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

// ✅ CREATE MANUAL USER
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
    const createdBy = req.user.id;

    const existing = await pool
      .request()
      .input("username", sql.VarChar, username)
      .query(`SELECT id FROM users WHERE username = @username`);

    if (existing.recordset.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Username already exists.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await pool
      .request()
      .input("username", sql.VarChar, username)
      .input("password", sql.VarChar, hashedPassword)
      .input("role_id", sql.Int, role_id)
      .input("department_id", sql.Int, department_id || null)
      .input("team_id", sql.Int, team_id || null)
      .input("created_by", sql.Int, createdBy)
      .query(`
        INSERT INTO users 
        (username, password, role_id, department_id, team_id, source, created_by, created_at, updated_at)
        VALUES 
        (@username, @password, @role_id, @department_id, @team_id, 'MANUAL', @created_by, GETDATE(), GETDATE())
      `);

    await logAudit({
      ...getAuditUser(req),
      action: "CREATE",
      module: "USER",
      entityType: "USER",
      entityName: username,
      description: `User "${username}" created`,
      newValues: { username, role_id, department_id, team_id, source: "MANUAL" },
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

// ✅ ADD AD USER
exports.addADUser = async (req, res) => {
  try {
    const { windows_username, role_id, department_id, team_id } = req.body;

    if (!windows_username || !role_id) {
      return res.status(400).json({
        success: false,
        message: "Windows username and role are required.",
      });
    }

    const pool = await poolPromise;
    const createdBy = req.user.id;

    const existing = await pool
      .request()
      .input("username", sql.VarChar, windows_username)
      .query(`SELECT id FROM users WHERE username = @username`);

    if (existing.recordset.length > 0) {
      return res.status(400).json({
        success: false,
        message: "AD user already exists.",
      });
    }

    await pool
      .request()
      .input("username", sql.VarChar, windows_username)
      .input("role_id", sql.Int, role_id)
      .input("department_id", sql.Int, department_id || null)
      .input("team_id", sql.Int, team_id || null)
      .input("created_by", sql.Int, createdBy)
      .query(`
        INSERT INTO users 
        (username, windows_username, role_id, department_id, team_id, source, created_by, created_at, updated_at)
        VALUES 
        (@username, @username, @role_id, @department_id, @team_id, 'AD', @created_by, GETDATE(), GETDATE())
      `);

    await logAudit({
      ...getAuditUser(req),
      action: "CREATE",
      module: "USER",
      entityType: "USER",
      entityName: windows_username,
      description: `AD User "${windows_username}" added`,
      newValues: { username: windows_username, role_id, department_id, team_id, source: "AD" },
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

// ✅ UPDATE USER
exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { role_id, department_id, team_id, is_active, password } = req.body;

    if (!role_id) {
      return res.status(400).json({
        success: false,
        message: "Role is required.",
      });
    }

    const updatedBy = req.user.id;
    const pool = await poolPromise;

    // Fetch old values + username for audit
    const oldRecord = await pool
      .request()
      .input("id", sql.Int, id)
      .query(`
        SELECT username, role_id, department_id, team_id, is_active
        FROM users WHERE id = @id
      `);
    const targetUsername = oldRecord.recordset[0]?.username ?? `ID ${id}`;

    if (password && password.trim()) {
      const hashedPassword = await bcrypt.hash(password, 10);

      await pool
        .request()
        .input("id", sql.Int, id)
        .input("role_id", sql.Int, role_id)
        .input("department_id", sql.Int, department_id || null)
        .input("team_id", sql.Int, team_id || null)
        .input("is_active", sql.Bit, is_active)
        .input("password", sql.VarChar, hashedPassword)
        .input("updated_by", sql.Int, updatedBy)
        .query(`
          UPDATE users
          SET role_id       = @role_id,
              department_id = @department_id,
              team_id       = @team_id,
              is_active     = @is_active,
              password      = @password,
              updated_by    = @updated_by,
              updated_at    = GETDATE()
          WHERE id = @id
        `);
    } else {
      await pool
        .request()
        .input("id", sql.Int, id)
        .input("role_id", sql.Int, role_id)
        .input("department_id", sql.Int, department_id || null)
        .input("team_id", sql.Int, team_id || null)
        .input("is_active", sql.Bit, is_active)
        .input("updated_by", sql.Int, updatedBy)
        .query(`
          UPDATE users
          SET role_id       = @role_id,
              department_id = @department_id,
              team_id       = @team_id,
              is_active     = @is_active,
              updated_by    = @updated_by,
              updated_at    = GETDATE()
          WHERE id = @id
        `);
    }

    await logAudit({
      ...getAuditUser(req),
      action: "UPDATE",
      module: "USER",
      entityType: "USER",
      entityId: Number(id),
      entityName: targetUsername,
      description: `User "${targetUsername}" updated`,
      oldValues: oldRecord.recordset[0] ?? null,
      newValues: { role_id, department_id, team_id, is_active, passwordChanged: !!(password && password.trim()) },
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

// ✅ DELETE USER
exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await poolPromise;

    const userResult = await pool
      .request()
      .input("id", sql.Int, id)
      .query(`SELECT username FROM users WHERE id = @id`);

    const username = userResult.recordset[0]?.username ?? `ID ${id}`;

    await pool
      .request()
      .input("id", sql.Int, id)
      .query(`DELETE FROM users WHERE id = @id`);

    await logAudit({
      ...getAuditUser(req),
      action: "DELETE",
      module: "USER",
      entityType: "USER",
      entityId: Number(id),
      entityName: username,
      description: `User "${username}" deleted`,
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

// ✅ TOGGLE ACTIVE STATUS
exports.toggleUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;
    const updatedBy = req.user.id;
    const pool = await poolPromise;

    const userResult = await pool
      .request()
      .input("id", sql.Int, id)
      .query(`SELECT username FROM users WHERE id = @id`);
    const username = userResult.recordset[0]?.username ?? `ID ${id}`;

    await pool
      .request()
      .input("id", sql.Int, id)
      .input("is_active", sql.Bit, is_active)
      .input("updated_by", sql.Int, updatedBy)
      .query(`
        UPDATE users
        SET is_active  = @is_active,
            updated_by = @updated_by,
            updated_at = GETDATE()
        WHERE id = @id
      `);

    await logAudit({
      ...getAuditUser(req),
      action: "STATUS_CHANGE",
      module: "USER",
      entityType: "USER",
      entityId: Number(id),
      entityName: username,
      description: `User "${username}" status changed to ${is_active ? "Active" : "Inactive"}`,
      newValues: { is_active },
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