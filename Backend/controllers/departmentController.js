const { poolPromise } = require("../config/db");
const sql = require("mssql");

exports.getDepartments = async (req, res) => {
    try {
        if (req.user.role !== "Admin") {
            return res.status(403).json({
                success: false,
                message: "Access denied"
            });
        }
        const pool = await poolPromise;

        const result = await pool.request().query(`
            SELECT id, department_name, is_active
            FROM test_case_manager.dbo.departments
            ORDER BY id ASC
        `);

        res.status(200).json({
            success: true,
            data: result.recordset
        });

    } catch (err) {
        console.error("SQL Server Error:", err);
        res.status(500).json({
            success: false,
            message: "Failed to fetch departments",
            error: err.message
        });
    }
};


exports.createDepartment = async (req, res) => {
    try {
        // ✅ Role check
        if (req.user.role !== "Admin") {
            return res.status(403).json({
                success: false,
                message: "Access denied"
            });
        }

        const { department_name, is_active } = req.body;

        if (!department_name) {
            return res.status(400).json({
                success: false,
                message: "Department name is required"
            });
        }

        const pool = await poolPromise;

        // ✅ Check if department already exists FIRST
        const existing = await pool.request()
            .input("department_name", sql.VarChar, department_name)
            .query(`
                SELECT id 
                FROM test_case_manager.dbo.departments
                WHERE department_name = @department_name
            `);

        if (existing.recordset.length > 0) {
            return res.status(400).json({
                success: false,
                message: "Department already exists"
            });
        }

        // ✅ Insert department
        await pool.request()
            .input("department_name", sql.VarChar, department_name)
            .input("is_active", sql.Bit, is_active ?? true)
            .query(`
                INSERT INTO test_case_manager.dbo.departments (department_name, is_active)
                VALUES (@department_name, @is_active)
            `);

        // ✅ Audit log
        await pool.request()
            .input("description", sql.VarChar, `Department ${department_name} created`)
            .query(`
                INSERT INTO audit_logs (action, module, description)
                VALUES ('CREATE', 'DEPARTMENT', @description)
            `);

        res.status(201).json({
            success: true,
            message: "Department created successfully"
        });

    } catch (err) {
        console.error("SQL Server Error:", err);
        res.status(500).json({
            success: false,
            message: "Failed to create department",
            error: err.message
        });
    }
};