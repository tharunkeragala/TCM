/**
 * apiTestingController.js
 * Place at: server/controllers/apiTestingController.js
 */

const sql = require("mssql");
const { poolPromise } = require("../config/db");
const apiTestingEngine = require("../services/apiTestingService");
const apiChainingService = require("../services/apiChainingService");

exports.createEndpoint = async (req, res) => {
  try {
    const { testCaseId, name, method, url, headers, body, authentication, assertions } = req.body;
    const pool = await poolPromise;

    const result = await pool
      .request()
      .input("testCaseId", sql.Int, testCaseId || null)
      .input("name", sql.VarChar, name)
      .input("method", sql.VarChar, method)
      .input("url", sql.NVarChar(sql.MAX), url)
      .input("headers", sql.NVarChar(sql.MAX), headers ? JSON.stringify(headers) : null)
      .input("body", sql.NVarChar(sql.MAX), body ? JSON.stringify(body) : null)
      .input("authType", sql.VarChar, authentication?.type || "NONE")
      .input("authValue", sql.NVarChar(sql.MAX), authentication?.value || null)
      .input("assertions", sql.NVarChar(sql.MAX), assertions ? JSON.stringify(assertions) : null).query(`
        INSERT INTO dbo.api_endpoints
          (test_case_id, name, method, url, headers, body, authentication_type, authentication_value, assertions)
        OUTPUT INSERTED.id
        VALUES
          (@testCaseId, @name, @method, @url, @headers, @body, @authType, @authValue, @assertions)
      `);

    res.json({ success: true, data: { endpointId: result.recordset[0].id, created: true } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.executeAPI = async (req, res) => {
  try {
    const { apiEndpointId, variables } = req.body;
    const pool = await poolPromise;

    const epResult = await pool.request().input("id", sql.Int, apiEndpointId).query(`SELECT * FROM dbo.api_endpoints WHERE id = @id`);
    if (!epResult.recordset.length) return res.status(404).json({ success: false, error: "Endpoint not found" });

    const endpoint = epResult.recordset[0];
    endpoint.headers = endpoint.headers ? JSON.parse(endpoint.headers) : {};
    endpoint.body = endpoint.body ? JSON.parse(endpoint.body) : null;
    endpoint.assertions = endpoint.assertions ? JSON.parse(endpoint.assertions) : [];

    const response = await apiTestingEngine.executeRequest(endpoint, variables || {});
    const validations = endpoint.assertions.length ? apiTestingEngine.validateResponse(response, endpoint.assertions) : [];

    res.json({ success: true, data: { ...response, validations } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.executeChain = async (req, res) => {
  try {
    const { chainId, initialVariables } = req.body;
    const pool = await poolPromise;

    const stepsResult = await pool
      .request()
      .input("chainId", sql.Int, chainId)
      .query(`
        SELECT cs.*, e.name AS endpoint_name, e.method, e.url, e.headers, e.body,
               e.authentication_type, e.authentication_value
        FROM dbo.api_chain_steps cs
        JOIN dbo.api_endpoints e ON e.id = cs.api_endpoint_id
        WHERE cs.api_chain_id = @chainId
        ORDER BY cs.step_order
      `);

    const chainDefinition = {
      id: chainId,
      name: `chain_${chainId}`,
      steps: stepsResult.recordset.map((row) => ({
        id: row.id,
        name: row.endpoint_name,
        apiEndpoint: {
          method: row.method,
          url: row.url,
          headers: row.headers ? JSON.parse(row.headers) : {},
          body: row.body ? JSON.parse(row.body) : null,
          authentication_type: row.authentication_type,
          authentication_value: row.authentication_value,
        },
        extractRules: row.extract_rules ? JSON.parse(row.extract_rules) : {},
        retryPolicy: row.retry_policy ? JSON.parse(row.retry_policy) : { maxRetries: 0 },
        stopOnFailure: Boolean(row.stop_on_failure),
      })),
    };

    const flow = apiChainingService.buildChainFlow(chainDefinition);
    const context = await apiChainingService.executeChain(flow, initialVariables || {});
    const report = apiChainingService.generateReport(flow, context);

    res.json({ success: true, data: report });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.listEndpoints = async (req, res) => {
  try {
    const { testCaseId } = req.query;
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("testCaseId", sql.Int, testCaseId)
      .query(`SELECT * FROM dbo.api_endpoints WHERE test_case_id = @testCaseId ORDER BY created_at DESC`);
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
