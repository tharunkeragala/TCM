/**
 * variableEngine.js
 * Place at: server/services/variableEngine.js
 *
 * Central variable store + resolver used by every other engine
 * (data-driven, conditional, keyword, API testing, chaining).
 * Supports static variables, nested paths, and built-in system functions
 * like {{uuid()}}, {{randomEmail()}}, {{environment(API_KEY)}}.
 *
 * Requires: npm install @faker-js/faker uuid --save
 */

const { faker } = require("@faker-js/faker");
const { v4: uuidv4 } = require("uuid");

class VariableEngine {
  constructor() {
    this.variables = {};
    this.systemFunctions = {
      uuid: () => uuidv4(),
      timestamp: () => Date.now(),
      iso_timestamp: () => new Date().toISOString(),
      date_today: () => new Date().toISOString().split("T")[0],
      date_tomorrow: () => {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        return d.toISOString().split("T")[0];
      },
      random_email: () => faker.internet.email(),
      random_name: () => faker.person.fullName(),
      random_phone: () => faker.phone.number(),
      random_string: (length = 10) => faker.string.alphanumeric(Number(length) || 10),
      random_number: (min = 0, max = 100) =>
        Math.floor(Math.random() * (Number(max) - Number(min) + 1)) + Number(min),
      random_boolean: () => Math.random() > 0.5,
      environment: (varName) => process.env[varName],
    };
  }

  /** Resolve a single variable name (user variable first, then system function) */
  resolveVariable(variableName) {
    if (this.variables[variableName] !== undefined) return this.variables[variableName];
    if (this.systemFunctions[variableName]) return this.systemFunctions[variableName]();
    return null;
  }

  /** Substitute every {{variable}} / {{function(args)}} occurrence in a string */
  substituteVariables(text, customVariables = {}) {
    const allVars = { ...this.variables, ...customVariables };
    return String(text).replace(/\{\{([^}]+)\}\}/g, (match, expression) => {
      const expr = expression.trim();
      try {
        if (expr.includes("(")) return String(this.evaluateFunctionExpression(expr));
        if (expr.includes(".")) {
          const nested = this.getNestedVariable(expr, allVars);
          if (nested !== null && nested !== undefined) return String(nested);
        }
        const value = allVars[expr] !== undefined ? allVars[expr] : this.resolveVariable(expr);
        if (value !== null && value !== undefined) return String(value);
        console.warn(`[variableEngine] Variable not found: ${expr}`);
        return match;
      } catch (err) {
        console.warn(`[variableEngine] Error resolving "${expr}":`, err.message);
        return match;
      }
    });
  }

  /** Evaluate function-style expressions like uuid() or random_number(1, 100) */
  evaluateFunctionExpression(expression) {
    const match = expression.match(/(\w+)\((.*)\)/);
    if (!match) return null;
    const [, funcName, argsStr] = match;
    const func = this.systemFunctions[funcName];
    if (!func) throw new Error(`Unknown function: ${funcName}`);

    const args = argsStr
      .split(",")
      .map((a) => a.trim())
      .filter(Boolean)
      .map((arg) => {
        if (!isNaN(arg)) return parseFloat(arg);
        if (arg.startsWith('"') || arg.startsWith("'")) return arg.slice(1, -1);
        return this.resolveVariable(arg);
      });

    return func(...args);
  }

  setVariable(name, value) {
    this.variables[name] = value;
  }

  setVariables(vars) {
    Object.assign(this.variables, vars);
  }

  getVariables() {
    return { ...this.variables };
  }

  clearVariables() {
    this.variables = {};
  }

  /** Dot-notation nested lookup, e.g. getNestedVariable('api.user.name', vars) */
  getNestedVariable(path, source = this.variables) {
    return path.split(".").reduce((current, part) => (current == null ? null : current[part]), source);
  }

  /** Evaluate a boolean/arithmetic expression with variables substituted in */
  evaluateExpression(expression, variables = {}) {
    const allVars = { ...this.variables, ...variables };
    let code = String(expression);
    for (const [key, value] of Object.entries(allVars)) {
      const escaped = typeof value === "string" ? JSON.stringify(value) : value;
      code = code.split(`{{${key}}}`).join(escaped);
    }
    try {
      // eslint-disable-next-line no-new-func
      return Function('"use strict"; return (' + code + ")")();
    } catch (err) {
      throw new Error(`Expression evaluation failed: ${err.message}`);
    }
  }

  /** Extract values from an API/JSON response using JSONPath and store them as variables */
  extractVariablesFromResponse(response, extractRules) {
    const { JSONPath } = require("jsonpath-plus");
    const extracted = {};
    for (const [varName, path] of Object.entries(extractRules || {})) {
      try {
        const result = JSONPath({ path: String(path), json: response });
        extracted[varName] = result.length === 1 ? result[0] : result;
      } catch (err) {
        console.warn(`[variableEngine] Failed to extract ${varName}:`, err.message);
      }
    }
    this.setVariables(extracted);
    return extracted;
  }

  exportVariables() {
    return { timestamp: new Date().toISOString(), variables: this.variables, count: Object.keys(this.variables).length };
  }
}

// Singleton — one process-wide variable store. For per-run isolation, use
// `new (require('./variableEngine').VariableEngine)()` instead in the runner.
module.exports = new VariableEngine();
module.exports.VariableEngine = VariableEngine;
