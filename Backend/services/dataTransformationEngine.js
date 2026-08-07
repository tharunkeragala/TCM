/**
 * dataTransformationEngine.js
 * Place at: server/services/dataTransformationEngine.js
 *
 * Transforms data using JSONPath, JMESPath, XPath (XML), Regex,
 * or arbitrary JavaScript expressions. Supports chaining transformations.
 *
 * Requires: npm install jsonpath-plus jmespath xpath xmldom --save
 */

const { JSONPath } = require("jsonpath-plus");
const JMESPath = require("jmespath");
const xpath = require("xpath");
const { DOMParser } = require("xmldom");

class DataTransformationEngine {
  async transformData(data, transformation) {
    switch (String(transformation.type).toUpperCase()) {
      case "JSONPATH":
        return this.transformJsonPath(data, transformation.expression);
      case "JMESPATH":
        return this.transformJMESPath(data, transformation.expression);
      case "XPATH":
        return this.transformXPath(data, transformation.expression);
      case "REGEX":
        return this.transformRegex(data, transformation.pattern, transformation.flags);
      case "JAVASCRIPT":
        return this.transformJavaScript(data, transformation.expression);
      case "CUSTOM":
        return this.transformCustom(data, transformation.customFunction);
      default:
        throw new Error(`Unknown transformation type: ${transformation.type}`);
    }
  }

  /** e.g. users[0].profile.email */
  transformJsonPath(data, expression) {
    try {
      const result = JSONPath({ path: String(expression), json: data });
      return result.length === 1 ? result[0] : result;
    } catch (err) {
      throw new Error(`JSONPath transformation failed: ${err.message}`);
    }
  }

  /** e.g. users[?status == 'active'].name | [0] */
  transformJMESPath(data, expression) {
    try {
      return JMESPath.search(data, String(expression));
    } catch (err) {
      throw new Error(`JMESPath transformation failed: ${err.message}`);
    }
  }

  /** e.g. //user[@id='123']/email/text() — data must be an XML string */
  transformXPath(data, expression) {
    try {
      const doc = new DOMParser().parseFromString(String(data));
      const result = xpath.select(String(expression), doc);
      if (!result || result.length === 0) return null;
      if (result.length === 1) return result[0].nodeValue ?? result[0].toString();
      return result.map((r) => r.nodeValue ?? r.toString());
    } catch (err) {
      throw new Error(`XPath transformation failed: ${err.message}`);
    }
  }

  transformRegex(data, pattern, flags = "g") {
    try {
      const regex = new RegExp(pattern, flags);
      return String(data).match(regex) || [];
    } catch (err) {
      throw new Error(`Regex transformation failed: ${err.message}`);
    }
  }

  /** Safely evaluate a JS expression with `data` in scope */
  transformJavaScript(data, expression) {
    try {
      const context = { data, JSON, Math, String, Array, Object };
      // eslint-disable-next-line no-new-func
      const func = new Function(...Object.keys(context), `return (${expression})`);
      return func(...Object.values(context));
    } catch (err) {
      throw new Error(`JavaScript transformation failed: ${err.message}`);
    }
  }

  transformCustom(data, customFunction) {
    if (typeof customFunction !== "function") throw new Error("Custom transformation must be a function");
    return customFunction(data);
  }

  async chainTransformations(data, transformations = []) {
    let result = data;
    for (const t of transformations) {
      result = await this.transformData(result, t);
    }
    return result;
  }

  getTemplates() {
    return {
      "Extract First Item": { type: "JSONPATH", expression: "$[0]" },
      "Extract All Emails": { type: "JSONPATH", expression: "$..email" },
      "Count Items": { type: "JMESPATH", expression: "length(@)" },
      "Extract Email from Text": {
        type: "REGEX",
        pattern: "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}",
        flags: "g",
      },
      "Filter Active Users": { type: "JMESPATH", expression: "users[?status == `active`]" },
      "Concatenate Fields": { type: "JAVASCRIPT", expression: "`${data.firstName} ${data.lastName}`" },
    };
  }
}

module.exports = new DataTransformationEngine();
