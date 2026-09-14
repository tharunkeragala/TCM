const { poolPromise } = require("../config/db");
const sql = require("mssql");
const logAudit = require("./auditController");

const DB = "test_case_manager.dbo";

const parseSteps = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try { return JSON.parse(value); } catch { return []; }
};



exports.getPendingApprovals = async (req, res) => {
  try {
    const pool = await poolPromise;

    const result = await pool.request().query(`
      SELECT
        cr.*,
        tc.title AS current_title,
        tc.priority AS current_priority,
        tc.preconditions AS current_preconditions,
        tc.playwright_script AS current_playwright_script,
        tc.workflow_status AS current_workflow_status,
        u.username AS submitted_by_name,
        ts.suite_name AS proposed_suite_name,
        p.project_name AS proposed_project_name
      FROM ${DB}.test_case_change_requests cr
      INNER JOIN ${DB}.test_cases tc ON tc.id=cr.test_case_id
      LEFT JOIN ${DB}.users u ON u.id=cr.submitted_by
      LEFT JOIN ${DB}.test_suites ts ON ts.id=cr.proposed_suite_id
      LEFT JOIN ${DB}.projects p ON p.id=ts.project_id
      WHERE cr.request_status='PENDING'
      ORDER BY cr.submitted_at ASC
    `);

    res.json({
      success: true,
      data: result.recordset.map((r) => ({ ...r, proposed_steps: parseSteps(r.proposed_steps) })),
    });
  } catch (err) {
    console.error("GET Pending Approvals Error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch pending approvals", error: err.message });
  }
};

exports.getWorkflowRequest = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input("id", sql.Int, req.params.requestId)
      .query(`
        SELECT
          cr.*,
          tc.title AS current_title,
          tc.priority AS current_priority,
          tc.preconditions AS current_preconditions,
          tc.playwright_script AS current_playwright_script,
          tc.workflow_status AS current_workflow_status,
          u.username AS submitted_by_name,
          ts.suite_name AS proposed_suite_name,
          p.project_name AS proposed_project_name
        FROM ${DB}.test_case_change_requests cr
        INNER JOIN ${DB}.test_cases tc ON tc.id=cr.test_case_id
        LEFT JOIN ${DB}.users u ON u.id=cr.submitted_by
        LEFT JOIN ${DB}.test_suites ts ON ts.id=cr.proposed_suite_id
        LEFT JOIN ${DB}.projects p ON p.id=ts.project_id
        WHERE cr.id=@id
      `);

    if (!result.recordset.length) {
      return res.status(404).json({ success: false, message: "Workflow request not found." });
    }

    const request = result.recordset[0];
    const steps = await pool.request()
      .input("id", sql.Int, request.test_case_id)
      .query(`
        SELECT step_number,action,expected_result
        FROM ${DB}.test_steps
        WHERE test_case_id=@id
        ORDER BY step_number
      `);

    res.json({
      success: true,
      data: {
        ...request,
        current_steps: steps.recordset,
        proposed_steps: parseSteps(request.proposed_steps),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to fetch workflow request", error: err.message });
  }
};

exports.getTestCaseWorkflowHistory = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().input("id", sql.Int, req.params.id).query(`
      SELECT
        cr.*,
        s.username AS submitted_by_name,
        d.username AS decision_by_name,
        r.username AS returned_by_name
      FROM ${DB}.test_case_change_requests cr
      LEFT JOIN ${DB}.users s ON s.id=cr.submitted_by
      LEFT JOIN ${DB}.users d ON d.id=cr.decision_by
      LEFT JOIN ${DB}.users r ON r.id=cr.returned_by
      WHERE cr.test_case_id=@id
      ORDER BY cr.created_at DESC
    `);

    res.json({
      success: true,
      data: result.recordset.map((r) => ({ ...r, proposed_steps: parseSteps(r.proposed_steps) })),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to fetch workflow history", error: err.message });
  }
};

exports.approveRequest = async (req, res) => {
  const pool = await poolPromise;
  const tx = new sql.Transaction(pool);

  try {
    const userId = req.user.id;

    await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);

    const locked = await new sql.Request(tx)
      .input("id", sql.Int, req.params.requestId)
      .query(`SELECT * FROM ${DB}.test_case_change_requests WITH(UPDLOCK,HOLDLOCK) WHERE id=@id`);
    const request = locked.recordset[0];

    if (!request) {
      await tx.rollback();
      return res.status(404).json({ success: false, message: "Workflow request not found." });
    }
    if (request.request_status !== "PENDING") {
      await tx.rollback();
      return res.status(409).json({ success: false, message: `Request is already ${request.request_status}.` });
    }
    if (Number(request.submitted_by) === Number(userId)) {
      await tx.rollback();
      return res.status(403).json({ success: false, message: "You cannot approve your own change." });
    }

    const oldResult = await new sql.Request(tx)
      .input("id", sql.Int, request.test_case_id)
      .query(`SELECT * FROM ${DB}.test_cases WITH(UPDLOCK,HOLDLOCK) WHERE id=@id`);
    const oldCase = oldResult.recordset[0];

    await new sql.Request(tx)
      .input("id", sql.Int, request.test_case_id)
      .input("suite_id", sql.Int, request.proposed_suite_id)
      .input("title", sql.VarChar(500), request.proposed_title)
      .input("preconditions", sql.VarChar(sql.MAX), request.proposed_preconditions)
      .input("priority", sql.VarChar(20), request.proposed_priority)
      .input("script", sql.NVarChar(sql.MAX), request.proposed_playwright_script)
      .input("submitted_by", sql.Int, request.submitted_by)
      .input("approved_by", sql.Int, userId)
      .query(`
        UPDATE ${DB}.test_cases
        SET suite_id=@suite_id,
            title=@title,
            preconditions=@preconditions,
            priority=@priority,
            playwright_script=@script,
            workflow_status='Approved',
            workflow_request_id=NULL,
            updated_by=@submitted_by,
            updated_at=GETDATE(),
            approved_by=@approved_by,
            approved_at=GETDATE(),
            version_no=ISNULL(version_no,0)+1
        WHERE id=@id
      `);

    await new sql.Request(tx)
      .input("id", sql.Int, request.test_case_id)
      .query(`DELETE FROM ${DB}.test_steps WHERE test_case_id=@id`);

    for (const step of parseSteps(request.proposed_steps)) {
      await new sql.Request(tx)
        .input("id", sql.Int, request.test_case_id)
        .input("step_number", sql.Int, step.step_number)
        .input("action", sql.VarChar(sql.MAX), step.action)
        .input("expected_result", sql.VarChar(sql.MAX), step.expected_result || null)
        .query(`
          INSERT INTO ${DB}.test_steps(test_case_id,step_number,action,expected_result)
          VALUES(@id,@step_number,@action,@expected_result)
        `);
    }

    await new sql.Request(tx)
      .input("id", sql.Int, request.id)
      .input("user_id", sql.Int, userId)
      .input("comment", sql.NVarChar(2000), String(req.body?.comment || "").trim() || null)
      .query(`
        UPDATE ${DB}.test_case_change_requests
        SET request_status='APPROVED',
            decision_by=@user_id,
            decision_at=SYSUTCDATETIME(),
            decision_comment=@comment,
            updated_at=SYSUTCDATETIME()
        WHERE id=@id
      `);

    await tx.commit();

    await logAudit({
      userId,
      action: "WORKFLOW_APPROVE",
      module: "TEST_CASE",
      entityType: "TEST_CASE",
      entityId: request.test_case_id,
      entityName: request.proposed_title,
      description: `Approved test case change request #${request.id}`,
      oldValues: oldCase,
      newValues: {
        suite_id: request.proposed_suite_id,
        title: request.proposed_title,
        preconditions: request.proposed_preconditions,
        priority: request.proposed_priority,
        playwright_script: request.proposed_playwright_script,
        workflow_status: "Approved",
      },
      status: "SUCCESS",
    });

    res.json({ success: true, message: "Approved. The test case status is now Approved." });
  } catch (err) {
    try { await tx.rollback(); } catch {}
    console.error("APPROVE Error:", err);
    res.status(500).json({ success: false, message: "Failed to approve request", error: err.message });
  }
};

const closeWithoutApplying = async (req, res, mode) => {
  const pool = await poolPromise;
  const tx = new sql.Transaction(pool);

  try {
    const userId = req.user.id;
    const comment = String(req.body?.comment || "").trim();

    if (!comment) {
      return res.status(400).json({
        success: false,
        message: mode === "REJECTED" ? "A rejection reason is required." : "A return reason is required.",
      });
    }

    await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);

    const locked = await new sql.Request(tx)
      .input("id", sql.Int, req.params.requestId)
      .query(`SELECT * FROM ${DB}.test_case_change_requests WITH(UPDLOCK,HOLDLOCK) WHERE id=@id`);
    const request = locked.recordset[0];

    if (!request) {
      await tx.rollback();
      return res.status(404).json({ success: false, message: "Workflow request not found." });
    }
    if (request.request_status !== "PENDING") {
      await tx.rollback();
      return res.status(409).json({ success: false, message: `Request is already ${request.request_status}.` });
    }
    if (Number(request.submitted_by) === Number(userId)) {
      await tx.rollback();
      return res.status(403).json({ success: false, message: "You cannot decide your own change." });
    }

    if (mode === "REJECTED") {
      await new sql.Request(tx)
        .input("id", sql.Int, request.id)
        .input("user_id", sql.Int, userId)
        .input("comment", sql.NVarChar(2000), comment)
        .query(`
          UPDATE ${DB}.test_case_change_requests
          SET request_status='REJECTED',
              decision_by=@user_id,
              decision_at=SYSUTCDATETIME(),
              decision_comment=@comment,
              updated_at=SYSUTCDATETIME()
          WHERE id=@id
        `);

      await new sql.Request(tx)
        .input("id", sql.Int, request.test_case_id)
        .input("status", sql.VarChar(20), request.from_workflow_status || "Draft")
        .query(`
          UPDATE ${DB}.test_cases
          SET workflow_status=@status,workflow_request_id=NULL
          WHERE id=@id
        `);
    } else {
      await new sql.Request(tx)
        .input("id", sql.Int, request.id)
        .input("user_id", sql.Int, userId)
        .input("comment", sql.NVarChar(2000), comment)
        .query(`
          UPDATE ${DB}.test_case_change_requests
          SET request_status='RETURNED',
              returned_by=@user_id,
              returned_at=SYSUTCDATETIME(),
              return_comment=@comment,
              updated_at=SYSUTCDATETIME()
          WHERE id=@id
        `);

      await new sql.Request(tx)
        .input("id", sql.Int, request.test_case_id)
        .input("request_id", sql.Int, request.id)
        .query(`
          UPDATE ${DB}.test_cases
          SET workflow_status='Draft',workflow_request_id=@request_id
          WHERE id=@id
        `);
    }

    await tx.commit();

    await logAudit({
      userId,
      action: mode === "REJECTED" ? "WORKFLOW_REJECT" : "WORKFLOW_RETURN",
      module: "TEST_CASE",
      entityType: "TEST_CASE",
      entityId: request.test_case_id,
      entityName: request.proposed_title,
      description:
        mode === "REJECTED"
          ? `Rejected test case change request #${request.id}. Reason: ${comment}`
          : `Returned test case change request #${request.id}. Reason: ${comment}`,
      newValues: { request_id: request.id, decision: mode, reason: comment },
      status: "SUCCESS",
    });

    res.json({
      success: true,
      message:
        mode === "REJECTED"
          ? "Change rejected. Live test case was not changed."
          : "Returned for correction. The workflow status is now Draft.",
    });
  } catch (err) {
    try { await tx.rollback(); } catch {}
    res.status(500).json({ success: false, message: "Workflow action failed", error: err.message });
  }
};

exports.rejectRequest = (req, res) => closeWithoutApplying(req, res, "REJECTED");
exports.returnRequest = (req, res) => closeWithoutApplying(req, res, "RETURNED");
