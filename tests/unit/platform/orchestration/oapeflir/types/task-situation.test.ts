import test from "node:test";
import assert from "node:assert/strict";

import {
  TaskSituationSchema,
  parseTaskSituation,
  createTaskSituationRef,
} from "../../../../../../src/platform/orchestration/oapeflir/types/task-situation.js";

test("TaskSituationSchema parses valid task situation", () => {
  const validData = {
    taskId: "task_123",
    timestamp: Date.now(),
    objective: "Test objective",
    currentPhase: "planning",
    userIntent: {
      raw: "Test user intent",
      normalized: "test user intent",
      confidence: 0.9,
    },
    blockers: [],
    codebaseSnapshot: {
      rootPath: "/test",
      fileCount: 10,
      relevantFiles: [],
    },
    environmentContext: {
      nodeVersion: "20.0.0",
      platform: "darwin",
      workingDirectory: "/test",
      availableTools: [],
    },
    historicalContext: {
      previousTaskIds: [],
      relatedMemoryRefs: [],
    },
  };

  const result = TaskSituationSchema.parse(validData);
  assert.equal(result.taskId, "task_123");
  assert.equal(result.objective, "Test objective");
  assert.equal(result.currentPhase, "planning");
});

test("TaskSituationSchema applies defaults", () => {
  const minimalData = {
    taskId: "task_456",
    timestamp: Date.now(),
    objective: "Minimal objective",
    currentPhase: "intake",
    userIntent: {
      raw: "Raw",
      normalized: "normalized",
      confidence: 0.5,
    },
    blockers: [],
    codebaseSnapshot: {
      rootPath: "/",
      fileCount: 0,
      relevantFiles: [],
    },
    environmentContext: {
      nodeVersion: "20.0.0",
      platform: "linux",
      workingDirectory: "/",
      availableTools: [],
    },
    historicalContext: {},
  };

  const result = TaskSituationSchema.parse(minimalData);
  assert.deepEqual(result.blockers, []);
  assert.deepEqual(result.relevantMemory, []);
  assert.deepEqual(result.fileRefs, []);
  assert.deepEqual(result.metrics, {});
});

test("TaskSituationSchema rejects invalid phase", () => {
  assert.throws(() => {
    TaskSituationSchema.parse({
      taskId: "task_789",
      timestamp: Date.now(),
      objective: "Test",
      currentPhase: "invalid_phase",
      userIntent: { raw: "r", normalized: "n", confidence: 0.5 },
      blockers: [],
      codebaseSnapshot: { rootPath: "/", fileCount: 0, relevantFiles: [] },
      environmentContext: { nodeVersion: "v", platform: "p", workingDirectory: "/", availableTools: [] },
      historicalContext: { previousTaskIds: [], relatedMemoryRefs: [] },
    });
  });
});

test("TaskSituationSchema rejects missing required fields", () => {
  assert.throws(() => {
    TaskSituationSchema.parse({
      taskId: "task_only",
    });
  });
});

test("parseTaskSituation returns parsed TaskSituation", () => {
  const input = {
    taskId: "task_parse_1",
    timestamp: 1234567890,
    objective: "Parse test",
    currentPhase: "executing",
    userIntent: {
      raw: "execute task",
      normalized: "execute",
      confidence: 0.8,
    },
    blockers: [
      { description: "Resource constraint", severity: "medium" },
    ],
    codebaseSnapshot: {
      rootPath: "/project",
      fileCount: 50,
      relevantFiles: [{ path: "/src/main.ts", language: "typescript" }],
    },
    environmentContext: {
      nodeVersion: "20.0.0",
      platform: "darwin",
      workingDirectory: "/project",
      availableTools: ["git", "npm"],
    },
    historicalContext: {
      previousTaskIds: ["task_prev_1"],
      relatedMemoryRefs: ["memory:ref_1"],
    },
  };

  const result = parseTaskSituation(input);
  assert.equal(result.taskId, "task_parse_1");
  assert.equal(result.objective, "Parse test");
  assert.equal(result.currentPhase, "executing");
  assert.equal(result.userIntent.confidence, 0.8);
  assert.equal(result.blockers.length, 1);
  assert.equal(result.codebaseSnapshot.fileCount, 50);
});

test("parseTaskSituation throws on invalid input", () => {
  assert.throws(() => {
    parseTaskSituation({
      taskId: "",
      timestamp: 0,
      objective: "Test",
      currentPhase: "invalid",
      userIntent: { raw: "", normalized: "", confidence: 0 },
      blockers: [],
      codebaseSnapshot: { rootPath: "", fileCount: 0, relevantFiles: [] },
      environmentContext: { nodeVersion: "", platform: "", workingDirectory: "", availableTools: [] },
      historicalContext: {},
    });
  });
});

test("createTaskSituationRef formats ref correctly", () => {
  const situation = {
    taskId: "task_ref_1",
    timestamp: 1234567890,
  };

  const ref = createTaskSituationRef(situation);
  assert.equal(ref, "task_situation:task_ref_1:1234567890");
});

test("createTaskSituationRef handles different timestamps", () => {
  const situation1 = { taskId: "task_1", timestamp: 1000 };
  const situation2 = { taskId: "task_1", timestamp: 2000 };

  const ref1 = createTaskSituationRef(situation1);
  const ref2 = createTaskSituationRef(situation2);

  assert.notEqual(ref1, ref2);
  assert.equal(ref1, "task_situation:task_1:1000");
  assert.equal(ref2, "task_situation:task_1:2000");
});
