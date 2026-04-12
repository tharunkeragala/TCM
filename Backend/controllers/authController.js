const { sql, poolPromise } = require("../config/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const SECRET = process.env.JWT_SECRET;

exports.login = async (req, res) => {
    try {
        const { username, password } = req.body;

        const pool = await poolPromise;

        const result = await pool.request()
            .input("username", sql.VarChar, username)
            .query(`
                SELECT TOP 1
                    u.id,
                    u.username,
                    u.password,
                    u.email,
                    u.department_id,
                    u.team_id,
                    r.role_name,
                    d.department_name,
                    t.team_name
                FROM users u
                JOIN roles r ON u.role_id = r.id
                LEFT JOIN departments d ON u.department_id = d.id
                LEFT JOIN teams t ON u.team_id = t.id
                WHERE u.username = @username 
                  AND u.is_active = 1
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
            user: {
                id: user.id,
                username: user.username,
                role: user.role_name,
                email: user.email,
                department: {
                    id: user.department_id,
                    name: user.department_name
                },
                team: {
                    id: user.team_id,
                    name: user.team_name
                }
            }
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