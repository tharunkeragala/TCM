/**
 * keywordEngine.js
 * Place at: server/services/keywordEngine.js
 *
 * Tab-separated keyword scripts (Keyword | Locator | Value) -> Playwright actions,
 * or convert them straight into runnable Playwright TypeScript source.
 *
 * Depends on `resolveLocator` from your existing playwrightRunner.js —
 * this file assumes playwrightRunner.js lives next to it in server/services/.
 * Adjust the require path below if your existing file lives elsewhere.
 */

const { resolveLocator } = require("./playwrightRunner");

class KeywordEngine {
  constructor() {
    this.builtInKeywords = {
      Navigate: { type: "NAVIGATION", execute: async (page, p) => page.goto(p.url ?? p.value, { waitUntil: "domcontentloaded" }) },
      GoBack: { type: "NAVIGATION", execute: async (page) => page.goBack() },
      Refresh: { type: "NAVIGATION", execute: async (page) => page.reload() },

      Click: { type: "ACTION", execute: async (page, p) => resolveLocator(page, p.locator).click() },
      DoubleClick: { type: "ACTION", execute: async (page, p) => resolveLocator(page, p.locator).dblclick() },
      RightClick: { type: "ACTION", execute: async (page, p) => resolveLocator(page, p.locator).click({ button: "right" }) },

      Type: { type: "ACTION", execute: async (page, p) => resolveLocator(page, p.locator).fill(p.value ?? "") },
      ClearAndType: {
        type: "ACTION",
        execute: async (page, p) => {
          const loc = resolveLocator(page, p.locator);
          await loc.clear();
          await loc.fill(p.value ?? "");
        },
      },
      TypeSlow: {
        type: "ACTION",
        execute: async (page, p) => resolveLocator(page, p.locator).pressSequentially(p.value ?? "", { delay: 50 }),
      },
      Select: { type: "ACTION", execute: async (page, p) => resolveLocator(page, p.locator).selectOption(p.value ?? "") },

      WaitForElement: {
        type: "ACTION",
        execute: async (page, p) => resolveLocator(page, p.locator).waitFor({ state: "visible", timeout: Number(p.timeout) || 5000 }),
      },
      WaitForText: {
        type: "ACTION",
        execute: async (page, p) =>
          page.waitForFunction((text) => document.body.innerText.includes(text), p.value, {
            timeout: Number(p.timeout) || 5000,
          }),
      },
      Wait: { type: "ACTION", execute: async (page, p) => page.waitForTimeout(Number(p.value ?? p.milliseconds) || 1000) },

      VerifyText: {
        type: "ASSERTION",
        execute: async (page, p) => {
          const text = await resolveLocator(page, p.locator).textContent();
          if (!text || !text.includes(p.value)) throw new Error(`Expected text "${p.value}" not found. Got: "${text}"`);
        },
      },
      VerifyElementVisible: {
        type: "ASSERTION",
        execute: async (page, p) => {
          if (!(await resolveLocator(page, p.locator).isVisible())) throw new Error(`Element not visible: ${p.locator}`);
        },
      },
      VerifyElementNotVisible: {
        type: "ASSERTION",
        execute: async (page, p) => {
          if (await resolveLocator(page, p.locator).isVisible()) throw new Error(`Element should not be visible: ${p.locator}`);
        },
      },
      VerifyElementPresent: {
        type: "ASSERTION",
        execute: async (page, p) => {
          if ((await resolveLocator(page, p.locator).count()) === 0) throw new Error(`Element not found: ${p.locator}`);
        },
      },
      VerifyPageTitle: {
        type: "ASSERTION",
        execute: async (page, p) => {
          const title = await page.title();
          if (title !== p.value) throw new Error(`Expected title "${p.value}" but got "${title}"`);
        },
      },
      VerifyPageUrl: {
        type: "ASSERTION",
        execute: async (page, p) => {
          const url = page.url();
          if (url !== p.value) throw new Error(`Expected URL "${p.value}" but got "${url}"`);
        },
      },

      TakeScreenshot: { type: "ACTION", execute: async (page, p) => page.screenshot({ path: p.value ?? p.filePath }) },
    };

    // Custom keywords registered at runtime via createCustomKeyword()
    this.customKeywords = {};
  }

  /** Parse a tab-separated keyword script: Keyword \t Locator \t Value */
  parseKeywordScript(script) {
    const lines = String(script)
      .split("\n")
      .filter((l) => l.trim() && !l.trim().startsWith("#"));

    return lines.map((line) => {
      const parts = line.split("\t").map((p) => p.trim());
      const [keyword, locator, value] = parts;
      return { keyword, params: { locator: locator || undefined, value: value || undefined } };
    });
  }

  async executeKeyword(page, keyword, customKeywords = {}) {
    const def = customKeywords[keyword.keyword] || this.customKeywords[keyword.keyword] || this.builtInKeywords[keyword.keyword];
    if (!def) throw new Error(`Unknown keyword: ${keyword.keyword}`);
    return def.execute(page, keyword.params || {});
  }

  async executeKeywordTest(page, script, customKeywords = {}) {
    const keywords = this.parseKeywordScript(script);
    const results = [];
    for (let i = 0; i < keywords.length; i++) {
      const start = Date.now();
      try {
        await this.executeKeyword(page, keywords[i], customKeywords);
        results.push({ step: i + 1, ...keywords[i], status: "passed", duration_ms: Date.now() - start });
      } catch (err) {
        results.push({ step: i + 1, ...keywords[i], status: "failed", error: err.message, duration_ms: Date.now() - start });
        throw err;
      }
    }
    return results;
  }

  /** Convert a keyword script into a runnable Playwright test file (string) */
  convertToPlaywrightCode(keywordScript) {
    const keywords = this.parseKeywordScript(keywordScript);
    const lines = [
      "const { test, expect } = require('@playwright/test');",
      "",
      "test('Converted from Keyword Script', async ({ page }) => {",
    ];
    for (const kw of keywords) {
      const line = this.keywordToPlaywrightLine(kw);
      if (line) lines.push(`  ${line}`);
    }
    lines.push("});");
    return lines.join("\n");
  }

  keywordToPlaywrightLine({ keyword, params }) {
    const selector = params.locator ? `'${params.locator}'` : "";
    const value = params.value ? `'${params.value}'` : "";
    switch (keyword) {
      case "Navigate":
        return `await page.goto(${value});`;
      case "Click":
        return `await page.click(${selector});`;
      case "DoubleClick":
        return `await page.dblclick(${selector});`;
      case "Type":
        return `await page.fill(${selector}, ${value});`;
      case "Select":
        return `await page.selectOption(${selector}, ${value});`;
      case "WaitForElement":
        return `await page.waitForSelector(${selector});`;
      case "Wait":
        return `await page.waitForTimeout(${Number(params.value) || 1000});`;
      case "VerifyText":
        return `await expect(page.locator(${selector})).toContainText(${value});`;
      case "VerifyPageTitle":
        return `await expect(page).toHaveTitle(${value});`;
      case "VerifyElementVisible":
        return `await expect(page.locator(${selector})).toBeVisible();`;
      case "TakeScreenshot":
        return `await page.screenshot({ path: ${value} });`;
      default:
        return null;
    }
  }

  /** Register a project-specific custom keyword at runtime */
  createCustomKeyword(keywordName, executeFn) {
    this.customKeywords[keywordName] = { type: "CUSTOM", execute: executeFn };
  }

  getAvailableKeywords() {
    return {
      built_in: Object.keys(this.builtInKeywords),
      custom: Object.keys(this.customKeywords),
    };
  }
}

module.exports = new KeywordEngine();
