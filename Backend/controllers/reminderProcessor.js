const { poolPromise } = require("../config/db");
const sql = require("mssql");

exports.processReminders = async () => {
  try {
    const pool = await poolPromise;

    // Find all due reminders not yet sent
    const result = await pool
      .request()
      .query(`
        SELECT r.*, t.title, t.due_date
        FROM test_case_manager.dbo.task_reminders r
        JOIN test_case_manager.dbo.tasks t ON t.id = r.task_id
        WHERE r.is_sent = 0
          AND r.remind_at <= GETDATE()
          AND t.status NOT IN ('Completed', 'Cancelled')
      `);

    for (const reminder of result.recordset) {
      // Insert notification
      await pool
        .request()
        .input("user_id",  sql.Int,      reminder.user_id)
        .input("task_id",  sql.Int,      reminder.task_id)
        .input("message",  sql.NVarChar, `Reminder: Task "${reminder.title}" is due on ${reminder.due_date}`)
        .query(`
          INSERT INTO test_case_manager.dbo.notifications
            (user_id, task_id, type, message)
          VALUES
            (@user_id, @task_id, 'deadline_reminder', @message)
        `);

      if (reminder.is_recurring) {
        // Recalculate next remind_at
        const nextRemindAt = new Date(reminder.remind_at);
        if (reminder.remind_unit === "hours")  nextRemindAt.setHours(nextRemindAt.getHours() + reminder.remind_before);
        if (reminder.remind_unit === "days")   nextRemindAt.setDate(nextRemindAt.getDate() + reminder.remind_before);
        if (reminder.remind_unit === "months") nextRemindAt.setMonth(nextRemindAt.getMonth() + reminder.remind_before);

        await pool
          .request()
          .input("id",         sql.Int,      reminder.id)
          .input("remind_at",  sql.DateTime, nextRemindAt)
          .query(`
            UPDATE test_case_manager.dbo.task_reminders
            SET remind_at = @remind_at
            WHERE id = @id
          `);
      } else {
        // Mark as sent
        await pool
          .request()
          .input("id", sql.Int, reminder.id)
          .query(`
            UPDATE test_case_manager.dbo.task_reminders
            SET is_sent = 1 WHERE id = @id
          `);
      }
    }

    // Also flag overdue tasks
    const overdue = await pool.request().query(`
      SELECT t.id, t.title,
             ta.user_id
      FROM test_case_manager.dbo.tasks t
      JOIN test_case_manager.dbo.task_assignments ta ON ta.task_id = t.id
      WHERE t.due_date < CAST(GETDATE() AS DATE)
        AND t.status NOT IN ('Completed','Cancelled')
        AND NOT EXISTS (
          SELECT 1 FROM test_case_manager.dbo.notifications n
          WHERE n.task_id = t.id
            AND n.user_id = ta.user_id
            AND n.type = 'task_overdue'
            AND CAST(n.created_at AS DATE) = CAST(GETDATE() AS DATE)
        )
    `);

    for (const row of overdue.recordset) {
      await pool
        .request()
        .input("user_id", sql.Int,      row.user_id)
        .input("task_id", sql.Int,      row.id)
        .input("message", sql.NVarChar, `Task "${row.title}" is overdue!`)
        .query(`
          INSERT INTO test_case_manager.dbo.notifications
            (user_id, task_id, type, message)
          VALUES
            (@user_id, @task_id, 'task_overdue', @message)
        `);
    }

    console.log(`[Reminder Processor] Processed ${result.recordset.length} reminders, ${overdue.recordset.length} overdue alerts`);
  } catch (err) {
    console.error("[Reminder Processor] Error:", err);
  }
};