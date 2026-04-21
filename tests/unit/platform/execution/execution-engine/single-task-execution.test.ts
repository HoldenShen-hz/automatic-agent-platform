import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync, unlinkSync } from "node:fs";

import { runSingleTaskExecution, type HappyPathInput } from "../../../../../../src/platform/execution/execution-engine/single-task-execution.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

test("runSingleTaskExecution happy path execution", async () => {
  const dbPath = join(__dirname, "test-happy-path.db");

  // Clean up any existing test database
  if (existsSync(dbPath)) {
    unlinkSync(dbPath);
  }

  const input: HappyPathInput = {
    dbPath,
    title: "Test Single Task",
    request: "Say hello",
    // Use stepOutputOverride to avoid needing LLM provider
    stepOutputOverride: {
      summary: "Test summary",
      result: "Test result",
    },
  };

  try {
    const snapshot = await runSingleTaskExecution(input);

    assert.ok(snapshot, "runSingleTaskExecution should return a snapshot");
    assert.ok(snapshot.task, "snapshot should have task property");
    assert.equal(snapshot.task.title, "Test Single Task", "task title should match");
    assert.equal(snapshot.task.status, "done", "task status should be done");
  } finally {
    // Clean up test database
    if (existsSync(dbPath)) {
      unlinkSync(dbPath);
    }
  }
});

test("runSingleTaskExecution with stepOutputOverride", async () => {
  const dbPath = join(__dirname, "test-step-override.db");

  if (existsSync(dbPath)) {
    unlinkSync(dbPath);
  }

  const customOutput = {
    summary: "Custom summary",
    result: "Custom result",
    extraField: "extra value",
  };

  const input: HappyPathInput = {
    dbPath,
    title: "Test Step Override",
    request: "Test request",
    stepOutputOverride: customOutput,
  };

  try {
    const snapshot = await runSingleTaskExecution(input);

    assert.ok(snapshot, "runSingleTaskExecution should return a snapshot");
    assert.ok(snapshot.task, "snapshot should have task property");
  } finally {
    if (existsSync(dbPath)) {
      unlinkSync(dbPath);
    }
  }
});

test("runSingleTaskExecution creates task with correct divisionId", async () => {
  const dbPath = join(__dirname, "test-division.db");

  if (existsSync(dbPath)) {
    unlinkSync(dbPath);
  }

  const input: HappyPathInput = {
    dbPath,
    title: "Test Division",
    request: "Division test",
    stepOutputOverride: { summary: "test", result: "test" },
  };

  try {
    const snapshot = await runSingleTaskExecution(input);

    assert.ok(snapshot.task.divisionId, "task should have divisionId");
    assert.equal(typeof snapshot.task.divisionId, "string", "divisionId should be a string");
  } finally {
    if (existsSync(dbPath)) {
      unlinkSync(dbPath);
    }
  }
});

test("runSingleTaskExecution sets task priority", async () => {
  const dbPath = join(__dirname, "test-priority.db");

  if (existsSync(dbPath)) {
    unlinkSync(dbPath);
  }

  const input: HappyPathInput = {
    dbPath,
    title: "Test Priority",
    request: "Priority test",
    stepOutputOverride: { summary: "test", result: "test" },
  };

  try {
    const snapshot = await runSingleTaskExecution(input);

    assert.equal(snapshot.task.priority, "normal", "task should have normal priority by default");
  } finally {
    if (existsSync(dbPath)) {
      unlinkSync(dbPath);
    }
  }
});

test("runSingleTaskExecution creates workflow record", async () => {
  const dbPath = join(__dirname, "test-workflow.db");

  if (existsSync(dbPath)) {
    unlinkSync(dbPath);
  }

  const input: HappyPathInput = {
    dbPath,
    title: "Test Workflow Record",
    request: "Workflow test",
    stepOutputOverride: { summary: "test", result: "test" },
  };

  try {
    const snapshot = await runSingleTaskExecution(input);

    assert.ok(snapshot.workflow, "snapshot should have workflow property");
    assert.equal(snapshot.workflow.taskId, snapshot.task.id, "workflow taskId should match task id");
  } finally {
    if (existsSync(dbPath)) {
      unlinkSync(dbPath);
    }
  }
});

test("runSingleTaskExecution creates session record", async () => {
  const dbPath = join(__dirname, "test-session.db");

  if (existsSync(dbPath)) {
    unlinkSync(dbPath);
  }

  const input: HappyPathInput = {
    dbPath,
    title: "Test Session Record",
    request: "Session test",
    stepOutputOverride: { summary: "test", result: "test" },
  };

  try {
    const snapshot = await runSingleTaskExecution(input);

    assert.ok(snapshot.session, "snapshot should have session property");
    assert.equal(snapshot.session.taskId, snapshot.task.id, "session taskId should match task id");
    assert.equal(snapshot.session.channel, "cli", "session channel should be cli");
  } finally {
    if (existsSync(dbPath)) {
      unlinkSync(dbPath);
    }
  }
});

test("runSingleTaskExecution creates execution record", async () => {
  const dbPath = join(__dirname, "test-execution.db");

  if (existsSync(dbPath)) {
    unlinkSync(dbPath);
  }

  const input: HappyPathInput = {
    dbPath,
    title: "Test Execution Record",
    request: "Execution test",
    stepOutputOverride: { summary: "test", result: "test" },
  };

  try {
    const snapshot = await runSingleTaskExecution(input);

    assert.ok(Array.isArray(snapshot.executions), "snapshot should have executions array");
    assert.ok(snapshot.executions.length > 0, "executions array should not be empty");
  } finally {
    if (existsSync(dbPath)) {
      unlinkSync(dbPath);
    }
  }
});

test("runSingleTaskExecution creates step output", async () => {
  const dbPath = join(__dirname, "test-step-output.db");

  if (existsSync(dbPath)) {
    unlinkSync(dbPath);
  }

  const input: HappyPathInput = {
    dbPath,
    title: "Test Step Output",
    request: "Step output test",
    stepOutputOverride: { summary: "Custom step", result: "Custom result" },
  };

  try {
    const snapshot = await runSingleTaskExecution(input);

    assert.ok(Array.isArray(snapshot.stepOutputs), "snapshot should have stepOutputs array");
  } finally {
    if (existsSync(dbPath)) {
      unlinkSync(dbPath);
    }
  }
});

test("runSingleTaskExecution with null stepOutputOverride falls back to synthetic output", async () => {
  const dbPath = join(__dirname, "test-synthetic.db");

  if (existsSync(dbPath)) {
    unlinkSync(dbPath);
  }

  const input: HappyPathInput = {
    dbPath,
    title: "Test Synthetic Output",
    request: "Synthetic test",
    stepOutputOverride: null, // This should cause the code to use synthetic output
  };

  try {
    // This may or may not produce output depending on LLM provider availability
    // Just verify it doesn't throw
    const snapshot = await runSingleTaskExecution(input);
    assert.ok(snapshot, "runSingleTaskExecution should complete even with null stepOutputOverride");
  } finally {
    if (existsSync(dbPath)) {
      unlinkSync(dbPath);
    }
  }
});

test("runSingleTaskExecution generates valid timestamps", async () => {
  const dbPath = join(__dirname, "test-timestamps.db");

  if (existsSync(dbPath)) {
    unlinkSync(dbPath);
  }

  const input: HappyPathInput = {
    dbPath,
    title: "Test Timestamps",
    request: "Timestamp test",
    stepOutputOverride: { summary: "test", result: "test" },
  };

  try {
    const snapshot = await runSingleTaskExecution(input);

    assert.ok(snapshot.task.createdAt, "task should have createdAt");
    assert.ok(snapshot.task.updatedAt, "task should have updatedAt");
    // ISO 8601 format check
    assert.match(snapshot.task.createdAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  } finally {
    if (existsSync(dbPath)) {
      unlinkSync(dbPath);
    }
  }
});

test("runSingleTaskExecution handles admission policy", async () => {
  const dbPath = join(__dirname, "test-admission.db");

  if (existsSync(dbPath)) {
    unlinkSync(dbPath);
  }

  const input: HappyPathInput = {
    dbPath,
    title: "Test Admission Policy",
    request: "Admission test",
    stepOutputOverride: { summary: "test", result: "test" },
  };

  try {
    const snapshot = await runSingleTaskExecution(input);
    assert.ok(snapshot, "runSingleTaskExecution should work with admission policy");
  } finally {
    if (existsSync(dbPath)) {
      unlinkSync(dbPath);
    }
  }
});

test("runSingleTaskExecution task output JSON is valid", async () => {
  const dbPath = join(__dirname, "test-output-json.db");

  if (existsSync(dbPath)) {
    unlinkSync(dbPath);
  }

  const input: HappyPathInput = {
    dbPath,
    title: "Test Output JSON",
    request: "Output JSON test",
    stepOutputOverride: { summary: "test summary", result: "test result" },
  };

  try {
    const snapshot = await runSingleTaskExecution(input);

    assert.ok(snapshot.task.outputJson, "task should have outputJson");
    const output = JSON.parse(snapshot.task.outputJson!);
    assert.ok(typeof output === "object", "outputJson should parse to object");
  } finally {
    if (existsSync(dbPath)) {
      unlinkSync(dbPath);
    }
  }
});

test("runSingleTaskExecution input JSON is stored", async () => {
  const dbPath = join(__dirname, "test-input-json.db");

  if (existsSync(dbPath)) {
    unlinkSync(dbPath);
  }

  const testRequest = "Unique test request string";
  const input: HappyPathInput = {
    dbPath,
    title: "Test Input JSON",
    request: testRequest,
    stepOutputOverride: { summary: "test", result: "test" },
  };

  try {
    const snapshot = await runSingleTaskExecution(input);

    const inputData = JSON.parse(snapshot.task.inputJson);
    assert.ok(inputData.request, "inputJson should contain request");
  } finally {
    if (existsSync(dbPath)) {
      unlinkSync(dbPath);
    }
  }
});
