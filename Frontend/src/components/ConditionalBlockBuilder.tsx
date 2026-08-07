/**
 * ConditionalBlockBuilder.tsx
 * Place at: same feature folder as PlaywrightEditor.tsx, under a `components/` subfolder
 *   e.g. .../Playwright/components/ConditionalBlockBuilder.tsx
 */
import React, { useState } from "react";
import { FaPlus, FaTrash } from "react-icons/fa";
import API from "../services/api";
import { authHeaders } from "../pages/TestManagement/Playwright/helpers";

type BlockType = "IF" | "SWITCH" | "LOOP" | "WHILE" | "FOREACH";

interface Block {
  id: string;
  type: BlockType;
  condition?: string;
  iterations?: number;
  collection?: string;
  steps: { action: string; selector?: string }[];
  children: Block[];
}

interface Props {
  testCaseId: number | string;
}

export default function ConditionalBlockBuilder({ testCaseId }: Props) {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const newBlock = (): Block => ({ id: `block-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, type: "IF", steps: [], children: [] });

  const addBlock = (parentId?: string) => {
    if (!parentId) {
      setBlocks([...blocks, newBlock()]);
      return;
    }
    setBlocks(updateBlockInTree(blocks, parentId, (b) => ({ ...b, children: [...b.children, newBlock()] })));
  };

  const updateBlockInTree = (list: Block[], blockId: string, updater: (b: Block) => Block): Block[] =>
    list.map((b) => (b.id === blockId ? updater(b) : { ...b, children: updateBlockInTree(b.children, blockId, updater) }));

  const removeBlockFromTree = (list: Block[], blockId: string): Block[] =>
    list.filter((b) => b.id !== blockId).map((b) => ({ ...b, children: removeBlockFromTree(b.children, blockId) }));

  const patchBlock = (id: string, patch: Partial<Block>) => setBlocks(updateBlockInTree(blocks, id, (b) => ({ ...b, ...patch })));

  const validateAndSave = async () => {
    try {
      const res = await API.post("/api/advanced/conditional/validate", { testCaseId, blocks }, { headers: authHeaders() });
      if (!res.data.valid) {
        setMessage(`Warnings: ${res.data.warnings.join("; ")}`);
        return;
      }
      const saveRes = await API.post("/api/advanced/conditional/save", { testCaseId, blocks }, { headers: authHeaders() });
      setMessage(saveRes.data.success ? "Saved conditional flow." : "Failed to save.");
    } catch (err: any) {
      setMessage(err.response?.data?.error || "Validation failed.");
    }
  };

  const renderBlock = (block: Block) => (
    <div key={block.id} className="mb-4 ml-4 border-l-2 border-blue-500 pl-4">
      <div className="rounded-lg bg-blue-50 p-4 dark:bg-blue-950/40">
        <div className="mb-3 flex items-center justify-between">
          <select
            value={block.type}
            onChange={(e) => patchBlock(block.id, { type: e.target.value as BlockType })}
            className="rounded border px-3 py-1 text-sm font-medium dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          >
            <option>IF</option>
            <option>SWITCH</option>
            <option>LOOP</option>
            <option>WHILE</option>
            <option>FOREACH</option>
          </select>
          <button onClick={() => setBlocks(removeBlockFromTree(blocks, block.id))} className="text-red-500 hover:text-red-700">
            <FaTrash />
          </button>
        </div>

        {["IF", "WHILE"].includes(block.type) && (
          <div className="mb-3">
            <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">Condition</label>
            <input
              value={block.condition || ""}
              onChange={(e) => patchBlock(block.id, { condition: e.target.value })}
              placeholder='e.g. {{response.status}} == "ACTIVE"'
              className="w-full rounded border px-2 py-1 font-mono text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            />
          </div>
        )}

        {block.type === "LOOP" && (
          <div className="mb-3">
            <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">Iterations</label>
            <input
              type="number"
              min={1}
              value={block.iterations ?? 1}
              onChange={(e) => patchBlock(block.id, { iterations: parseInt(e.target.value, 10) })}
              className="w-full rounded border px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            />
          </div>
        )}

        {block.type === "FOREACH" && (
          <div className="mb-3">
            <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">Collection (e.g. {"{{items}}"})</label>
            <input
              value={block.collection || ""}
              onChange={(e) => patchBlock(block.id, { collection: e.target.value })}
              className="w-full rounded border px-2 py-1 font-mono text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            />
          </div>
        )}

        {block.children.length > 0 && <div className="mt-4 border-t pt-3 dark:border-gray-700">{block.children.map(renderBlock)}</div>}

        <button onClick={() => addBlock(block.id)} className="mt-3 flex items-center gap-1 rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700">
          <FaPlus /> Add Nested Block
        </button>
      </div>
    </div>
  );

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Conditional Execution Flow</h3>

      {message && <div className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">{message}</div>}

      <div className="space-y-4">
        {blocks.map(renderBlock)}
        <button onClick={() => addBlock()} className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700">
          <FaPlus /> Add Conditional Block
        </button>
      </div>

      {blocks.length > 0 && (
        <button onClick={validateAndSave} className="mt-4 w-full rounded-lg bg-gray-800 px-4 py-2 text-sm font-medium text-white hover:bg-gray-900 dark:bg-gray-700">
          Validate &amp; Save
        </button>
      )}

      <div className="mt-6 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
        <p className="mb-2 font-medium">Condition syntax examples:</p>
        <ul className="space-y-1">
          <li><code>{'{{response.status}} == "ACTIVE"'}</code></li>
          <li><code>{'{{country}} == "US"'}</code></li>
          <li><code>{'{{user.role}} == "admin" && {{isLoggedIn}} == true'}</code></li>
        </ul>
      </div>
    </div>
  );
}
