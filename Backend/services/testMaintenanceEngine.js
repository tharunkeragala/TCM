/**
 * testMaintenanceEngine.js
 * Place at: server/services/testMaintenanceEngine.js
 *
 * Script versioning, locator-change tracking, deleted-element detection,
 * and maintenance/flakiness reporting. Uses the same mssql pool pattern
 * as your existing playwrightRunner.js.
 */

const crypto = require("crypto");
const sql = require("mssql");
const { poolPromise } = require("../config/db");

class TestMaintenanceEngine {
  async getNextVersion(testCaseId) {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("testCaseId", sql.Int, testCaseId)
      .query(`SELECT ISNULL(MAX(version_number), 0) AS maxVersion FROM dbo.test_versions WHERE test_case_id = @testCaseId`);
    return (result.recordset[0].maxVersion || 0) + 1;
  }

  generateHash(content) {
    return crypto.createHash("sha256").update(String(content)).digest("hex");
  }

  /** Save a new version row for a test case's script */
  async versionScript(testCaseId, script, changeMessage = "", changedBy = null) {
    const pool = await poolPromise;
    const versionNumber = await this.getNextVersion(testCaseId);
    const hash = this.generateHash(script);

    await pool
      .request()
      .input("testCaseId", sql.Int, testCaseId)
      .input("versionNumber", sql.Int, versionNumber)
      .input("script", sql.NVarChar(sql.MAX), script)
      .input("changeMessage", sql.NVarChar(sql.MAX), changeMessage)
      .input("changedBy", sql.Int, changedBy)
      .input("hash", sql.VarChar(64), hash).query(`
        INSERT INTO dbo.test_versions (test_case_id, version_number, script, change_message, changed_by, script_hash)
        VALUES (@testCaseId, @versionNumber, @script, @changeMessage, @changedBy, @hash)
      `);

    return { testCaseId, versionNumber, hash, changeMessage, changedAt: new Date() };
  }

  /** Record a locator change (manual edit or self-healing recovery) */
  async trackLocatorChange(testCaseId, oldLocator, newLocator, reason = "MANUAL_UPDATE") {
    const pool = await poolPromise;
    await pool
      .request()
      .input("testCaseId", sql.Int, testCaseId)
      .input("originalLocator", sql.NVarChar(sql.MAX), oldLocator)
      .input("actualLocator", sql.NVarChar(sql.MAX), newLocator)
      .input("wasHealed", sql.Bit, reason === "SELF_HEALED" ? 1 : 0)
      .input("reason", sql.VarChar(50), reason).query(`
        INSERT INTO dbo.locator_history
          (test_case_id, original_locator, actual_locator_used, was_healed, healing_reason)
        VALUES
          (@testCaseId, @originalLocator, @actualLocator, @wasHealed, @reason)
      `);

    return { testCaseId, oldLocator, newLocator, reason, timestamp: new Date() };
  }

  /** Record a routine (non-healed) locator usage for stability stats */
  async recordLocatorUsage(testCaseId, locator, successful) {
    return this.trackLocatorChange(testCaseId, locator, successful ? locator : null, successful ? "NORMAL" : "SELF_HEALED");
  }

  async getVersionHistory(testCaseId) {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("testCaseId", sql.Int, testCaseId)
      .query(`SELECT * FROM dbo.test_versions WHERE test_case_id = @testCaseId ORDER BY changed_at DESC`);
    return result.recordset;
  }

  async getLocatorHistory(testCaseId) {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("testCaseId", sql.Int, testCaseId)
      .query(`SELECT * FROM dbo.locator_history WHERE test_case_id = @testCaseId ORDER BY last_used DESC`);
    return result.recordset;
  }

  async getRunHistory(testCaseId) {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("testCaseId", sql.Int, testCaseId)
      .query(`SELECT * FROM dbo.playwright_test_runs WHERE test_case_id = @testCaseId ORDER BY created_at DESC`);
    return result.recordset;
  }

  async getTestCase(testCaseId) {
    const pool = await poolPromise;
    const result = await pool.request().input("id", sql.Int, testCaseId).query(`SELECT * FROM dbo.test_cases WHERE id = @id`);
    return result.recordset[0];
  }

  countLocators(script) {
    const regex = /(?:page\.|locator\(|getByTestId\(|getByRole\()/g;
    return (String(script).match(regex) || []).length;
  }

  calculateChangeFrequency(versionHistory) {
    if (versionHistory.length < 2) return 0;
    const dates = versionHistory.map((v) => new Date(v.changed_at));
    const daySpan = (dates[0] - dates[dates.length - 1]) / (1000 * 60 * 60 * 24) || 1;
    return Math.round(versionHistory.length / daySpan);
  }

  calculateFlakiness(runHistory) {
    if (runHistory.length < 2) return "0.00";
    let flakes = 0;
    for (let i = 0; i < runHistory.length - 1; i++) {
      if (runHistory[i].status !== runHistory[i + 1].status) flakes++;
    }
    return ((flakes / runHistory.length) * 100).toFixed(2);
  }

  calculateLocatorFailureRate(locatorHistory) {
    if (locatorHistory.length === 0) return 0;
    const healed = locatorHistory.filter((l) => l.was_healed).length;
    return healed / locatorHistory.length;
  }

  generateRecommendations(testCase, versionHistory, locatorHistory, runHistory) {
    const recommendations = [];

    if (this.calculateChangeFrequency(versionHistory) > 5) {
      recommendations.push({
        type: "FREQUENT_CHANGES",
        severity: "MEDIUM",
        message: "This test is changed frequently. Consider refactoring for stability.",
        action: "Extract reusable components or update selectors",
      });
    }

    if (runHistory.length > 0) {
      const failureRate = 1 - runHistory.filter((r) => r.status === "passed").length / runHistory.length;
      if (failureRate > 0.2) {
        recommendations.push({
          type: "HIGH_FAILURE_RATE",
          severity: "HIGH",
          message: `Test has ${(failureRate * 100).toFixed(0)}% failure rate.`,
          action: "Review test logic and locators for stability",
        });
      }

      const lastRun = runHistory[0];
      const daysSinceRun = Math.floor((Date.now() - new Date(lastRun.created_at)) / (1000 * 60 * 60 * 24));
      if (daysSinceRun > 30) {
        recommendations.push({
          type: "STALE_TEST",
          severity: "LOW",
          message: `Test hasn't run in ${daysSinceRun} days.`,
          action: "Schedule regular execution or archive if no longer needed",
        });
      }
    }

    const unstableLocators = locatorHistory.filter((l) => l.was_healed);
    if (unstableLocators.length > 0) {
      recommendations.push({
        type: "UNSTABLE_LOCATORS",
        severity: "HIGH",
        message: `${unstableLocators.length} locator usages required self-healing.`,
        action: "Update locators to more stable selectors",
      });
    }

    return recommendations;
  }

  async generateMaintenanceReport(testCaseId) {
    const testCase = await this.getTestCase(testCaseId);
    const versionHistory = await this.getVersionHistory(testCaseId);
    const locatorHistory = await this.getLocatorHistory(testCaseId);
    const runHistory = await this.getRunHistory(testCaseId);

    return {
      testCaseId,
      testCaseName: testCase?.title,
      report: {
        versioning: {
          totalVersions: versionHistory.length,
          lastModified: versionHistory[0]?.changed_at,
          changeFrequency: this.calculateChangeFrequency(versionHistory),
        },
        locators: {
          totalLocators: this.countLocators(testCase?.playwright_script),
          healedLocators: locatorHistory.filter((l) => l.was_healed).length,
          failureRate: this.calculateLocatorFailureRate(locatorHistory),
        },
        execution: {
          totalRuns: runHistory.length,
          passRate: runHistory.length ? ((runHistory.filter((r) => r.status === "passed").length / runHistory.length) * 100).toFixed(2) : "0.00",
          averageDuration: runHistory.length ? Math.round(runHistory.reduce((s, r) => s + (r.duration_ms || 0), 0) / runHistory.length) : 0,
          flakiness: this.calculateFlakiness(runHistory),
        },
        recommendations: this.generateRecommendations(testCase, versionHistory, locatorHistory, runHistory),
      },
    };
  }

  async exportTestCase(testCaseId, format = "json") {
    const testCase = await this.getTestCase(testCaseId);
    const versionHistory = await this.getVersionHistory(testCaseId);
    const runs = await this.getRunHistory(testCaseId);

    const exported = {
      metadata: { exportDate: new Date().toISOString(), exportFormat: format },
      testCase,
      versionHistory,
      recentRuns: runs.slice(0, 10),
      statistics: {
        totalRuns: runs.length,
        passRate: runs.length ? ((runs.filter((r) => r.status === "passed").length / runs.length) * 100).toFixed(2) : "0.00",
      },
    };

    if (format === "markdown") return this.formatAsMarkdown(exported);
    return JSON.stringify(exported, null, 2);
  }

  formatAsMarkdown(exported) {
    return `
# Test Case: ${exported.testCase?.title}

## Statistics
- Total Runs: ${exported.statistics.totalRuns}
- Pass Rate: ${exported.statistics.passRate}%

## Script
\`\`\`javascript
${exported.testCase?.playwright_script || ""}
\`\`\`

## Version History
- Latest Version: ${exported.versionHistory[0]?.version_number ?? "n/a"}
- Last Modified: ${exported.versionHistory[0] ? new Date(exported.versionHistory[0].changed_at).toLocaleDateString() : "n/a"}
`;
  }
}

module.exports = new TestMaintenanceEngine();
