const { poolPromise } = require("../config/db");
const sql = require("mssql");

// helper
function formatDate(date) {
  return new Date(date).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

exports.processReminders = async () => {
  try {
    const pool = await poolPromise;

    // ─────────────────────────────────────────────
    // PROCESS DUE REMINDERS
    // ─────────────────────────────────────────────
    const result = await pool.request().query(`
      SELECT 
        r.*,
        t.title,
        t.due_date,
        t.status,
        t.is_archived
      FROM test_case_manager.dbo.task_reminders r
      INNER JOIN test_case_manager.dbo.tasks t 
        ON t.id = r.task_id
      WHERE r.is_sent = 0
        AND r.remind_at <= GETDATE()
        AND t.is_archived = 0
        AND t.status NOT IN ('Completed', 'Cancelled')
    `);

    await Promise.all(
      result.recordset.map(async (reminder) => {
        try {
          // extra safety (defensive programming)
          if (
            !reminder ||
            reminder.status === "Completed" ||
            reminder.status === "Cancelled"
          ) {
            return;
          }

          const formattedDueDate = reminder.due_date
            ? formatDate(reminder.due_date)
            : "No due date";

          // INSERT NOTIFICATION
          await pool
            .request()
            .input("user_id", sql.Int, reminder.user_id)
            .input("task_id", sql.Int, reminder.task_id)
            .input(
              "message",
              sql.NVarChar,
              `Reminder: Task "${reminder.title}" is due on ${formattedDueDate}`
            )
            .query(`
              INSERT INTO test_case_manager.dbo.notifications
                (user_id, task_id, type, message)
              VALUES
                (@user_id, @task_id, 'deadline_reminder', @message)
            `);

          // ─────────────────────────────────────────────
          // RECURRENCE HANDLING
          // ─────────────────────────────────────────────
          if (reminder.is_recurring) {
            const nextRemindAt = new Date(reminder.remind_at);

            const value = reminder.remind_before || 1;

            if (reminder.remind_unit === "hours") {
              nextRemindAt.setHours(nextRemindAt.getHours() + value);
            } else if (reminder.remind_unit === "days") {
              nextRemindAt.setDate(nextRemindAt.getDate() + value);
            } else if (reminder.remind_unit === "months") {
              nextRemindAt.setMonth(nextRemindAt.getMonth() + value);
            }

            await pool
              .request()
              .input("id", sql.Int, reminder.id)
              .input("remind_at", sql.DateTime, nextRemindAt)
              .query(`
                UPDATE test_case_manager.dbo.task_reminders
                SET remind_at = @remind_at
                WHERE id = @id
              `);
          } else {
            await pool
              .request()
              .input("id", sql.Int, reminder.id)
              .query(`
                UPDATE test_case_manager.dbo.task_reminders
                SET is_sent = 1
                WHERE id = @id
              `);
          }
        } catch (innerErr) {
          console.error("[Reminder Item Error]", innerErr);
        }
      })
    );

    // ─────────────────────────────────────────────
    // OVERDUE TASKS
    // ─────────────────────────────────────────────
    const overdue = await pool.request().query(`
      SELECT t.id, t.title, ta.user_id
      FROM test_case_manager.dbo.tasks t
      INNER JOIN test_case_manager.dbo.task_assignments ta
        ON ta.task_id = t.id
      WHERE t.due_date < CAST(GETDATE() AS DATE)
        AND t.status NOT IN ('Completed', 'Cancelled')
        AND t.is_archived = 0
        AND NOT EXISTS (
          SELECT 1
          FROM test_case_manager.dbo.notifications n
          WHERE n.task_id = t.id
            AND n.user_id = ta.user_id
            AND n.type = 'task_overdue'
            AND CAST(n.created_at AS DATE) = CAST(GETDATE() AS DATE)
        )
    `);

    await Promise.all(
      overdue.recordset.map(async (row) => {
        try {
          await pool
            .request()
            .input("user_id", sql.Int, row.user_id)
            .input("task_id", sql.Int, row.id)
            .input("message", sql.NVarChar, `Task "${row.title}" is overdue!`)
            .query(`
              INSERT INTO test_case_manager.dbo.notifications
                (user_id, task_id, type, message)
              VALUES
                (@user_id, @task_id, 'task_overdue', @message)
            `);
        } catch (err) {
          console.error("[Overdue Insert Error]", err);
        }
      })
    );

    console.log(
      `[Reminder Processor] Reminders: ${result.recordset.length}, Overdue: ${overdue.recordset.length}`
    );
  } catch (err) {
    console.error("[Reminder Processor] Fatal Error:", err);
  }
};