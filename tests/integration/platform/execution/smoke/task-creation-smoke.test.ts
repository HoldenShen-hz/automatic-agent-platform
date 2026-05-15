/**
 * Smoke Test: Task Creation
 *
 * Verifies task creation through various surfaces.
 * Part of the smoke test suite in tests/integration/platform/five-plane-execution/smoke/.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { SqliteDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { newId, nowIso } from "../../../../../src/platform/contracts/types/ids.js";

test("smoke: task can be created via direct store insertion", () => {
  const workspace = createTempWorkspace("smoke-task-create-");

  try {
    const dbPath = join(workspace, "task_create.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    const taskId = newId("task");
    const now = nowIso();

    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Smoke test task creation",
        status: "pending",
        source: "user",
        priority: "normal",
        inputJson: '{"request": "test task"}',
        normalizedInputJson: '{"request": "test task"}',
        outputJson: null,
        estimatedCostUsd: 0,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });
    });

    const tasks = store.listTasks(10);
    const found = tasks.find((t) => t.id === taskId);

    assert.ok(found, "Task should be findable after insertion");
    assert.strictEqual(found!.title, "Smoke test task creation");
    assert.strictEqual(found!.status, "pending");
    assert.strictEqual(found!.source, "user");
    assert.strictEqual(found!.priority, "normal");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("smoke: task with different priority levels can be created", () => {
  const workspace = createTempWorkspace("smoke-task-priority-");

  try {
    const dbPath = join(workspace, "priority.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    const priorities = ["low", "normal", "high", "urgent"] as const;
    const taskIds: string[] = [];
    const now = nowIso();

    db.transaction(() => {
      for (const priority of priorities) {
        const taskId = newId("task");
        taskIds.push(taskId);
        store.insertTask({
          id: taskId,
          parentId: null,
          rootId: taskId,
          divisionId: "general_ops",
          title: `Priority ${priority} task`,
          status: "pending",
          source: "user",
          priority,
          inputJson: "{}",
          normalizedInputJson: "{}",
          outputJson: null,
          estimatedCostUsd: 0,
          actualCostUsd: 0,
          errorCode: null,
          createdAt: now,
          updatedAt: now,
          completedAt: null,
        });
      }
    });

    const tasks = store.listTasks(10);

    for (let i = 0; i < priorities.length; i++) {
      const found = tasks.find((t) => t.id === taskIds[i]);
      assert.ok(found, `Task with priority ${priorities[i]} should exist`);
      assert.strictEqual(found!.priority, priorities[i]);
    }

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("smoke: task with various sources can be created", () => {
  const workspace = createTempWorkspace("smoke-task-source-");

  try {
    const dbPath = join(workspace, "source.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    const sources = ["user", "perception", "system"] as const;
    const taskIds: string[] = [];
    const now = nowIso();

    db.transaction(() => {
      for (const source of sources) {
        const taskId = newId("task");
        taskIds.push(taskId);
        store.insertTask({
          id: taskId,
          parentId: null,
          rootId: taskId,
          divisionId: "general_ops",
          title: `Source ${source} task`,
          status: "pending",
          source,
          priority: "normal",
          inputJson: "{}",
          normalizedInputJson: "{}",
          outputJson: null,
          estimatedCostUsd: 0,
          actualCostUsd: 0,
          errorCode: null,
          createdAt: now,
          updatedAt: now,
          completedAt: null,
        });
      }
    });

    const tasks = store.listTasks(10);

    for (let i = 0; i < sources.length; i++) {
      const found = tasks.find((t) => t.id === taskIds[i]);
      assert.ok(found, `Task with source ${sources[i]} should exist`);
      assert.strictEqual(found!.source, sources[i]);
    }

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("smoke: task can be retrieved by ID", () => {
  const workspace = createTempWorkspace("smoke-task-get-");

  try {
    const dbPath = join(workspace, "get.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    const divisions = ["general_ops", "platform_team", "data_team"];
    const taskIds: string[] = [];
    const now = nowIso();

    db.transaction(() => {
      for (const divisionId of divisions) {
        const taskId = newId("task");
        taskIds.push(taskId);
        store.insertTask({
          id: taskId,
          parentId: null,
          rootId: taskId,
          divisionId,
          title: `Division ${divisionId} task`,
          status: "pending",
          source: "user",
          priority: "normal",
          inputJson: "{}",
          normalizedInputJson: "{}",
          outputJson: null,
          estimatedCostUsd: 0,
          actualCostUsd: 0,
          errorCode: null,
          createdAt: now,
          updatedAt: now,
          completedAt: null,
        });
      }
    });

    // Use getTask to retrieve each task directly
    for (let i = 0; i < divisions.length; i++) {
      const taskId = taskIds[i]!;
      const found = store.getTask(taskId);
      assert.ok(found, `Task in division ${divisions[i]} should exist via getTask`);
      assert.strictEqual(found!.divisionId, divisions[i]);
    }

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("smoke: task input and output JSON are preserved", () => {
  const workspace = createTempWorkspace("smoke-task-json-");

  try {
    const dbPath = join(workspace, "json.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    const taskId = newId("task");
    const now = nowIso();
    const inputData = {
      request: "analyze this repository",
      context: { repoUrl: "https://github.com/example/repo", branch: "main" },
    };
    const outputData = {
      summary: "Repository analysis complete",
      findings: ["Finding 1", "Finding 2"],
    };

    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "JSON preservation test",
        status: "done",
        source: "user",
        priority: "normal",
        inputJson: JSON.stringify(inputData),
        normalizedInputJson: JSON.stringify(inputData),
        outputJson: JSON.stringify(outputData),
        estimatedCostUsd: 0.05,
        actualCostUsd: 0.03,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: now,
      });
    });

    const tasks = store.listTasks(10);
    const found = tasks.find((t) => t.id === taskId);

    assert.ok(found, "Task should be findable");
    assert.strictEqual(found!.status, "done");

    const parsedInput = JSON.parse(found!.inputJson);
    assert.deepStrictEqual(parsedInput, inputData);

    const parsedOutput = JSON.parse(found!.outputJson!);
    assert.deepStrictEqual(parsedOutput, outputData);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});
