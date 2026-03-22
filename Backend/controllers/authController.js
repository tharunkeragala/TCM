const { sql, poolPromise } = require("../config/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const SECRET = "testcase_secret";

exports.login = async (req, res) => {
    try {
        const { username, password } = req.body;

        const pool = await poolPromise; // ✅ THIS is the real pool

        const result = await pool.request()
            .input("username", sql.VarChar, username)
            .query(`
                SELECT users.*, roles.role_name 
                FROM users 
                JOIN roles ON users.role_id = roles.id
                WHERE username = @username AND is_active = 1
            `);

        if (result.recordset.length === 0) {
            return res.status(401).json({ message: "User not found or inactive" });
        }

        const user = result.recordset[0];

        const match = await bcrypt.compare(password, user.password);

        if (!match) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        const token = jwt.sign(
            { id: user.id, role: user.role_name },
            SECRET,
            { expiresIn: "8h" }
        );

        res.json({
            token,
            username: user.username,
            role: user.role_name
        });

    } catch (err) {
        console.error(err);
        res.status(500).send("Server Error");
    }
};

exports.windowsLogin = async (req, res) => {
    try {
        const { windows_username } = req.body;

        const pool = await poolPromise;

        const result = await pool.request()
            .input("windows_username", sql.VarChar, windows_username)
            .query(`
                SELECT users.*, roles.role_name 
                FROM users 
                JOIN roles ON users.role_id = roles.id
                WHERE windows_username = @windows_username AND is_active = 1
            `);

        if (result.recordset.length === 0) {
            return res.status(401).json({ message: "Windows user not authorized" });
        }

        const user = result.recordset[0];

        const token = jwt.sign(
            { id: user.id, role: user.role_name },
            SECRET,
            { expiresIn: "8h" }
        );

        res.json({
            token,
            username: user.username,
            role: user.role_name
        });

    } catch (err) {
        console.error(err);
        res.status(500).send("Server Error");
    }
};