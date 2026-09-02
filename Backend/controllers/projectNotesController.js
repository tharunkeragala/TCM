const { poolPromise } = require("../config/db");
const sql = require("mssql");
const logAudit = require("./auditController");

// ===============================
// GET NOTES FOR A PROJECT
// ===============================
exports.getProjectNotes = async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await poolPromise;

    const result = await pool
      .request()
      .input("project_id", sql.Int, id)
      .query(`
        SELECT
          n.id,
          n.project_id,
          n.note_text,
          n.created_by,
          n.created_at,
          u.username AS created_by_name
        FROM dbo.project_notes n
        LEFT JOIN dbo.users u ON u.id = n.created_by
        WHERE n.project_id = @project_id
        ORDER BY n.created_at DESC
      `);

    res.status(200).json({
      success: true,
      data: result.recordset,
    });
  } catch (err) {
    console.error("GET Project Notes Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch notes",
      error: err.message,
    });
  }
};

// ===============================
// ADD NOTE
// ===============================
exports.createProjectNote = async (req, res) => {
  try {
    const { id } = req.params;
    const { note_text } = req.body;
    const userId = req.user?.id || null;

    if (!note_text?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Note text is required",
      });
    }

    const pool = await poolPromise;

    const projectCheck = await pool
      .request()
      .input("id", sql.Int, id)
      .query(`SELECT id, project_name FROM dbo.projects WHERE id = @id`);

    if (!projectCheck.recordset[0]) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    const insertResult = await pool
      .request()
      .input("project_id", sql.Int, id)
      .input("note_text", sql.VarChar(sql.MAX), note_text.trim())
      .input("created_by", sql.Int, userId)
      .query(`
        INSERT INTO dbo.project_notes
          (project_id, note_text, created_by, created_at)
        OUTPUT INSERTED.*
        VALUES
          (@project_id, @note_text, @created_by, GETDATE())
      `);

    const note = insertResult.recordset[0];

    // Attach the display name so the frontend can render it immediately
    // without needing to refetch the whole list.
    const userResult = userId
      ? await pool
          .request()
          .input("user_id", sql.Int, userId)
          .query(`SELECT username FROM dbo.users WHERE id = @user_id`)
      : null;

    note.created_by_name = userResult?.recordset[0]?.username || null;

    await logAudit({
      userId,
      action: "CREATE",
      module: "PROJECT",
      entityType: "PROJECT_NOTE",
      entityId: note.id,
      entityName: `Note on ${projectCheck.recordset[0].project_name}`,
      description: `Added a note to project ${projectCheck.recordset[0].project_name}`,
      newValues: { note_text: note.note_text },
    });

    res.status(201).json({
      success: true,
      message: "Note added",
      data: note,
    });
  } catch (err) {
    console.error("CREATE Project Note Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to add note",
      error: err.message,
    });
  }
};

// ===============================
// DELETE NOTE
// ===============================
exports.deleteProjectNote = async (req, res) => {
  try {
    const { noteId } = req.params;
    const userId = req.user?.id || null;
    const pool = await poolPromise;

    const noteResult = await pool
      .request()
      .input("id", sql.Int, noteId)
      .query(`SELECT * FROM dbo.project_notes WHERE id = @id`);

    const note = noteResult.recordset[0];
    if (!note) {
      return res.status(404).json({
        success: false,
        message: "Note not found",
      });
    }

    await pool
      .request()
      .input("id", sql.Int, noteId)
      .query(`DELETE FROM dbo.project_notes WHERE id = @id`);

    await logAudit({
      userId,
      action: "DELETE",
      module: "PROJECT",
      entityType: "PROJECT_NOTE",
      entityId: note.id,
      entityName: `Note on project #${note.project_id}`,
      description: `Deleted a note from project #${note.project_id}`,
      oldValues: { note_text: note.note_text },
    });

    res.json({
      success: true,
      message: "Note deleted",
    });
  } catch (err) {
    console.error("DELETE Project Note Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to delete note",
      error: err.message,
    });
  }
};