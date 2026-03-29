const { poolPromise } = require("../config/db");

exports.getRoles = async (req, res) => {
    try {
        if (!req.user || req.user.role !== "Admin") {
    return res.status(403).json({
        success: false,
        message: "Access denied"
    });
}
        const pool = await poolPromise;

        const result = await pool.request().query(`
            SELECT id, role_name
            FROM test_case_manager.dbo.roles
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
            message: "Failed to fetch roles",
            error: err.message
        });
    }
};