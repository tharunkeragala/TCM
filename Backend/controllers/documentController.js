const { poolPromise } = require("../config/db");
const sql = require("mssql");
const logAudit = require("./auditController");
const { encryptBuffer, decryptBuffer } = require("../utils/encryptionUtils");

const LIST_COLUMNS = `
  d.id, d.project_id, d.original_name, d.mime_type, d.file_size,
  d.uploaded_by, d.created_at, d.is_archived, d.archived_at
`;

exports.uploadProjectDocuments = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || null;
    const files = req.files;

    if (!files || files.length === 0) {
      return res.status(400).json({ success: false, message: "No files uploaded" });
    }

    const pool = await poolPromise;
    const projectCheck = await pool
      .request()
      .input("id", sql.Int, id)
      .query(`SELECT id, project_name FROM test_case_manager.dbo.projects WHERE id = @id`);

    if (!projectCheck.recordset.length) {
      return res.status(404).json({ success: false, message: "Project not found" });
    }

    const project = projectCheck.recordset[0];
    const inserted = [];

    // Sequential inserts keep this simple and keep memory pressure predictable
    // for large multi-file uploads; each file is encrypted just before insert.
    for (const file of files) {
      const { encrypted, iv, authTag } = encryptBuffer(file.buffer);

      const result = await pool
        .request()
        .input("project_id", sql.Int, id)
        .input("original_name", sql.VarChar(255), file.originalname)
        .input("mime_type", sql.VarChar(150), file.mimetype)
        .input("file_size", sql.BigInt, file.size)
        .input("encrypted_data", sql.VarBinary(sql.MAX), encrypted)
        .input("iv", sql.VarBinary(12), iv)
        .input("auth_tag", sql.VarBinary(16), authTag)
        .input("uploaded_by", sql.Int, userId)
        .query(`
          INSERT INTO test_case_manager.dbo.project_documents
            (project_id, original_name, mime_type, file_size, encrypted_data, iv, auth_tag, uploaded_by)
          OUTPUT
            INSERTED.id, INSERTED.project_id, INSERTED.original_name, INSERTED.mime_type,
            INSERTED.file_size, INSERTED.uploaded_by, INSERTED.created_at, INSERTED.is_archived
          VALUES
            (@project_id, @original_name, @mime_type, @file_size, @encrypted_data, @iv, @auth_tag, @uploaded_by)
        `);
      inserted.push(result.recordset[0]);
    }

    await logAudit({
      userId,
      action: "UPLOAD",
      module: "PROJECT",
      entityType: "PROJECT_DOCUMENT",
      entityId: Number(id),
      entityName: project.project_name,
      description: `Uploaded ${inserted.length} document(s) to project ${project.project_name}`,
      newValues: { files: inserted.map((f) => f.original_name) },
    });

    res.status(201).json({ success: true, data: inserted });
  } catch (err) {
    console.error("Upload Project Documents Error:", err);
    res.status(500).json({ success: false, message: "Failed to upload documents", error: err.message });
  }
};

exports.getProjectDocuments = async (req, res) => {
  try {
    const { id } = req.params;
    const includeArchived = req.query.includeArchived === "true";
    const pool = await poolPromise;

    const result = await pool
      .request()
      .input("project_id", sql.Int, id)
      .query(`
        SELECT ${LIST_COLUMNS}, u.username AS uploaded_by_name
        FROM test_case_manager.dbo.project_documents d
        LEFT JOIN test_case_manager.dbo.users u ON u.id = d.uploaded_by
        WHERE d.project_id = @project_id
          ${includeArchived ? "" : "AND d.is_archived = 0"}
        ORDER BY d.created_at DESC
      `);

    // Note: encrypted_data/iv/auth_tag are intentionally excluded here —
    // the list endpoint should never pull the BLOB payload over the wire.
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    console.error("Get Project Documents Error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch documents", error: err.message });
  }
};

exports.downloadProjectDocument = async (req, res) => {
  try {
    const { docId } = req.params;
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("id", sql.Int, docId)
      .query(`
        SELECT id, original_name, mime_type, encrypted_data, iv, auth_tag, is_archived
        FROM test_case_manager.dbo.project_documents
        WHERE id = @id
      `);

    const doc = result.recordset[0];
    if (!doc) return res.status(404).json({ success: false, message: "Document not found" });

    if (doc.is_archived) {
      return res.status(410).json({ success: false, message: "This document has been archived and is no longer available" });
    }

    if (!doc.encrypted_data || !doc.iv || !doc.auth_tag) {
      // Row predates the encrypted-storage migration and has no BLOB payload.
      return res.status(410).json({
        success: false,
        message: "This document was uploaded under the old storage system and is no longer retrievable",
      });
    }

    const decrypted = decryptBuffer(doc.encrypted_data, doc.iv, doc.auth_tag);

    res.setHeader("Content-Type", doc.mime_type || "application/octet-stream");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(doc.original_name)}"`
    );
    res.setHeader("Content-Length", decrypted.length);
    res.send(decrypted);
  } catch (err) {
    console.error("Download Document Error:", err);
    res.status(500).json({ success: false, message: "Failed to download document", error: err.message });
  }
};

// "Delete" now archives the row. Nothing is removed from disk (there's
// nothing there to remove) and nothing is removed from the DB yet —
// permanent removal happens later via the retention job.
exports.deleteProjectDocument = async (req, res) => {
  try {
    const { docId } = req.params;
    const userId = req.user?.id || null;
    const pool = await poolPromise;

    const result = await pool
      .request()
      .input("id", sql.Int, docId)
      .query(`
        SELECT id, project_id, original_name, is_archived
        FROM test_case_manager.dbo.project_documents
        WHERE id = @id
      `);

    const doc = result.recordset[0];
    if (!doc) return res.status(404).json({ success: false, message: "Document not found" });
    if (doc.is_archived) {
      return res.status(400).json({ success: false, message: "Document is already archived" });
    }

    await pool
      .request()
      .input("id", sql.Int, docId)
      .query(`
        UPDATE test_case_manager.dbo.project_documents
        SET is_archived = 1, archived_at = GETDATE()
        WHERE id = @id
      `);

    await logAudit({
      userId,
      action: "DELETE",
      module: "PROJECT",
      entityType: "PROJECT_DOCUMENT",
      entityId: doc.project_id,
      entityName: doc.original_name,
      description: `Archived document ${doc.original_name}`,
      oldValues: doc,
    });

    res.json({ success: true, message: "Document archived" });
  } catch (err) {
    console.error("Delete Document Error:", err);
    res.status(500).json({ success: false, message: "Failed to archive document", error: err.message });
  }
};

// Optional: lets a user pull a document back out of the archive before
// the retention job permanently purges it.
exports.restoreProjectDocument = async (req, res) => {
  try {
    const { docId } = req.params;
    const userId = req.user?.id || null;
    const pool = await poolPromise;

    const result = await pool
      .request()
      .input("id", sql.Int, docId)
      .query(`
        SELECT id, project_id, original_name, is_archived
        FROM test_case_manager.dbo.project_documents
        WHERE id = @id
      `);

    const doc = result.recordset[0];
    if (!doc) return res.status(404).json({ success: false, message: "Document not found" });
    if (!doc.is_archived) {
      return res.status(400).json({ success: false, message: "Document is not archived" });
    }

    await pool
      .request()
      .input("id", sql.Int, docId)
      .query(`
        UPDATE test_case_manager.dbo.project_documents
        SET is_archived = 0, archived_at = NULL
        WHERE id = @id
      `);

    await logAudit({
      userId,
      action: "RESTORE",
      module: "PROJECT",
      entityType: "PROJECT_DOCUMENT",
      entityId: doc.project_id,
      entityName: doc.original_name,
      description: `Restored document ${doc.original_name} from archive`,
    });

    res.json({ success: true, message: "Document restored" });
  } catch (err) {
    console.error("Restore Document Error:", err);
    res.status(500).json({ success: false, message: "Failed to restore document", error: err.message });
  }
};