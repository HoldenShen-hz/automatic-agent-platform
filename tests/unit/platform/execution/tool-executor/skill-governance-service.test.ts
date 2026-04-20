import assert from "node:assert/strict";
import test from "node:test";

import {
  SkillGovernanceService,
  computeSkillHealth,
} from "../../../../../src/platform/execution/tool-executor/skill-governance-service.js";

const createMockStore = () => {
  const connection = {
    exec: () => {},
    prepare: (_sql: string) => ({
      run: (..._args: unknown[]) => {},
      get: () => ({}),
      all: () => [],
    }),
  };
  return {
    withConnection: <T>(work: (db: typeof connection) => T): T => work(connection),
  };
};

test("computeSkillHealth returns 0.5 for never-executed skills", () => {
  const health = computeSkillHealth(0, 0);
  assert.equal(health, 0.5);
});

test("computeSkillHealth returns success rate for executed skills", () => {
  const health = computeSkillHealth(100, 0.9);
  assert.equal(health, 0.9);
});

test("computeSkillHealth caps execution factor at 1.0", () => {
  // With 1000 executions and 0.5 success rate
  const health = computeSkillHealth(1000, 0.5);
  // successRate * min(1, 1000/100) = 0.5 * 1 = 0.5
  assert.equal(health, 0.5);
});

test("SkillGovernanceService.validateSkill returns valid for correct input", () => {
  const service = new SkillGovernanceService(createMockStore() as unknown as import("../../../../../src/platform/state-evidence/truth/authoritative-task-store.js").AuthoritativeTaskStore);

  const result = service.validateSkill({
    skillId: "test-skill",
    version: "1.0.0",
    name: "Test Skill",
    description: "A test skill for validation",
    requiredTools: ["read", "edit_replace"],
    cacheable: true,
    cacheTtlSeconds: 3600,
  });

  assert.equal(result.valid, true);
  assert.equal(result.errors.length, 0);
});

test("SkillGovernanceService.validateSkill rejects invalid skillId", () => {
  const service = new SkillGovernanceService(createMockStore() as unknown as import("../../../../../src/platform/state-evidence/truth/authoritative-task-store.js").AuthoritativeTaskStore);

  const result = service.validateSkill({
    skillId: "123-invalid",
    version: "1.0.0",
    name: "Test Skill",
    description: "A test skill for validation",
    requiredTools: [],
    cacheable: false,
    cacheTtlSeconds: 0,
  });

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("skillId")));
});

test("SkillGovernanceService.validateSkill rejects invalid version", () => {
  const service = new SkillGovernanceService(createMockStore() as unknown as import("../../../../../src/platform/state-evidence/truth/authoritative-task-store.js").AuthoritativeTaskStore);

  const result = service.validateSkill({
    skillId: "valid-skill",
    version: "1.0", // Should be 1.0.0
    name: "Test Skill",
    description: "A test skill for validation",
    requiredTools: [],
    cacheable: false,
    cacheTtlSeconds: 0,
  });

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("version")));
});

test("SkillGovernanceService.validateSkill rejects short name", () => {
  const service = new SkillGovernanceService(createMockStore() as unknown as import("../../../../../src/platform/state-evidence/truth/authoritative-task-store.js").AuthoritativeTaskStore);

  const result = service.validateSkill({
    skillId: "valid-skill",
    version: "1.0.0",
    name: "AB", // Too short
    description: "A test skill for validation",
    requiredTools: [],
    cacheable: false,
    cacheTtlSeconds: 0,
  });

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("name")));
});

test("SkillGovernanceService.validateSkill warns on short description", () => {
  const service = new SkillGovernanceService(createMockStore() as unknown as import("../../../../../src/platform/state-evidence/truth/authoritative-task-store.js").AuthoritativeTaskStore);

  const result = service.validateSkill({
    skillId: "valid-skill",
    version: "1.0.0",
    name: "Test Skill",
    description: "Short", // Too short for warning
    requiredTools: [],
    cacheable: false,
    cacheTtlSeconds: 0,
  });

  assert.ok(result.warnings.some((w) => w.includes("description")));
});

test("SkillGovernanceService.validateSkill warns on short cache TTL", () => {
  const service = new SkillGovernanceService(createMockStore() as unknown as import("../../../../../src/platform/state-evidence/truth/authoritative-task-store.js").AuthoritativeTaskStore);

  const result = service.validateSkill({
    skillId: "valid-skill",
    version: "1.0.0",
    name: "Test Skill",
    description: "A test skill for validation",
    requiredTools: [],
    cacheable: true,
    cacheTtlSeconds: 30, // Less than 60
  });

  assert.ok(result.warnings.some((w) => w.includes("cacheTtlSeconds")));
});

test("SkillGovernanceService.authorizeExecution allows by default", () => {
  const service = new SkillGovernanceService(createMockStore() as unknown as import("../../../../../src/platform/state-evidence/truth/authoritative-task-store.js").AuthoritativeTaskStore);

  const result = service.authorizeExecution({
    skillId: "test-skill",
    skillVersion: "1.0.0",
    sessionId: "session-1",
    executionId: "exec-1",
    requestedTools: ["read"],
  });

  assert.equal(result.authorized, true);
});

test("SkillGovernanceService.listSkills returns empty array", () => {
  const service = new SkillGovernanceService(createMockStore() as unknown as import("../../../../../src/platform/state-evidence/truth/authoritative-task-store.js").AuthoritativeTaskStore);

  const skills = service.listSkills();
  assert.ok(Array.isArray(skills));
});

test("SkillGovernanceService.getExecutionPolicy returns default policy", () => {
  const service = new SkillGovernanceService(createMockStore() as unknown as import("../../../../../src/platform/state-evidence/truth/authoritative-task-store.js").AuthoritativeTaskStore);

  const policy = service.getExecutionPolicy("test-skill");

  assert.ok(policy);
  assert.equal(policy!.skillId, "test-skill");
  assert.equal(policy!.allowExecution, true);
  assert.equal(policy!.requireApproval, false);
});

test("SkillGovernanceService.getSkill returns null for non-existent skill", () => {
  const service = new SkillGovernanceService(createMockStore() as unknown as import("../../../../../src/platform/state-evidence/truth/authoritative-task-store.js").AuthoritativeTaskStore);

  const skill = service.getSkill("non-existent");
  assert.equal(skill, null);
});

test("SkillGovernanceService.getSkillHealth returns 0 for non-existent skill", () => {
  const service = new SkillGovernanceService(createMockStore() as unknown as import("../../../../../src/platform/state-evidence/truth/authoritative-task-store.js").AuthoritativeTaskStore);

  const health = service.getSkillHealth("non-existent");
  assert.equal(health, 0);
});
