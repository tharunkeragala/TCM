/**
 * maintenanceController.js
 * Place at: server/controllers/maintenanceController.js
 */

const sql = require("mssql");
const { poolPromise } = require("../config/db");
const testMaintenanceEngine = require("../services/testMaintenanceEngine");
const selfHealingEngine = require("../services/selfHealingEngine");

exports.versionScript = async (req, res) => {
  try {
    const { testCaseId, script, changeMessage } = req.body;
    const version = await testMaintenanceEngine.versionScript(testCaseId, script, changeMessage, req.user?.id);
    res.json({ success: true, data: version });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.generateReport = async (req, res) => {
  try {
    const { testCaseId } = req.query;
    const report = await testMaintenanceEngine.generateMaintenanceReport(Number(testCaseId));
    res.json({ success: true, data: report });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.exportTestCase = async (req, res) => {
  try {
    const { testCaseId, format } = req.query;
    const exported = await testMaintenanceEngine.exportTestCase(Number(testCaseId), format || "json");
    res.json({ success: true, data: exported });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getVersionHistory = async (req, res) => {
  try {
    const { testCaseId } = req.query;
    const history = await testMaintenanceEngine.getVersionHistory(Number(testCaseId));
    res.json({ success: true, data: history });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getLocatorHistory = async (req, res) => {
  try {
    const { testCaseId } = req.query;
    const history = await testMaintenanceEngine.getLocatorHistory(Number(testCaseId));
    const grouped = {};
    for (const row of history) {
      grouped[row.original_locator] = grouped[row.original_locator] || [];
      grouped[row.original_locator].push({ locator: row.original_locator, successful: !row.was_healed, timestamp: row.last_used });
    }
    const locators = Object.values(grouped).map((h) => selfHealingEngine.analyzeLocatorStability(h));
    res.json({ success: true, data: { locators } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.generateAlternatives = async (req, res) => {
  try {
    const { elementInfo } = req.body;
    const alternatives = await selfHealingEngine.generateAlternativeLocators(elementInfo || {});
    res.json({ success: true, data: { alternatives } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
