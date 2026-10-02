const { poolPromise } = require("../config/db");
const sql = require("mssql");

const DB = "test_case_manager.dbo";

function projectAccessSql(projectAlias = "p", userParam = "@user_id") {
  return `(
    ${projectAlias}.created_by = ${userParam}
    OR ${projectAlias}.project_manager_id = ${userParam}
    OR EXISTS (
      SELECT 1
      FROM ${DB}.project_assignees pa
      WHERE pa.project_id = ${projectAlias}.id
        AND pa.user_id = ${userParam}
    )
    OR EXISTS (
      SELECT 1
      FROM ${DB}.tasks t
      INNER JOIN ${DB}.task_assignments ta
        ON ta.task_id = t.id
      WHERE t.project_id = ${projectAlias}.id
        AND ISNULL(t.is_archived, 0) = 0
        AND ta.user_id = ${userParam}
        AND ta.role IN ('Assignee', 'Owner')
    )
  )`;
}

async function hasProjectAccess(pool, userId, projectId) {
  const uid = Number(userId);
  const pid = Number(projectId);

  if (
    !Number.isInteger(uid) ||
    uid <= 0 ||
    !Number.isInteger(pid) ||
    pid <= 0
  ) {
    return false;
  }

  const result = await pool
    .request()
    .input("user_id", sql.Int, uid)
    .input("project_id", sql.Int, pid)
    .query(`
      SELECT TOP 1 p.id
      FROM ${DB}.projects p
      WHERE p.id = @project_id
        AND ISNULL(p.is_archived, 0) = 0
        AND ${projectAccessSql("p")}
    `);

  return result.recordset.length > 0;
}

async function hasAnyProjectAccess(pool, userId) {
  const uid = Number(userId);

  if (!Number.isInteger(uid) || uid <= 0) {
    return false;
  }

  const result = await pool
    .request()
    .input("user_id", sql.Int, uid)
    .query(`
      SELECT TOP 1 p.id
      FROM ${DB}.projects p
      WHERE ISNULL(p.is_archived, 0) = 0
        AND ${projectAccessSql("p")}
    `);

  return result.recordset.length > 0;
}

async function getProjectIdFromSuite(pool, suiteId) {
  const id = Number(suiteId);

  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }

  const result = await pool
    .request()
    .input("id", sql.Int, id)
    .query(`
      SELECT project_id
      FROM ${DB}.test_suites
      WHERE id = @id
    `);

  return result.recordset[0]?.project_id ?? null;
}

async function getProjectIdFromTestCase(pool, testCaseId) {
  const id = Number(testCaseId);

  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }

  const result = await pool
    .request()
    .input("id", sql.Int, id)
    .query(`
      SELECT ts.project_id
      FROM ${DB}.test_cases tc
      INNER JOIN ${DB}.test_suites ts
        ON ts.id = tc.suite_id
      WHERE tc.id = @id
    `);

  return result.recordset[0]?.project_id ?? null;
}

async function getProjectIdFromSprint(pool, sprintId) {
  const id = Number(sprintId);

  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }

  const result = await pool
    .request()
    .input("id", sql.Int, id)
    .query(`
      SELECT project_id
      FROM ${DB}.sprints
      WHERE id = @id
    `);

  return result.recordset[0]?.project_id ?? null;
}

async function getProjectIdFromRun(pool, runId) {
  const id = Number(runId);

  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }

  const result = await pool
    .request()
    .input("id", sql.Int, id)
    .query(`
      SELECT ts.project_id
      FROM ${DB}.playwright_test_runs r
      INNER JOIN ${DB}.test_cases tc
        ON tc.id = r.test_case_id
      INNER JOIN ${DB}.test_suites ts
        ON ts.id = tc.suite_id
      WHERE r.id = @id
    `);

  return result.recordset[0]?.project_id ?? null;
}

async function getProjectIdFromBatch(pool, batchId) {
  const id = Number(batchId);

  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }

  const result = await pool
    .request()
    .input("id", sql.Int, id)
    .query(`
      SELECT sp.project_id
      FROM ${DB}.sprint_batch_runs br
      INNER JOIN ${DB}.sprints sp
        ON sp.id = br.sprint_id
      WHERE br.id = @id
    `);

  return result.recordset[0]?.project_id ?? null;
}

async function requireProjectAccess(req, res, projectId, pool = null) {
  const db = pool || (await poolPromise);
  const allowed = await hasProjectAccess(
    db,
    req.user?.id,
    projectId,
  );

  if (!allowed) {
    res.status(403).json({
      success: false,
      message: "Access denied: you are not assigned to this project.",
    });
  }

  return allowed;
}

/**
 * Controller wrapper used by testSuiteController, testCaseController and
 * sprintcontroller.
 *
 * Usage:
 * exports.someHandler = withProjectAccess(async (req, pool) => projectId)(handler);
 */
function withProjectAccess(resolveProjectId) {
  if (typeof resolveProjectId !== "function") {
    throw new TypeError("withProjectAccess requires a project resolver function");
  }

  return (handler) => {
    if (typeof handler !== "function") {
      throw new TypeError("withProjectAccess requires a controller handler function");
    }

    return async (req, res, next) => {
      try {
        if (!req.user?.id) {
          return res.status(401).json({
            success: false,
            message: "Unauthorized",
          });
        }

        const pool = await poolPromise;
        const projectId = Number(await resolveProjectId(req, pool));

        if (!Number.isInteger(projectId) || projectId <= 0) {
          return res.status(404).json({
            success: false,
            message: "Project could not be resolved for this request.",
          });
        }

        const allowed = await hasProjectAccess(
          pool,
          req.user.id,
          projectId,
        );

        if (!allowed) {
          return res.status(403).json({
            success: false,
            message: "Access denied: you are not assigned to this project.",
          });
        }

        req.projectAccessId = projectId;
        return handler(req, res, next);
      } catch (err) {
        console.error("Project access guard error:", err);
        return res.status(500).json({
          success: false,
          message: "Project access check failed",
          error: err.message,
        });
      }
    };
  };
}

module.exports = {
  DB,
  projectAccessSql,
  hasProjectAccess,
  hasAnyProjectAccess,
  getProjectIdFromSuite,
  getProjectIdFromTestCase,
  getProjectIdFromSprint,
  getProjectIdFromRun,
  getProjectIdFromBatch,
  requireProjectAccess,
  withProjectAccess,
};
