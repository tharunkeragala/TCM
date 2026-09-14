const { poolPromise } = require("../config/db");
const sql = require("mssql");
const logAudit = require("./auditController");

const DB = "test_case_manager.dbo";

const normalizeSteps = (steps) =>
  Array.isArray(steps)
    ? steps.map((s, i) => ({
        step_number: i + 1,
        action: String(s.action || "").trim(),
        expected_result: String(s.expected_result || "").trim(),
      }))
    : [];

const validate = ({ suite_id, title, priority, steps }) => {
  if (!Number(suite_id)) return "Suite is required.";
  if (!String(title || "").trim()) return "Title is required.";

  if (!["Low", "Medium", "High", "Critical"].includes(priority || "Medium")) {
    return "Invalid priority.";
  }

  const normalized = normalizeSteps(steps);

  if (!normalized.length) {
    return "At least one test step is required.";
  }

  if (normalized.some((s) => !s.action)) {
    return "Every test step must have an action.";
  }

  return null;
};

const replaceSteps = async (tx, testCaseId, steps) => {
  await new sql.Request(tx)
    .input("id", sql.Int, testCaseId)
    .query(`
      DELETE FROM ${DB}.test_steps
      WHERE test_case_id = @id
    `);

  for (const step of steps) {
    await new sql.Request(tx)
      .input("test_case_id", sql.Int, testCaseId)
      .input("step_number", sql.Int, step.step_number)
      .input("action", sql.VarChar(sql.MAX), step.action)
      .input(
        "expected_result",
        sql.VarChar(sql.MAX),
        step.expected_result || null,
      )
      .query(`
        INSERT INTO ${DB}.test_steps
          (test_case_id, step_number, action, expected_result)
        VALUES
          (@test_case_id, @step_number, @action, @expected_result)
      `);
  }
};

exports.getTestCases = async (req, res) => {
  try {
    const pool = await poolPromise;
    const { suite_id } = req.query;

    const userResult = await pool
      .request()
      .input("user_id", sql.Int, req.user.id)
      .query(`
        SELECT department_id
        FROM ${DB}.users
        WHERE id = @user_id
      `);

    const departmentId =
      userResult.recordset[0]?.department_id ?? null;

    const request = pool
      .request()
      .input("department_id", sql.Int, departmentId);

    const conditions = [
      "(u1.department_id = @department_id OR u1.department_id IS NULL)",
    ];

    if (suite_id) {
      request.input("suite_id", sql.Int, suite_id);
      conditions.push("tc.suite_id = @suite_id");
    }

    const result = await request.query(`
      SELECT
        tc.id,
        tc.suite_id,
        tc.title,
        tc.preconditions,
        tc.priority,
        tc.status,
        ISNULL(tc.workflow_status, 'Draft') AS workflow_status,
        tc.workflow_request_id,
        tc.approved_by,
        tc.approved_at,
        tc.version_no,
        tc.playwright_script,
        tc.created_by,
        tc.updated_by,
        tc.created_at,
        tc.updated_at,

        ts.suite_name,
        p.project_name,

        u1.username AS created_by_name,
        u2.username AS updated_by_name,
        ua.username AS approved_by_name,

        cr.request_status AS active_request_status,
        cr.return_comment AS active_return_comment,
        cr.submitted_by AS active_request_submitted_by

      FROM ${DB}.test_cases tc

      LEFT JOIN ${DB}.test_suites ts
        ON ts.id = tc.suite_id

      LEFT JOIN ${DB}.projects p
        ON p.id = ts.project_id

      LEFT JOIN ${DB}.users u1
        ON u1.id = tc.created_by

      LEFT JOIN ${DB}.users u2
        ON u2.id = tc.updated_by

      LEFT JOIN ${DB}.users ua
        ON ua.id = tc.approved_by

      LEFT JOIN ${DB}.test_case_change_requests cr
        ON cr.id = tc.workflow_request_id

      WHERE ${conditions.join(" AND ")}

      ORDER BY tc.id ASC
    `);

    res.json({
      success: true,
      data: result.recordset,
    });
  } catch (err) {
    console.error("GET Test Cases Error:", err);

    res.status(500).json({
      success: false,
      message: "Failed to fetch test cases",
      error: err.message,
    });
  }
};

exports.getTestCaseById = async (req, res) => {
  try {
    const pool = await poolPromise;

    const result = await pool
      .request()
      .input("id", sql.Int, req.params.id)
      .query(`
        SELECT
          tc.id,
          tc.suite_id,
          tc.title,
          tc.preconditions,
          tc.priority,
          tc.status,
          ISNULL(tc.workflow_status, 'Draft') AS workflow_status,
          tc.workflow_request_id,
          tc.approved_by,
          tc.approved_at,
          tc.version_no,
          tc.playwright_script,
          tc.created_by,
          tc.updated_by,
          tc.created_at,
          tc.updated_at,

          ts.suite_name,
          p.project_name,

          u1.username AS created_by_name,
          u2.username AS updated_by_name,
          ua.username AS approved_by_name,

          cr.id AS active_request_id,
          cr.request_status AS active_request_status,
          cr.return_comment AS active_return_comment,

          cr.proposed_suite_id,
          cr.proposed_title,
          cr.proposed_preconditions,
          cr.proposed_priority,
          cr.proposed_playwright_script,
          cr.proposed_steps

        FROM ${DB}.test_cases tc

        LEFT JOIN ${DB}.test_suites ts
          ON ts.id = tc.suite_id

        LEFT JOIN ${DB}.projects p
          ON p.id = ts.project_id

        LEFT JOIN ${DB}.users u1
          ON u1.id = tc.created_by

        LEFT JOIN ${DB}.users u2
          ON u2.id = tc.updated_by

        LEFT JOIN ${DB}.users ua
          ON ua.id = tc.approved_by

        LEFT JOIN ${DB}.test_case_change_requests cr
          ON cr.id = tc.workflow_request_id

        WHERE tc.id = @id
      `);

    if (!result.recordset.length) {
      return res.status(404).json({
        success: false,
        message: "Test case not found",
      });
    }

    const tc = result.recordset[0];

    const steps = await pool
      .request()
      .input("id", sql.Int, req.params.id)
      .query(`
        SELECT
          step_number,
          action,
          expected_result
        FROM ${DB}.test_steps
        WHERE test_case_id = @id
        ORDER BY step_number
      `);

    let proposedSteps = null;

    if (tc.proposed_steps) {
      try {
        proposedSteps = JSON.parse(tc.proposed_steps);
      } catch {
        proposedSteps = null;
      }
    }

    delete tc.proposed_steps;

    res.json({
      success: true,
      data: {
        ...tc,
        steps: steps.recordset,
        proposed_steps: proposedSteps,
      },
    });
  } catch (err) {
    console.error("GET Test Case Error:", err);

    res.status(500).json({
      success: false,
      message: "Failed to fetch test case",
      error: err.message,
    });
  }
};

exports.getTestCaseStepCount = async (req, res) => {
  try {
    const pool = await poolPromise;

    const result = await pool
      .request()
      .input("id", sql.Int, req.params.id)
      .query(`
        SELECT COUNT(*) AS step_count
        FROM ${DB}.test_steps
        WHERE test_case_id = @id
      `);

    res.json({
      success: true,
      count: result.recordset[0]?.step_count || 0,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch step count",
      error: err.message,
    });
  }
};

exports.createTestCase = async (req, res) => {
  const pool = await poolPromise;
  const tx = new sql.Transaction(pool);

  try {
    const {
      suite_id,
      title,
      preconditions,
      priority = "Medium",
      steps,
      playwright_script,
    } = req.body;

    // workflow_status/status from the browser are intentionally ignored.
    const error = validate({
      suite_id,
      title,
      priority,
      steps,
    });

    if (error) {
      return res.status(400).json({
        success: false,
        message: error,
      });
    }

    const normalizedSteps = normalizeSteps(steps);
    const userId = req.user.id;

    await tx.begin();

    const inserted = await new sql.Request(tx)
      .input("suite_id", sql.Int, suite_id)
      .input("title", sql.VarChar(500), String(title).trim())
      .input(
        "preconditions",
        sql.VarChar(sql.MAX),
        preconditions || null,
      )
      .input("priority", sql.VarChar(20), priority)
      .input(
        "script",
        sql.NVarChar(sql.MAX),
        playwright_script || null,
      )
      .input("user_id", sql.Int, userId)
      .query(`
        INSERT INTO ${DB}.test_cases
        (
          suite_id,
          title,
          preconditions,
          priority,
          workflow_status,
          playwright_script,
          created_by,
          updated_by
        )
        OUTPUT INSERTED.*
        VALUES
        (
          @suite_id,
          @title,
          @preconditions,
          @priority,
          'Draft',
          @script,
          @user_id,
          @user_id
        )
      `);

    const tc = inserted.recordset[0];

    await replaceSteps(tx, tc.id, normalizedSteps);

    await tx.commit();

    await logAudit({
      userId,
      action: "CREATE",
      module: "TEST_CASE",
      entityType: "TEST_CASE",
      entityId: tc.id,
      entityName: tc.title,
      description: `Created test case #${tc.id} as Draft`,
      newValues: {
        ...tc,
        workflow_status: "Draft",
        steps: normalizedSteps,
      },
      status: "SUCCESS",
    });

    res.status(201).json({
      success: true,
      message:
        "Test case created as Draft. Submit it for review when it is ready.",
      id: tc.id,
      workflow_status: "Draft",
    });
  } catch (err) {
    try {
      await tx.rollback();
    } catch {}

    console.error("CREATE Test Case Error:", err);

    res.status(500).json({
      success: false,
      message: "Failed to create test case",
      error: err.message,
    });
  }
};

exports.submitForReview = async (req, res) => {
  const pool = await poolPromise;
  const tx = new sql.Transaction(pool);

  try {
    const testCaseId = Number(req.params.id);
    const userId = req.user.id;

    await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);

    const found = await new sql.Request(tx)
      .input("id", sql.Int, testCaseId)
      .query(`
        SELECT *
        FROM ${DB}.test_cases WITH (UPDLOCK, HOLDLOCK)
        WHERE id = @id
      `);

    const tc = found.recordset[0];

    if (!tc) {
      await tx.rollback();

      return res.status(404).json({
        success: false,
        message: "Test case not found.",
      });
    }

    if (tc.workflow_status !== "Draft") {
      await tx.rollback();

      return res.status(409).json({
        success: false,
        message:
          tc.workflow_status === "Review"
            ? "This test case is already pending review."
            : "Only Draft test cases can be submitted for review.",
      });
    }

    const pending = await new sql.Request(tx)
      .input("id", sql.Int, testCaseId)
      .query(`
        SELECT TOP 1 id
        FROM ${DB}.test_case_change_requests
        WHERE test_case_id = @id
          AND request_status = 'PENDING'
      `);

    if (pending.recordset.length) {
      await tx.rollback();

      return res.status(409).json({
        success: false,
        message: "A pending review already exists.",
      });
    }

    const returned = await new sql.Request(tx)
      .input("id", sql.Int, testCaseId)
      .query(`
        SELECT TOP 1 *
        FROM ${DB}.test_case_change_requests WITH (UPDLOCK, HOLDLOCK)
        WHERE test_case_id = @id
          AND request_status = 'RETURNED'
        ORDER BY id DESC
      `);

    const returnedRequest = returned.recordset[0];

    // Returned proposals are corrected/resubmitted through updateTestCase.
    if (returnedRequest) {
      await tx.rollback();

      return res.status(409).json({
        success: false,
        message:
          "This test case has returned changes. Open Edit, correct them, and resubmit for approval.",
      });
    }

    const steps = await new sql.Request(tx)
      .input("id", sql.Int, testCaseId)
      .query(`
        SELECT
          step_number,
          action,
          expected_result
        FROM ${DB}.test_steps
        WHERE test_case_id = @id
        ORDER BY step_number
      `);

    const requestType =
      tc.approved_at || Number(tc.version_no || 0) > 1
        ? "UPDATE"
        : "CREATE";

    const inserted = await new sql.Request(tx)
      .input("test_case_id", sql.Int, testCaseId)
      .input(
        "request_type",
        sql.VarChar(20),
        requestType,
      )
      .input(
        "from_status",
        sql.VarChar(20),
        tc.workflow_status || "Draft",
      )
      .input("suite_id", sql.Int, tc.suite_id)
      .input("title", sql.VarChar(500), tc.title)
      .input(
        "preconditions",
        sql.VarChar(sql.MAX),
        tc.preconditions || null,
      )
      .input("priority", sql.VarChar(20), tc.priority)
      .input(
        "script",
        sql.NVarChar(sql.MAX),
        tc.playwright_script || null,
      )
      .input(
        "steps",
        sql.NVarChar(sql.MAX),
        JSON.stringify(steps.recordset),
      )
      .input("user_id", sql.Int, userId)
      .query(`
        INSERT INTO ${DB}.test_case_change_requests
        (
          test_case_id,
          request_type,
          request_status,
          from_workflow_status,
          requested_workflow_status,
          proposed_suite_id,
          proposed_title,
          proposed_preconditions,
          proposed_priority,
          proposed_playwright_script,
          proposed_steps,
          submitted_by
        )
        OUTPUT INSERTED.id
        VALUES
        (
          @test_case_id,
          @request_type,
          'PENDING',
          @from_status,
          'Approved',
          @suite_id,
          @title,
          @preconditions,
          @priority,
          @script,
          @steps,
          @user_id
        )
      `);

    const requestId = inserted.recordset[0].id;

    await new sql.Request(tx)
      .input("id", sql.Int, testCaseId)
      .input("request_id", sql.Int, requestId)
      .input("user_id", sql.Int, userId)
      .query(`
        UPDATE ${DB}.test_cases
        SET
          workflow_status = 'Review',
          workflow_request_id = @request_id,
          updated_by = @user_id,
          updated_at = GETDATE()
        WHERE id = @id
      `);

    await tx.commit();

    await logAudit({
      userId,
      action: "WORKFLOW_SUBMIT",
      module: "TEST_CASE",
      entityType: "TEST_CASE",
      entityId: testCaseId,
      entityName: tc.title,
      description:
        `Submitted test case #${testCaseId} for approval as request #${requestId}`,
      oldValues: {
        workflow_status: "Draft",
      },
      newValues: {
        workflow_status: "Review",
        workflow_request_id: requestId,
      },
      status: "SUCCESS",
    });

    res.json({
      success: true,
      message: "Test case sent for approval.",
      request_id: requestId,
      workflow_status: "Review",
    });
  } catch (err) {
    try {
      await tx.rollback();
    } catch {}

    console.error("SUBMIT REVIEW Error:", err);

    res.status(500).json({
      success: false,
      message: "Failed to submit for review",
      error: err.message,
    });
  }
};

exports.updateTestCase = async (req, res) => {
  const pool = await poolPromise;
  const tx = new sql.Transaction(pool);

  try {
    const testCaseId = Number(req.params.id);
    const userId = req.user.id;

    const {
      suite_id,
      title,
      preconditions,
      priority = "Medium",
      steps,
      playwright_script,
    } = req.body;

    // workflow_status/status supplied by the browser are ignored.
    const error = validate({
      suite_id,
      title,
      priority,
      steps,
    });

    if (error) {
      return res.status(400).json({
        success: false,
        message: error,
      });
    }

    const normalizedSteps = normalizeSteps(steps);

    await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);

    const oldResult = await new sql.Request(tx)
      .input("id", sql.Int, testCaseId)
      .query(`
        SELECT *
        FROM ${DB}.test_cases WITH (UPDLOCK, HOLDLOCK)
        WHERE id = @id
      `);

    const oldCase = oldResult.recordset[0];

    if (!oldCase) {
      await tx.rollback();

      return res.status(404).json({
        success: false,
        message: "Test case not found.",
      });
    }

    const openResult = await new sql.Request(tx)
      .input("id", sql.Int, testCaseId)
      .query(`
        SELECT TOP 1 *
        FROM ${DB}.test_case_change_requests WITH (UPDLOCK, HOLDLOCK)
        WHERE test_case_id = @id
          AND request_status IN ('PENDING', 'RETURNED')
        ORDER BY id DESC
      `);

    const open = openResult.recordset[0];

    if (open?.request_status === "PENDING") {
      await tx.rollback();

      return res.status(409).json({
        success: false,
        message:
          "This test case is already pending review and cannot be edited until a decision is made.",
      });
    }

    // ---------------------------------------------------------
    // RETURNED REQUEST
    // Correct the proposal and immediately resubmit it.
    // The live test case content is not overwritten.
    // ---------------------------------------------------------
    if (open?.request_status === "RETURNED") {
      if (Number(open.submitted_by) !== Number(userId)) {
        await tx.rollback();

        return res.status(403).json({
          success: false,
          message:
            "Only the original requester can correct a returned request.",
        });
      }

      await new sql.Request(tx)
        .input("request_id", sql.Int, open.id)
        .input("suite_id", sql.Int, suite_id)
        .input("title", sql.VarChar(500), String(title).trim())
        .input(
          "preconditions",
          sql.VarChar(sql.MAX),
          preconditions || null,
        )
        .input("priority", sql.VarChar(20), priority)
        .input(
          "script",
          sql.NVarChar(sql.MAX),
          playwright_script || null,
        )
        .input(
          "steps",
          sql.NVarChar(sql.MAX),
          JSON.stringify(normalizedSteps),
        )
        .query(`
          UPDATE ${DB}.test_case_change_requests
          SET
            request_status = 'PENDING',
            proposed_suite_id = @suite_id,
            proposed_title = @title,
            proposed_preconditions = @preconditions,
            proposed_priority = @priority,
            proposed_playwright_script = @script,
            proposed_steps = @steps,
            revision_no = revision_no + 1,
            resubmitted_at = SYSUTCDATETIME(),
            returned_by = NULL,
            returned_at = NULL,
            return_comment = NULL,
            updated_at = SYSUTCDATETIME()
          WHERE id = @request_id
        `);

      await new sql.Request(tx)
        .input("id", sql.Int, testCaseId)
        .input("request_id", sql.Int, open.id)
        .input("user_id", sql.Int, userId)
        .query(`
          UPDATE ${DB}.test_cases
          SET
            workflow_status = 'Review',
            workflow_request_id = @request_id,
            updated_by = @user_id,
            updated_at = GETDATE()
          WHERE id = @id
        `);

      await tx.commit();

      await logAudit({
        userId,
        action: "WORKFLOW_RESUBMIT",
        module: "TEST_CASE",
        entityType: "TEST_CASE",
        entityId: testCaseId,
        entityName: String(title).trim(),
        description:
          `Corrected and resubmitted test case change request #${open.id}`,
        oldValues: oldCase,
        newValues: {
          suite_id,
          title,
          preconditions,
          priority,
          playwright_script,
          steps: normalizedSteps,
          workflow_status: "Review",
          workflow_request_id: open.id,
        },
        status: "SUCCESS",
      });

      return res.json({
        success: true,
        message: "Corrected changes resubmitted for approval.",
        request_id: open.id,
        workflow_status: "Review",
      });
    }

    // ---------------------------------------------------------
    // DRAFT
    // A Draft is still being prepared, so editing it simply
    // saves the Draft. It does NOT create an approval request.
    // ---------------------------------------------------------
    if (oldCase.workflow_status === "Draft") {
      await new sql.Request(tx)
        .input("id", sql.Int, testCaseId)
        .input("suite_id", sql.Int, suite_id)
        .input("title", sql.VarChar(500), String(title).trim())
        .input(
          "preconditions",
          sql.VarChar(sql.MAX),
          preconditions || null,
        )
        .input("priority", sql.VarChar(20), priority)
        .input(
          "script",
          sql.NVarChar(sql.MAX),
          playwright_script || null,
        )
        .input("user_id", sql.Int, userId)
        .query(`
          UPDATE ${DB}.test_cases
          SET
            suite_id = @suite_id,
            title = @title,
            preconditions = @preconditions,
            priority = @priority,
            playwright_script = @script,
            workflow_status = 'Draft',
            workflow_request_id = NULL,
            updated_by = @user_id,
            updated_at = GETDATE()
          WHERE id = @id
        `);

      await replaceSteps(
        tx,
        testCaseId,
        normalizedSteps,
      );

      await tx.commit();

      await logAudit({
        userId,
        action: "UPDATE_DRAFT",
        module: "TEST_CASE",
        entityType: "TEST_CASE",
        entityId: testCaseId,
        entityName: String(title).trim(),
        description: `Updated Draft test case #${testCaseId}`,
        oldValues: oldCase,
        newValues: {
          suite_id,
          title,
          preconditions,
          priority,
          playwright_script,
          steps: normalizedSteps,
          workflow_status: "Draft",
        },
        status: "SUCCESS",
      });

      return res.json({
        success: true,
        message:
          "Draft saved. Submit it for review when it is ready.",
        workflow_status: "Draft",
      });
    }

    // ---------------------------------------------------------
    // APPROVED
    // Edits become a proposed change request.
    // Live approved content remains unchanged until approval.
    // ---------------------------------------------------------
    if (oldCase.workflow_status === "Approved") {
      const inserted = await new sql.Request(tx)
        .input("test_case_id", sql.Int, testCaseId)
        .input(
          "from_status",
          sql.VarChar(20),
          "Approved",
        )
        .input("suite_id", sql.Int, suite_id)
        .input("title", sql.VarChar(500), String(title).trim())
        .input(
          "preconditions",
          sql.VarChar(sql.MAX),
          preconditions || null,
        )
        .input("priority", sql.VarChar(20), priority)
        .input(
          "script",
          sql.NVarChar(sql.MAX),
          playwright_script || null,
        )
        .input(
          "steps",
          sql.NVarChar(sql.MAX),
          JSON.stringify(normalizedSteps),
        )
        .input("user_id", sql.Int, userId)
        .query(`
          INSERT INTO ${DB}.test_case_change_requests
          (
            test_case_id,
            request_type,
            request_status,
            from_workflow_status,
            requested_workflow_status,
            proposed_suite_id,
            proposed_title,
            proposed_preconditions,
            proposed_priority,
            proposed_playwright_script,
            proposed_steps,
            submitted_by
          )
          OUTPUT INSERTED.id
          VALUES
          (
            @test_case_id,
            'UPDATE',
            'PENDING',
            @from_status,
            'Approved',
            @suite_id,
            @title,
            @preconditions,
            @priority,
            @script,
            @steps,
            @user_id
          )
        `);

      const requestId = inserted.recordset[0].id;

      await new sql.Request(tx)
        .input("id", sql.Int, testCaseId)
        .input("request_id", sql.Int, requestId)
        .input("user_id", sql.Int, userId)
        .query(`
          UPDATE ${DB}.test_cases
          SET
            workflow_status = 'Review',
            workflow_request_id = @request_id,
            updated_by = @user_id,
            updated_at = GETDATE()
          WHERE id = @id
        `);

      await tx.commit();

      await logAudit({
        userId,
        action: "WORKFLOW_SUBMIT",
        module: "TEST_CASE",
        entityType: "TEST_CASE",
        entityId: testCaseId,
        entityName: String(title).trim(),
        description:
          `Submitted changes to approved test case #${testCaseId} for approval as request #${requestId}`,
        oldValues: oldCase,
        newValues: {
          suite_id,
          title,
          preconditions,
          priority,
          playwright_script,
          steps: normalizedSteps,
          workflow_status: "Review",
          workflow_request_id: requestId,
        },
        status: "SUCCESS",
      });

      return res.json({
        success: true,
        message:
          "Changes sent for approval. The current approved version remains live until approval.",
        request_id: requestId,
        workflow_status: "Review",
      });
    }

    await tx.rollback();

    return res.status(409).json({
      success: false,
      message:
        "This test case cannot be edited in its current workflow state.",
    });
  } catch (err) {
    try {
      await tx.rollback();
    } catch {}

    console.error("UPDATE Test Case Error:", err);

    res.status(500).json({
      success: false,
      message: "Failed to update test case",
      error: err.message,
    });
  }
};

exports.deleteTestCase = async (req, res) => {
  const pool = await poolPromise;
  const tx = new sql.Transaction(pool);

  try {
    const id = Number(req.params.id);
    const userId = req.user.id;

    const found = await pool
      .request()
      .input("id", sql.Int, id)
      .query(`
        SELECT *
        FROM ${DB}.test_cases
        WHERE id = @id
      `);

    const tc = found.recordset[0];

    if (!tc) {
      return res.status(404).json({
        success: false,
        message: "Test case not found.",
      });
    }

    if (tc.workflow_request_id) {
      return res.status(409).json({
        success: false,
        message:
          "Resolve the active workflow request before deleting this test case.",
      });
    }

    await tx.begin();

    await new sql.Request(tx)
      .input("id", sql.Int, id)
      .query(`
        DELETE FROM ${DB}.test_steps
        WHERE test_case_id = @id
      `);

    await new sql.Request(tx)
      .input("id", sql.Int, id)
      .query(`
        DELETE FROM ${DB}.test_case_change_requests
        WHERE test_case_id = @id
      `);

    await new sql.Request(tx)
      .input("id", sql.Int, id)
      .query(`
        DELETE FROM ${DB}.test_cases
        WHERE id = @id
      `);

    await tx.commit();

    await logAudit({
      userId,
      action: "DELETE",
      module: "TEST_CASE",
      entityType: "TEST_CASE",
      entityId: id,
      entityName: tc.title,
      description: `Deleted test case #${id}`,
      oldValues: tc,
      status: "SUCCESS",
    });

    res.json({
      success: true,
      message: "Test case deleted successfully",
    });
  } catch (err) {
    try {
      await tx.rollback();
    } catch {}

    console.error("DELETE Test Case Error:", err);

    res.status(500).json({
      success: false,
      message: "Failed to delete test case",
      error: err.message,
    });
  }
};

exports.getTestCaseActivity = async (req, res) => {
  try {
    const pool = await poolPromise;

    const result = await pool
      .request()
      .input("id", sql.Int, req.params.id)
      .query(`
        SELECT
          al.*,
          u.username
        FROM ${DB}.audit_logs al
        LEFT JOIN ${DB}.users u
          ON u.id = al.user_id
        WHERE al.entity_type = 'TEST_CASE'
          AND al.entity_id = @id
        ORDER BY al.created_at DESC
      `);

    res.json({
      success: true,
      data: result.recordset,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch activity",
      error: err.message,
    });
  }
};
