/**
 * apiTestingService.js
 * Place at: server/services/apiTestingService.js
 *
 * Builds and executes HTTP requests (with variable substitution + auth),
 * validates responses against assertions, extracts values with JSONPath,
 * and can run a simple sequential chain of API calls.
 *
 * Requires: npm install axios jsonpath-plus --save
 */

const axios = require("axios");
const { JSONPath } = require("jsonpath-plus");

class APITestingEngine {
  substituteVariables(str, variables) {
    let result = String(str);
    for (const [key, value] of Object.entries(variables || {})) {
      result = result.split(`{{${key}}}`).join(String(value));
    }
    return result;
  }

  buildRequest(apiEndpoint, variables = {}) {
    const request = {
      method: apiEndpoint.method,
      url: this.substituteVariables(apiEndpoint.url, variables),
      headers: { "Content-Type": "application/json", "User-Agent": "PlaywrightTestEngine/1.0" },
    };

    if (apiEndpoint.headers) {
      const parsedHeaders = typeof apiEndpoint.headers === "string" ? JSON.parse(apiEndpoint.headers) : apiEndpoint.headers;
      for (const [k, v] of Object.entries(parsedHeaders)) {
        request.headers[k] = this.substituteVariables(String(v), variables);
      }
    }

    if (apiEndpoint.authentication_type === "BEARER") {
      request.headers.Authorization = `Bearer ${this.substituteVariables(apiEndpoint.authentication_value, variables)}`;
    } else if (apiEndpoint.authentication_type === "BASIC") {
      request.headers.Authorization = `Basic ${Buffer.from(
        this.substituteVariables(apiEndpoint.authentication_value, variables)
      ).toString("base64")}`;
    } else if (apiEndpoint.authentication_type === "API_KEY") {
      request.headers["X-API-Key"] = this.substituteVariables(apiEndpoint.authentication_value, variables);
    }

    if (apiEndpoint.body && ["POST", "PUT", "PATCH"].includes(apiEndpoint.method)) {
      const bodyStr = typeof apiEndpoint.body === "string" ? apiEndpoint.body : JSON.stringify(apiEndpoint.body);
      request.data = JSON.parse(this.substituteVariables(bodyStr, variables));
    }

    return request;
  }

  async executeRequest(apiEndpoint, variables = {}) {
    const request = this.buildRequest(apiEndpoint, variables);
    const start = Date.now();
    try {
      const response = await axios(request);
      return {
        success: true,
        statusCode: response.status,
        headers: response.headers,
        body: response.data,
        duration_ms: Date.now() - start,
        error: null,
      };
    } catch (error) {
      return {
        success: false,
        statusCode: error.response?.status,
        headers: error.response?.headers,
        body: error.response?.data,
        duration_ms: Date.now() - start,
        error: error.message,
      };
    }
  }

  extractFromResponse(responseBody, extractRules = {}) {
    const extracted = {};
    for (const [key, path] of Object.entries(extractRules)) {
      try {
        const value = JSONPath({ path: String(path), json: responseBody });
        extracted[key] = value.length === 1 ? value[0] : value;
      } catch (err) {
        console.warn(`[apiTestingService] Failed to extract ${key} with path ${path}:`, err.message);
        extracted[key] = null;
      }
    }
    return extracted;
  }

  compareValues(actual, operator, expected) {
    switch (operator) {
      case "equals":
        return actual === expected;
      case "not_equals":
        return actual !== expected;
      case "contains":
        return String(actual).includes(String(expected));
      case "greater_than":
        return actual > expected;
      case "less_than":
        return actual < expected;
      default:
        return false;
    }
  }

  getActualValue(response, assertion) {
    if (assertion.type === "STATUS_CODE") return response.statusCode;
    if (assertion.type === "RESPONSE_TIME") return response.duration_ms;
    if (assertion.type === "JSON_PATH") return JSONPath({ path: assertion.path, json: response.body })[0];
    return null;
  }

  validateResponse(response, assertions = []) {
    return assertions.map((assertion) => {
      try {
        let result = false;
        switch (assertion.type) {
          case "STATUS_CODE":
            result = response.statusCode === assertion.expectedValue;
            break;
          case "JSON_PATH":
            result = this.compareValues(
              JSONPath({ path: assertion.path, json: response.body })[0],
              assertion.operator,
              assertion.expectedValue
            );
            break;
          case "HEADER":
            result = response.headers?.[assertion.headerName] === assertion.expectedValue;
            break;
          case "RESPONSE_TIME":
            result = response.duration_ms <= assertion.maxDuration;
            break;
          default:
            result = false;
        }
        return {
          assertion: assertion.name || assertion.type,
          passed: result,
          expected: assertion.expectedValue,
          actual: this.getActualValue(response, assertion),
        };
      } catch (err) {
        return { assertion: assertion.name || assertion.type, passed: false, error: err.message };
      }
    });
  }

  /** Simple sequential chain: array of { name, endpoint, extractRules, assertions, stopOnFailure } */
  async executeAPIChain(chainSteps, initialVariables = {}) {
    const variables = { ...initialVariables };
    const responses = [];
    const chainResults = { success: true, steps: [] };

    for (const step of chainSteps) {
      try {
        const response = await this.executeRequest(step.endpoint, variables);

        if (step.extractRules) {
          Object.assign(variables, this.extractFromResponse(response.body, step.extractRules));
        }

        let allPassed = true;
        let validationResults = [];
        if (step.assertions) {
          validationResults = this.validateResponse(response, step.assertions);
          allPassed = validationResults.every((r) => r.passed);
          if (!allPassed) chainResults.success = false;
        }

        chainResults.steps.push({
          name: step.name,
          statusCode: response.statusCode,
          passed: allPassed,
          validations: validationResults,
        });

        responses.push({ endpoint: step.endpoint.name, statusCode: response.statusCode, body: response.body, duration: response.duration_ms });

        if (!allPassed && step.stopOnFailure) break;
      } catch (err) {
        chainResults.success = false;
        chainResults.steps.push({ name: step.name, passed: false, error: err.message });
        if (step.stopOnFailure) break;
      }
    }

    return { ...chainResults, variables, responses };
  }
}

module.exports = new APITestingEngine();
