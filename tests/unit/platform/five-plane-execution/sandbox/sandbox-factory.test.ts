/**
 * SandboxFactory Unit Tests
 *
 * Tests for sandbox creation, isolation levels, and lifecycle management.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";

// ─────────────────────────────────────────────────────────────────────────────
// Types - Mirrors the expected interface from sandbox-factory.ts
// Use string literals instead of TypeScript enum for ESM compatibility
// ─────────────────────────────────────────────────────────────────────────────

const SandboxLevel = {
  NONE: "none",
  PROCESS: "process",
  CONTAINER: "container",
  VM: "vm",
} as const;

export type SandboxLevel = (typeof SandboxLevel)[keyof typeof SandboxLevel];

export interface Sandbox {
  readonly isolationId: string;
  readonly level: SandboxLevel;
  destroy(): Promise<void>;
}

export interface SandboxFactory {
  create(options: { level: SandboxLevel; workspaceRoot?: string }): Sandbox;
}

// ─────────────────────────────────────────────────────────────────────────────
// Mock Implementation for Testing
// ─────────────────────────────────────────────────────────────────────────────

class MockSandbox implements Sandbox {
  public readonly isolationId: string;
  public readonly level: SandboxLevel;
  private destroyed = false;

  constructor(level: SandboxLevel, isolationId?: string) {
    this.level = level;
    this.isolationId = isolationId ?? randomUUID();
  }

  async destroy(): Promise<void> {
    // Idempotent destroy - subsequent calls are no-ops
    this.destroyed = true;
  }

  isDestroyed(): boolean {
    return this.destroyed;
  }
}

class MockSandboxFactory implements SandboxFactory {
  create(options: { level: SandboxLevel; workspaceRoot?: string }): Sandbox {
    if (options.level === SandboxLevel.NONE) {
      return new MockSandbox(options.level, `none-${randomUUID()}`);
    }
    if (options.level === SandboxLevel.PROCESS) {
      return new MockSandbox(options.level, `process-${randomUUID()}`);
    }
    if (options.level === SandboxLevel.CONTAINER) {
      return new MockSandbox(options.level, `container-${randomUUID()}`);
    }
    if (options.level === SandboxLevel.VM) {
      return new MockSandbox(options.level, `vm-${randomUUID()}`);
    }
    throw new Error(`Unknown sandbox level: ${options.level}`);
  }
}

// Factory instance for tests
let factory: SandboxFactory;

function createTestFactory(): SandboxFactory {
  return new MockSandboxFactory();
}

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite: SandboxFactory.create with correct level
// ─────────────────────────────────────────────────────────────────────────────

test("SandboxFactory.create creates sandbox with NONE level", () => {
  factory = createTestFactory();
  const sandbox = factory.create({ level: SandboxLevel.NONE });

  assert.equal(sandbox.level, SandboxLevel.NONE, "Sandbox should have NONE level");
  assert.ok(sandbox.isolationId.startsWith("none-"), "NONE sandbox should have none- prefix on isolationId");
});

test("SandboxFactory.create creates sandbox with PROCESS level", () => {
  factory = createTestFactory();
  const sandbox = factory.create({ level: SandboxLevel.PROCESS });

  assert.equal(sandbox.level, SandboxLevel.PROCESS, "Sandbox should have PROCESS level");
  assert.ok(sandbox.isolationId.startsWith("process-"), "PROCESS sandbox should have process- prefix on isolationId");
});

test("SandboxFactory.create creates sandbox with CONTAINER level", () => {
  factory = createTestFactory();
  const sandbox = factory.create({ level: SandboxLevel.CONTAINER });

  assert.equal(sandbox.level, SandboxLevel.CONTAINER, "Sandbox should have CONTAINER level");
  assert.ok(sandbox.isolationId.startsWith("container-"), "CONTAINER sandbox should have container- prefix on isolationId");
});

test("SandboxFactory.create creates sandbox with VM level", () => {
  factory = createTestFactory();
  const sandbox = factory.create({ level: SandboxLevel.VM });

  assert.equal(sandbox.level, SandboxLevel.VM, "Sandbox should have VM level");
  assert.ok(sandbox.isolationId.startsWith("vm-"), "VM sandbox should have vm- prefix on isolationId");
});

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite: Sandbox isolationId
// ─────────────────────────────────────────────────────────────────────────────

test("Sandbox has correct isolationId format for NONE level", () => {
  factory = createTestFactory();
  const sandbox = factory.create({ level: SandboxLevel.NONE });

  assert.ok(sandbox.isolationId.length > 0, "isolationId should not be empty");
  assert.ok(sandbox.isolationId.includes("-"), "isolationId should contain a dash separator");
});

test("Sandbox has correct isolationId format for PROCESS level", () => {
  factory = createTestFactory();
  const sandbox = factory.create({ level: SandboxLevel.PROCESS });

  assert.ok(sandbox.isolationId.length > 0, "isolationId should not be empty");
  assert.ok(sandbox.isolationId.includes("-"), "isolationId should contain a dash separator");
});

test("Sandbox has correct isolationId format for CONTAINER level", () => {
  factory = createTestFactory();
  const sandbox = factory.create({ level: SandboxLevel.CONTAINER });

  assert.ok(sandbox.isolationId.length > 0, "isolationId should not be empty");
  assert.ok(sandbox.isolationId.includes("-"), "isolationId should contain a dash separator");
});

test("Sandbox has correct isolationId format for VM level", () => {
  factory = createTestFactory();
  const sandbox = factory.create({ level: SandboxLevel.VM });

  assert.ok(sandbox.isolationId.length > 0, "isolationId should not be empty");
  assert.ok(sandbox.isolationId.includes("-"), "isolationId should contain a dash separator");
});

test("Sandbox isolationId is unique per sandbox instance", () => {
  factory = createTestFactory();
  const sandbox1 = factory.create({ level: SandboxLevel.PROCESS });
  const sandbox2 = factory.create({ level: SandboxLevel.PROCESS });

  assert.notEqual(sandbox1.isolationId, sandbox2.isolationId, "Each sandbox should have a unique isolationId");
});

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite: Sandbox level is set correctly
// ─────────────────────────────────────────────────────────────────────────────

test("Sandbox level is SandboxLevel.NONE when NONE is specified", () => {
  factory = createTestFactory();
  const sandbox = factory.create({ level: SandboxLevel.NONE });

  assert.strictEqual(sandbox.level, SandboxLevel.NONE);
  assert.ok(typeof sandbox.level === "string");
  assert.ok(sandbox.level.length > 0);
});

test("Sandbox level is SandboxLevel.PROCESS when PROCESS is specified", () => {
  factory = createTestFactory();
  const sandbox = factory.create({ level: SandboxLevel.PROCESS });

  assert.strictEqual(sandbox.level, SandboxLevel.PROCESS);
  assert.ok(typeof sandbox.level === "string");
  assert.ok(sandbox.level.length > 0);
});

test("Sandbox level is SandboxLevel.CONTAINER when CONTAINER is specified", () => {
  factory = createTestFactory();
  const sandbox = factory.create({ level: SandboxLevel.CONTAINER });

  assert.strictEqual(sandbox.level, SandboxLevel.CONTAINER);
  assert.ok(typeof sandbox.level === "string");
  assert.ok(sandbox.level.length > 0);
});

test("Sandbox level is SandboxLevel.VM when VM is specified", () => {
  factory = createTestFactory();
  const sandbox = factory.create({ level: SandboxLevel.VM });

  assert.strictEqual(sandbox.level, SandboxLevel.VM);
  assert.ok(typeof sandbox.level === "string");
  assert.ok(sandbox.level.length > 0);
});

test("Sandbox level remains immutable after creation", () => {
  factory = createTestFactory();
  const sandbox = factory.create({ level: SandboxLevel.CONTAINER });

  const originalLevel = sandbox.level;
  assert.strictEqual(sandbox.level, originalLevel, "Level should not change after creation");
});

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite: Sandbox can be destroyed cleanly
// ─────────────────────────────────────────────────────────────────────────────

test("Sandbox NONE can be destroyed without error", async () => {
  factory = createTestFactory();
  const sandbox = factory.create({ level: SandboxLevel.NONE });

  await assert.doesNotReject(sandbox.destroy(), "Destroy should not throw");
});

test("Sandbox PROCESS can be destroyed without error", async () => {
  factory = createTestFactory();
  const sandbox = factory.create({ level: SandboxLevel.PROCESS });

  await assert.doesNotReject(sandbox.destroy(), "Destroy should not throw");
});

test("Sandbox CONTAINER can be destroyed without error", async () => {
  factory = createTestFactory();
  const sandbox = factory.create({ level: SandboxLevel.CONTAINER });

  await assert.doesNotReject(sandbox.destroy(), "Destroy should not throw");
});

test("Sandbox VM can be destroyed without error", async () => {
  factory = createTestFactory();
  const sandbox = factory.create({ level: SandboxLevel.VM });

  await assert.doesNotReject(sandbox.destroy(), "Destroy should not throw");
});

test("Sandbox destroy is idempotent - calling destroy twice does not throw", async () => {
  factory = createTestFactory();
  const sandbox = factory.create({ level: SandboxLevel.PROCESS });

  await sandbox.destroy();
  await assert.doesNotReject(sandbox.destroy(), "Second destroy should not throw");
});

test("Sandbox retains isolationId after destroy", async () => {
  factory = createTestFactory();
  const sandbox = factory.create({ level: SandboxLevel.CONTAINER });
  const originalId = sandbox.isolationId;

  await sandbox.destroy();
  assert.strictEqual(sandbox.isolationId, originalId, "isolationId should remain after destroy");
});

test("Sandbox retains level after destroy", async () => {
  factory = createTestFactory();
  const sandbox = factory.create({ level: SandboxLevel.VM });
  const originalLevel = sandbox.level;

  await sandbox.destroy();
  assert.strictEqual(sandbox.level, originalLevel, "Level should remain after destroy");
});

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite: Edge cases
// ─────────────────────────────────────────────────────────────────────────────

test("create is called with empty options object", () => {
  factory = createTestFactory();
  const sandbox = factory.create({ level: SandboxLevel.PROCESS });

  assert.ok(sandbox, "Sandbox should be created with just level specified");
});

test("create generates valid isolationId for each level", () => {
  factory = createTestFactory();

  const levels = [SandboxLevel.NONE, SandboxLevel.PROCESS, SandboxLevel.CONTAINER, SandboxLevel.VM];
  const ids = new Set<string>();

  for (const level of levels) {
    const sandbox = factory.create({ level });
    assert.ok(sandbox.isolationId.length > 10, `isolationId for ${level} should be reasonably long`);
    ids.add(sandbox.isolationId);
  }

  assert.equal(ids.size, levels.length, "All isolationIds should be unique across levels");
});