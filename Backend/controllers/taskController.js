const { poolPromise } = require("../config/db");
const sql = require("mssql");

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

async function getUsername(pool, userId) {
  const result = await pool
    .request()
    .input("id", sql.Int, userId)
    .query(`
      SELECT username
      FROM test_case_manager.dbo.users
      WHERE id = @id
    `);

  return result.recordset[0]?.username || `User ${userId}`;
}

// Insert a system comment (status change, ETA change, assignment)
async function insertSystemComment(pool, taskId, message) {
  await pool
    .request()
    .input("task_id", sql.Int, taskId)
    .input("comment", sql.NVarChar, message)
    .query(`
      INSERT INTO test_case_manager.dbo.task_comments
        (task_id, comment, is_system, created_by)
      VALUES
        (@task_id, @comment, 1, NULL)
    `);
}

// Insert a notification for a single user
async function insertNotification(pool, userId, taskId, type, message) {
  await pool
    .request()
    .input("user_id",  sql.Int,     userId)
    .input("task_id",  sql.Int,     taskId)
    .input("type",     sql.VarChar, type)
    .input("message",  sql.NVarChar, message)
    .query(`
      INSERT INTO test_case_manager.dbo.notifications
        (user_id, task_id, type, message)
      VALUES
        (@user_id, @task_id, @type, @message)
    `);
}

// ─────────────────────────────────────────────
// GET ALL TASKS (with filters)
// ─────────────────────────────────────────────
exports.getTasks = async (req, res) => {
  try {
    const { status, priority, assigned_to_me, search } = req.query;
    const userId = req.user?.id || null;
    const pool   = await poolPromise;

    // 🔹 Step 1: Check role (same as dashboard)
    const roleResult = await pool
      .request()
      .input("user_id", sql.Int, userId)
      .query(`
        SELECT d.id AS dept_id
        FROM test_case_manager.dbo.departments d
        WHERE d.department_head_id = @user_id
      `);

    const isDeptHead = roleResult.recordset.length > 0;
    const deptId     = isDeptHead ? roleResult.recordset[0].dept_id : null;

    const request = pool.request();
    let where = "WHERE t.is_archived = 0";

    // 🔹 Step 2: Apply role-based visibility
    if (isDeptHead) {
      request.input("dept_id", sql.Int, deptId);
      request.input("user_id", sql.Int, userId);

      where += `
        AND (
          t.created_by IN (
            SELECT u.id
            FROM test_case_manager.dbo.users u
            WHERE u.department_id = @dept_id
          )
          OR EXISTS (
            SELECT 1
            FROM test_case_manager.dbo.task_assignments ta
            WHERE ta.task_id = t.id AND ta.user_id = @user_id
          )
        )
      `;
    } else {
      request.input("user_id", sql.Int, userId);

      where += `
        AND (
          t.created_by = @user_id
          OR EXISTS (
            SELECT 1
            FROM test_case_manager.dbo.task_assignments ta
            WHERE ta.task_id = t.id AND ta.user_id = @user_id
          )
        )
      `;
    }

    // 🔹 Step 3: Apply additional filters
    if (status) {
      request.input("status", sql.VarChar, status);
      where += " AND t.status = @status";
    }

    if (priority) {
      request.input("priority", sql.VarChar, priority);
      where += " AND t.priority = @priority";
    }

    if (assigned_to_me === "true" && userId) {
      request.input("me", sql.Int, userId);
      where += ` AND EXISTS (
        SELECT 1 FROM test_case_manager.dbo.task_assignments ta
        WHERE ta.task_id = t.id AND ta.user_id = @me
      )`;
    }

    if (search) {
      request.input("search", sql.NVarChar, `%${search}%`);
      where += " AND (t.title LIKE @search OR t.description LIKE @search)";
    }

    // 🔹 Step 4: Final query
    const result = await request.query(`
      SELECT
        t.*,
        u1.username   AS created_by_name,
        u2.username   AS updated_by_name,
        p.project_name,
        ts.suite_name,
        (
          SELECT STRING_AGG(u.username, ', ')
          FROM test_case_manager.dbo.task_assignments ta
          JOIN test_case_manager.dbo.users u ON u.id = ta.user_id
          WHERE ta.task_id = t.id AND ta.role = 'Assignee'
        ) AS assignees,
        (
          SELECT COUNT(*)
          FROM test_case_manager.dbo.task_comments tc
          WHERE tc.task_id = t.id AND tc.is_system = 0
        ) AS comment_count
      FROM test_case_manager.dbo.tasks t
      LEFT JOIN test_case_manager.dbo.users u1       ON u1.id = t.created_by
      LEFT JOIN test_case_manager.dbo.users u2       ON u2.id = t.updated_by
      LEFT JOIN test_case_manager.dbo.projects p     ON p.id  = t.project_id
      LEFT JOIN test_case_manager.dbo.test_suites ts ON ts.id = t.suite_id
      ${where}
      ORDER BY t.created_at DESC
    `);

    res.status(200).json({
      success: true,
      is_dept_head: isDeptHead,
      data: result.recordset
    });

  } catch (err) {
    console.error("GET Tasks Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch tasks",
      error: err.message
    });
  }
};

// ─────────────────────────────────────────────
// GET TASK BY ID (full detail)
// ─────────────────────────────────────────────
exports.getTaskById = async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await poolPromise;

    // Core task
    const taskResult = await pool
      .request()
      .input("id", sql.Int, id)
      .query(`
        SELECT
  t.id,
  t.title,
  t.description,
  t.status,
  t.priority,
  t.start_date,
  t.due_date,
  t.project_id,
  t.suite_id,
  t.tags,
  t.created_by,
  t.updated_by,
  t.created_at,
  t.updated_at,
          u1.username   AS created_by_name,
          u2.username   AS updated_by_name,
          p.project_name,
          ts.suite_name
        FROM test_case_manager.dbo.tasks t
        LEFT JOIN test_case_manager.dbo.users u1       ON u1.id = t.created_by
        LEFT JOIN test_case_manager.dbo.users u2       ON u2.id = t.updated_by
        LEFT JOIN test_case_manager.dbo.projects p     ON p.id  = t.project_id
        LEFT JOIN test_case_manager.dbo.test_suites ts ON ts.id = t.suite_id
        WHERE t.id = @id
AND t.is_archived = 0
      `);

    if (!taskResult.recordset.length) {
      return res.status(404).json({ success: false, message: "Task not found" });
    }

    const task = taskResult.recordset[0];

    // Assignments
    const assignmentsResult = await pool
      .request()
      .input("task_id", sql.Int, id)
      .query(`
        SELECT ta.*, u.username, u.email
        FROM test_case_manager.dbo.task_assignments ta
        JOIN test_case_manager.dbo.users u ON u.id = ta.user_id
        WHERE ta.task_id = @task_id
        ORDER BY ta.role, u.username
      `);

    // Progress logs
    const progressResult = await pool
      .request()
      .input("task_id", sql.Int, id)
      .query(`
        SELECT tp.*, u.username AS created_by_name
        FROM test_case_manager.dbo.task_progress tp
        JOIN test_case_manager.dbo.users u ON u.id = tp.created_by
        WHERE tp.task_id = @task_id
        ORDER BY tp.created_at DESC
      `);

    // Comments (user + system), latest first
    const commentsResult = await pool
      .request()
      .input("task_id", sql.Int, id)
      .query(`
        SELECT tc.*, u.username AS created_by_name
        FROM test_case_manager.dbo.task_comments tc
        LEFT JOIN test_case_manager.dbo.users u ON u.id = tc.created_by
        WHERE tc.task_id = @task_id
        ORDER BY tc.created_at DESC
      `);

    // ETA history
    const etaResult = await pool
      .request()
      .input("task_id", sql.Int, id)
      .query(`
        SELECT teh.*, u.username AS updated_by_name
        FROM test_case_manager.dbo.task_eta_history teh
        JOIN test_case_manager.dbo.users u ON u.id = teh.updated_by
        WHERE teh.task_id = @task_id
        ORDER BY teh.updated_at DESC
      `);

    // Attachments
    const attachResult = await pool
      .request()
      .input("task_id", sql.Int, id)
      .query(`
        SELECT ta2.*, u.username AS uploaded_by_name
        FROM test_case_manager.dbo.task_attachments ta2
        JOIN test_case_manager.dbo.users u ON u.id = ta2.uploaded_by
        WHERE ta2.task_id = @task_id
        ORDER BY ta2.uploaded_at DESC
      `);

    res.status(200).json({
      success: true,
      data: {
        ...task,
        assignments:  assignmentsResult.recordset,
        progress:     progressResult.recordset,
        comments:     commentsResult.recordset,
        eta_history:  etaResult.recordset,
        attachments:  attachResult.recordset,
      },
    });
  } catch (err) {
    console.error("GET Task By ID Error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch task", error: err.message });
  }
};

// ─────────────────────────────────────────────
// CREATE TASK
// ─────────────────────────────────────────────
exports.createTask = async (req, res) => {
  try {
    const {
      title, description, priority, start_date, due_date,
      project_id, suite_id, tags, assignees, watchers,
    } = req.body;
    const userId = req.user?.id || null;

    if (!title?.trim()) {
      return res.status(400).json({ success: false, message: "Title is required" });
    }

    const pool = await poolPromise;

    // Insert task
    const taskResult = await pool
      .request()
      .input("title",       sql.VarChar,  title)
      .input("description", sql.NVarChar, description || null)
      .input("priority",    sql.VarChar,  priority || "Medium")
      .input("start_date",  sql.Date,     start_date || null)
      .input("due_date",    sql.Date,     due_date || null)
      .input("project_id",  sql.Int,      project_id || null)
      .input("suite_id",    sql.Int,      suite_id || null)
      .input("tags",        sql.NVarChar, tags || null)
      .input("created_by",  sql.Int,      userId)
      .input("updated_by",  sql.Int,      userId)
      .query(`
        INSERT INTO test_case_manager.dbo.tasks
          (title, description, priority, start_date, due_date,
           project_id, suite_id, tags, created_by, updated_by)
        OUTPUT INSERTED.id
        VALUES
          (@title, @description, @priority, @start_date, @due_date,
           @project_id, @suite_id, @tags, @created_by, @updated_by)
      `);

    const taskId = taskResult.recordset[0].id;

    // Insert Owner assignment
    await pool
      .request()
      .input("task_id",     sql.Int, taskId)
      .input("user_id",     sql.Int, userId)
      .input("assigned_by", sql.Int, userId)
      .query(`
        INSERT INTO test_case_manager.dbo.task_assignments
          (task_id, user_id, role, assigned_by)
        VALUES
          (@task_id, @user_id, 'Owner', @assigned_by)
      `);

    // Insert Assignees
    if (Array.isArray(assignees) && assignees.length > 0) {
      for (const uid of assignees) {
        await pool
          .request()
          .input("task_id",     sql.Int, taskId)
          .input("user_id",     sql.Int, uid)
          .input("assigned_by", sql.Int, userId)
          .query(`
            INSERT INTO test_case_manager.dbo.task_assignments
              (task_id, user_id, role, assigned_by)
            VALUES
              (@task_id, @user_id, 'Assignee', @assigned_by)
          `);

        // Notify each assignee
        await insertNotification(
          pool, uid, taskId,
          "task_assigned",
          `You have been assigned to task: "${title}"`
        );
      }
    }

    // Insert Watchers
    if (Array.isArray(watchers) && watchers.length > 0) {
      for (const uid of watchers) {
        await pool
          .request()
          .input("task_id",     sql.Int, taskId)
          .input("user_id",     sql.Int, uid)
          .input("assigned_by", sql.Int, userId)
          .query(`
            INSERT INTO test_case_manager.dbo.task_assignments
              (task_id, user_id, role, assigned_by)
            VALUES
              (@task_id, @user_id, 'Watcher', @assigned_by)
          `);
      }
    }

    // System comment
    await insertSystemComment(pool, taskId, `Task created with status "Pending"`);

    await pool
      .request()
      .input("description", sql.VarChar, `Task "${title}" created`)
      .query(`
        INSERT INTO audit_logs (action, module, description)
        VALUES ('CREATE', 'TASK', @description)
      `);

    res.status(201).json({ success: true, message: "Task created successfully", id: taskId });
  } catch (err) {
    console.error("CREATE Task Error:", err);
    res.status(500).json({ success: false, message: "Failed to create task", error: err.message });
  }
};

// ─────────────────────────────────────────────
// UPDATE TASK
// ─────────────────────────────────────────────
exports.updateTask = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title, description, priority, start_date, due_date,
      project_id, suite_id, tags, assignees, watchers,
    } = req.body;
    const userId = req.user?.id || null;

    if (!title?.trim()) {
      return res.status(400).json({ success: false, message: "Title is required" });
    }

    const pool = await poolPromise;

    // Fetch current task for comparison
    const current = await pool
      .request()
      .input("id", sql.Int, id)
      .query(`SELECT * FROM test_case_manager.dbo.tasks WHERE id = @id`);

    if (!current.recordset.length) {
      return res.status(404).json({ success: false, message: "Task not found" });
    }

    await pool
      .request()
      .input("id",          sql.Int,     id)
      .input("title",       sql.VarChar,  title)
      .input("description", sql.NVarChar, description || null)
      .input("priority",    sql.VarChar,  priority)
      .input("start_date",  sql.Date,     start_date || null)
      .input("due_date",    sql.Date,     due_date || null)
      .input("project_id",  sql.Int,      project_id || null)
      .input("suite_id",    sql.Int,      suite_id || null)
      .input("tags",        sql.NVarChar, tags || null)
      .input("updated_by",  sql.Int,      userId)
      .query(`
        UPDATE test_case_manager.dbo.tasks
        SET title       = @title,
            description = @description,
            priority    = @priority,
            start_date  = @start_date,
            due_date    = @due_date,
            project_id  = @project_id,
            suite_id    = @suite_id,
            tags        = @tags,
            updated_by  = @updated_by,
            updated_at  = GETDATE()
        WHERE id = @id
      `);

    // Replace assignees (keep Owner, replace Assignee/Watcher rows)
    await pool
      .request()
      .input("task_id", sql.Int, id)
      .query(`
        DELETE FROM test_case_manager.dbo.task_assignments
        WHERE task_id = @task_id AND role IN ('Assignee','Watcher')
      `);

    if (Array.isArray(assignees) && assignees.length > 0) {
      for (const uid of assignees) {
        await pool
          .request()
          .input("task_id",     sql.Int, id)
          .input("user_id",     sql.Int, uid)
          .input("assigned_by", sql.Int, userId)
          .query(`
            INSERT INTO test_case_manager.dbo.task_assignments
              (task_id, user_id, role, assigned_by)
            VALUES
              (@task_id, @user_id, 'Assignee', @assigned_by)
          `);
      }
    }

    if (Array.isArray(watchers) && watchers.length > 0) {
      for (const uid of watchers) {
        await pool
          .request()
          .input("task_id",     sql.Int, id)
          .input("user_id",     sql.Int, uid)
          .input("assigned_by", sql.Int, userId)
          .query(`
            INSERT INTO test_case_manager.dbo.task_assignments
              (task_id, user_id, role, assigned_by)
            VALUES
              (@task_id, @user_id, 'Watcher', @assigned_by)
          `);
      }
    }

const username = req.user?.username || `User ${userId}`;

await insertSystemComment(
  pool,
  id,
  `Task details updated by ${username}`
);

    await pool
      .request()
      .input("description", sql.VarChar, `Task ID ${id} updated`)
      .query(`
        INSERT INTO audit_logs (action, module, description)
        VALUES ('UPDATE', 'TASK', @description)
      `);

    res.json({ success: true, message: "Task updated successfully" });
  } catch (err) {
    console.error("UPDATE Task Error:", err);
    res.status(500).json({ success: false, message: "Failed to update task", error: err.message });
  }
};

// ─────────────────────────────────────────────
// UPDATE STATUS
// ─────────────────────────────────────────────
exports.updateTaskStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const userId = req.user?.id || null;
    const pool = await poolPromise;

    const current = await pool
      .request()
      .input("id", sql.Int, id)
      .query(`SELECT status, title FROM test_case_manager.dbo.tasks WHERE id = @id`);

    if (!current.recordset.length) {
      return res.status(404).json({ success: false, message: "Task not found" });
    }

    const oldStatus = current.recordset[0].status;
    const taskTitle = current.recordset[0].title;

    await pool
      .request()
      .input("id",         sql.Int,     id)
      .input("status",     sql.VarChar, status)
      .input("updated_by", sql.Int,     userId)
      .query(`
        UPDATE test_case_manager.dbo.tasks
        SET status     = @status,
            updated_by = @updated_by,
            updated_at = GETDATE()
        WHERE id = @id
      `);

    const username = await getUsername(pool, userId);

await insertSystemComment(
  pool,
  id,
  `Status changed from "${oldStatus}" to "${status}" by ${username}`
);

    // Notify all assignees + owner
    const participants = await pool
      .request()
      .input("task_id", sql.Int, id)
      .query(`
        SELECT user_id FROM test_case_manager.dbo.task_assignments
        WHERE task_id = @task_id AND user_id != ${userId}
      `);

    for (const p of participants.recordset) {
      await insertNotification(
        pool, p.user_id, id,
        "status_changed",
        `Task "${taskTitle}" status changed to "${status}"`
      );
    }

    await pool
      .request()
      .input("description", sql.VarChar, `Task ID ${id} status changed to ${status}`)
      .query(`
        INSERT INTO audit_logs (action, module, description)
        VALUES ('STATUS_CHANGE', 'TASK', @description)
      `);

    res.json({ success: true, message: "Status updated successfully" });
  } catch (err) {
    console.error("UPDATE Task Status Error:", err);
    res.status(500).json({ success: false, message: "Failed to update status", error: err.message });
  }
};

// ─────────────────────────────────────────────
// EXTEND ETA
// ─────────────────────────────────────────────
exports.extendETA = async (req, res) => {
  try {
    const { id } = req.params;
    const { new_eta, reason } = req.body;
    const userId = req.user?.id || null;

    if (!new_eta)  return res.status(400).json({ success: false, message: "New ETA is required" });
    if (!reason?.trim()) return res.status(400).json({ success: false, message: "Reason is required" });

    const pool = await poolPromise;

    const current = await pool
      .request()
      .input("id", sql.Int, id)
      .query(`SELECT due_date, title FROM test_case_manager.dbo.tasks WHERE id = @id`);

    if (!current.recordset.length) {
      return res.status(404).json({ success: false, message: "Task not found" });
    }

    const oldETA   = current.recordset[0].due_date;
    const taskTitle = current.recordset[0].title;

    // Save ETA history
    await pool
      .request()
      .input("task_id",    sql.Int,     id)
      .input("old_eta",    sql.Date,    oldETA || null)
      .input("new_eta",    sql.Date,    new_eta)
      .input("reason",     sql.NVarChar, reason)
      .input("updated_by", sql.Int,     userId)
      .query(`
        INSERT INTO test_case_manager.dbo.task_eta_history
          (task_id, old_eta, new_eta, reason, updated_by)
        VALUES
          (@task_id, @old_eta, @new_eta, @reason, @updated_by)
      `);

    // Update task due_date
    await pool
      .request()
      .input("id",         sql.Int,  id)
      .input("new_eta",    sql.Date, new_eta)
      .input("updated_by", sql.Int,  userId)
      .query(`
        UPDATE test_case_manager.dbo.tasks
        SET due_date   = @new_eta,
            updated_by = @updated_by,
            updated_at = GETDATE()
        WHERE id = @id
      `);

    const username = await getUsername(pool, userId);

await insertSystemComment(
  pool,
  id,
  `ETA extended by ${username} from "${
    oldETA ? oldETA.toISOString().split("T")[0] : "not set"
  }" to "${new_eta}". Reason: ${reason}`
);

    // Notify participants
    const participants = await pool
      .request()
      .input("task_id", sql.Int, id)
      .query(`
        SELECT user_id FROM test_case_manager.dbo.task_assignments
        WHERE task_id = @task_id AND user_id != ${userId}
      `);

    for (const p of participants.recordset) {
      await insertNotification(
        pool, p.user_id, id,
        "eta_changed",
        `ETA for task "${taskTitle}" has been updated to ${new_eta}`
      );
    }

    res.json({ success: true, message: "ETA extended successfully" });
  } catch (err) {
    console.error("EXTEND ETA Error:", err);
    res.status(500).json({ success: false, message: "Failed to extend ETA", error: err.message });
  }
};

// ─────────────────────────────────────────────
// ADD PROGRESS LOG
// ─────────────────────────────────────────────
exports.addProgress = async (req, res) => {
  try {
    const { id } = req.params;
    const { comment } = req.body;
    const userId = req.user?.id || null;

    if (!comment?.trim()) {
      return res.status(400).json({ success: false, message: "Comment is required" });
    }

    const pool = await poolPromise;

    await pool
      .request()
      .input("task_id",    sql.Int,     id)
      .input("comment",    sql.NVarChar, comment)
      .input("created_by", sql.Int,     userId)
      .query(`
        INSERT INTO test_case_manager.dbo.task_progress
          (task_id, comment, created_by)
        VALUES
          (@task_id, @comment, @created_by)
      `);

    res.status(201).json({ success: true, message: "Progress log added" });
  } catch (err) {
    console.error("ADD Progress Error:", err);
    res.status(500).json({ success: false, message: "Failed to add progress", error: err.message });
  }
};

// ─────────────────────────────────────────────
// ADD COMMENT
// ─────────────────────────────────────────────
exports.addComment = async (req, res) => {
  try {
    const { id } = req.params;
    const { comment, mentions } = req.body; // mentions: array of user IDs
    const userId = req.user?.id || null;

    if (!comment?.trim()) {
      return res.status(400).json({ success: false, message: "Comment is required" });
    }

    const pool = await poolPromise;

    // Get task title
    const taskResult = await pool
      .request()
      .input("id", sql.Int, id)
      .query(`SELECT title FROM test_case_manager.dbo.tasks WHERE id = @id`);

    const taskTitle = taskResult.recordset[0]?.title || "";

    const commentResult = await pool
      .request()
      .input("task_id",    sql.Int,     id)
      .input("comment",    sql.NVarChar, comment)
      .input("created_by", sql.Int,     userId)
      .query(`
        INSERT INTO test_case_manager.dbo.task_comments
          (task_id, comment, is_system, created_by)
        OUTPUT INSERTED.id
        VALUES
          (@task_id, @comment, 0, @created_by)
      `);

    const commentId = commentResult.recordset[0].id;

    // Insert mentions + notify
    if (Array.isArray(mentions) && mentions.length > 0) {
      for (const uid of mentions) {
        await pool
          .request()
          .input("comment_id", sql.Int, commentId)
          .input("user_id",    sql.Int, uid)
          .query(`
            INSERT INTO test_case_manager.dbo.task_comment_mentions
              (comment_id, user_id)
            VALUES
              (@comment_id, @user_id)
          `);

        await insertNotification(
          pool, uid, id,
          "comment_mention",
          `You were mentioned in a comment on task "${taskTitle}"`
        );
      }
    }

    res.status(201).json({ success: true, message: "Comment added", id: commentId });
  } catch (err) {
    console.error("ADD Comment Error:", err);
    res.status(500).json({ success: false, message: "Failed to add comment", error: err.message });
  }
};

// ─────────────────────────────────────────────
// DELETE COMMENT
// ─────────────────────────────────────────────
exports.deleteComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const pool = await poolPromise;

    await pool
      .request()
      .input("id", sql.Int, commentId)
      .query(`
        DELETE FROM test_case_manager.dbo.task_comment_mentions WHERE comment_id = @id
      `);

    await pool
      .request()
      .input("id", sql.Int, commentId)
      .query(`
        DELETE FROM test_case_manager.dbo.task_comments
        WHERE id = @id AND is_system = 0
      `);

    res.json({ success: true, message: "Comment deleted" });
  } catch (err) {
    console.error("DELETE Comment Error:", err);
    res.status(500).json({ success: false, message: "Failed to delete comment", error: err.message });
  }
};

// ─────────────────────────────────────────────
// DELETE TASK
// ─────────────────────────────────────────────
exports.deleteTask = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || null;

    const pool = await poolPromise;

    // Check task exists
    const taskResult = await pool
      .request()
      .input("id", sql.Int, id)
      .query(`
        SELECT title
        FROM test_case_manager.dbo.tasks
        WHERE id = @id
          AND is_archived = 0
      `);

    if (!taskResult.recordset.length) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    // Soft delete (archive)
    await pool
      .request()
      .input("id", sql.Int, id)
      .input("updated_by", sql.Int, userId)
      .query(`
        UPDATE test_case_manager.dbo.tasks
        SET
          is_archived = 1,
          archived_at = GETDATE(),
          updated_by = @updated_by,
          updated_at = GETDATE()
        WHERE id = @id
      `);

    // Audit log
    await pool
      .request()
      .input("description", sql.VarChar, `Task ID ${id} archived`)
      .query(`
        INSERT INTO audit_logs (action, module, description)
        VALUES ('ARCHIVE', 'TASK', @description)
      `);

    res.json({
      success: true,
      message: "Task archived successfully",
    });

  } catch (err) {
    console.error("ARCHIVE Task Error:", err);

    res.status(500).json({
      success: false,
      message: "Failed to archive task",
      error: err.message,
    });
  }
};

// ─────────────────────────────────────────────
// SET REMINDER — deactivates previous reminders first
exports.setReminder = async (req, res) => {
  try {
    const { id } = req.params;
    const { remind_before, remind_unit, is_recurring } = req.body;
    const userId = req.user?.id || null;

    if (!remind_before || !remind_unit) {
      return res.status(400).json({
        success: false,
        message: "remind_before and remind_unit are required",
      });
    }

    const pool = await poolPromise;

    // 1. Verify task has a due date
    const taskResult = await pool
      .request()
      .input("id", sql.Int, id)
      .query(`SELECT due_date FROM test_case_manager.dbo.tasks WHERE id = @id`);

    if (!taskResult.recordset.length || !taskResult.recordset[0].due_date) {
      return res.status(400).json({
        success: false,
        message: "Task has no due date set",
      });
    }

    const dueDate = new Date(taskResult.recordset[0].due_date);
    let remindAt = new Date(dueDate);

    if (remind_unit === "hours")  remindAt.setHours(remindAt.getHours() - remind_before);
    if (remind_unit === "days")   remindAt.setDate(remindAt.getDate() - remind_before);
    if (remind_unit === "months") remindAt.setMonth(remindAt.getMonth() - remind_before);

    // 2. Deactivate all previous reminders for this task + user
    await pool
      .request()
      .input("task_id", sql.Int, id)
      .input("user_id", sql.Int, userId)
      .query(`
        UPDATE test_case_manager.dbo.task_reminders
        SET is_active = 0
        WHERE task_id = @task_id
          AND user_id = @user_id
          AND is_active = 1
      `);

    // 3. Insert new active reminder
    await pool
      .request()
      .input("task_id",       sql.Int,      id)
      .input("user_id",       sql.Int,      userId)
      .input("remind_before", sql.Int,      remind_before)
      .input("remind_unit",   sql.VarChar,  remind_unit)
      .input("is_recurring",  sql.Bit,      is_recurring ?? 0)
      .input("remind_at",     sql.DateTime, remindAt)
      .query(`
        INSERT INTO test_case_manager.dbo.task_reminders
          (task_id, user_id, remind_before, remind_unit, is_recurring, remind_at, is_active)
        VALUES
          (@task_id, @user_id, @remind_before, @remind_unit, @is_recurring, @remind_at, 1)
      `);

    res.status(201).json({ success: true, message: "Reminder set successfully" });
  } catch (err) {
    console.error("SET Reminder Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to set reminder",
      error: err.message,
    });
  }
};

// GET LATEST ACTIVE REMINDER for a task (scoped to the requesting user)
exports.getLatestReminder = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || null;

    const pool = await poolPromise;

    const result = await pool
      .request()
      .input("task_id", sql.Int, id)
      .input("user_id", sql.Int, userId)
      .query(`
        SELECT TOP 1
          id, task_id, user_id,
          remind_before, remind_unit,
          is_recurring, is_sent,
          remind_at, created_at, is_active
        FROM test_case_manager.dbo.task_reminders
        WHERE task_id = @task_id
          AND user_id = @user_id
          AND is_active = 1
        ORDER BY created_at DESC
      `);

    if (!result.recordset.length) {
      return res.status(200).json({ success: true, reminder: null });
    }

    return res.status(200).json({ success: true, reminder: result.recordset[0] });
  } catch (err) {
    console.error("GET Latest Reminder Error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch latest reminder",
      error: err.message,
    });
  }
};

// ─────────────────────────────────────────────
// GET NOTIFICATIONS (for current user)
// ─────────────────────────────────────────────
exports.getNotifications = async (req, res) => {
  try {
    const userId = req.user?.id || null;
    const pool = await poolPromise;

    const result = await pool
      .request()
      .input("user_id", sql.Int, userId)
      .query(`
        SELECT TOP 50
          n.*,
          t.title AS task_title
        FROM test_case_manager.dbo.notifications n
        LEFT JOIN test_case_manager.dbo.tasks t ON t.id = n.task_id
        WHERE n.user_id = @user_id
        ORDER BY n.created_at DESC
      `);

    const unreadCount = result.recordset.filter(n => !n.is_read).length;

    res.status(200).json({
      success: true,
      data: result.recordset,
      unread_count: unreadCount,
    });
  } catch (err) {
    console.error("GET Notifications Error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch notifications", error: err.message });
  }
};

// ─────────────────────────────────────────────
// MARK NOTIFICATION(S) AS READ
// ─────────────────────────────────────────────
exports.markNotificationsRead = async (req, res) => {
  try {
    const userId = req.user?.id || null;
    const { ids } = req.body; // array of notification IDs, or empty = mark all
    const pool = await poolPromise;

    if (Array.isArray(ids) && ids.length > 0) {
      for (const nid of ids) {
        await pool
          .request()
          .input("id",      sql.Int, nid)
          .input("user_id", sql.Int, userId)
          .query(`
            UPDATE test_case_manager.dbo.notifications
            SET is_read = 1
            WHERE id = @id AND user_id = @user_id
          `);
      }
    } else {
      await pool
        .request()
        .input("user_id", sql.Int, userId)
        .query(`
          UPDATE test_case_manager.dbo.notifications
          SET is_read = 1
          WHERE user_id = @user_id
        `);
    }

    res.json({ success: true, message: "Notifications marked as read" });
  } catch (err) {
    console.error("MARK Notifications Error:", err);
    res.status(500).json({ success: false, message: "Failed to mark notifications", error: err.message });
  }
};

// ─────────────────────────────────────────────
// GET TASK DASHBOARD STATS
// Returns counts scoped to the logged-in user:
//   - tasks they created
//   - tasks assigned to them
//   - if dept head: all tasks created by users in same department
// ─────────────────────────────────────────────
exports.getTaskDashboardStats = async (req, res) => {
  try {
    const userId = req.user?.id || null;
    const pool   = await poolPromise;

    // Check if the user is a department head
    const roleResult = await pool
      .request()
      .input("user_id", sql.Int, userId)
      .query(`
        SELECT d.id AS dept_id, d.department_name AS dept_name
        FROM test_case_manager.dbo.departments d
        WHERE d.department_head_id = @user_id
      `);

    const isDeptHead = roleResult.recordset.length > 0;
    const deptId     = isDeptHead ? roleResult.recordset[0].dept_id : null;

    let statsQuery;

    if (isDeptHead) {
      statsQuery = await pool
        .request()
        .input("user_id", sql.Int, userId)
        .input("dept_id", sql.Int, deptId)
        .query(`
          SELECT
            COUNT(*) AS total,
            SUM(CASE WHEN t.status = 'Pending' THEN 1 ELSE 0 END) AS pending,
            SUM(CASE WHEN t.status = 'In Progress' THEN 1 ELSE 0 END) AS in_progress,
            SUM(CASE WHEN t.status = 'Completed' THEN 1 ELSE 0 END) AS completed,
            SUM(CASE WHEN t.status = 'On Hold' THEN 1 ELSE 0 END) AS on_hold,
            SUM(CASE WHEN t.status = 'Cancelled' THEN 1 ELSE 0 END) AS cancelled
          FROM test_case_manager.dbo.tasks t
          WHERE t.is_archived = 0
          AND (
            t.created_by IN (
              SELECT u.id
              FROM test_case_manager.dbo.users u
              WHERE u.department_id = @dept_id
            )
            OR EXISTS (
              SELECT 1
              FROM test_case_manager.dbo.task_assignments ta
              WHERE ta.task_id = t.id AND ta.user_id = @user_id
            )
          )
        `);
    } else {
      statsQuery = await pool
        .request()
        .input("user_id", sql.Int, userId)
        .query(`
          SELECT
            COUNT(*) AS total,
            SUM(CASE WHEN t.status = 'Pending' THEN 1 ELSE 0 END) AS pending,
            SUM(CASE WHEN t.status = 'In Progress' THEN 1 ELSE 0 END) AS in_progress,
            SUM(CASE WHEN t.status = 'Completed' THEN 1 ELSE 0 END) AS completed,
            SUM(CASE WHEN t.status = 'On Hold' THEN 1 ELSE 0 END) AS on_hold,
            SUM(CASE WHEN t.status = 'Cancelled' THEN 1 ELSE 0 END) AS cancelled
          FROM test_case_manager.dbo.tasks t
          WHERE t.is_archived = 0
          AND (
            t.created_by = @user_id
            OR EXISTS (
              SELECT 1
              FROM test_case_manager.dbo.task_assignments ta
              WHERE ta.task_id = t.id AND ta.user_id = @user_id
            )
          )
        `);
    }

    const stats = statsQuery.recordset[0];

    res.status(200).json({
      success: true,
      is_dept_head: isDeptHead,
      dept_name: isDeptHead ? roleResult.recordset[0].dept_name : null,
      data: {
        total:       stats.total       || 0,
        pending:     stats.pending     || 0,
        in_progress: stats.in_progress || 0,
        completed:   stats.completed   || 0,
        on_hold:     stats.on_hold     || 0,
        cancelled:   stats.cancelled   || 0,
      },
    });

  } catch (err) {
    console.error("GET Dashboard Stats Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard stats",
      error: err.message,
    });
  }
};

// Restore Task Endpoint
exports.restoreTask = async (req, res) => {
  try {
    const { id } = req.params;

    const pool = await poolPromise;

    await pool
      .request()
      .input("id", sql.Int, id)
      .query(`
        UPDATE test_case_manager.dbo.tasks
        SET
          is_archived = 0,
          archived_at = NULL,
          updated_at = GETDATE()
        WHERE id = @id
      `);

    res.json({
      success: true,
      message: "Task restored successfully",
    });

  } catch (err) {
    console.error("RESTORE Task Error:", err);

    res.status(500).json({
      success: false,
      message: "Failed to restore task",
      error: err.message,
    });
  }
};