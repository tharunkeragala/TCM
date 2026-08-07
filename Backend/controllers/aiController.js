/**
 * aiController.js
 * Place at: server/controllers/aiController.js
 */

const sql = require("mssql");
const { poolPromise } = require("../config/db");
const AISuggestionEngine = require("../services/aiSuggestionEngine");

const aiEngine = new AISuggestionEngine();

exports.generateSuggestions = async (req, res) => {
  try {
    const { testCaseId, script, suggestionType } = req.body;
    let suggestions = [];

    if (suggestionType === "assertions") {
      suggestions = await aiEngine.suggestMissingAssertions(script, {});
    } else if (suggestionType === "refactoring") {
      suggestions = [{ title: "Refactoring suggestion", description: await aiEngine.suggestTestRefactoring(script), confidence: "MEDIUM" }];
    } else {
      suggestions = await aiEngine.suggestMissingAssertions(script, {});
    }

    // Persist for tracking/audit
    if (testCaseId) {
      const pool = await poolPromise;
      for (const s of suggestions) {
        await pool
          .request()
          .input("testCaseId", sql.Int, testCaseId)
          .input("type", sql.VarChar, suggestionType || "assertions")
          .input("text", sql.NVarChar(sql.MAX), s.description || s.assertion || JSON.stringify(s))
          .input("code", sql.NVarChar(sql.MAX), s.code || null)
          .input("confidence", sql.Float, s.confidence === "HIGH" ? 0.9 : s.confidence === "MEDIUM" ? 0.6 : 0.3)
          .query(`
            INSERT INTO dbo.test_ai_suggestions (test_case_id, suggestion_type, suggestion_text, suggested_code, confidence_score)
            VALUES (@testCaseId, @type, @text, @code, @confidence)
          `);
      }
    }

    res.json({ success: true, data: { suggestions } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.detectDuplicates = async (req, res) => {
  try {
    const { testCases } = req.body;
    const duplicates = await aiEngine.detectDuplicateTests(testCases);
    res.json({ success: true, data: { duplicates } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.recommendComponents = async (req, res) => {
  try {
    const { testCases } = req.body;
    const components = await aiEngine.recommendReusableComponents(testCases);
    res.json({ success: true, data: { components } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.generatePageObject = async (req, res) => {
  try {
    const { script, pageName } = req.body;
    const code = await aiEngine.generatePageObject(script, pageName);
    res.json({ success: true, data: { code } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.suggestStableLocators = async (req, res) => {
  try {
    const { element, pageState } = req.body;
    const alternatives = await aiEngine.suggestStableLocators(element, pageState);
    res.json({ success: true, data: { alternatives } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
