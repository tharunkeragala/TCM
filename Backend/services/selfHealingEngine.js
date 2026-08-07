/**
 * selfHealingEngine.js
 * Place at: server/services/selfHealingEngine.js
 *
 * Generates ranked alternative locators for an element and tries them
 * in order when the primary selector fails, so tests survive minor DOM changes.
 *
 * Requires: npm install js-levenshtein --save
 */

const levenshtein = require("js-levenshtein");

class SelfHealingEngine {
  /**
   * Generate alternative locators from a captured element descriptor, e.g.
   * { id, testid, ariaLabel, className, textContent, tag, attributes }
   */
  async generateAlternativeLocators(element = {}, pageContext = {}) {
    const alternatives = [];

    if (element.id) alternatives.push({ selector: `#${element.id}`, strategy: "id", stability: "HIGH", rank: 1 });

    if (element.testid) {
      alternatives.push({ selector: `[data-testid="${element.testid}"]`, strategy: "testid", stability: "HIGH", rank: 2 });
    }

    const ariaLabel = element.ariaLabel;
    if (ariaLabel) alternatives.push({ selector: `[aria-label="${ariaLabel}"]`, strategy: "aria_label", stability: "HIGH", rank: 3 });

    if (element.className && !this.isGenericClass(element.className)) {
      alternatives.push({ selector: `.${element.className.split(" ")[0]}`, strategy: "class", stability: "MEDIUM", rank: 4 });
    }

    const text = element.textContent?.trim();
    if (text && text.length < 100) {
      alternatives.push({ selector: `text=${text}`, strategy: "text", stability: "MEDIUM", rank: 5 });
    }

    const role = element.role || this.inferRole(element.tag);
    if (role) alternatives.push({ selector: `role=${role}`, strategy: "role", stability: "MEDIUM", rank: 6 });

    if (element.tag) {
      const specific = element.className ? `${element.tag}.${element.className.split(" ")[0]}` : element.tag;
      alternatives.push({ selector: specific, strategy: "css_combination", stability: "MEDIUM", rank: 7 });
    }

    if (element.xpath) alternatives.push({ selector: `xpath=${element.xpath}`, strategy: "xpath", stability: "LOW", rank: 8 });

    return alternatives.sort((a, b) => a.rank - b.rank);
  }

  /** Try the primary selector, then each alternative in order, first visible match wins */
  async findElementWithFallback(page, primarySelector, alternatives = []) {
    const locators = [primarySelector, ...alternatives.map((a) => a.selector)];

    for (let i = 0; i < locators.length; i++) {
      try {
        const element = page.locator(locators[i]).first();
        if (await element.isVisible({ timeout: 1000 }).catch(() => false)) {
          return {
            found: true,
            selector: locators[i],
            attemptNumber: i + 1,
            usedFallback: i > 0,
            confidence: this.calculateConfidence(i, locators.length),
          };
        }
      } catch (_) {
        continue;
      }
    }

    return { found: false, attemptedSelectors: locators, confidence: 0 };
  }

  calculateSelectorSimilarity(original, current) {
    const distance = levenshtein(original, current);
    const maxLength = Math.max(original.length, current.length) || 1;
    const similarity = 1 - distance / maxLength;
    return { distance, similarity, threshold: similarity > 0.7 };
  }

  /** Store a locator usage outcome for later stability analysis (call from your runner) */
  buildUsageRecord(testCaseId, locator, successful, extra = {}) {
    return { testCaseId, locator, timestamp: new Date(), successful, ...extra };
  }

  /** Aggregate a locator's history into a stability score */
  analyzeLocatorStability(locatorHistory) {
    const totalUses = locatorHistory.length || 1;
    const successfulUses = locatorHistory.filter((h) => h.successful).length;
    const failureRate = (totalUses - successfulUses) / totalUses;
    return {
      locator: locatorHistory[0]?.locator,
      totalUses,
      successfulUses,
      failureRate,
      stabilityScore: 1 - failureRate,
      isStable: failureRate < 0.1,
      recommendation: failureRate < 0.1 ? "KEEP" : "REPLACE",
    };
  }

  isGenericClass(className) {
    const generic = ["container", "wrapper", "main", "content", "row", "col", "btn", "card", "item"];
    return generic.some((g) => className.toLowerCase().includes(g));
  }

  inferRole(tag) {
    const roleMap = { button: "button", a: "link", input: "textbox", select: "combobox", h1: "heading", nav: "navigation", img: "img" };
    return roleMap[(tag || "").toLowerCase()] || null;
  }

  calculateConfidence(attempt, total) {
    return Math.max(0, 1 - attempt / total);
  }
}

module.exports = new SelfHealingEngine();
