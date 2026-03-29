const { poolPromise } = require("../config/db");

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