const { poolPromise } = require("../config/db");

// Get all departments
exports.getDepartments = async (req, res) => {
    try {
        const pool = await poolPromise;

        const result = await pool.request().query(`
            SELECT id, department_name, is_active
            FROM test_case_manager.dbo.departments
            ORDER BY id DESC
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