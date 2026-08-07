/**
 * conditionalController.js
 * Place at: server/controllers/conditionalController.js
 */

const sql = require("mssql");
const { poolPromise } = require("../config/db");
const conditionalExecutor = require("../services/conditionalExecutor");

exports.validateBlocks = async (req, res) => {
  try {
    const { blocks } = req.body;
    const warnings = [];

    const validate = (list) => {
      for (const block of list || []) {
        const type = block.type || block.blockType;
        if (["IF", "WHILE"].includes(type) && !block.condition) {
          warnings.push(`${type} block is missing a condition`);
        }
        if (type === "LOOP" && block.iterations === undefined) {
          warnings.push("LOOP block is missing iterations");
        }
        if (type === "FOREACH" && !block.collection) {
          warnings.push("FOREACH block is missing a collection expression");
        }
        try {
          if (block.condition) conditionalExecutor.evaluateCondition(block.condition, {});
        } catch (err) {
          warnings.push(`Condition syntax error: ${err.message}`);
        }
        if (block.children) validate(block.children);
      }
    };
    validate(blocks);

    res.json({ success: true, valid: warnings.length === 0, warnings });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.saveBlocks = async (req, res) => {
  try {
    const { testCaseId, blocks } = req.body;
    const pool = await poolPromise;

    const saveBlock = async (block, parentId, order) => {
      const result = await pool
        .request()
        .input("testCaseId", sql.Int, testCaseId)
        .input("blockType", sql.VarChar, block.type || block.blockType)
        .input("condition", sql.NVarChar(sql.MAX), block.condition || block.collection || String(block.iterations ?? ""))
        .input("parentId", sql.Int, parentId)
        .input("order", sql.Int, order).query(`
          INSERT INTO dbo.conditional_blocks (test_case_id, block_type, condition_expr, parent_block_id, sequence_order)
          OUTPUT INSERTED.id
          VALUES (@testCaseId, @blockType, @condition, @parentId, @order)
        `);
      const blockId = result.recordset[0].id;

      const steps = block.steps || block.ifSteps || [];
      for (let i = 0; i < steps.length; i++) {
        await pool
          .request()
          .input("blockId", sql.Int, blockId)
          .input("order", sql.Int, i)
          .input("stepType", sql.VarChar, steps[i].action || "custom")
          .input("stepConfig", sql.NVarChar(sql.MAX), JSON.stringify(steps[i]))
          .query(`INSERT INTO dbo.conditional_block_steps (block_id, step_order, step_type, step_config) VALUES (@blockId, @order, @stepType, @stepConfig)`);
      }

      for (let i = 0; i < (block.children || []).length; i++) {
        await saveBlock(block.children[i], blockId, i);
      }
    };

    for (let i = 0; i < blocks.length; i++) {
      await saveBlock(blocks[i], null, i);
    }

    res.json({ success: true, data: { saved: blocks.length } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
