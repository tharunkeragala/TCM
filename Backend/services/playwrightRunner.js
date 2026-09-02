const { chromium } = require("playwright");
const { poolPromise, sql } = require("../config/db");
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
/* Configuration                                                              */
/* -------------------------------------------------------------------------- */

const DEFAULT_NAVIGATION_TIMEOUT = Number(
  process.env.PLAYWRIGHT_NAVIGATION_TIMEOUT || 5000,
);

const DEFAULT_ACTION_TIMEOUT = Number(
  process.env.PLAYWRIGHT_ACTION_TIMEOUT || 300,
);

const DEFAULT_NETWORK_IDLE_TIMEOUT = Number(
  process.env.PLAYWRIGHT_NETWORK_IDLE_TIMEOUT || 100,
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
/* Active run control                                                         */
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
/* Selector utilities                                                         */
/* -------------------------------------------------------------------------- */

function normalizeSelector(raw) {
  if (!raw) {
    return raw;
  }

  if (typeof raw === "object") {
    return raw;
  }

  let selector = String(raw).trim();

  if (
    (selector.startsWith("'") && selector.endsWith("'")) ||
    (selector.startsWith('"') && selector.endsWith('"')) ||
    (selector.startsWith("`") && selector.endsWith("`"))
  ) {
    selector = selector.slice(1, -1).trim();
  }

  if (selector.startsWith("xpath=")) {
    return {
      xpath: selector.substring(6),
    };
  }

  if (
    selector.startsWith("/") ||
    selector.startsWith("//") ||
    selector.startsWith("(//")
  ) {
    return {
      xpath: selector,
    };
  }

  if (selector.startsWith("data-testid=")) {
    return {
      testid: selector.substring(13),
    };
  }

  if (selector.startsWith("name=")) {
    return {
      name: selector.substring(5),
    };
  }

  if (selector.startsWith("id=")) {
    return {
      id: selector.substring(3),
    };
  }

  if (selector.startsWith("text=")) {
    return {
      text: selector.substring(5),
    };
  }

  return {
    css: selector,
  };
}

function resolveLocator(page, selector) {
  if (!selector) {
    throw new Error("Selector is null or undefined");
  }

  const normalized = normalizeSelector(selector);

  if (typeof normalized === "string") {
    return page.locator(normalized);
  }

  if (normalized.xpath) {
    return page.locator(`xpath=${normalized.xpath}`);
  }

  if (normalized.id) {
    return page.locator(`#${escapeCssIdentifier(normalized.id)}`);
  }

  if (normalized.name) {
    return page.locator(`[name="${escapeAttributeValue(normalized.name)}"]`);
  }

  if (normalized.testid) {
    return page.getByTestId(normalized.testid);
  }

  if (normalized.text) {
    return page.getByText(normalized.text);
  }

  if (normalized.css) {
    return page.locator(normalized.css);
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

  if (
    (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("`") && trimmed.endsWith("`"))
  ) {
    return trimmed.slice(1, -1);
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return trimmed;
  }
}

/* -------------------------------------------------------------------------- */
/* Script parser                                                              */
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
/* Browser launch utilities                                                   */
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
/* Page waits                                                                 */
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
  const {
    state = "visible",

    timeout = DEFAULT_ACTION_TIMEOUT,
  } = options;

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

        timeout: 3000,
      })
      .catch(() => null),

    locator.click({
      timeout: DEFAULT_ACTION_TIMEOUT,
    }),
  ]);

  await waitAfterAction(page);
}

/* -------------------------------------------------------------------------- */
/* Live screencast                                                            */
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
/* Browser diagnostics                                                        */
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
/* Original single test runner                                                */
/* -------------------------------------------------------------------------- */

async function runTestCase(testCaseId, userId = null) {
  const pool = await poolPromise;

  const testCaseResult = await pool.request().input("id", sql.Int, testCaseId)
    .query(`
        SELECT
          id,
          title,
          playwright_script
        FROM dbo.test_cases
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
        INSERT INTO dbo.playwright_test_runs
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
/* Enhanced data-driven runner                                                */
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
        FROM dbo.test_cases
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

  /*
   * UPDATED:
   *
   * testCaseId is supplied so we can
   * verify the selected dataset belongs
   * to this test case.
   */
  const dataPoints = await resolveDataPoints(
    pool,
    testCaseId,
    options.dataSourceId,
  );

  /*
   * Mapping rows should normally already
   * be loaded by the controller from the
   * selected mappingSetId.
   */
  const parameterMappings = Array.isArray(options.parameterMappings)
    ? options.parameterMappings
    : [];

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

      /*
       * Mapping-set substitution.
       *
       * Example mapping set:
       *
       * Login Data Mapping
       *
       * {{username}} -> username
       * {{password}} -> password
       *
       * Both rows are applied together
       * for each data iteration.
       */
      if (parameterMappings.length > 0) {
        processedScript = dataEngineService.substituteVariables(
          processedScript,
          dataPoint,
          parameterMappings,
        );
      }

      /*
       * Keep automatic nested variable
       * substitution for scripts using
       * {{customer.name}} directly.
       */
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
        "Unable to save test version:",
        error.message,
      );
    });

  return runIds;
}

/* -------------------------------------------------------------------------- */
/* Basic step execution                                                       */
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
      console.warn(
        "[Playwright runner] Unsupported script line:",

        step.raw,
      );
  }
}

/* -------------------------------------------------------------------------- */
/* Enhanced step execution                                                    */
/* -------------------------------------------------------------------------- */

async function executeStep(page, rawStep, context) {
  const { testCaseId, variableEngine, onLocatorHealed } = context;

  const variables = variableEngine.getVariables();

  const step = JSON.parse(
    JSON.stringify(
      rawStep,

      (_key, value) =>
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

    case "custom": {
      console.warn(
        "[Enhanced runner] Unsupported custom line:",

        step.raw,
      );

      return {
        skipped: true,

        reason: "Unsupported custom script line.",
      };
    }

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
/* Enhanced locator / self healing                                            */
/* -------------------------------------------------------------------------- */

async function executeEnhancedLocatorAction(page, step, context) {
  const { testCaseId, onLocatorHealed } = context;

  if (!step.selector) {
    throw new Error(`Selector is missing for action "${step.action}".`);
  }

  let locator = null;

  let locatorUsed = step.selector;

  let usedFallback = false;

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
      // Continue.
    }
  }

  return {
    found: false,

    attemptedSelectors: candidates,

    confidence: 0,
  };
}

/* -------------------------------------------------------------------------- */
/* Data loading                                                               */
/* -------------------------------------------------------------------------- */

/**
 * IMPORTANT:
 *
 * Uploaded CSV/XLSX/JSON rows are already stored in:
 *
 *   dbo.test_data_rows
 *
 * We therefore do NOT reopen source_path during execution.
 *
 * This makes saved datasets reusable even if:
 *   - the original upload file no longer exists
 *   - the backend restarted
 *   - the original path was temporary
 *
 * The selected dataset is also verified against test_case_id.
 */
async function resolveDataPoints(pool, testCaseId, dataSourceId) {
  /*
   * No selected data source means one
   * standard execution with empty data.
   */
  if (!dataSourceId) {
    return [{}];
  }

  const numericSourceId = Number(dataSourceId);

  const numericTestCaseId = Number(testCaseId);

  if (!numericSourceId || numericSourceId <= 0) {
    throw new Error("Invalid data source ID.");
  }

  if (!numericTestCaseId || numericTestCaseId <= 0) {
    throw new Error("Invalid test case ID.");
  }

  /* ---------------------------------------------------------------------- */
  /* Verify selected data source                                            */
  /* ---------------------------------------------------------------------- */

  const sourceResult = await pool
    .request()
    .input("dataSourceId", sql.Int, numericSourceId).query(`
        SELECT
          id,
          test_case_id,
          data_source_type,
          source_path
        FROM dbo.test_data_sources
        WHERE id = @dataSourceId
      `);

  if (!sourceResult.recordset.length) {
    throw new Error(`Data source ${numericSourceId} was not found.`);
  }

  const dataSource = sourceResult.recordset[0];

  /* ---------------------------------------------------------------------- */
  /* Verify ownership                                                       */
  /* ---------------------------------------------------------------------- */

  if (Number(dataSource.test_case_id) !== numericTestCaseId) {
    throw new Error(
      `Data source ${numericSourceId} does not belong to test case ${numericTestCaseId}.`,
    );
  }

  /* ---------------------------------------------------------------------- */
  /* Load all persisted data rows                                           */
  /* ---------------------------------------------------------------------- */

  const rowsResult = await pool
    .request()
    .input("dataSourceId", sql.Int, numericSourceId).query(`
        SELECT
          id,
          row_number,
          data
        FROM dbo.test_data_rows
        WHERE data_source_id = @dataSourceId
        ORDER BY row_number ASC, id ASC
      `);

  if (!rowsResult.recordset.length) {
    throw new Error(
      `Data source ${numericSourceId} does not contain any saved test rows.`,
    );
  }

  const dataPoints = [];

  const invalidRows = [];

  for (const row of rowsResult.recordset) {
    try {
      const parsed =
        typeof row.data === "string" ? JSON.parse(row.data) : row.data;

      /*
       * Data-driven rows need to be
       * normal objects.
       */
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        invalidRows.push(row.row_number);

        continue;
      }

      dataPoints.push(parsed);
    } catch (error) {
      invalidRows.push(row.row_number);

      console.warn(
        `Invalid JSON in data source ${numericSourceId}, row ${row.row_number}:`,
        error.message,
      );
    }
  }

  if (dataPoints.length === 0) {
    throw new Error(
      `Data source ${numericSourceId} contains no valid test-data rows.`,
    );
  }

  if (invalidRows.length > 0) {
    console.warn(
      `Data source ${numericSourceId} contains ${invalidRows.length} invalid row(s): ${invalidRows.join(
        ", ",
      )}`,
    );
  }

  console.log(
    `Loaded ${dataPoints.length} data row(s) from source ${numericSourceId} for test case ${numericTestCaseId}.`,
  );

  return dataPoints;
}

/* -------------------------------------------------------------------------- */
/* Screenshot helpers                                                         */
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
/* Database helpers                                                           */
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
    .input(
      "value",
      sql.NVarChar(sql.MAX),

      step.value || null,
    )
    .input("status", sql.VarChar, "running").query(`
        INSERT INTO dbo.playwright_test_run_steps
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
      UPDATE dbo.playwright_test_run_steps
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
        INSERT INTO dbo.playwright_test_runs
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
    .input(
      "value",
      sql.NVarChar(sql.MAX),

      step.value || null,
    )
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
      INSERT INTO dbo.playwright_test_run_steps
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
      UPDATE dbo.playwright_test_runs
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
      UPDATE dbo.playwright_test_runs
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
/* Exports                                                                    */
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

  /*
   * Exported mainly for debugging/testing
   * data-driven execution.
   */
  resolveDataPoints,
};
