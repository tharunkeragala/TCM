const { poolPromise } = require("../config/db");
const sql = require("mssql");

// ✅ GET ALL
exports.getDepartments = async (req, res) => {
  try {
    const pool = await poolPromise;

    const result = await pool.request().query(`
      SELECT id, department_name, is_active
      FROM test_case_manager.dbo.departments
      ORDER BY id ASC
    `);

    res.status(200).json({
      success: true,
      data: result.recordset,
    });
  } catch (err) {
    console.error("GET Departments Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch departments",
      error: err.message,
    });
  }
};

// ✅ GET ASSIGNED USER COUNT
exports.getAssignedUserCount = async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await poolPromise;

    const result = await pool
      .request()
      .input("department_id", sql.Int, id)
      .query(`
        SELECT COUNT(*) AS user_count
        FROM test_case_manager.dbo.users
        WHERE department_id = @department_id
      `);

    const count = result.recordset[0]?.user_count ?? 0;

    res.status(200).json({
      success: true,
      count,
    });
  } catch (err) {
    console.error("GET Assigned User Count Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch assigned user count",
      error: err.message,
    });
  }
};

// ✅ CREATE
exports.createDepartment = async (req, res) => {
  try {
    const { department_name, is_active } = req.body;

    if (!department_name) {
      return res.status(400).json({
        success: false,
        message: "Department name is required",
      });
    }

    const pool = await poolPromise;

    const existing = await pool
      .request()
      .input("department_name", sql.VarChar, department_name)
      .query(`
        SELECT id FROM test_case_manager.dbo.departments
        WHERE department_name = @department_name
      `);

    if (existing.recordset.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Department already exists",
      });
    }

    await pool
      .request()
      .input("department_name", sql.VarChar, department_name)
      .input("is_active", sql.Bit, is_active ?? true)
      .query(`
        INSERT INTO test_case_manager.dbo.departments (department_name, is_active)
        VALUES (@department_name, @is_active)
      `);

    await pool
      .request()
      .input("description", sql.VarChar, `Department ${department_name} created`)
      .query(`
        INSERT INTO audit_logs (action, module, description)
        VALUES ('CREATE', 'DEPARTMENT', @description)
      `);

    res.status(201).json({
      success: true,
      message: "Department created successfully",
    });
  } catch (err) {
    console.error("CREATE Department Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to create department",
      error: err.message,
    });
  }
};

// ✅ UPDATE
exports.updateDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    const { department_name, is_active } = req.body;

    const pool = await poolPromise;

    const existing = await pool
      .request()
      .input("department_name", sql.VarChar, department_name)
      .input("id", sql.Int, id)
      .query(`
        SELECT id FROM test_case_manager.dbo.departments
        WHERE department_name = @department_name AND id != @id
      `);

    if (existing.recordset.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Department name already exists",
      });
    }

    await pool
      .request()
      .input("id", sql.Int, id)
      .input("department_name", sql.VarChar, department_name)
      .input("is_active", sql.Bit, is_active)
      .query(`
        UPDATE test_case_manager.dbo.departments
        SET department_name = @department_name,
            is_active = @is_active
        WHERE id = @id
      `);

    await pool
      .request()
      .input("description", sql.VarChar, `Department ID ${id} updated`)
      .query(`
        INSERT INTO audit_logs (action, module, description)
        VALUES ('UPDATE', 'DEPARTMENT', @description)
      `);

    res.json({
      success: true,
      message: "Department updated successfully",
    });
  } catch (err) {
    console.error("UPDATE Department Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to update department",
      error: err.message,
    });
  }
};

// ✅ DELETE (detaches assigned users before deleting)
exports.deleteDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await poolPromise;

    const assignedUsersResult = await pool
      .request()
      .input("department_id", sql.Int, id)
      .query(`
        SELECT COUNT(*) AS user_count
        FROM test_case_manager.dbo.users
        WHERE department_id = @department_id
      `);

    const userCount = assignedUsersResult.recordset[0]?.user_count ?? 0;

    if (userCount > 0) {
      await pool
        .request()
        .input("department_id", sql.Int, id)
        .query(`
          UPDATE test_case_manager.dbo.users
          SET department_id = NULL
          WHERE department_id = @department_id
        `);

      await pool
        .request()
        .input("description", sql.VarChar, `${userCount} user(s) detached from Department ID ${id} before deletion`)
        .query(`
          INSERT INTO audit_logs (action, module, description)
          VALUES ('DETACH', 'DEPARTMENT', @description)
        `);
    }

    await pool
      .request()
      .input("id", sql.Int, id)
      .query(`
        DELETE FROM test_case_manager.dbo.departments
        WHERE id = @id
      `);

    await pool
      .request()
      .input("description", sql.VarChar, `Department ID ${id} deleted`)
      .query(`
        INSERT INTO audit_logs (action, module, description)
        VALUES ('DELETE', 'DEPARTMENT', @description)
      `);

    res.json({
      success: true,
      message:
        userCount > 0
          ? `Department deleted. ${userCount} user(s) have been detached and need to be reassigned.`
          : "Department deleted successfully",
    });
  } catch (err) {
    console.error("DELETE Department Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to delete department",
      error: err.message,
    });
  }
};

// ✅ TOGGLE ACTIVE
exports.toggleDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;
    const pool = await poolPromise;

    await pool
      .request()
      .input("id", sql.Int, id)
      .input("is_active", sql.Bit, is_active)
      .query(`
        UPDATE test_case_manager.dbo.departments
        SET is_active = @is_active
        WHERE id = @id
      `);

    await pool
      .request()
      .input("description", sql.VarChar, `Department ID ${id} status changed to ${is_active ? "Active" : "Inactive"}`)
      .query(`
        INSERT INTO audit_logs (action, module, description)
        VALUES ('STATUS_CHANGE', 'DEPARTMENT', @description)
      `);

    res.json({
      success: true,
      message: "Department status updated",
    });
  } catch (err) {
    console.error("TOGGLE Department Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to update status",
      error: err.message,
    });
  }
};