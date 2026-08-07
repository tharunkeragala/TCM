/**
 * variableController.js
 * Place at: server/controllers/variableController.js
 */

const sql = require("mssql");
const { poolPromise } = require("../config/db");
const variableEngine = require("../services/variableEngine");

exports.getAvailableVariables = async (_req, res) => {
  try {
    const pool = await poolPromise;
    const sysResult = await pool.request().query(`SELECT variable_name, description FROM dbo.system_variables ORDER BY variable_name`);

    res.json({
      success: true,
      data: {
        userVariables: variableEngine.getVariables(),
        systemFunctions: sysResult.recordset.map((r) => ({ name: `${r.variable_name}()`, description: r.description })),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.setVariable = async (req, res) => {
  try {
    const { testCaseId, name, value, scope = "TEST" } = req.body;
    variableEngine.setVariable(name, value);

    if (testCaseId) {
      const pool = await poolPromise;
      await pool
        .request()
        .input("testCaseId", sql.Int, testCaseId)
        .input("name", sql.VarChar, name)
        .input("value", sql.NVarChar(sql.MAX), String(value))
        .input("scope", sql.VarChar, scope).query(`
          MERGE dbo.test_variables AS target
          USING (SELECT @testCaseId AS test_case_id, @name AS variable_name) AS src
          ON target.test_case_id = src.test_case_id AND target.variable_name = src.variable_name
          WHEN MATCHED THEN UPDATE SET variable_value = @value, scope = @scope
          WHEN NOT MATCHED THEN
            INSERT (test_case_id, variable_name, variable_value, scope)
            VALUES (@testCaseId, @name, @value, @scope);
        `);
    }

    res.json({ success: true, data: { variable: name, value } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.evaluateExpression = async (req, res) => {
  try {
    const { expression, variables } = req.body;
    const result = variableEngine.substituteVariables(expression, variables || {});
    res.json({ success: true, data: { result } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
