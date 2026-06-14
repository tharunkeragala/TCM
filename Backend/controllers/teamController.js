const { poolPromise } = require("../config/db");
const sql = require("mssql");
const logAudit = require("./auditController");

// Helper for audit logs
const buildTeamAuditData = async (pool, team) => {
  if (!team) return null;

  let department_name = null;

  if (team.department_id) {
    const deptResult = await pool
      .request()
      .input("department_id", sql.Int, team.department_id).query(`
        SELECT department_name
        FROM test_case_manager.dbo.departments
        WHERE id = @department_id
      `);

    department_name = deptResult.recordset[0]?.department_name ?? null;
  }

  return {
    id: team.id,
    team_name: team.team_name,
    department_name,
    is_active: team.is_active,
  };
};

// ✅ GET ALL TEAMS
exports.getTeams = async (req, res) => {
  try {
    const pool = await poolPromise;

    const result = await pool.request().query(`
      SELECT t.id, t.team_name, t.is_active, t.department_id, d.department_name
      FROM test_case_manager.dbo.teams t
      LEFT JOIN test_case_manager.dbo.departments d
        ON t.department_id = d.id
      ORDER BY t.id ASC
    `);

    res.json({ success: true, data: result.recordset });
  } catch (err) {
    console.error("GET Teams Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch teams",
      error: err.message,
    });
  }
};

// ✅ GET TEAMS BY DEPARTMENT
exports.getTeamsByDepartment = async (req, res) => {
  try {
    const { department_id } = req.params;

    const pool = await poolPromise;

    const result = await pool
      .request()
      .input("department_id", sql.Int, department_id).query(`
        SELECT id, team_name, is_active
        FROM test_case_manager.dbo.teams
        WHERE department_id = @department_id
      `);

    res.json({ success: true, data: result.recordset });
  } catch (err) {
    console.error("GET Teams By Department Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch teams",
      error: err.message,
    });
  }
};

// ✅ GET ASSIGNED USER COUNT FOR TEAM
exports.getAssignedUserCount = async (req, res) => {
  try {
    const { id } = req.params;

    const pool = await poolPromise;

    const result = await pool.request().input("team_id", sql.Int, id).query(`
        SELECT COUNT(*) AS user_count
        FROM test_case_manager.dbo.users
        WHERE team_id = @team_id
      `);

    res.json({
      success: true,
      count: result.recordset[0]?.user_count ?? 0,
    });
  } catch (err) {
    console.error("GET Team User Count Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch user count",
      error: err.message,
    });
  }
};

// ✅ CREATE TEAM
exports.createTeam = async (req, res) => {
  try {
    const { team_name, department_id, is_active } = req.body;

    if (!team_name || !department_id) {
      return res.status(400).json({
        success: false,
        message: "Team name and department are required",
      });
    }

    const pool = await poolPromise;

    const existing = await pool
      .request()
      .input("team_name", sql.VarChar, team_name)
      .input("department_id", sql.Int, department_id).query(`
        SELECT id
        FROM test_case_manager.dbo.teams
        WHERE team_name = @team_name
          AND department_id = @department_id
      `);

    if (existing.recordset.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Team already exists in this department",
      });
    }

    const insertResult = await pool
      .request()
      .input("team_name", sql.VarChar, team_name)
      .input("department_id", sql.Int, department_id)
      .input("is_active", sql.Bit, is_active ?? true).query(`
        INSERT INTO test_case_manager.dbo.teams
          (team_name, department_id, is_active)
        OUTPUT INSERTED.*
        VALUES
          (@team_name, @department_id, @is_active)
      `);

    const team = insertResult.recordset[0];

    const auditTeam = await buildTeamAuditData(pool, team);

    await logAudit({
      userId: req.user?.id,
      action: "CREATE",
      module: "TEAM",
      entityType: "TEAM",
      entityId: team.id,
      entityName: team.team_name,
      description: `Created team ${team.team_name}`,
      newValues: auditTeam,
    });

    res.status(201).json({
      success: true,
      message: "Team created successfully",
    });
  } catch (err) {
    console.error("CREATE Team Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to create team",
      error: err.message,
    });
  }
};

// ✅ UPDATE TEAM
exports.updateTeam = async (req, res) => {
  try {
    const { id } = req.params;
    const { team_name, department_id, is_active } = req.body;

    const pool = await poolPromise;

    const oldTeamResult = await pool.request().input("id", sql.Int, id).query(`
        SELECT *
        FROM test_case_manager.dbo.teams
        WHERE id = @id
      `);

    const oldTeam = oldTeamResult.recordset[0];

    if (!oldTeam) {
      return res.status(404).json({
        success: false,
        message: "Team not found",
      });
    }

    const existing = await pool
      .request()
      .input("team_name", sql.VarChar, team_name)
      .input("department_id", sql.Int, department_id)
      .input("id", sql.Int, id).query(`
        SELECT id
        FROM test_case_manager.dbo.teams
        WHERE team_name = @team_name
          AND department_id = @department_id
          AND id != @id
      `);

    if (existing.recordset.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Team name already exists in this department",
      });
    }

    await pool
      .request()
      .input("id", sql.Int, id)
      .input("team_name", sql.VarChar, team_name)
      .input("department_id", sql.Int, department_id)
      .input("is_active", sql.Bit, is_active).query(`
        UPDATE test_case_manager.dbo.teams
        SET
          team_name = @team_name,
          department_id = @department_id,
          is_active = @is_active
        WHERE id = @id
      `);

    const updatedTeamResult = await pool.request().input("id", sql.Int, id)
      .query(`
        SELECT *
        FROM test_case_manager.dbo.teams
        WHERE id = @id
      `);

    const updatedTeam = updatedTeamResult.recordset[0];

    const oldAuditTeam = await buildTeamAuditData(pool, oldTeam);
    const newAuditTeam = await buildTeamAuditData(pool, updatedTeam);

    await logAudit({
      userId: req.user?.id,
      action: "UPDATE",
      module: "TEAM",
      entityType: "TEAM",
      entityId: Number(id),
      entityName: updatedTeam.team_name,
      description: `Updated team ${updatedTeam.team_name}`,
      oldValues: oldAuditTeam,
      newValues: newAuditTeam,
    });

    res.json({
      success: true,
      message: "Team updated successfully",
    });
  } catch (err) {
    console.error("UPDATE Team Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to update team",
      error: err.message,
    });
  }
};

// ✅ DELETE TEAM
exports.deleteTeam = async (req, res) => {
  try {
    const { id } = req.params;

    const pool = await poolPromise;

    const teamResult = await pool.request().input("id", sql.Int, id).query(`
        SELECT *
        FROM test_case_manager.dbo.teams
        WHERE id = @id
      `);

    const team = teamResult.recordset[0];

    if (!team) {
      return res.status(404).json({
        success: false,
        message: "Team not found",
      });
    }

    const auditTeam = await buildTeamAuditData(pool, team);

    const result = await pool.request().input("team_id", sql.Int, id).query(`
        SELECT COUNT(*) AS user_count
        FROM test_case_manager.dbo.users
        WHERE team_id = @team_id
      `);

    const count = result.recordset[0]?.user_count ?? 0;

    // Detach users if assigned
    if (count > 0) {
      await pool.request().input("team_id", sql.Int, id).query(`
          UPDATE test_case_manager.dbo.users
          SET team_id = NULL
          WHERE team_id = @team_id
        `);

      await logAudit({
        userId: req.user?.id,
        action: "DETACH",
        module: "TEAM",
        entityType: "TEAM",
        entityId: Number(id),
        entityName: team.team_name,
        description: `${count} user(s) detached from team`,
        oldValues: {
          assignedUsers: count,
        },
        newValues: {
          assignedUsers: 0,
        },
      });
    }

    // Delete team
    await pool.request().input("id", sql.Int, id).query(`
        DELETE FROM test_case_manager.dbo.teams
        WHERE id = @id
      `);

    // Audit delete
    await logAudit({
      userId: req.user?.id,
      action: "DELETE",
      module: "TEAM",
      entityType: "TEAM",
      entityId: team.id,
      entityName: team.team_name,
      description: `Deleted team ${team.team_name}`,
      oldValues: auditTeam,
    });

    res.json({
      success: true,
      message:
        count > 0
          ? `Team deleted. ${count} users detached.`
          : "Team deleted successfully",
    });
  } catch (err) {
    console.error("DELETE Team Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to delete team",
      error: err.message,
    });
  }
};

// ✅ TOGGLE TEAM STATUS
exports.toggleTeam = async (req, res) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;

    const pool = await poolPromise;

    const oldTeamResult = await pool.request().input("id", sql.Int, id).query(`
        SELECT *
        FROM test_case_manager.dbo.teams
        WHERE id = @id
      `);

    const oldTeam = oldTeamResult.recordset[0];

    if (!oldTeam) {
      return res.status(404).json({
        success: false,
        message: "Team not found",
      });
    }

    await pool
      .request()
      .input("id", sql.Int, id)
      .input("is_active", sql.Bit, is_active).query(`
        UPDATE test_case_manager.dbo.teams
        SET is_active = @is_active
        WHERE id = @id
      `);

    const updatedTeam = {
      ...oldTeam,
      is_active,
    };

    const oldAuditTeam = await buildTeamAuditData(pool, oldTeam);

    const newAuditTeam = {
      ...oldAuditTeam,
      is_active,
    };

    await logAudit({
      userId: req.user?.id,
      action: "STATUS_CHANGE",
      module: "TEAM",
      entityType: "TEAM",
      entityId: Number(id),
      entityName: oldTeam.team_name,
      description: `Team status changed to ${
        is_active ? "Active" : "Inactive"
      }`,
      oldValues: oldAuditTeam,
      newValues: newAuditTeam,
    });

    res.json({
      success: true,
      message: "Team status updated",
    });
  } catch (err) {
    console.error("TOGGLE Team Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to update status",
      error: err.message,
    });
  }
};
