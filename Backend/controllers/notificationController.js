const { poolPromise } = require("../config/db");
const sql = require("mssql");

exports.getUserNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const pool = await poolPromise;

    const result = await pool
  .request()
  .input("user_id", sql.Int, userId)
  .query(`
    SELECT TOP 20 
      n.id,
      n.task_id,
      n.type,
      n.message,
      n.is_read,
      CONVERT(VARCHAR(19), n.created_at, 120) AS created_at,
      t.title AS task_title,
      t.status AS task_status,
      t.is_archived
    FROM test_case_manager.dbo.notifications n
    LEFT JOIN test_case_manager.dbo.tasks t 
      ON t.id = n.task_id
    WHERE n.user_id = @user_id

      -- ✅ HARD FILTER VALID TASKS
      AND (
        n.task_id IS NULL
        OR (
          t.id IS NOT NULL
          AND t.is_archived = 0
          AND t.status NOT IN ('Cancelled', 'Completed')
        )
      )

    ORDER BY n.created_at DESC
  `);

    const notifications = result.recordset;

    const unreadCount = notifications.filter((n) => !n.is_read).length;

    res.json({ notifications, unreadCount });
  } catch (err) {
    console.error("[Notifications] Error fetching:", err);
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
};

exports.markNotificationRead = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const pool = await poolPromise;

    await pool
      .request()
      .input("id", sql.Int, id)
      .input("user_id", sql.Int, userId)
      .query(`
        UPDATE test_case_manager.dbo.notifications
        SET is_read = 1
        WHERE id = @id AND user_id = @user_id
      `);

    res.json({ success: true });
  } catch (err) {
    console.error("[Notifications] Error marking read:", err);
    res.status(500).json({ error: "Failed to update notification" });
  }
};

exports.markAllNotificationsRead = async (req, res) => {
  try {
    const userId = req.user.id;
    const pool = await poolPromise;

    await pool
      .request()
      .input("user_id", sql.Int, userId)
      .query(`
        UPDATE test_case_manager.dbo.notifications
        SET is_read = 1
        WHERE user_id = @user_id AND is_read = 0
      `);

    res.json({ success: true });
  } catch (err) {
    console.error("[Notifications] Error marking all read:", err);
    res.status(500).json({ error: "Failed to update notifications" });
  }
};