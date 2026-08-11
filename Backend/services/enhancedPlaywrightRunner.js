/**
 * enhancedPlaywrightRunner.js
 *
 * Place at:
 *   Backend/services/enhancedPlaywrightRunner.js
 *
 * Combined runner supporting:
 *   - Existing single test-case execution
 *   - Data-driven execution
 *   - Variable substitution
 *   - Conditional execution
 *   - Keyword-driven execution
 *   - API request steps
 *   - Self-healing locators
 *   - Version and locator-history tracking
 *   - Run cancellation
 *   - Live browser screencast
 *   - Step screenshots
 *   - Page and locator readiness waiting
 */

const { chromium } = require("playwright");
const { poolPromise } = require("../config/db");
const sql = require("mssql");
const path = require("path");
const fs = require("fs");

const { broadcast } = require("./wsHub");

const dataEngineService = require("./dataEngineService");
const { VariableEngine } = require("./variableEngine");
const conditionalExecutor = require("./conditionalExecutor");
const keywordEngine = require("./keywordEngine");
const apiTestingEngine = require("./apiTestingService");
const selfHealingEngine = require("./selfHealingEngine");
const testMaintenanceEngine = require("./testMaintenanceEngine");

/* -------------------------------------------------------------------------- */
/*                                Configuration                               */
/* -------------------------------------------------------------------------- */

const DATABASE_SCHEMA = "test_case_manager.dbo";

const DEFAULT_NAVIGATION_TIMEOUT = Number(
  process.env.PLAYWRIGHT_NAVIGATION_TIMEOUT || 60000,
);

const DEFAULT_ACTION_TIMEOUT = Number(
  process.env.PLAYWRIGHT_ACTION_TIMEOUT || 30000,
);

const DEFAULT_NETWORK_IDLE_TIMEOUT = Number(
  process.env.PLAYWRIGHT_NETWORK_IDLE_TIMEOUT || 10000,
);

const DEFAULT_PAGE_SETTLE_DELAY = Number(
  process.env.PLAYWRIGHT_PAGE_SETTLE_DELAY || 500,
);

const DEFAULT_ACTION_SETTLE_DELAY = Number(
  process.env.PLAYWRIGHT_ACTION_SETTLE_DELAY || 200,
);

const DEFAULT_TYPE_DELAY = Number(process.env.PLAYWRIGHT_TYPE_DELAY || 50);

const DEFAULT_SLOW_MO = Number(process.env.PLAYWRIGHT_SLOW_MO || 0);

const screenshotsDir = path.join(__dirname, "..", "screenshots");

if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, {
    recursive: true,
  });
}

/* -------------------------------------------------------------------------- */
/*                             Active run control                             */
/* -------------------------------------------------------------------------- */

const activeRuns = {};

function cancelRun(runId) {
  const controller = activeRuns[runId];

  if (!controller) {
    return false;
  }

  controller.abort();
  return true;
}

/* -------------------------------------------------------------------------- */
/*                            Selector utilities                              */
/* -------------------------------------------------------------------------- */

function normalizeSelector(raw) {
  if (!raw) return raw;

  // Already-normalized selector object
  if (typeof raw === "object") {
    return raw;
  }

  let s = String(raw).trim();

  // Remove surrounding quotes if they somehow remain
  if (
    (s.startsWith("'") && s.endsWith("'")) ||
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("`") && s.endsWith("`"))
  ) {
    s = s.slice(1, -1).trim();
  }

  // Playwright explicit XPath
  if (s.startsWith("xpath=")) {
    return {
      xpath: s.substring(6),
    };
  }

  // Raw absolute/relative XPath
  if (s.startsWith("/") || s.startsWith("//") || s.startsWith("(//")) {
    return {
      xpath: s,
    };
  }

  if (s.startsWith("data-testid=")) {
    return {
      testid: s.substring(13),
    };
  }

  if (s.startsWith("name=")) {
    return {
      name: s.substring(5),
    };
  }

  if (s.startsWith("id=")) {
    return {
      id: s.substring(3),
    };
  }

  if (s.startsWith("text=")) {
    return {
      text: s.substring(5),
    };
  }

  return {
    css: s,
  };
}

function resolveLocator(page, selector) {
  if (!selector) {
    throw new Error("Selector is null or undefined");
  }

  const s = normalizeSelector(selector);

  if (typeof s === "string") {
    return page.locator(s);
  }

  if (s.xpath) {
    return page.locator(`xpath=${s.xpath}`);
  }

  if (s.id) {
    return page.locator(`#${escapeCssIdentifier(s.id)}`);
  }

  if (s.name) {
    return page.locator(`[name="${escapeAttributeValue(s.name)}"]`);
  }

  if (s.testid) {
    return page.getByTestId(s.testid);
  }

  if (s.text) {
    return page.getByText(s.text);
  }

  if (s.css) {
    return page.locator(s.css);
  }

  throw new Error(`Cannot resolve selector: ${JSON.stringify(selector)}`);
}

function escapeCssIdentifier(value) {
  if (typeof CSS !== "undefined" && CSS.escape) {
    return CSS.escape(value);
  }

  return String(value).replace(
    /([ !"#$%&'()*+,./:;<=>?@[\\\]^`{|}~])/g,
    "\\$1",
  );
}

function escapeAttributeValue(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function parseSelectorArgument(arg) {
  const trimmed = String(arg || "").trim();

  if (!trimmed) {
    return null;
  }

  // Strip JS string quotes
  if (
    (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("`") && trimmed.endsWith("`"))
  ) {
    return trimmed.slice(1, -1);
  }

  // Support object selectors if ever stored that way
  try {
    return JSON.parse(trimmed);
  } catch {
    return trimmed;
  }
}

/* -------------------------------------------------------------------------- */
/*                               Script parser                                */
/* -------------------------------------------------------------------------- */

function parseTestScript(script = "") {
  const steps = [];

  const lines = String(script)
    .split("\n")
    .filter((line) => line.trim() && !line.trim().startsWith("//"));

  for (const line of lines) {
    const trimmed = line.trim();
    let match;

    if (
      (match = trimmed.match(
        /await page\.goto\(\s*['"`](.+?)['"`](?:\s*,[\s\S]*)?\)/,
      ))
    ) {
      steps.push({
        action: "navigate",
        value: match[1],
        raw: trimmed,
      });
    } else if (
      (match = trimmed.match(
        /await page\.click\((.+?)\s*(?:,\s*\{[\s\S]*\})?\);?$/,
      ))
    ) {
      steps.push({
        action: "click",
        selector: parseSelectorArgument(match[1]),
        raw: trimmed,
      });
    } else if (
      (match = trimmed.match(
        /await page\.fill\((.+?),\s*['"`]([\s\S]*?)['"`]\s*(?:,\s*\{[\s\S]*\})?\);?$/,
      ))
    ) {
      steps.push({
        action: "fill",
        selector: parseSelectorArgument(match[1]),
        value: match[2],
        raw: trimmed,
      });
    } else if (
      (match = trimmed.match(
        /await page\.type\((.+?),\s*['"`]([\s\S]*?)['"`]\s*(?:,\s*\{[\s\S]*\})?\);?$/,
      ))
    ) {
      steps.push({
        action: "type",
        selector: parseSelectorArgument(match[1]),
        value: match[2],
        raw: trimmed,
      });
    } else if (
      (match = trimmed.match(
        /await page\.selectOption\((.+?),\s*['"`]([\s\S]*?)['"`]\s*(?:,\s*\{[\s\S]*\})?\);?$/,
      ))
    ) {
      steps.push({
        action: "select",
        selector: parseSelectorArgument(match[1]),
        value: match[2],
        raw: trimmed,
      });
    } else if (
      (match = trimmed.match(
        /await page\.waitForSelector\((.+?)(?:,\s*\{[\s\S]*\})?\);?$/,
      ))
    ) {
      steps.push({
        action: "waitForSelector",
        selector: parseSelectorArgument(match[1]),
        raw: trimmed,
      });
    } else if ((match = trimmed.match(/await page\.waitForTimeout\((\d+)\)/))) {
      steps.push({
        action: "wait",
        value: match[1],
        raw: trimmed,
      });
    } else if (
      (match = trimmed.match(
        /await expect\(page\)\.toHaveTitle\(['"`](.+?)['"`]\)/,
      ))
    ) {
      steps.push({
        action: "assertTitle",
        value: match[1],
        raw: trimmed,
      });
    } else if (
      (match = trimmed.match(
        /await expect\(page\)\.toHaveURL\(['"`](.+?)['"`]\)/,
      ))
    ) {
      steps.push({
        action: "assertUrl",
        value: match[1],
        raw: trimmed,
      });
    } else if (trimmed.match(/await page\.screenshot\(/)) {
      steps.push({
        action: "screenshot",
        raw: trimmed,
      });
    } else {
      steps.push({
        action: "custom",
        raw: trimmed,
      });
    }
  }

  return steps;
}

function parsePlaywrightScriptSteps(script) {
  return parseTestScript(script);
}

/* -------------------------------------------------------------------------- */
/*                          Browser launch utilities                          */
/* -------------------------------------------------------------------------- */

function findBrowserExecutable() {
  const configuredPath = process.env.PLAYWRIGHT_BROWSER_PATH?.trim();

  if (configuredPath && fs.existsSync(configuredPath)) {
    return configuredPath;
  }

  const possibleBrowserPaths = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  ];

  return (
    possibleBrowserPaths.find((browserPath) => fs.existsSync(browserPath)) ||
    null
  );
}

async function launchBrowser() {
  const executablePath = findBrowserExecutable();

  const launchOptions = {
    headless: false,
    slowMo: DEFAULT_SLOW_MO,
    args: [
      "--start-maximized",
      "--disable-blink-features=AutomationControlled",
    ],
  };

  if (executablePath) {
    launchOptions.executablePath = executablePath;
  }

  try {
    return await chromium.launch(launchOptions);
  } catch (error) {
    if (error.message?.includes("Executable doesn't exist")) {
      throw new Error(
        "Playwright Chromium is not installed and no local Chrome or Edge browser could be launched. Run `npx playwright install chromium` in the Backend folder or configure PLAYWRIGHT_BROWSER_PATH.",
      );
    }

    throw error;
  }
}

async function createBrowserSession(runId) {
  const browser = await launchBrowser();

  const context = await browser.newContext({
    viewport: {
      width: 1280,
      height: 720,
    },
    ignoreHTTPSErrors: true,
  });

  context.setDefaultTimeout(DEFAULT_ACTION_TIMEOUT);

  context.setDefaultNavigationTimeout(DEFAULT_NAVIGATION_TIMEOUT);

  const page = await context.newPage();

  attachBrowserLogging(page, runId);

  const cdpClient = await startLiveScreencast(context, page, runId);

  return {
    browser,
    context,
    page,
    cdpClient,
  };
}

/* -------------------------------------------------------------------------- */
/*                                Page waits                                  */
/* -------------------------------------------------------------------------- */

async function waitForPageReady(page, options = {}) {
  const {
    navigationTimeout = DEFAULT_NAVIGATION_TIMEOUT,
    networkIdleTimeout = DEFAULT_NETWORK_IDLE_TIMEOUT,
    settleDelay = DEFAULT_PAGE_SETTLE_DELAY,
  } = options;

  await page.waitForLoadState("domcontentloaded", {
    timeout: navigationTimeout,
  });

  await page
    .waitForLoadState("load", {
      timeout: navigationTimeout,
    })
    .catch(() => {});

  await page.locator("body").waitFor({
    state: "visible",
    timeout: navigationTimeout,
  });

  /*
   * networkidle is not treated as mandatory.
   * Applications with polling or WebSockets may never become fully idle.
   */
  await page
    .waitForLoadState("networkidle", {
      timeout: networkIdleTimeout,
    })
    .catch(() => {});

  if (settleDelay > 0) {
    await page.waitForTimeout(settleDelay);
  }
}

async function waitForLocatorReady(page, selector, options = {}) {
  const { state = "visible", timeout = DEFAULT_ACTION_TIMEOUT } = options;

  const locator = resolveLocator(page, selector).first();

  await locator.waitFor({
    state,
    timeout,
  });

  return locator;
}

async function waitAfterAction(page, options = {}) {
  const {
    settleDelay = DEFAULT_ACTION_SETTLE_DELAY,
    networkIdleTimeout = 3000,
  } = options;

  await page
    .waitForLoadState("domcontentloaded", {
      timeout: 5000,
    })
    .catch(() => {});

  await page
    .waitForLoadState("networkidle", {
      timeout: networkIdleTimeout,
    })
    .catch(() => {});

  if (settleDelay > 0) {
    await page.waitForTimeout(settleDelay);
  }
}

async function clickAndWait(page, locator) {
  await Promise.all([
    page
      .waitForNavigation({
        waitUntil: "domcontentloaded",
        timeout: 10000,
      })
      .catch(() => null),

    locator.click({
      timeout: DEFAULT_ACTION_TIMEOUT,
    }),
  ]);

  await waitAfterAction(page);
}

/* -------------------------------------------------------------------------- */
/*                              Live screencast                               */
/* -------------------------------------------------------------------------- */

async function startLiveScreencast(context, page, runId) {
  try {
    const client = await context.newCDPSession(page);

    await client.send("Page.startScreencast", {
      format: "jpeg",
      quality: 60,
      everyNthFrame: 1,
    });

    client.on("Page.screencastFrame", async (event) => {
      try {
        broadcast({
          type: "live_frame",
          runId,
          frame: event.data,
        });

        await client.send("Page.screencastFrameAck", {
          sessionId: event.sessionId,
        });
      } catch {
        // Ignore screencast transmission errors.
      }
    });

    return client;
  } catch (error) {
    console.warn(
      `[Playwright run ${runId}] Unable to start live screencast:`,
      error.message,
    );

    return null;
  }
}

/* -------------------------------------------------------------------------- */
/*                            Browser diagnostics                             */
/* -------------------------------------------------------------------------- */

function attachBrowserLogging(page, runId) {
  page.on("console", (message) => {
    console.log(`[Browser run ${runId}] [${message.type()}] ${message.text()}`);
  });

  page.on("pageerror", (error) => {
    console.error(`[Browser run ${runId}] Page error:`, error.message);
  });

  page.on("requestfailed", (request) => {
    console.warn(
      `[Browser run ${runId}] Request failed:`,
      request.method(),
      request.url(),
      request.failure()?.errorText,
    );
  });

  page.on("dialog", async (dialog) => {
    console.warn(
      `[Browser run ${runId}] Dialog dismissed:`,
      dialog.type(),
      dialog.message(),
    );

    await dialog.dismiss().catch(() => {});
  });
}

/* -------------------------------------------------------------------------- */
/*                        Original single test runner                         */
/* -------------------------------------------------------------------------- */

async function runTestCase(testCaseId, userId = null) {
  const pool = await poolPromise;

  const testCaseResult = await pool.request().input("id", sql.Int, testCaseId)
    .query(`
      SELECT
        id,
        title,
        playwright_script
      FROM ${DATABASE_SCHEMA}.test_cases
      WHERE id = @id
    `);

  if (!testCaseResult.recordset.length) {
    throw new Error("Test case not found.");
  }

  const testCase = testCaseResult.recordset[0];

  if (
    !testCase.playwright_script ||
    !String(testCase.playwright_script).trim()
  ) {
    throw new Error("This test case does not have a Playwright script.");
  }

  const runResult = await pool
    .request()
    .input("test_case_id", sql.Int, testCaseId)
    .input("status", sql.VarChar, "running")
    .input("started_at", sql.DateTime, new Date())
    .input("created_by", sql.Int, userId).query(`
      INSERT INTO ${DATABASE_SCHEMA}.playwright_test_runs
        (
          test_case_id,
          status,
          started_at,
          created_by
        )
      OUTPUT INSERTED.id
      VALUES
        (
          @test_case_id,
          @status,
          @started_at,
          @created_by
        )
    `);

  const runId = runResult.recordset[0].id;

  const startedAtMs = Date.now();

  const abortController = new AbortController();

  activeRuns[runId] = abortController;

  const isAborted = () => abortController.signal.aborted;

  broadcast({
    type: "run_started",
    runId,
    testCaseId,
  });

  const steps = parseTestScript(testCase.playwright_script);

  let browser = null;
  let context = null;

  try {
    const session = await createBrowserSession(runId);

    browser = session.browser;
    context = session.context;

    const page = session.page;

    for (let stepIndex = 0; stepIndex < steps.length; stepIndex += 1) {
      if (isAborted()) {
        broadcast({
          type: "run_aborted",
          runId,
          stoppedAtStep: stepIndex + 1,
        });

        break;
      }

      const step = steps[stepIndex];
      const stepStartedAt = Date.now();

      const stepId = await createStepRunningRecord(
        pool,
        runId,
        stepIndex + 1,
        step,
      );

      broadcast({
        type: "step_started",
        runId,
        stepId,
        stepNum: stepIndex + 1,
        step,
        total: steps.length,
      });

      const screenshotInfo = getStepScreenshotInfo(runId, stepIndex + 1);

      try {
        await executeBasicStep(page, step);

        await captureScreenshot(page, screenshotInfo.absolutePath);

        const duration = Date.now() - stepStartedAt;

        await updateExistingStepRecord(
          pool,
          stepId,
          "passed",
          duration,
          screenshotInfo.publicPath,
        );

        broadcast({
          type: "step_completed",
          runId,
          stepId,
          stepNum: stepIndex + 1,
          status: "passed",
          duration_ms: duration,
          screenshotPath: screenshotInfo.publicPath,
        });
      } catch (error) {
        await captureScreenshot(page, screenshotInfo.absolutePath);

        const duration = Date.now() - stepStartedAt;

        await updateExistingStepRecord(
          pool,
          stepId,
          "failed",
          duration,
          screenshotInfo.publicPath,
          error.message,
        );

        broadcast({
          type: "step_failed",
          runId,
          stepId,
          stepNum: stepIndex + 1,
          status: "failed",
          duration_ms: duration,
          error: error.message,
          screenshotPath: screenshotInfo.publicPath,
        });

        throw error;
      }
    }

    const finalStatus = isAborted() ? "aborted" : "passed";

    const duration = Date.now() - startedAtMs;

    await updateRunRecord(pool, runId, finalStatus, duration);

    broadcast({
      type: "run_completed",
      runId,
      status: finalStatus,
      duration,
    });
  } catch (error) {
    const duration = Date.now() - startedAtMs;

    await updateRunRecord(pool, runId, "failed", duration, error.message);

    broadcast({
      type: "run_completed",
      runId,
      status: "failed",
      error: error.message,
      duration,
    });
  } finally {
    delete activeRuns[runId];

    if (context) {
      await context.close().catch(() => {});
    }

    if (browser) {
      await browser.close().catch(() => {});
    }
  }

  return runId;
}

/* -------------------------------------------------------------------------- */
/*                         Enhanced data-driven runner                        */
/* -------------------------------------------------------------------------- */

async function runEnhancedTestCase(testCaseId, options = {}) {
  const pool = await poolPromise;

  const testCaseResult = await pool.request().input("id", sql.Int, testCaseId)
    .query(`
      SELECT
        id,
        title,
        playwright_script,
        test_type
      FROM ${DATABASE_SCHEMA}.test_cases
      WHERE id = @id
    `);

  if (!testCaseResult.recordset.length) {
    throw new Error("Test case not found.");
  }

  const testCase = testCaseResult.recordset[0];

  if (
    !testCase.playwright_script ||
    !String(testCase.playwright_script).trim()
  ) {
    throw new Error("This test case does not have a Playwright script.");
  }

  const dataPoints = await resolveDataPoints(pool, options.dataSourceId);

  const runIds = [];

  for (let dataIndex = 0; dataIndex < dataPoints.length; dataIndex += 1) {
    const dataPoint = dataPoints[dataIndex];

    const runId = await createEnhancedRunRecord(
      pool,
      testCaseId,
      options.userId,
      dataIndex,
    );

    runIds.push(runId);

    const abortController = new AbortController();

    activeRuns[runId] = abortController;

    const isAborted = () => abortController.signal.aborted;

    const variableEngine = new VariableEngine();

    variableEngine.setVariables(dataPoint);

    broadcast({
      type: "run_started",
      runId,
      testCaseId,
      dataIndex,
      totalIterations: dataPoints.length,
    });

    const runStartedAt = Date.now();

    let browser = null;
    let context = null;
    let locatorRecoveries = 0;
    let runFailed = false;
    let lastError = null;

    try {
      let processedScript = testCase.playwright_script;

      if (options.parameterMappings?.length) {
        processedScript = dataEngineService.substituteVariables(
          processedScript,
          dataPoint,
          options.parameterMappings,
        );
      }

      processedScript = dataEngineService.substituteNestedVariables(
        processedScript,
        dataPoint,
      );

      const isKeywordTest =
        String(testCase.test_type || "").toUpperCase() === "KEYWORD";

      const steps = isKeywordTest
        ? keywordEngine.parseKeywordScript(processedScript)
        : parsePlaywrightScriptSteps(processedScript);

      if (!steps.length) {
        throw new Error("No executable steps were found in the script.");
      }

      const session = await createBrowserSession(runId);

      browser = session.browser;
      context = session.context;

      const page = session.page;

      for (let stepIndex = 0; stepIndex < steps.length; stepIndex += 1) {
        if (isAborted()) {
          broadcast({
            type: "run_aborted",
            runId,
            stoppedAtStep: stepIndex + 1,
          });

          break;
        }

        const step = steps[stepIndex];

        const stepStartedAt = Date.now();

        broadcast({
          type: "step_started",
          runId,
          stepNum: stepIndex + 1,
          step,
          total: steps.length,
        });

        if (
          step.condition &&
          !conditionalExecutor.evaluateCondition(
            step.condition,
            variableEngine.getVariables(),
          )
        ) {
          await recordEnhancedStepResult(
            pool,
            runId,
            stepIndex + 1,
            step,
            "skipped",
            Date.now() - stepStartedAt,
            {
              reason: "Condition evaluated to false.",
            },
          );

          continue;
        }

        try {
          const result = await executeStep(page, step, {
            testCaseId,
            variableEngine,

            onLocatorHealed: () => {
              locatorRecoveries += 1;
            },
          });

          await recordEnhancedStepResult(
            pool,
            runId,
            stepIndex + 1,
            step,
            "passed",
            Date.now() - stepStartedAt,
            result || {},
          );
        } catch (error) {
          runFailed = true;
          lastError = error;

          const screenshotInfo = getFailureScreenshotInfo(runId, stepIndex + 1);

          await captureScreenshot(page, screenshotInfo.absolutePath);

          await recordEnhancedStepResult(
            pool,
            runId,
            stepIndex + 1,
            step,
            "failed",
            Date.now() - stepStartedAt,
            {
              error: error.message,
              screenshotPath: screenshotInfo.publicPath,
            },
          );

          if (!options.continueOnFailure) {
            throw error;
          }
        }
      }

      const finalStatus = isAborted()
        ? "aborted"
        : runFailed
          ? "failed"
          : "passed";

      const duration = Date.now() - runStartedAt;

      await finalizeEnhancedRun(
        pool,
        runId,
        finalStatus,
        locatorRecoveries,
        lastError?.message || null,
        duration,
      );

      broadcast({
        type: "run_completed",
        runId,
        status: finalStatus,
        error: lastError?.message || null,
        duration,
      });
    } catch (error) {
      lastError = error;

      const duration = Date.now() - runStartedAt;

      await finalizeEnhancedRun(
        pool,
        runId,
        "failed",
        locatorRecoveries,
        error.message,
        duration,
      );

      broadcast({
        type: "run_completed",
        runId,
        status: "failed",
        error: error.message,
        duration,
      });

      if (!options.continueOnFailure) {
        throw error;
      }
    } finally {
      delete activeRuns[runId];

      if (context) {
        await context.close().catch(() => {});
      }

      if (browser) {
        await browser.close().catch(() => {});
      }
    }
  }

  await testMaintenanceEngine
    .versionScript(
      testCaseId,
      testCase.playwright_script,
      "Enhanced run executed",
      options.userId,
    )
    .catch((error) => {
      console.warn(
        "[enhancedPlaywrightRunner] Unable to save test version:",
        error.message,
      );
    });

  return runIds;
}

/* -------------------------------------------------------------------------- */
/*                           Basic step execution                             */
/* -------------------------------------------------------------------------- */

async function executeBasicStep(page, step) {
  switch (step.action) {
    case "navigate": {
      if (!step.value) {
        throw new Error("Navigation URL is missing.");
      }

      await page.goto(step.value, {
        waitUntil: "domcontentloaded",
        timeout: DEFAULT_NAVIGATION_TIMEOUT,
      });

      await waitForPageReady(page);

      return;
    }

    case "click": {
      const locator = await waitForLocatorReady(page, step.selector);

      await locator.scrollIntoViewIfNeeded();
      await clickAndWait(page, locator);
      return;
    }

    case "fill": {
      const locator = await waitForLocatorReady(page, step.selector);

      await locator.scrollIntoViewIfNeeded();

      await locator.fill(step.value || "", {
        timeout: DEFAULT_ACTION_TIMEOUT,
      });

      await waitAfterAction(page);
      return;
    }

    case "type": {
      const locator = await waitForLocatorReady(page, step.selector);

      await locator.scrollIntoViewIfNeeded();

      await locator.pressSequentially(step.value || "", {
        delay: Number(step.delay) || DEFAULT_TYPE_DELAY,
      });

      await waitAfterAction(page);
      return;
    }

    case "select": {
      const locator = await waitForLocatorReady(page, step.selector);

      await locator.scrollIntoViewIfNeeded();

      await locator.selectOption(step.value || "", {
        timeout: DEFAULT_ACTION_TIMEOUT,
      });

      await waitAfterAction(page);
      return;
    }

    case "waitForSelector": {
      await waitForLocatorReady(page, step.selector, {
        state: "visible",
        timeout: Number(step.timeout) || DEFAULT_ACTION_TIMEOUT,
      });

      return;
    }

    case "wait": {
      /*
       * Keep the original explicit wait timing.
       */
      await page.waitForTimeout(parseInt(step.value, 10) || 1000);

      return;
    }

    case "assertTitle": {
      const title = await page.title();

      if (title !== step.value) {
        throw new Error(`Expected title "${step.value}" but got "${title}".`);
      }

      return;
    }

    case "assertUrl": {
      const currentUrl = page.url();

      if (currentUrl !== step.value) {
        throw new Error(
          `Expected URL "${step.value}" but got "${currentUrl}".`,
        );
      }

      return;
    }

    case "screenshot":
      return;

    case "custom":
    default:
      console.warn("[Playwright runner] Unsupported script line:", step.raw);
  }
}

/* -------------------------------------------------------------------------- */
/*                         Enhanced step execution                            */
/* -------------------------------------------------------------------------- */

async function executeStep(page, rawStep, context) {
  const { testCaseId, variableEngine, onLocatorHealed } = context;

  const variables = variableEngine.getVariables();

  const step = JSON.parse(
    JSON.stringify(rawStep, (_key, value) =>
      typeof value === "string"
        ? variableEngine.substituteVariables(value, variables)
        : value,
    ),
  );

  const action = step.action || step.keyword;

  switch (action) {
    case "navigate": {
      if (!step.value) {
        throw new Error("Navigation URL is missing.");
      }

      await page.goto(step.value, {
        waitUntil: "domcontentloaded",
        timeout: DEFAULT_NAVIGATION_TIMEOUT,
      });

      await waitForPageReady(page);

      return {
        url: page.url(),
      };
    }

    case "waitForSelector": {
      await waitForLocatorReady(page, step.selector, {
        state: "visible",
        timeout: Number(step.timeout) || DEFAULT_ACTION_TIMEOUT,
      });

      return {
        selectorUsed: step.selector,
      };
    }

    case "click":
    case "fill":
    case "type":
    case "select":
      return executeEnhancedLocatorAction(page, step, {
        testCaseId,
        onLocatorHealed,
      });

    case "wait": {
      const waitDuration = parseInt(step.value, 10) || 1000;

      await page.waitForTimeout(waitDuration);

      return {
        waitedMilliseconds: waitDuration,
      };
    }

    case "assertTitle": {
      const actualTitle = await page.title();

      if (actualTitle !== step.value) {
        throw new Error(
          `Expected title "${step.value}" but got "${actualTitle}".`,
        );
      }

      return {
        expectedTitle: step.value,
        actualTitle,
      };
    }

    case "assertUrl": {
      const actualUrl = page.url();

      if (actualUrl !== step.value) {
        throw new Error(`Expected URL "${step.value}" but got "${actualUrl}".`);
      }

      return {
        expectedUrl: step.value,
        actualUrl,
      };
    }

    case "screenshot":
      return;

    case "api_request": {
      const apiResult = await apiTestingEngine.executeRequest(
        step.apiEndpoint,
        variables,
      );

      if (!apiResult.success) {
        throw new Error(
          apiResult.error ||
            `API request failed with status ${apiResult.statusCode}.`,
        );
      }

      if (step.extractRules) {
        const extracted = apiTestingEngine.extractFromResponse(
          apiResult.body,
          step.extractRules,
        );

        variableEngine.setVariables(extracted);
      }

      if (step.assertions) {
        const validations = apiTestingEngine.validateResponse(
          apiResult,
          step.assertions,
        );

        const failed = validations.find((validation) => !validation.passed);

        if (failed) {
          throw new Error(`API assertion failed: ${failed.assertion}`);
        }
      }

      return apiResult;
    }

    case "conditional_block": {
      await conditionalExecutor.executeBlockTree(step.blocks, variables, {
        executeStep: (nestedStep, nestedVariables) => {
          variableEngine.setVariables(nestedVariables);

          return executeStep(page, nestedStep, context);
        },
      });

      return;
    }

    case "custom":
      console.warn("[Enhanced runner] Unsupported custom line:", step.raw);

      return {
        skipped: true,
        reason: "Unsupported custom script line.",
      };

    default: {
      if (step.keyword) {
        const result = await keywordEngine.executeKeyword(page, step);

        await waitAfterAction(page);

        return result;
      }

      console.warn(`[Enhanced runner] Unknown action: ${action}`);

      return {
        skipped: true,
        reason: `Unknown action: ${action}`,
      };
    }
  }
}

/* -------------------------------------------------------------------------- */
/*                      Enhanced locator/self-healing                        */
/* -------------------------------------------------------------------------- */

async function executeEnhancedLocatorAction(page, step, context) {
  const { testCaseId, onLocatorHealed } = context;

  if (!step.selector) {
    throw new Error(`Selector is missing for action "${step.action}".`);
  }

  let locator = null;
  let locatorUsed = step.selector;
  let usedFallback = false;

  /*
   * First allow the original selector to use normal Playwright waiting.
   * Self-healing only runs after the normal selector has timed out.
   */
  try {
    locator = await waitForLocatorReady(page, step.selector, {
      state: "visible",
      timeout: Number(step.timeout) || DEFAULT_ACTION_TIMEOUT,
    });
  } catch (primaryError) {
    const alternatives = await selfHealingEngine.generateAlternativeLocators(
      step.elementInfo || {},
    );

    const healingResult = await findElementWithFallback(
      page,
      step.selector,
      alternatives,
    );

    if (!healingResult.found) {
      throw new Error(
        `Element not found after waiting and self-healing: ${JSON.stringify(
          step.selector,
        )}. Original error: ${primaryError.message}`,
      );
    }

    locatorUsed = healingResult.selector;

    usedFallback = healingResult.usedFallback;

    locator = resolveLocator(page, locatorUsed).first();

    await locator.waitFor({
      state: "visible",
      timeout: DEFAULT_ACTION_TIMEOUT,
    });

    if (usedFallback) {
      onLocatorHealed();

      await testMaintenanceEngine
        .trackLocatorChange(
          testCaseId,
          JSON.stringify(step.selector),
          String(locatorUsed),
          "SELF_HEALED",
        )
        .catch((error) => {
          console.warn(
            "[Enhanced runner] Unable to record healed locator:",
            error.message,
          );
        });
    }
  }

  await locator.scrollIntoViewIfNeeded();

  switch (step.action) {
    case "click":
      await clickAndWait(page, locator);
      break;

    case "fill":
      await locator.fill(step.value || "", {
        timeout: DEFAULT_ACTION_TIMEOUT,
      });

      await waitAfterAction(page);
      break;

    case "type":
      await locator.pressSequentially(step.value || "", {
        delay: Number(step.delay) || DEFAULT_TYPE_DELAY,
      });

      await waitAfterAction(page);
      break;

    case "select":
      await locator.selectOption(step.value || "", {
        timeout: DEFAULT_ACTION_TIMEOUT,
      });

      await waitAfterAction(page);
      break;

    default:
      throw new Error(`Unsupported locator action: ${step.action}`);
  }

  return {
    selectorUsed: locatorUsed,
    usedFallback,
  };
}

async function findElementWithFallback(
  page,
  primarySelector,
  alternatives = [],
) {
  const candidates = [
    primarySelector,

    ...alternatives.map((alternative) => alternative.selector),
  ].filter(Boolean);

  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index];

    try {
      const locator = resolveLocator(page, candidate).first();

      await locator.waitFor({
        state: "visible",
        timeout: 5000,
      });

      return {
        found: true,
        selector: candidate,
        attemptNumber: index + 1,
        usedFallback: index > 0,
        confidence: Math.max(0, 1 - index / candidates.length),
      };
    } catch {
      // Continue to the next locator candidate.
    }
  }

  return {
    found: false,
    attemptedSelectors: candidates,
    confidence: 0,
  };
}

/* -------------------------------------------------------------------------- */
/*                              Data loading                                  */
/* -------------------------------------------------------------------------- */

async function resolveDataPoints(pool, dataSourceId) {
  if (!dataSourceId) {
    return [{}];
  }

  const sourceResult = await pool.request().input("id", sql.Int, dataSourceId)
    .query(`
      SELECT *
      FROM ${DATABASE_SCHEMA}.test_data_sources
      WHERE id = @id
    `);

  const dataSource = sourceResult.recordset[0];

  if (!dataSource) {
    throw new Error(`Data source ${dataSourceId} was not found.`);
  }

  let sourceOptions = {};

  if (dataSource.options) {
    try {
      sourceOptions =
        typeof dataSource.options === "string"
          ? JSON.parse(dataSource.options)
          : dataSource.options;
    } catch {
      sourceOptions = {};
    }
  }

  const dataPoints = await dataEngineService.loadTestData(
    dataSource.data_source_type,
    dataSource.source_path,
    sourceOptions,
  );

  if (!Array.isArray(dataPoints) || dataPoints.length === 0) {
    throw new Error("The selected data source does not contain any test rows.");
  }

  return dataPoints;
}

/* -------------------------------------------------------------------------- */
/*                             Screenshot helpers                             */
/* -------------------------------------------------------------------------- */

function getStepScreenshotInfo(runId, stepNumber) {
  const filename = `${runId}_step${stepNumber}.png`;

  return {
    filename,
    absolutePath: path.join(screenshotsDir, filename),
    publicPath: `/screenshots/${filename}`,
  };
}

function getFailureScreenshotInfo(runId, stepNumber) {
  const filename = `${runId}_step${stepNumber}_failed.png`;

  return {
    filename,
    absolutePath: path.join(screenshotsDir, filename),
    publicPath: `/screenshots/${filename}`,
  };
}

async function captureScreenshot(page, screenshotPath) {
  if (!page) {
    return false;
  }

  try {
    await page.screenshot({
      path: screenshotPath,
      fullPage: false,
    });

    return true;
  } catch {
    return false;
  }
}

/* -------------------------------------------------------------------------- */
/*                             Database helpers                               */
/* -------------------------------------------------------------------------- */

async function createStepRunningRecord(pool, runId, stepNumber, step) {
  const result = await pool
    .request()
    .input("run_id", sql.Int, runId)
    .input("step_number", sql.Int, stepNumber)
    .input("action", sql.VarChar, step.action || step.keyword || "custom")
    .input(
      "selector",
      sql.NVarChar(sql.MAX),
      step.selector == null ? null : JSON.stringify(step.selector),
    )
    .input("value", sql.NVarChar(sql.MAX), step.value || null)
    .input("status", sql.VarChar, "running").query(`
      INSERT INTO ${DATABASE_SCHEMA}.playwright_test_run_steps
        (
          run_id,
          step_number,
          action,
          selector,
          value,
          status
        )
      OUTPUT INSERTED.id
      VALUES
        (
          @run_id,
          @step_number,
          @action,
          @selector,
          @value,
          @status
        )
    `);

  return result.recordset[0].id;
}

async function updateExistingStepRecord(
  pool,
  stepId,
  status,
  duration,
  screenshotPath,
  errorMessage = null,
) {
  await pool
    .request()
    .input("id", sql.Int, stepId)
    .input("status", sql.VarChar, status)
    .input("duration_ms", sql.Int, duration)
    .input("error_message", sql.NVarChar(sql.MAX), errorMessage)
    .input("screenshot_path", sql.NVarChar(sql.MAX), screenshotPath).query(`
      UPDATE ${DATABASE_SCHEMA}.playwright_test_run_steps
      SET
        status = @status,
        duration_ms = @duration_ms,
        error_message = @error_message,
        screenshot_path = @screenshot_path
      WHERE id = @id
    `);
}

async function createEnhancedRunRecord(pool, testCaseId, userId, dataIndex) {
  const result = await pool
    .request()
    .input("test_case_id", sql.Int, testCaseId)
    .input("status", sql.VarChar, "running")
    .input("started_at", sql.DateTime, new Date())
    .input("created_by", sql.Int, userId || null)
    .input("data_index", sql.Int, dataIndex).query(`
      INSERT INTO ${DATABASE_SCHEMA}.playwright_test_runs
        (
          test_case_id,
          status,
          started_at,
          created_by,
          data_index
        )
      OUTPUT INSERTED.id
      VALUES
        (
          @test_case_id,
          @status,
          @started_at,
          @created_by,
          @data_index
        )
    `);

  return result.recordset[0].id;
}

async function recordEnhancedStepResult(
  pool,
  runId,
  stepNumber,
  step,
  status,
  duration,
  extra = {},
) {
  await pool
    .request()
    .input("run_id", sql.Int, runId)
    .input("step_number", sql.Int, stepNumber)
    .input("action", sql.VarChar, step.action || step.keyword || "custom")
    .input(
      "selector",
      sql.NVarChar(sql.MAX),
      step.selector ? JSON.stringify(step.selector) : null,
    )
    .input("value", sql.NVarChar(sql.MAX), step.value || null)
    .input("status", sql.VarChar, status)
    .input("duration_ms", sql.Int, duration)
    .input(
      "error_message",
      sql.NVarChar(sql.MAX),
      extra.error || extra.reason || null,
    )
    .input(
      "screenshot_path",
      sql.NVarChar(sql.MAX),
      extra.screenshotPath || null,
    ).query(`
      INSERT INTO ${DATABASE_SCHEMA}.playwright_test_run_steps
        (
          run_id,
          step_number,
          action,
          selector,
          value,
          status,
          duration_ms,
          error_message,
          screenshot_path
        )
      VALUES
        (
          @run_id,
          @step_number,
          @action,
          @selector,
          @value,
          @status,
          @duration_ms,
          @error_message,
          @screenshot_path
        )
    `);

  broadcast({
    type:
      status === "passed"
        ? "step_completed"
        : status === "skipped"
          ? "step_skipped"
          : "step_failed",

    runId,
    stepNum: stepNumber,
    status,
    duration_ms: duration,
    error: extra.error,
    reason: extra.reason,
    screenshotPath: extra.screenshotPath,
  });
}

async function updateRunRecord(
  pool,
  runId,
  status,
  duration,
  errorMessage = null,
) {
  await pool
    .request()
    .input("id", sql.Int, runId)
    .input("status", sql.VarChar, status)
    .input("completed_at", sql.DateTime, new Date())
    .input("duration_ms", sql.Int, duration)
    .input("error_message", sql.NVarChar(sql.MAX), errorMessage).query(`
      UPDATE ${DATABASE_SCHEMA}.playwright_test_runs
      SET
        status = @status,
        completed_at = @completed_at,
        duration_ms = @duration_ms,
        error_message = @error_message
      WHERE id = @id
    `);
}

async function finalizeEnhancedRun(
  pool,
  runId,
  status,
  locatorRecoveries,
  errorMessage = null,
  duration = null,
) {
  await pool
    .request()
    .input("id", sql.Int, runId)
    .input("status", sql.VarChar, status)
    .input("completed_at", sql.DateTime, new Date())
    .input("locator_recoveries", sql.Int, locatorRecoveries)
    .input("error_message", sql.NVarChar(sql.MAX), errorMessage)
    .input("duration_ms", sql.Int, duration).query(`
      UPDATE ${DATABASE_SCHEMA}.playwright_test_runs
      SET
        status = @status,
        completed_at = @completed_at,
        locator_recoveries = @locator_recoveries,
        error_message = @error_message,
        duration_ms = @duration_ms
      WHERE id = @id
    `);
}

/* -------------------------------------------------------------------------- */
/*                                  Exports                                   */
/* -------------------------------------------------------------------------- */

module.exports = {
  runTestCase,
  runEnhancedTestCase,
  executeStep,
  cancelRun,
  parseTestScript,
  parsePlaywrightScriptSteps,
  normalizeSelector,
  resolveLocator,
  waitForPageReady,
  waitForLocatorReady,
};
