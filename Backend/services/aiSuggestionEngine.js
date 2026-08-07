/**
 * aiSuggestionEngine.js
 * Place at: server/services/aiSuggestionEngine.js
 *
 * Wraps the OpenAI API to generate: missing-assertion suggestions,
 * duplicate-test detection, reusable-component recommendations,
 * stable-locator suggestions, and Page Object generation.
 *
 * Requires: npm install openai --save
 * Set OPENAI_API_KEY in your .env
 */

const OpenAI = require("openai").default;

class AISuggestionEngine {
  constructor(apiKey = process.env.OPENAI_API_KEY) {
    this.openai = new OpenAI({ apiKey });
  }

  async suggestMissingAssertions(script, pageContext = {}) {
    const prompt = `
You are an expert test automation engineer. Analyze this Playwright test script and suggest missing assertions.

Current Script:
${script}

Page Context:
${JSON.stringify(pageContext, null, 2)}

Provide suggestions for:
1. Elements that should be verified to exist/be visible
2. Text content that should be validated
3. Page state assertions
4. Error message checks

Format each suggestion as:
- Type: [VISIBILITY|TEXT|STATE|ERROR]
  Assertion: [specific assertion code]
  Confidence: [HIGH|MEDIUM|LOW]
  Reason: [why this assertion matters]
`;
    const response = await this.openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 1000,
      temperature: 0.7,
    });
    return this.parseAssertionSuggestions(response.choices[0].message.content);
  }

  async detectDuplicateTests(testCases) {
    const prompt = `
Analyze these test cases and identify duplicates or high similarity:

${testCases.map((tc, i) => `Test ${i + 1}: ${tc.title}\nScript: ${tc.playwright_script}`).join("\n---\n")}

For each group of similar tests, provide test indices, similarity percentage (0-100),
reason for similarity, and a suggestion for consolidation.
Respond with ONLY a JSON array of {indices, similarity, reason, suggestion}.
`;
    const response = await this.openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 1500,
      temperature: 0.5,
    });
    return this.safeParseJsonArray(response.choices[0].message.content);
  }

  async recommendReusableComponents(testCases) {
    const prompt = `
Analyze these test cases and identify patterns that could be extracted into reusable components:

${testCases.map((tc, i) => `Test ${i + 1}: ${tc.title}\n${tc.playwright_script}`).join("\n---\n")}

Identify common step sequences (login, form filling, validation), repeated assertions,
and common page interactions. Respond with ONLY a JSON array of
{name, steps, applicableTests, reuseCount}.
`;
    const response = await this.openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 2000,
      temperature: 0.6,
    });
    return this.safeParseJsonArray(response.choices[0].message.content);
  }

  async suggestStableLocators(element, pageState) {
    const prompt = `
Given this element, suggest the most stable Playwright locator strategy:

Element: ${JSON.stringify(element)}
Page State: ${JSON.stringify(pageState)}

Consider ID, test-id attribute, ARIA labels, CSS selectors, and XPath, in order of stability.
Respond with ONLY a JSON array of {locator, strategy, stability: "HIGH|MEDIUM|LOW", reason}.
`;
    const response = await this.openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 800,
      temperature: 0.5,
    });
    return this.safeParseJsonArray(response.choices[0].message.content);
  }

  async generatePageObject(script, pageName) {
    const prompt = `
Convert this Playwright test script into a Page Object Model class in TypeScript:

${script}

Page Name: ${pageName}

Generate a class with private locators as properties, public methods for each interaction,
JSDoc comments for each method, and getter methods for assertions. Make it production-ready
with proper error handling.
`;
    const response = await this.openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 2000,
      temperature: 0.4,
    });
    return response.choices[0].message.content;
  }

  async suggestTestRefactoring(script) {
    const prompt = `
Review this test script and suggest refactoring improvements:

${script}

Analyze for code duplication, missing error handling, hard-coded values that should be
parameterized, magic numbers, locator stability issues, and performance opportunities.
Provide a refactored code snippet and explanation.
`;
    const response = await this.openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 1500,
      temperature: 0.6,
    });
    return response.choices[0].message.content;
  }

  parseAssertionSuggestions(response) {
    const suggestions = [];
    let current = null;
    for (const line of response.split("\n")) {
      if (line.startsWith("- Type:")) {
        if (current) suggestions.push(current);
        current = { type: line.split(":")[1]?.trim() };
      } else if (line.trim().startsWith("Assertion:") && current) {
        current.assertion = line.split(":").slice(1).join(":").trim();
      } else if (line.trim().startsWith("Confidence:") && current) {
        current.confidence = line.split(":")[1]?.trim();
      } else if (line.trim().startsWith("Reason:") && current) {
        current.reason = line.split(":").slice(1).join(":").trim();
      }
    }
    if (current) suggestions.push(current);
    return suggestions;
  }

  safeParseJsonArray(text) {
    try {
      const match = text.match(/\[[\s\S]*\]/);
      return match ? JSON.parse(match[0]) : [];
    } catch {
      return [];
    }
  }
}

module.exports = AISuggestionEngine;
