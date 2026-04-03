const { sql, poolPromise } = require("../config/db");
const bcrypt = require("bcrypt");

// ✅ GET ALL USERS
exports.getUsers = async (req, res) => {
  try {
    if (req.user.role !== "Admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    const pool = await poolPromise;

    const result = await pool.request().query(`
      SELECT u.id, u.username, u.source, u.is_active,
             u.role_id, u.department_id,
             r.role_name,
             d.department_name
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      LEFT JOIN departments d ON u.department_id = d.id
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
    if (req.user.role !== "Admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    const { username, password, role_id, department_id } = req.body;

    if (!username || !password || !role_id) {
      return res.status(400).json({
        success: false,
        message: "Username, password, and role are required.",
      });
    }

    const pool = await poolPromise;

    // 🔍 Check duplicate username
    const existing = await pool
      .request()
      .input("username", sql.VarChar, username)
      .query(`
        SELECT id FROM users WHERE username = @username
      `);

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
      .query(`
        INSERT INTO users (username, password, role_id, department_id, source)
        VALUES (@username, @password, @role_id, @department_id, 'MANUAL')
      `);

    // 🧾 Audit log
    await pool
      .request()
      .input("description", sql.VarChar, `User ${username} created (MANUAL)`)
      .query(`
        INSERT INTO audit_logs (action, module, description)
        VALUES ('CREATE', 'USER', @description)
      `);

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
    if (req.user.role !== "Admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    const { windows_username, role_id, department_id } = req.body;

    if (!windows_username || !role_id) {
      return res.status(400).json({
        success: false,
        message: "Windows username and role are required.",
      });
    }

    const pool = await poolPromise;

    // 🔍 Check duplicate
    const existing = await pool
      .request()
      .input("username", sql.VarChar, windows_username)
      .query(`
        SELECT id FROM users WHERE username = @username
      `);

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
      .query(`
        INSERT INTO users (username, windows_username, role_id, department_id, source)
        VALUES (@username, @username, @role_id, @department_id, 'AD')
      `);

    // 🧾 Audit log
    await pool
      .request()
      .input(
        "description",
        sql.VarChar,
        `AD User ${windows_username} added`
      )
      .query(`
        INSERT INTO audit_logs (action, module, description)
        VALUES ('CREATE', 'USER', @description)
      `);

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
    if (req.user.role !== "Admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    const { id } = req.params;
    const { role_id, department_id, is_active, password } = req.body;

    if (!role_id) {
      return res.status(400).json({
        success: false,
        message: "Role is required.",
      });
    }

    const pool = await poolPromise;

    // ✅ If a new password is provided, hash it
    if (password && password.trim()) {
      const hashedPassword = await bcrypt.hash(password, 10);

      await pool
        .request()
        .input("id", sql.Int, id)
        .input("role_id", sql.Int, role_id)
        .input("department_id", sql.Int, department_id || null)
        .input("is_active", sql.Bit, is_active)
        .input("password", sql.VarChar, hashedPassword)
        .query(`
          UPDATE users
          SET role_id = @role_id,
              department_id = @department_id,
              is_active = @is_active,
              password = @password
          WHERE id = @id
        `);
    } else {
      await pool
        .request()
        .input("id", sql.Int, id)
        .input("role_id", sql.Int, role_id)
        .input("department_id", sql.Int, department_id || null)
        .input("is_active", sql.Bit, is_active)
        .query(`
          UPDATE users
          SET role_id = @role_id,
              department_id = @department_id,
              is_active = @is_active
          WHERE id = @id
        `);
    }

    // 🧾 Audit log
    await pool
      .request()
      .input("description", sql.VarChar, `User ID ${id} updated`)
      .query(`
        INSERT INTO audit_logs (action, module, description)
        VALUES ('UPDATE', 'USER', @description)
      `);

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
    if (req.user.role !== "Admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    const { id } = req.params;

    const pool = await poolPromise;

    // 🔍 Get username for audit log
    const userResult = await pool
      .request()
      .input("id", sql.Int, id)
      .query(`SELECT username FROM users WHERE id = @id`);

    const username = userResult.recordset[0]?.username ?? `ID ${id}`;

    await pool
      .request()
      .input("id", sql.Int, id)
      .query(`DELETE FROM users WHERE id = @id`);

    // 🧾 Audit log
    await pool
      .request()
      .input("description", sql.VarChar, `User ${username} deleted`)
      .query(`
        INSERT INTO audit_logs (action, module, description)
        VALUES ('DELETE', 'USER', @description)
      `);

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
    if (req.user.role !== "Admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    const { id } = req.params;
    const { is_active } = req.body;

    const pool = await poolPromise;

    await pool
      .request()
      .input("id", sql.Int, id)
      .input("is_active", sql.Bit, is_active)
      .query(`
        UPDATE users
        SET is_active = @is_active
        WHERE id = @id
      `);

    // 🧾 Audit log
    await pool
      .request()
      .input(
        "description",
        sql.VarChar,
        `User ID ${id} status changed to ${is_active ? "Active" : "Inactive"}`
      )
      .query(`
        INSERT INTO audit_logs (action, module, description)
        VALUES ('STATUS_CHANGE', 'USER', @description)
      `);

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