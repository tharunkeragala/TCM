const cron = require("node-cron");
const sql = require("mssql");
const { poolPromise } = require("../config/db");

const RETENTION_DAYS = parseInt(process.env.DOCUMENT_RETENTION_DAYS || "30", 10);

async function purgeExpiredDocuments() {
  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("days", sql.Int, RETENTION_DAYS)
      .query(`
        DELETE FROM test_case_manager.dbo.project_documents
        OUTPUT DELETED.id, DELETED.original_name
        WHERE is_archived = 1
          AND archived_at IS NOT NULL
          AND archived_at <= DATEADD(DAY, -@days, GETDATE())
      `);

    if (result.recordset.length > 0) {
      console.log(
        `[Document Cleanup] Permanently purged ${result.recordset.length} archived document(s): ` +
          result.recordset.map((r) => r.original_name).join(", ")
      );
    }
  } catch (err) {
    console.error("[Document Cleanup] Error purging expired documents:", err);
  }
}

// Runs once a day at 2:00 AM server time.
function scheduleDocumentCleanup() {
  cron.schedule("0 2 * * *", purgeExpiredDocuments);
  console.log(`[Document Cleanup] Scheduled. Retention period: ${RETENTION_DAYS} day(s).`);
}

module.exports = { scheduleDocumentCleanup, purgeExpiredDocuments };