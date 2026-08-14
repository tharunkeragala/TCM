class ConditionalExecutor {
  /** Evaluate a boolean condition expression with {{variables}} substituted */
  evaluateCondition(expression, variables) {
    let code = String(expression);
    for (const [key, value] of Object.entries(variables || {})) {
      const escaped = typeof value === "string" ? JSON.stringify(value) : value;
      code = code.split(`{{${key}}}`).join(escaped);
    }
    try {
      // eslint-disable-next-line no-new-func
      return Boolean(Function('"use strict"; return (' + code + ")")());
    } catch (err) {
      throw new Error(`Condition evaluation failed ("${expression}"): ${err.message}`);
    }
  }

  /** Evaluate a general (non-boolean) expression, e.g. iteration count or collection */
  evaluateExpression(expression, variables) {
    let code = String(expression);
    for (const [key, value] of Object.entries(variables || {})) {
      const escaped = typeof value === "string" ? JSON.stringify(value) : JSON.stringify(value);
      code = code.split(`{{${key}}}`).join(typeof value === "string" ? escaped : value);
    }
    try {
      // eslint-disable-next-line no-new-func
      return Function('"use strict"; return (' + code + ")")();
    } catch (err) {
      throw new Error(`Expression evaluation failed ("${expression}"): ${err.message}`);
    }
  }

  async executeIfBlock(block, variables, executor) {
    const conditionMet = this.evaluateCondition(block.condition, variables);
    const branch = conditionMet ? block.ifSteps : block.elseSteps;
    for (const step of branch || []) {
      await executor.executeStep(step, variables);
    }
  }

  async executeSwitchBlock(block, variables, executor) {
    const expressionValue = this.evaluateExpression(block.expression, variables);
    for (const caseBlock of block.cases || []) {
      if (String(expressionValue) === String(caseBlock.value) || caseBlock.isDefault) {
        for (const step of caseBlock.steps || []) {
          await executor.executeStep(step, variables);
        }
        if (!block.fallthrough) break;
      }
    }
  }

  async executeLoopBlock(block, variables, executor) {
    const iterations = this.evaluateExpression(block.iterations, variables);
    for (let i = 0; i < iterations; i++) {
      const loopVars = { ...variables, [block.iteratorVar || "i"]: i };
      for (const step of block.steps || []) {
        await executor.executeStep(step, loopVars);
      }
    }
  }

  async executeWhileBlock(block, variables, executor, maxIterations = 100) {
    let iterations = 0;
    while (this.evaluateCondition(block.condition, variables) && iterations < maxIterations) {
      for (const step of block.steps || []) {
        await executor.executeStep(step, variables);
      }
      iterations++;
    }
    if (iterations >= maxIterations) {
      console.warn(`[conditionalExecutor] WHILE loop exceeded max iterations: ${maxIterations}`);
    }
  }

  async executeForeachBlock(block, variables, executor) {
    const collection = this.evaluateExpression(block.collection, variables);
    if (!Array.isArray(collection)) throw new Error("FOREACH collection must resolve to an array");
    for (const item of collection) {
      const loopVars = { ...variables, [block.itemVar || "item"]: item };
      for (const step of block.steps || []) {
        await executor.executeStep(step, loopVars);
      }
    }
  }

  /** Recursively execute a tree of blocks in order */
  async executeBlockTree(blocks, variables, executor) {
    for (const block of blocks || []) {
      switch (block.blockType || block.type) {
        case "IF":
          await this.executeIfBlock(block, variables, executor);
          break;
        case "SWITCH":
          await this.executeSwitchBlock(block, variables, executor);
          break;
        case "LOOP":
          await this.executeLoopBlock(block, variables, executor);
          break;
        case "WHILE":
          await this.executeWhileBlock(block, variables, executor);
          break;
        case "FOREACH":
          await this.executeForeachBlock(block, variables, executor);
          break;
        default:
          throw new Error(`Unknown block type: ${block.blockType || block.type}`);
      }
      // Support nested child blocks
      if (block.children && block.children.length) {
        await this.executeBlockTree(block.children, variables, executor);
      }
    }
  }
}

module.exports = new ConditionalExecutor();
