/**
 * apiChainingService.js
 * Place at: server/services/apiChainingService.js
 *
 * Advanced API chain execution: retry policies, fallback steps, timelines,
 * and reporting on top of apiTestingService.js.
 */

const apiTestingEngine = require("./apiTestingService");
const { JSONPath } = require("jsonpath-plus");

class APIChainingService {
  buildChainFlow(chainDefinition) {
    return {
      chainId: chainDefinition.id,
      chainName: chainDefinition.name,
      steps: (chainDefinition.steps || []).map((stepDef) => ({
        stepId: stepDef.id,
        stepName: stepDef.name,
        apiEndpoint: stepDef.apiEndpoint,
        extractRules: stepDef.extractRules || {},
        passToNext: stepDef.passToNext || {},
        assertions: stepDef.assertions || [],
        fallbackSteps: stepDef.fallbackSteps || [],
        retryPolicy: stepDef.retryPolicy || { maxRetries: 0 },
        timeout: stepDef.timeout || 30000,
        stopOnFailure: stepDef.stopOnFailure !== false,
      })),
    };
  }

  async executeChain(chainFlow, initialVariables = {}) {
    const context = { variables: { ...initialVariables }, results: [], timeline: [], success: true, errors: [] };

    for (let i = 0; i < chainFlow.steps.length; i++) {
      const step = chainFlow.steps[i];
      const stepStart = Date.now();

      try {
        const response = await this.executeStepWithRetry(step, context.variables, step.retryPolicy);

        if (step.assertions.length > 0) {
          const validations = apiTestingEngine.validateResponse(response, step.assertions);
          if (!validations.every((v) => v.passed)) {
            throw new Error(`Assertion failed: ${validations.find((v) => !v.passed).assertion}`);
          }
        }

        const extracted = this.extractVariablesFromResponse(response, step.extractRules);
        Object.assign(context.variables, extracted);

        context.results.push({
          stepId: step.stepId,
          stepName: step.stepName,
          status: "passed",
          statusCode: response.statusCode,
          duration: Date.now() - stepStart,
          extracted,
          passed: true,
        });
        context.timeline.push({ timestamp: new Date(), step: step.stepName, event: "completed", duration: Date.now() - stepStart });
      } catch (err) {
        let recoveredByFallback = false;

        if (step.fallbackSteps.length > 0) {
          for (const fallback of step.fallbackSteps) {
            try {
              const fbResponse = await apiTestingEngine.executeRequest(fallback, context.variables);
              if (fbResponse.statusCode >= 200 && fbResponse.statusCode < 300) {
                context.results.push({
                  stepId: step.stepId,
                  stepName: `${step.stepName} (fallback)`,
                  status: "passed",
                  statusCode: fbResponse.statusCode,
                  duration: Date.now() - stepStart,
                  wasFallback: true,
                  passed: true,
                });
                recoveredByFallback = true;
                break;
              }
            } catch (_) {
              /* try next fallback */
            }
          }
        }

        if (!recoveredByFallback) {
          context.results.push({ stepId: step.stepId, stepName: step.stepName, status: "failed", error: err.message, duration: Date.now() - stepStart, passed: false });
          context.errors.push({ step: step.stepName, error: err.message });
          context.success = false;
          if (step.stopOnFailure) break;
        }
      }
    }

    return context;
  }

  async executeStepWithRetry(step, variables, retryPolicy, attempt = 1) {
    try {
      return await apiTestingEngine.executeRequest(step.apiEndpoint, variables);
    } catch (err) {
      if (attempt <= (retryPolicy.maxRetries || 0)) {
        const delay = retryPolicy.delayMs || 1000 * attempt;
        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.executeStepWithRetry(step, variables, retryPolicy, attempt + 1);
      }
      throw err;
    }
  }

  extractVariablesFromResponse(response, extractRules) {
    const extracted = {};
    for (const [varName, path] of Object.entries(extractRules || {})) {
      try {
        const result = JSONPath({ path: String(path), json: response.body });
        extracted[varName] = result.length === 1 ? result[0] : result;
      } catch (err) {
        console.warn(`[apiChainingService] Failed to extract ${varName}:`, err.message);
      }
    }
    return extracted;
  }

  generateReport(chainFlow, context) {
    return {
      chainName: chainFlow.chainName,
      executionDate: new Date().toISOString(),
      totalDuration: context.timeline.reduce((sum, t) => sum + t.duration, 0),
      totalSteps: chainFlow.steps.length,
      successfulSteps: context.results.filter((r) => r.passed).length,
      failedSteps: context.results.filter((r) => !r.passed).length,
      overallStatus: context.success ? "PASSED" : "FAILED",
      steps: context.results,
      variables: context.variables,
      errors: context.errors,
      timeline: context.timeline,
    };
  }

  validateChainDefinition(chainDef) {
    const errors = [];
    if (!chainDef.id) errors.push("Chain ID is required");
    if (!chainDef.name) errors.push("Chain name is required");
    if (!Array.isArray(chainDef.steps) || chainDef.steps.length === 0) errors.push("At least one step is required");
    (chainDef.steps || []).forEach((step, i) => {
      if (!step.id) errors.push(`Step ${i} missing ID`);
      if (!step.apiEndpoint) errors.push(`Step ${i} missing API endpoint`);
    });
    return { valid: errors.length === 0, errors };
  }
}

module.exports = new APIChainingService();
