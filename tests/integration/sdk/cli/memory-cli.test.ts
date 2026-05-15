import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import test from "node:test";

import { parseStructuredMemoryContent } from "../../../../src/platform/five-plane-state-evidence/memory/memory-schema.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";

function runCli<T>(scriptName: string, env: NodeJS.ProcessEnv): T {
  const stdout = execFileSync(process.execPath, [join(process.cwd(), "dist", "src", "sdk", "cli", scriptName)], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ...env,
    },
    encoding: "utf8",
  });

  return JSON.parse(stdout) as T;
}

test("memory CLI remembers lists and revokes entries", () => {
  const workspace = createTempWorkspace("aa-memory-cli-");
  const dbPath = join(workspace, "memory-cli.db");

  try {
    const remembered = runCli<{ id: string; scope: string; classification: string }>("memory.js", {
      AA_DB_PATH: dbPath,
      AA_MEMORY_ACTION: "remember",
      AA_MEMORY_SCOPE: "project",
      AA_MEMORY_TEXT: "document the operator rollback path",
      AA_MEMORY_CLASSIFICATION: "internal",
      AA_MEMORY_QUALITY_SCORE: "0.8",
    });

    assert.equal(remembered.scope, "project");
    assert.equal(remembered.classification, "internal");

    const listed = runCli<Array<{ id: string; scope: string; hitCount: number }>>("memory.js", {
      AA_DB_PATH: dbPath,
      AA_MEMORY_ACTION: "list",
      AA_MEMORY_SCOPES: "project",
    });

    assert.equal(listed.length, 1);
    assert.equal(listed[0]?.id, remembered.id);
    assert.equal(listed[0]?.hitCount, 1);

    const quality = runCli<{ totalCount: number; recalledCount: number }>("memory.js", {
      AA_DB_PATH: dbPath,
      AA_MEMORY_ACTION: "quality",
    });

    assert.equal(quality.totalCount, 1);
    assert.equal(quality.recalledCount, 1);

    const revoked = runCli<{ id: string; revocationReason: string | null } | null>("memory.js", {
      AA_DB_PATH: dbPath,
      AA_MEMORY_ACTION: "revoke",
      AA_MEMORY_ID: remembered.id,
      AA_MEMORY_REVOCATION_REASON: "manual cleanup",
    });

    assert.equal(revoked?.id, remembered.id);
    assert.equal(revoked?.revocationReason, "manual cleanup");
  } finally {
    cleanupPath(workspace);
  }
});

test("memory CLI consolidates short-term memories into a summarized long-term entry", () => {
  const workspace = createTempWorkspace("aa-memory-cli-consolidate-");
  const dbPath = join(workspace, "memory-cli-consolidate.db");

  try {
    for (const [index, text] of [
      "capture operator rollback prerequisites",
      "record queue replay safeguards",
      "preserve writeback fail-close rationale",
    ].entries()) {
      runCli("memory.js", {
        AA_DB_PATH: dbPath,
        AA_MEMORY_ACTION: "remember",
        AA_TASK_ID: "task-cli-memory",
        AA_MEMORY_SCOPE: "project",
        AA_MEMORY_TEXT: text,
        AA_MEMORY_CLASSIFICATION: "internal",
        AA_MEMORY_QUALITY_SCORE: "0.8",
        AA_MEMORY_LAYER: "layer_3",
        AA_MEMORY_CREATED_AT: `2026-04-07T09:0${index}:00.000Z`,
      });
    }

    const consolidated = runCli<{
      consolidated: boolean;
      sourceMemoryIds: string[];
      createdMemory: { id: string; memoryLayer: string; classification: string } | null;
    }>("memory.js", {
      AA_DB_PATH: dbPath,
      AA_MEMORY_ACTION: "consolidate",
      AA_TASK_ID: "task-cli-memory",
      AA_MEMORY_SCOPES: "project",
      AA_MEMORY_MIN_SOURCE_MEMORIES: "3",
      AA_MEMORY_BEFORE_CREATED_AT: "2026-04-07T10:00:00.000Z",
      AA_MEMORY_EVALUATED_AT: "2026-04-07T10:05:00.000Z",
    });

    assert.equal(consolidated.consolidated, true);
    assert.equal(consolidated.createdMemory?.memoryLayer, "layer_5");
    assert.equal(consolidated.createdMemory?.classification, "summary");
    assert.equal(consolidated.sourceMemoryIds.length, 3);

    const longTerm = runCli<Array<{ id: string; memoryLayer: string }>>("memory.js", {
      AA_DB_PATH: dbPath,
      AA_MEMORY_ACTION: "list",
      AA_TASK_ID: "task-cli-memory",
      AA_MEMORY_SCOPES: "project",
      AA_MEMORY_LAYERS: "layer_5",
    });

    assert.equal(longTerm.length, 1);
    assert.equal(longTerm[0]?.id, consolidated.createdMemory?.id);
  } finally {
    cleanupPath(workspace);
  }
});

test("memory CLI remembers canonical structured memory fields from dedicated env vars", () => {
  const workspace = createTempWorkspace("aa-memory-cli-structured-");
  const dbPath = join(workspace, "memory-cli-structured.db");

  try {
    const remembered = runCli<{ contentJson: string }>("memory.js", {
      AA_DB_PATH: dbPath,
      AA_MEMORY_ACTION: "remember",
      AA_MEMORY_SCOPE: "project",
      AA_MEMORY_WORK_CONTEXT: "stabilize recovery pipeline",
      AA_MEMORY_TOP_OF_MIND: "queue replay,authoritative writeback",
      AA_MEMORY_RECENT_HISTORY: "duplicate delivery drill passed",
      AA_MEMORY_LONG_TERM_BACKGROUND: "phase2 remediation",
      AA_MEMORY_FACTS_JSON: JSON.stringify([
        { content: "fail closed on stale snapshots", category: "safety_rule", confidence: 0.95 },
      ]),
    });

    const structured = parseStructuredMemoryContent(remembered.contentJson);
    assert.equal(structured.workContext, "stabilize recovery pipeline");
    assert.deepEqual(structured.topOfMind, ["queue replay", "authoritative writeback"]);
    assert.deepEqual(structured.recentHistory, ["duplicate delivery drill passed"]);
    assert.deepEqual(structured.longTermBackground, ["phase2 remediation"]);
    assert.equal(structured.facts[0]?.content, "fail closed on stale snapshots");
  } finally {
    cleanupPath(workspace);
  }
});
