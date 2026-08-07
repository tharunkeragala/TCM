/**
 * keywordController.js
 * Place at: server/controllers/keywordController.js
 */

const keywordEngine = require("../services/keywordEngine");

exports.getAvailableKeywords = async (_req, res) => {
  try {
    res.json({ success: true, data: keywordEngine.getAvailableKeywords() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.convertToPlaywright = async (req, res) => {
  try {
    const { script } = req.body;
    const code = keywordEngine.convertToPlaywrightCode(script);
    res.json({ success: true, data: { code } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * Executes a keyword script against a short-lived headless browser page.
 * Intended for quick keyword validation from the editor, NOT full test runs
 * (use /api/data-drive/run-parameterized or the standard run endpoint for that).
 */
exports.executeKeywordScript = async (req, res) => {
  const { chromium } = require("playwright");
  let browser;
  try {
    const { script, startUrl } = req.body;
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    if (startUrl) await page.goto(startUrl, { waitUntil: "domcontentloaded" });

    const results = await keywordEngine.executeKeywordTest(page, script);
    res.json({ success: true, data: { results } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
};
