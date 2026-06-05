const { chromium } = require("playwright");
const { poolPromise } = require("../config/db");
const sql = require("mssql");
const path = require("path");
const fs = require("fs");
const { broadcast } = require("./wsHub");

const screenshotsDir = path.join(__dirname, "..", "screenshots");
if (!fs.existsSync(screenshotsDir))
  fs.mkdirSync(screenshotsDir, { recursive: true });

const activeRuns = {};

function cancelRun(runId) {
  const ctrl = activeRuns[runId];
  if (!ctrl) return false;
  ctrl.abort();
  return true;
}

function normalizeSelector(raw) {
  if (!raw) return raw;
  if (typeof raw === "object") return raw;

  let s = String(raw).trim();
  if (
    (s.startsWith("'") && s.endsWith("'")) ||
    (s.startsWith('"') && s.endsWith('"'))
  ) {
    s = s.slice(1, -1);
  }

  if (s.startsWith("xpath=")) return { xpath: s.slice(6) };
  if (s.startsWith("data-testid=")) return { testid: s.slice(13) };
  if (s.startsWith("name=")) return { name: s.slice(5) };
  if (s.startsWith("id=")) return { id: s.slice(3) };
  return { css: s };
}

function resolveLocator(page, selector) {
  if (!selector) throw new Error("Selector is null or undefined");
  const s = normalizeSelector(selector);

  if (typeof s === "string") return page.locator(s);
  if (s.id) return page.locator(`#${s.id}`);
  if (s.xpath) return page.locator(`xpath=${s.xpath}`);
  if (s.name) return page.locator(`[name="${s.name}"]`);
  if (s.testid) return page.getByTestId(s.testid);
  if (s.css) return page.locator(s.css);

  throw new Error(`Cannot resolve selector: ${JSON.stringify(selector)}`);
}

function parseSelectorArgument(arg) {
  const trimmed = String(arg || "").trim();
  if (!trimmed) return null;

  if (
    (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("`") && trimmed.endsWith("`"))
  ) {
    return trimmed.slice(1, -1);
  }

  try {
    return JSON.parse(trimmed);
  } catch (_) {
    return trimmed;
  }
}

function parseTestScript(script = "") {
  const steps = [];
  const lines = String(script)
    .split("\n")
    .filter((l) => l.trim() && !l.trim().startsWith("//"));

  for (const line of lines) {
    const t = line.trim();
    let m;

    if ((m = t.match(/await page\.goto\(['"`](.+?)['"`]/))) {
      steps.push({ action: "navigate", value: m[1], raw: t });
    } else if ((m = t.match(/await page\.click\((.+)\)/))) {
      steps.push({
        action: "click",
        selector: parseSelectorArgument(m[1]),
        raw: t,
      });
    } else if ((m = t.match(/await page\.fill\((.+),\s*['"`](.*)['"`]\)/))) {
      steps.push({
        action: "fill",
        selector: parseSelectorArgument(m[1]),
        value: m[2],
        raw: t,
      });
    } else if ((m = t.match(/await page\.type\((.+),\s*['"`](.*)['"`]\)/))) {
      steps.push({
        action: "type",
        selector: parseSelectorArgument(m[1]),
        value: m[2],
        raw: t,
      });
    } else if (
      (m = t.match(/await page\.selectOption\((.+),\s*['"`](.*)['"`]\)/))
    ) {
      steps.push({
        action: "select",
        selector: parseSelectorArgument(m[1]),
        value: m[2],
        raw: t,
      });
    } else if (
      (m = t.match(/await page\.waitForSelector\(['"`](.+?)['"`]\)/))
    ) {
      steps.push({ action: "waitForSelector", selector: m[1], raw: t });
    } else if ((m = t.match(/await page\.waitForTimeout\((\d+)\)/))) {
      steps.push({ action: "wait", value: m[1], raw: t });
    } else if (
      (m = t.match(/await expect\(page\)\.toHaveTitle\(['"`](.+?)['"`]\)/))
    ) {
      steps.push({ action: "assertTitle", value: m[1], raw: t });
    } else if (t.match(/await page\.screenshot\(/)) {
      steps.push({ action: "screenshot", raw: t });
    } else {
      steps.push({ action: "custom", raw: t });
    }
  }

  return steps;
}

async function runTestCase(testCaseId, userId = null) {
  console.log("RUN TEST CASE CALLED", testCaseId);
  const pool = await poolPromise;

  const tcResult = await pool.request().input("id", sql.Int, testCaseId).query(`
      SELECT id, title, playwright_script
      FROM test_case_manager.dbo.test_cases
      WHERE id = @id
    `);

  if (!tcResult.recordset.length) throw new Error("Test case not found");

  const testCase = tcResult.recordset[0];
  if (
    !testCase.playwright_script ||
    !String(testCase.playwright_script).trim()
  ) {
    throw new Error("This test case does not have a Playwright script");
  }

  const runResult = await pool
    .request()
    .input("test_case_id", sql.Int, testCaseId)
    .input("status", sql.VarChar, "running")
    .input("started_at", sql.DateTime, new Date())
    .input("created_by", sql.Int, userId).query(`
      INSERT INTO test_case_manager.dbo.playwright_test_runs
        (test_case_id, status, started_at, created_by)
      OUTPUT INSERTED.id
      VALUES
        (@test_case_id, @status, @started_at, @created_by)
    `);

  const runId = runResult.recordset[0].id;
  const startedAtMs = Date.now();
  const abortCtrl = new AbortController();
  activeRuns[runId] = abortCtrl;
  const isAborted = () => abortCtrl.signal.aborted;

  broadcast({ type: "run_started", runId, testCaseId });
  console.log("RUN STARTED", runId);

  const steps = parseTestScript(testCase.playwright_script);
  let browser = null;

  try {
    const possibleBrowserPaths = [
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
      "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    ];

    const executablePath = possibleBrowserPaths.find((p) => fs.existsSync(p));

    if (!executablePath) {
      throw new Error(
        "No local Chrome or Edge browser found. Please install Chrome/Edge or configure PLAYWRIGHT_BROWSER_PATH.",
      );
    }

    browser = await chromium.launch({
      executablePath,
      headless: false,
      args: [
        "--start-maximized",
        "--disable-blink-features=AutomationControlled",
      ],
    });
    console.log("PLAYWRIGHT BROWSER LAUNCHED");
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
    });
    const page = await context.newPage();

    const client = await context.newCDPSession(page);
    await client.send("Page.startScreencast", {
      format: "jpeg",
      quality: 60,
      everyNthFrame: 1,
    });

    client.on("Page.screencastFrame", async (event) => {
      try {
        broadcast({ type: "live_frame", runId, frame: event.data });
        await client.send("Page.screencastFrameAck", {
          sessionId: event.sessionId,
        });
      } catch (_) {}
    });

    for (let i = 0; i < steps.length; i++) {
      console.log("RUNNING STEP", i + 1, steps[i]);
      if (isAborted()) {
        broadcast({ type: "run_aborted", runId, stoppedAtStep: i + 1 });
        break;
      }

      const step = steps[i];
      const stepStartedAt = Date.now();

      const stepResult = await pool
        .request()
        .input("run_id", sql.Int, runId)
        .input("step_number", sql.Int, i + 1)
        .input("action", sql.VarChar, step.action)
        .input(
          "selector",
          sql.NVarChar(sql.MAX),
          step.selector == null ? null : JSON.stringify(step.selector),
        )
        .input("value", sql.NVarChar(sql.MAX), step.value || null)
        .input("status", sql.VarChar, "running").query(`
          INSERT INTO test_case_manager.dbo.playwright_test_run_steps
            (run_id, step_number, action, selector, value, status)
          OUTPUT INSERTED.id
          VALUES
            (@run_id, @step_number, @action, @selector, @value, @status)
        `);

      const stepId = stepResult.recordset[0].id;
      broadcast({
        type: "step_started",
        runId,
        stepId,
        stepNum: i + 1,
        step,
        total: steps.length,
      });

      const screenshotFilename = `${runId}_step${i + 1}.png`;
      const screenshotPath = path.join(screenshotsDir, screenshotFilename);
      const publicScreenshotPath = `/screenshots/${screenshotFilename}`;

      try {
        switch (step.action) {
          case "navigate":
            await page.goto(step.value, { waitUntil: "domcontentloaded" });
            break;
          case "click":
            await resolveLocator(page, step.selector).click();
            break;
          case "fill":
            await resolveLocator(page, step.selector).fill(step.value || "");
            break;
          case "type":
            await resolveLocator(page, step.selector).pressSequentially(
              step.value || "",
            );
            break;
          case "select":
            await resolveLocator(page, step.selector).selectOption(
              step.value || "",
            );
            break;
          case "waitForSelector":
            await resolveLocator(page, step.selector).waitFor({
              state: "visible",
            });
            break;
          case "wait":
            await page.waitForTimeout(parseInt(step.value, 10) || 1000);
            break;
          case "assertTitle": {
            const title = await page.title();
            if (title !== step.value)
              throw new Error(
                `Expected title "${step.value}" but got "${title}"`,
              );
            break;
          }
          case "screenshot":
            break;
          case "custom":
          default:
            break;
        }

        await page.screenshot({ path: screenshotPath }).catch(() => {});
        const duration = Date.now() - stepStartedAt;

        await pool
          .request()
          .input("id", sql.Int, stepId)
          .input("status", sql.VarChar, "passed")
          .input("duration_ms", sql.Int, duration)
          .input("screenshot_path", sql.NVarChar, publicScreenshotPath).query(`
            UPDATE test_case_manager.dbo.playwright_test_run_steps
            SET status = @status,
                duration_ms = @duration_ms,
                screenshot_path = @screenshot_path
            WHERE id = @id
          `);

        broadcast({
          type: "step_completed",
          runId,
          stepId,
          stepNum: i + 1,
          status: "passed",
          duration_ms: duration,
          screenshotPath: publicScreenshotPath,
        });
      } catch (err) {
        await page.screenshot({ path: screenshotPath }).catch(() => {});
        const duration = Date.now() - stepStartedAt;

        await pool
          .request()
          .input("id", sql.Int, stepId)
          .input("status", sql.VarChar, "failed")
          .input("duration_ms", sql.Int, duration)
          .input("error_message", sql.NVarChar(sql.MAX), err.message)
          .input("screenshot_path", sql.NVarChar, publicScreenshotPath).query(`
            UPDATE test_case_manager.dbo.playwright_test_run_steps
            SET status = @status,
                duration_ms = @duration_ms,
                error_message = @error_message,
                screenshot_path = @screenshot_path
            WHERE id = @id
          `);

        broadcast({
          type: "step_failed",
          runId,
          stepId,
          stepNum: i + 1,
          status: "failed",
          duration_ms: duration,
          error: err.message,
          screenshotPath: publicScreenshotPath,
        });

        throw err;
      }
    }

    const finalStatus = isAborted() ? "aborted" : "passed";
    const duration = Date.now() - startedAtMs;

    await pool
      .request()
      .input("id", sql.Int, runId)
      .input("status", sql.VarChar, finalStatus)
      .input("completed_at", sql.DateTime, new Date())
      .input("duration_ms", sql.Int, duration).query(`
        UPDATE test_case_manager.dbo.playwright_test_runs
        SET status = @status,
            completed_at = @completed_at,
            duration_ms = @duration_ms
        WHERE id = @id
      `);

    broadcast({ type: "run_completed", runId, status: finalStatus, duration });
  } catch (err) {
    const duration = Date.now() - startedAtMs;
    console.error("PLAYWRIGHT ERROR:", err);

    await pool
      .request()
      .input("id", sql.Int, runId)
      .input("status", sql.VarChar, "failed")
      .input("completed_at", sql.DateTime, new Date())
      .input("duration_ms", sql.Int, duration)
      .input("error_message", sql.NVarChar(sql.MAX), err.message).query(`
        UPDATE test_case_manager.dbo.playwright_test_runs
        SET status = @status,
            completed_at = @completed_at,
            duration_ms = @duration_ms,
            error_message = @error_message
        WHERE id = @id
      `);

    broadcast({
      type: "run_completed",
      runId,
      status: "failed",
      error: err.message,
      duration,
    });
  } finally {
    delete activeRuns[runId];
    if (browser) await browser.close().catch(() => {});
  }

  return runId;
}

module.exports = {
  runTestCase,
  parseTestScript,
  cancelRun,
  normalizeSelector,
  resolveLocator,
};
