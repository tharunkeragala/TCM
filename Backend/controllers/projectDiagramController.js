const { poolPromise } = require("../config/db");
const sql = require("mssql");
const logAudit = require("./auditController");

// Small helpers — nodes/edges/viewport are stored as JSON text in MSSQL.
// Keep the parsing centralized so a bad/empty row never 500s the page.
const safeParse = (text, fallback) => {
  if (!text) return fallback;
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
};

const shapeDiagramRow = (row) => ({
  project_id: row.project_id,
  nodes: safeParse(row.nodes, []),
  edges: safeParse(row.edges, []),
  viewport: safeParse(row.viewport, null),
  latest_version_number: row.latest_version_number ?? 0,
  updated_by_name: row.updated_by_name || null,
  updated_at: row.updated_at || null,
});

// ===============================
// GET DRAFT (current working diagram)
// GET /api/projects/:id/diagram
// ===============================
exports.getDiagram = async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await poolPromise;

    const result = await pool.request().input("project_id", sql.Int, id).query(`
        SELECT d.*, u.username AS updated_by_name
        FROM test_case_manager.dbo.project_diagrams d
        LEFT JOIN test_case_manager.dbo.users u ON u.id = d.updated_by
        WHERE d.project_id = @project_id
      `);

    const row = result.recordset[0];

    // No diagram started yet — hand back an empty scaffold rather than 404,
    // so the editor can open straight into a blank canvas.
    if (!row) {
      return res.status(200).json({
        success: true,
        data: {
          project_id: Number(id),
          nodes: [],
          edges: [],
          viewport: null,
          latest_version_number: 0,
          updated_by_name: null,
          updated_at: null,
        },
      });
    }

    res.status(200).json({ success: true, data: shapeDiagramRow(row) });
  } catch (err) {
    console.error("GET Project Diagram Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch diagram",
      error: err.message,
    });
  }
};

// ===============================
// SAVE DRAFT (silent autosave + manual Save)
// PUT /api/projects/:id/diagram
// ===============================
exports.saveDraft = async (req, res) => {
  try {
    const { id } = req.params;
    const { nodes, edges, viewport } = req.body;
    const userId = req.user?.id || null;

    if (!Array.isArray(nodes) || !Array.isArray(edges)) {
      return res.status(400).json({
        success: false,
        message: "nodes and edges must be arrays",
      });
    }

    const pool = await poolPromise;

    const projectCheck = await pool
      .request()
      .input("id", sql.Int, id)
      .query(`SELECT id FROM test_case_manager.dbo.projects WHERE id = @id`);

    if (!projectCheck.recordset[0]) {
      return res
        .status(404)
        .json({ success: false, message: "Project not found" });
    }

    const existing = await pool
      .request()
      .input("project_id", sql.Int, id)
      .query(
        `SELECT id FROM test_case_manager.dbo.project_diagrams WHERE project_id = @project_id`,
      );

    const nodesJson = JSON.stringify(nodes);
    const edgesJson = JSON.stringify(edges);
    const viewportJson = viewport ? JSON.stringify(viewport) : null;

    if (existing.recordset[0]) {
      await pool
        .request()
        .input("project_id", sql.Int, id)
        .input("nodes", sql.NVarChar(sql.MAX), nodesJson)
        .input("edges", sql.NVarChar(sql.MAX), edgesJson)
        .input("viewport", sql.NVarChar(sql.MAX), viewportJson)
        .input("updated_by", sql.Int, userId).query(`
          UPDATE test_case_manager.dbo.project_diagrams
          SET nodes = @nodes,
              edges = @edges,
              viewport = @viewport,
              updated_by = @updated_by,
              updated_at = GETDATE()
          WHERE project_id = @project_id
        `);
    } else {
      await pool
        .request()
        .input("project_id", sql.Int, id)
        .input("nodes", sql.NVarChar(sql.MAX), nodesJson)
        .input("edges", sql.NVarChar(sql.MAX), edgesJson)
        .input("viewport", sql.NVarChar(sql.MAX), viewportJson)
        .input("created_by", sql.Int, userId)
        .input("updated_by", sql.Int, userId).query(`
          INSERT INTO test_case_manager.dbo.project_diagrams
            (project_id, nodes, edges, viewport, created_by, updated_by)
          VALUES
            (@project_id, @nodes, @edges, @viewport, @created_by, @updated_by)
        `);
    }

    // Intentionally no audit log here — this fires on every autosave tick
    // and would drown the activity feed. Meaningful history is captured by
    // explicit versions below.
    res.status(200).json({ success: true, message: "Draft saved" });
  } catch (err) {
    console.error("SAVE Project Diagram Draft Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to save diagram",
      error: err.message,
    });
  }
};

// ===============================
// LIST VERSIONS
// GET /api/projects/:id/diagram/versions
// ===============================
exports.listVersions = async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await poolPromise;

    const result = await pool.request().input("project_id", sql.Int, id).query(`
        SELECT
          v.id, v.project_id, v.version_number, v.label, v.created_at,
          u.username AS created_by_name
        FROM test_case_manager.dbo.project_diagram_versions v
        LEFT JOIN test_case_manager.dbo.users u ON u.id = v.created_by
        WHERE v.project_id = @project_id
        ORDER BY v.version_number DESC
      `);

    res.status(200).json({ success: true, data: result.recordset });
  } catch (err) {
    console.error("LIST Diagram Versions Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch version history",
      error: err.message,
    });
  }
};

// ===============================
// CREATE VERSION ("Save as New Version")
// POST /api/projects/:id/diagram/versions
// ===============================
exports.createVersion = async (req, res) => {
  try {
    const { id } = req.params;
    const { nodes, edges, viewport, label } = req.body;
    const userId = req.user?.id || null;

    if (!Array.isArray(nodes) || !Array.isArray(edges)) {
      return res.status(400).json({
        success: false,
        message: "nodes and edges must be arrays",
      });
    }

    const pool = await poolPromise;

    const projectResult = await pool
      .request()
      .input("id", sql.Int, id)
      .query(
        `SELECT id, project_name FROM test_case_manager.dbo.projects WHERE id = @id`,
      );

    const project = projectResult.recordset[0];
    if (!project) {
      return res
        .status(404)
        .json({ success: false, message: "Project not found" });
    }

    const nodesJson = JSON.stringify(nodes);
    const edgesJson = JSON.stringify(edges);
    const viewportJson = viewport ? JSON.stringify(viewport) : null;

    // Next version number for this project.
    const nextVersionResult = await pool
      .request()
      .input("project_id", sql.Int, id).query(`
        SELECT ISNULL(MAX(version_number), 0) + 1 AS next_version
        FROM test_case_manager.dbo.project_diagram_versions
        WHERE project_id = @project_id
      `);
    const nextVersion = nextVersionResult.recordset[0].next_version;

    const insertResult = await pool
      .request()
      .input("project_id", sql.Int, id)
      .input("version_number", sql.Int, nextVersion)
      .input("label", sql.VarChar(150), label?.trim() || null)
      .input("nodes", sql.NVarChar(sql.MAX), nodesJson)
      .input("edges", sql.NVarChar(sql.MAX), edgesJson)
      .input("viewport", sql.NVarChar(sql.MAX), viewportJson)
      .input("created_by", sql.Int, userId).query(`
        INSERT INTO test_case_manager.dbo.project_diagram_versions
          (project_id, version_number, label, nodes, edges, viewport, created_by)
        OUTPUT INSERTED.id, INSERTED.version_number, INSERTED.label, INSERTED.created_at
        VALUES
          (@project_id, @version_number, @label, @nodes, @edges, @viewport, @created_by)
      `);

    // Keep the draft table in sync with what was just published, and bump
    // its latest_version_number marker for the overview card badge.
    const existingDraft = await pool
      .request()
      .input("project_id", sql.Int, id)
      .query(
        `SELECT id FROM test_case_manager.dbo.project_diagrams WHERE project_id = @project_id`,
      );

    if (existingDraft.recordset[0]) {
      await pool
        .request()
        .input("project_id", sql.Int, id)
        .input("nodes", sql.NVarChar(sql.MAX), nodesJson)
        .input("edges", sql.NVarChar(sql.MAX), edgesJson)
        .input("viewport", sql.NVarChar(sql.MAX), viewportJson)
        .input("latest_version_number", sql.Int, nextVersion)
        .input("updated_by", sql.Int, userId).query(`
          UPDATE test_case_manager.dbo.project_diagrams
          SET nodes = @nodes, edges = @edges, viewport = @viewport,
              latest_version_number = @latest_version_number,
              updated_by = @updated_by, updated_at = GETDATE()
          WHERE project_id = @project_id
        `);
    } else {
      await pool
        .request()
        .input("project_id", sql.Int, id)
        .input("nodes", sql.NVarChar(sql.MAX), nodesJson)
        .input("edges", sql.NVarChar(sql.MAX), edgesJson)
        .input("viewport", sql.NVarChar(sql.MAX), viewportJson)
        .input("latest_version_number", sql.Int, nextVersion)
        .input("created_by", sql.Int, userId)
        .input("updated_by", sql.Int, userId).query(`
          INSERT INTO test_case_manager.dbo.project_diagrams
            (project_id, nodes, edges, viewport, latest_version_number, created_by, updated_by)
          VALUES
            (@project_id, @nodes, @edges, @viewport, @latest_version_number, @created_by, @updated_by)
        `);
    }

    const version = insertResult.recordset[0];

    await logAudit({
      userId,
      action: "CREATE",
      module: "PROJECT",
      entityType: "PROJECT_DIAGRAM_VERSION",
      entityId: version.id,
      entityName: `${project.project_name} — v${version.version_number}`,
      description: `Saved diagram version v${version.version_number} for project ${project.project_name}${
        version.label ? ` ("${version.label}")` : ""
      }`,
      newValues: {
        version_number: version.version_number,
        label: version.label,
      },
    });

    res.status(201).json({
      success: true,
      message: "Version saved",
      data: version,
    });
  } catch (err) {
    console.error("CREATE Diagram Version Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to save version",
      error: err.message,
    });
  }
};

// ===============================
// GET ONE VERSION (full nodes/edges)
// GET /api/projects/diagram-versions/:versionId
// ===============================
exports.getVersion = async (req, res) => {
  try {
    const { versionId } = req.params;
    const pool = await poolPromise;

    const result = await pool.request().input("id", sql.Int, versionId).query(`
        SELECT v.*, u.username AS created_by_name
        FROM test_case_manager.dbo.project_diagram_versions v
        LEFT JOIN test_case_manager.dbo.users u ON u.id = v.created_by
        WHERE v.id = @id
      `);

    const row = result.recordset[0];
    if (!row) {
      return res
        .status(404)
        .json({ success: false, message: "Version not found" });
    }

    res.status(200).json({
      success: true,
      data: {
        id: row.id,
        project_id: row.project_id,
        version_number: row.version_number,
        label: row.label,
        nodes: safeParse(row.nodes, []),
        edges: safeParse(row.edges, []),
        viewport: safeParse(row.viewport, null),
        created_by_name: row.created_by_name,
        created_at: row.created_at,
      },
    });
  } catch (err) {
    console.error("GET Diagram Version Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch version",
      error: err.message,
    });
  }
};

// ===============================
// RESTORE A VERSION INTO THE DRAFT
// POST /api/projects/diagram-versions/:versionId/restore
// ===============================
exports.restoreVersion = async (req, res) => {
  try {
    const { versionId } = req.params;
    const userId = req.user?.id || null;
    const pool = await poolPromise;

    const versionResult = await pool
      .request()
      .input("id", sql.Int, versionId)
      .query(
        `SELECT * FROM test_case_manager.dbo.project_diagram_versions WHERE id = @id`,
      );

    const version = versionResult.recordset[0];
    if (!version) {
      return res
        .status(404)
        .json({ success: false, message: "Version not found" });
    }

    const projectResult = await pool
      .request()
      .input("id", sql.Int, version.project_id)
      .query(
        `SELECT project_name FROM test_case_manager.dbo.projects WHERE id = @id`,
      );
    const projectName =
      projectResult.recordset[0]?.project_name || `#${version.project_id}`;

    const existingDraft = await pool
      .request()
      .input("project_id", sql.Int, version.project_id)
      .query(
        `SELECT id FROM test_case_manager.dbo.project_diagrams WHERE project_id = @project_id`,
      );

    if (existingDraft.recordset[0]) {
      await pool
        .request()
        .input("project_id", sql.Int, version.project_id)
        .input("nodes", sql.NVarChar(sql.MAX), version.nodes)
        .input("edges", sql.NVarChar(sql.MAX), version.edges)
        .input("viewport", sql.NVarChar(sql.MAX), version.viewport)
        .input("updated_by", sql.Int, userId).query(`
          UPDATE test_case_manager.dbo.project_diagrams
          SET nodes = @nodes, edges = @edges, viewport = @viewport,
              updated_by = @updated_by, updated_at = GETDATE()
          WHERE project_id = @project_id
        `);
    } else {
      await pool
        .request()
        .input("project_id", sql.Int, version.project_id)
        .input("nodes", sql.NVarChar(sql.MAX), version.nodes)
        .input("edges", sql.NVarChar(sql.MAX), version.edges)
        .input("viewport", sql.NVarChar(sql.MAX), version.viewport)
        .input("created_by", sql.Int, userId)
        .input("updated_by", sql.Int, userId).query(`
          INSERT INTO test_case_manager.dbo.project_diagrams
            (project_id, nodes, edges, viewport, created_by, updated_by)
          VALUES
            (@project_id, @nodes, @edges, @viewport, @created_by, @updated_by)
        `);
    }

    await logAudit({
      userId,
      action: "RESTORE",
      module: "PROJECT",
      entityType: "PROJECT_DIAGRAM_VERSION",
      entityId: version.id,
      entityName: `${projectName} — v${version.version_number}`,
      description: `Restored diagram v${version.version_number} into the working draft for project ${projectName}`,
    });

    res.status(200).json({
      success: true,
      message: "Version restored into draft",
      data: {
        nodes: safeParse(version.nodes, []),
        edges: safeParse(version.edges, []),
        viewport: safeParse(version.viewport, null),
      },
    });
  } catch (err) {
    console.error("RESTORE Diagram Version Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to restore version",
      error: err.message,
    });
  }
};

// ===============================
// DELETE A VERSION
// DELETE /api/projects/diagram-versions/:versionId
// ===============================
exports.deleteVersion = async (req, res) => {
  try {
    const { versionId } = req.params;
    const userId = req.user?.id || null;
    const pool = await poolPromise;

    const versionResult = await pool
      .request()
      .input("id", sql.Int, versionId)
      .query(
        `SELECT * FROM test_case_manager.dbo.project_diagram_versions WHERE id = @id`,
      );

    const version = versionResult.recordset[0];
    if (!version) {
      return res
        .status(404)
        .json({ success: false, message: "Version not found" });
    }

    await pool
      .request()
      .input("id", sql.Int, versionId)
      .query(
        `DELETE FROM test_case_manager.dbo.project_diagram_versions WHERE id = @id`,
      );

    await logAudit({
      userId,
      action: "DELETE",
      module: "PROJECT",
      entityType: "PROJECT_DIAGRAM_VERSION",
      entityId: version.id,
      entityName: `Project #${version.project_id} — v${version.version_number}`,
      description: `Deleted diagram version v${version.version_number} from project #${version.project_id}`,
      oldValues: {
        version_number: version.version_number,
        label: version.label,
      },
    });

    res.status(200).json({ success: true, message: "Version deleted" });
  } catch (err) {
    console.error("DELETE Diagram Version Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to delete version",
      error: err.message,
    });
  }
};
