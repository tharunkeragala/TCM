const { poolPromise } = require("../config/db");
const sql = require("mssql");
const logAudit = require("./auditController");

// departmentController.js — add this helper at the top
const getAuditUser = (req) => ({
  userId: req.user?.id ?? null,
  performedBy: req.user?.username ?? null,
});

const getDepartmentHeadName = async (pool, departmentHeadId) => {
  if (!departmentHeadId) return null;

  const result = await pool.request().input("id", sql.Int, departmentHeadId)
    .query(`
      SELECT username
      FROM test_case_manager.dbo.users
      WHERE id = @id
    `);

  return result.recordset[0]?.username || null;
};

// ✅ GET ALL
exports.getDepartments = async (req, res) => {
  try {
    const pool = await poolPromise;

    const result = await pool.request().query(`
      SELECT 
        d.id,
        d.department_name,
        d.is_active,
        d.department_head_id,
        u.username AS department_head_name
      FROM test_case_manager.dbo.departments d
      LEFT JOIN test_case_manager.dbo.users u 
        ON d.department_head_id = u.id
      ORDER BY d.id ASC
    `);

    res.status(200).json({ success: true, data: result.recordset });
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

    const result = await pool.request().input("department_id", sql.Int, id)
      .query(`
        SELECT COUNT(*) AS user_count
        FROM test_case_manager.dbo.users
        WHERE department_id = @department_id
      `);

    res.status(200).json({
      success: true,
      count: result.recordset[0]?.user_count ?? 0,
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
    const { department_name, is_active, department_head_id } = req.body;

    if (!department_name) {
      return res
        .status(400)
        .json({ success: false, message: "Department name is required" });
    }

    const pool = await poolPromise;

    const existing = await pool
      .request()
      .input("department_name", sql.VarChar, department_name).query(`
        SELECT id FROM test_case_manager.dbo.departments
        WHERE department_name = @department_name
      `);

    if (existing.recordset.length > 0) {
      return res
        .status(400)
        .json({ success: false, message: "Department already exists" });
    }

    await pool
      .request()
      .input("department_name", sql.VarChar, department_name)
      .input("is_active", sql.Bit, is_active ?? true)
      .input(
        "department_head_id",
        sql.Int,
        department_head_id ? Number(department_head_id) : null,
      ).query(`
        INSERT INTO test_case_manager.dbo.departments 
          (department_name, is_active, department_head_id)
        VALUES (@department_name, @is_active, @department_head_id)
      `);

    const departmentHeadName = await getDepartmentHeadName(
      pool,
      department_head_id,
    );

    await logAudit({
      ...getAuditUser(req),
      action: "CREATE",
      module: "DEPARTMENT",
      entityType: "DEPARTMENT",
      entityName: department_name,
      description: `Department "${department_name}" created`,
      newValues: {
        department_name,
        is_active,
        department_head: departmentHeadName,
      },
      status: "SUCCESS",
    });

    res
      .status(201)
      .json({ success: true, message: "Department created successfully" });
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
    const { department_name, is_active, department_head_id } = req.body;

    const pool = await poolPromise;

    const duplicate = await pool
      .request()
      .input("department_name", sql.VarChar, department_name)
      .input("id", sql.Int, id).query(`
        SELECT id FROM test_case_manager.dbo.departments
        WHERE department_name = @department_name AND id != @id
      `);

    if (duplicate.recordset.length > 0) {
      return res
        .status(400)
        .json({ success: false, message: "Department name already exists" });
    }

    // Fetch old values for audit
    const oldRecord = await pool.request().input("id", sql.Int, id).query(`
    SELECT
      d.department_name,
      d.is_active,
      d.department_head_id,
      u.username AS department_head_name
    FROM test_case_manager.dbo.departments d
    LEFT JOIN test_case_manager.dbo.users u
      ON d.department_head_id = u.id
    WHERE d.id = @id
  `);

    await pool
      .request()
      .input("id", sql.Int, id)
      .input("department_name", sql.VarChar, department_name)
      .input("is_active", sql.Bit, is_active)
      .input(
        "department_head_id",
        sql.Int,
        department_head_id ? Number(department_head_id) : null,
      ).query(`
        UPDATE test_case_manager.dbo.departments
        SET department_name = @department_name,
            is_active = @is_active,
            department_head_id = @department_head_id
        WHERE id = @id
      `);
    const departmentHeadName = await getDepartmentHeadName(
      pool,
      department_head_id,
    );
    await logAudit({
      ...getAuditUser(req),
      action: "UPDATE",
      module: "DEPARTMENT",
      entityType: "DEPARTMENT",
      entityId: Number(id),
      entityName: department_name,
      description: `Department "${department_name}" updated`,
      oldValues: oldRecord.recordset[0]
        ? {
            department_name: oldRecord.recordset[0].department_name,
            is_active: oldRecord.recordset[0].is_active,
            department_head: oldRecord.recordset[0].department_head_name,
          }
        : null,

      newValues: {
        department_name,
        is_active,
        department_head: departmentHeadName,
      },
      status: "SUCCESS",
    });

    res.json({ success: true, message: "Department updated successfully" });
  } catch (err) {
    console.error("UPDATE Department Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to update department",
      error: err.message,
    });
  }
};

// ✅ DELETE
exports.deleteDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await poolPromise;

    const assignedResult = await pool
      .request()
      .input("department_id", sql.Int, id).query(`
        SELECT COUNT(*) AS user_count
        FROM test_case_manager.dbo.users
        WHERE department_id = @department_id
      `);

    const userCount = assignedResult.recordset[0]?.user_count ?? 0;

    // Fetch department name before delete
    const deptRecord = await pool.request().input("id", sql.Int, id).query(`
        SELECT department_name FROM test_case_manager.dbo.departments WHERE id = @id
      `);
    const deptName = deptRecord.recordset[0]?.department_name ?? `ID ${id}`;

    if (userCount > 0) {
      await pool.request().input("department_id", sql.Int, id).query(`
          UPDATE test_case_manager.dbo.users
          SET department_id = NULL
          WHERE department_id = @department_id
        `);

      await logAudit({
        ...getAuditUser(req),
        action: "DETACH",
        module: "DEPARTMENT",
        entityType: "DEPARTMENT",
        entityId: Number(id),
        entityName: deptName,
        description: `${userCount} user(s) detached from Department "${deptName}" before deletion`,
        status: "SUCCESS",
      });
    }

    await pool
      .request()
      .input("id", sql.Int, id)
      .query(`DELETE FROM test_case_manager.dbo.departments WHERE id = @id`);

    await logAudit({
      ...getAuditUser(req),
      action: "DELETE",
      module: "DEPARTMENT",
      entityType: "DEPARTMENT",
      entityId: Number(id),
      entityName: deptName,
      description: `Department "${deptName}" deleted`,
      status: "SUCCESS",
    });

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

    // Fetch name for audit
    const deptRecord = await pool.request().input("id", sql.Int, id).query(`
        SELECT department_name FROM test_case_manager.dbo.departments WHERE id = @id
      `);
    const deptName = deptRecord.recordset[0]?.department_name ?? `ID ${id}`;

    await pool
      .request()
      .input("id", sql.Int, id)
      .input("is_active", sql.Bit, is_active).query(`
        UPDATE test_case_manager.dbo.departments
        SET is_active = @is_active
        WHERE id = @id
      `);

    await logAudit({
      ...getAuditUser(req),
      action: "STATUS_CHANGE",
      module: "DEPARTMENT",
      entityType: "DEPARTMENT",
      entityId: Number(id),
      entityName: deptName,
      description: `Department "${deptName}" status changed to ${is_active ? "Active" : "Inactive"}`,
      newValues: { is_active },
      status: "SUCCESS",
    });

    res.json({ success: true, message: "Department status updated" });
  } catch (err) {
    console.error("TOGGLE Department Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to update status",
      error: err.message,
    });
  }
};
