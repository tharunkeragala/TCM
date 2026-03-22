const { sql, poolPromise } = require("../config/db");

exports.getUsers = async (req, res) => {
    try {
        const pool = await poolPromise;

        const result = await pool.request().query(`
            SELECT u.id, u.username, u.source, u.is_active,
                   r.role_name,
                   d.department_name
            FROM users u
            LEFT JOIN roles r ON u.role_id = r.id
            LEFT JOIN departments d ON u.department_id = d.id
        `);

        res.json(result.recordset);

    } catch (err) {
        console.error("SQL Server Error:", err);
        res.status(500).json({ error: err.message });
    }
};


const bcrypt = require("bcrypt");

exports.createUser = async (req, res) => {
    try {
        const { username, password, role_id, department_id } = req.body;

        const hashedPassword = await bcrypt.hash(password, 10);

        const pool = await poolPromise;

        await pool.request()
            .input("username", sql.VarChar, username)
            .input("password", sql.VarChar, hashedPassword)
            .input("role_id", sql.Int, role_id)
            .input("department_id", sql.Int, department_id)
            .query(`
                INSERT INTO users (username, password, role_id, department_id, source)
                VALUES (@username, @password, @role_id, @department_id, 'MANUAL')
            `);

        await pool.request()
            .input("description", sql.VarChar, `User ${username} created`)
            .query(`
                INSERT INTO audit_logs (action, module, description)
                VALUES ('CREATE', 'USER', @description)
            `);

        res.json({ message: "User created" });

    } catch (err) {
        console.error("SQL Server Error:", err);
        res.status(500).json({ error: err.message });
    }
};


exports.addADUser = async (req, res) => {
    try {
        const { windows_username, role_id, department_id } = req.body;

        const pool = await poolPromise;

        await pool.request()
            .input("username", sql.VarChar, windows_username)
            .input("role_id", sql.Int, role_id)
            .input("department_id", sql.Int, department_id)
            .query(`
                INSERT INTO users (username, windows_username, role_id, department_id, source)
                VALUES (@username, @username, @role_id, @department_id, 'AD')
            `);

        res.json({ message: "AD User added" });

    } catch (err) {
        console.error("SQL Server Error:", err);
        res.status(500).json({ error: err.message });
    }
};