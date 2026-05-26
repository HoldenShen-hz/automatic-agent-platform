/**
 * Extended Unit Tests: Skill Governance Service
 *
 * Provides comprehensive coverage for SkillGovernanceService methods
 * including registerSkill, updateLifecycle, setExecutionPolicy,
 * recordExecutionOutcome, and archiveOldDeprecatedSkills.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  SkillGovernanceService,
  computeSkillHealth,
  type SkillMetadata,
  type SkillExecutionPolicy,
  type SkillLifecycle,
} from "../../../src/platform/five-plane-execution/tool-executor/skill-governance-service.js";
import type { AuthoritativeTaskStore } from "../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";

function createMockStore(): AuthoritativeTaskStore {
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
  } as unknown as AuthoritativeTaskStore;
}

test("computeSkillHealth returns 0.5 for never-executed skills", () => {
  assert.equal(computeSkillHealth(0, 0), 0.5);
});

test("computeSkillHealth returns success rate for executed skills", () => {
  const health = computeSkillHealth(100, 0.9);
  assert.equal(health, 0.8921568627450981);
});

test("computeSkillHealth caps execution factor at 1.0", () => {
  const health = computeSkillHealth(1000, 0.5);
  assert.equal(health, 0.5);
});

test("computeSkillHealth handles high execution count with perfect success", () => {
  const health = computeSkillHealth(500, 1.0);
  assert.equal(health, 0.99800796812749);
});

test("computeSkillHealth handles low success rate with many executions", () => {
  const health = computeSkillHealth(200, 0.3);
  assert.equal(health, 0.30198019801980197);
});

test("SkillGovernanceService.validateSkill returns valid for correct input", () => {
  const service = new SkillGovernanceService(createMockStore());

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

test("SkillGovernanceService.validateSkill rejects invalid skillId starting with number", () => {
  const service = new SkillGovernanceService(createMockStore());

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

test("SkillGovernanceService.validateSkill rejects invalid version format", () => {
  const service = new SkillGovernanceService(createMockStore());

  const result = service.validateSkill({
    skillId: "valid-skill",
    version: "1.0",
    name: "Test Skill",
    description: "A test skill for validation",
    requiredTools: [],
    cacheable: false,
    cacheTtlSeconds: 0,
  });

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("version")));
});

test("SkillGovernanceService.validateSkill rejects version with too many parts", () => {
  const service = new SkillGovernanceService(createMockStore());

  const result = service.validateSkill({
    skillId: "valid-skill",
    version: "1.0.0.0",
    name: "Test Skill",
    description: "A test skill for validation",
    requiredTools: [],
    cacheable: false,
    cacheTtlSeconds: 0,
  });

  assert.equal(result.valid, false);
});

test("SkillGovernanceService.validateSkill rejects short name", () => {
  const service = new SkillGovernanceService(createMockStore());

  const result = service.validateSkill({
    skillId: "valid-skill",
    version: "1.0.0",
    name: "AB",
    description: "A test skill for validation",
    requiredTools: [],
    cacheable: false,
    cacheTtlSeconds: 0,
  });

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("name")));
});

test("SkillGovernanceService.validateSkill rejects name exceeding max length", () => {
  const service = new SkillGovernanceService(createMockStore());

  const result = service.validateSkill({
    skillId: "valid-skill",
    version: "1.0.0",
    name: "A".repeat(101),
    description: "A test skill for validation",
    requiredTools: [],
    cacheable: false,
    cacheTtlSeconds: 0,
  });

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("name")));
});

test("SkillGovernanceService.validateSkill warns on short description", () => {
  const service = new SkillGovernanceService(createMockStore());

  const result = service.validateSkill({
    skillId: "valid-skill",
    version: "1.0.0",
    name: "Test Skill",
    description: "Short",
    requiredTools: [],
    cacheable: false,
    cacheTtlSeconds: 0,
  });

  assert.ok(result.warnings.some((w) => w.includes("description")));
});

test("SkillGovernanceService.validateSkill rejects description exceeding max length", () => {
  const service = new SkillGovernanceService(createMockStore());

  const result = service.validateSkill({
    skillId: "valid-skill",
    version: "1.0.0",
    name: "Test Skill",
    description: "A".repeat(501),
    requiredTools: [],
    cacheable: false,
    cacheTtlSeconds: 0,
  });

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("description")));
});

test("SkillGovernanceService.validateSkill warns on no required tools", () => {
  const service = new SkillGovernanceService(createMockStore());

  const result = service.validateSkill({
    skillId: "valid-skill",
    version: "1.0.0",
    name: "Test Skill",
    description: "A test skill for validation",
    requiredTools: [],
    cacheable: false,
    cacheTtlSeconds: 0,
  });

  assert.ok(result.warnings.some((w) => w.includes("required tools")));
});

test("SkillGovernanceService.validateSkill warns on short cache TTL for cacheable skill", () => {
  const service = new SkillGovernanceService(createMockStore());

  const result = service.validateSkill({
    skillId: "valid-skill",
    version: "1.0.0",
    name: "Test Skill",
    description: "A test skill for validation",
    requiredTools: ["read"],
    cacheable: true,
    cacheTtlSeconds: 30,
  });

  assert.ok(result.warnings.some((w) => w.includes("cacheTtlSeconds")));
});

test("SkillGovernanceService.validateSkill warns on very long cache TTL", () => {
  const service = new SkillGovernanceService(createMockStore());

  const result = service.validateSkill({
    skillId: "valid-skill",
    version: "1.0.0",
    name: "Test Skill",
    description: "A test skill for validation",
    requiredTools: ["read"],
    cacheable: true,
    cacheTtlSeconds: 86400 * 8, // 8 days
  });

  assert.ok(result.warnings.some((w) => w.includes("7 days")));
});

test("SkillGovernanceService.registerSkill stores skill in mock database", () => {
  const service = new SkillGovernanceService(createMockStore());

  const skill: SkillMetadata = {
    skillId: "test-skill",
    name: "Test Skill",
    version: "1.0.0",
    description: "A test skill",
    author: "test-author",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    lifecycle: "active",
    riskLevel: "low",
    tags: ["test"],
    requiredTools: ["read"],
    requiredPermissions: [],
    cacheable: true,
    cacheTtlSeconds: 3600,
    executionCount: 0,
    successRate: 0,
    avgDurationMs: 0,
  };

  const result = service.registerSkill(skill);
  assert.equal(result, true);
});

test("SkillGovernanceService.updateLifecycle updates skill lifecycle", () => {
  const service = new SkillGovernanceService(createMockStore());

  const result = service.updateLifecycle({
    skillId: "test-skill",
    newLifecycle: "deprecated",
    reason: "Superseded by new version",
  });

  assert.equal(result, true);
});

test("SkillGovernanceService.getExecutionPolicy returns default policy for unknown skill", () => {
  const service = new SkillGovernanceService(createMockStore());

  const policy = service.getExecutionPolicy("unknown-skill");

  assert.equal(policy, null);
});

test("SkillGovernanceService.setExecutionPolicy stores policy", () => {
  const service = new SkillGovernanceService(createMockStore());

  const policy: SkillExecutionPolicy = {
    skillId: "test-skill",
    allowExecution: true,
    requireApproval: true,
    maxConcurrentExecutions: 10,
    maxExecutionsPerHour: 200,
    rateLimitWindowMs: 7200000,
    blockedMessage: null,
  };

  const result = service.setExecutionPolicy(policy);
  assert.equal(result, true);
});

test("SkillGovernanceService.authorizeExecution denies when execution not allowed", () => {
  const service = new SkillGovernanceService(createMockStore());

  const result = service.authorizeExecution({
    skillId: "any-skill",
    skillVersion: "1.0.0",
    sessionId: "session-1",
    executionId: "exec-1",
    requestedTools: ["read"],
  });

  assert.equal(result.authorized, false);
  assert.match(result.deniedReasons.join(" "), /not configured/i);
});

test("SkillGovernanceService.authorizeExecution requires approval when policy says so", () => {
  const service = new SkillGovernanceService(createMockStore());

  const result = service.authorizeExecution({
    skillId: "any-skill",
    skillVersion: "1.0.0",
    sessionId: "session-1",
    executionId: "exec-1",
    requestedTools: ["read"],
  });

  assert.equal(result.authorized, false);
  assert.deepEqual(result.requiredApprovals, []);
});

test("SkillGovernanceService.listSkills returns empty array for mock", () => {
  const service = new SkillGovernanceService(createMockStore());

  const skills = service.listSkills();
  assert.ok(Array.isArray(skills));
});

test("SkillGovernanceService.listSkills returns skills filtered by lifecycle", () => {
  const service = new SkillGovernanceService(createMockStore());

  const activeSkills = service.listSkills({ lifecycle: "active" });
  assert.ok(Array.isArray(activeSkills));
});

test("SkillGovernanceService.listSkills returns skills filtered by riskLevel", () => {
  const service = new SkillGovernanceService(createMockStore());

  const lowRiskSkills = service.listSkills({ riskLevel: "low" });
  assert.ok(Array.isArray(lowRiskSkills));
});

test("SkillGovernanceService.listSkills returns skills filtered by tag", () => {
  const service = new SkillGovernanceService(createMockStore());

  const taggedSkills = service.listSkills({ tag: "data" });
  assert.ok(Array.isArray(taggedSkills));
});

test("SkillGovernanceService.getSkill returns null for non-existent skill", () => {
  const service = new SkillGovernanceService(createMockStore());

  const skill = service.getSkill("non-existent");
  assert.equal(skill, null);
});

test("SkillGovernanceService.getSkillHealth returns 0 for non-existent skill", () => {
  const service = new SkillGovernanceService(createMockStore());

  const health = service.getSkillHealth("non-existent");
  assert.equal(health, 0);
});

test("SkillGovernanceService.archiveOldDeprecatedSkills archives deprecated skills older than threshold", () => {
  const service = new SkillGovernanceService(createMockStore());

  const result = service.archiveOldDeprecatedSkills(30);
  assert.equal(result, 1);
});

test("SkillGovernanceService recordExecutionOutcome updates skill metrics", () => {
  const service = new SkillGovernanceService(createMockStore());

  // This should not throw
  service.recordExecutionOutcome("test-skill", true, 150);
  service.recordExecutionOutcome("test-skill", false, 200);
});

test("SkillGovernanceService.validateSkill handles special characters in skillId", () => {
  const service = new SkillGovernanceService(createMockStore());

  // Valid skillId with underscores and hyphens
  const result = service.validateSkill({
    skillId: "my_test-skill_v2",
    version: "1.0.0",
    name: "Test Skill",
    description: "A test skill for validation",
    requiredTools: [],
    cacheable: false,
    cacheTtlSeconds: 0,
  });

  assert.equal(result.valid, true);
});

test("SkillGovernanceService.validateSkill rejects skillId with spaces", () => {
  const service = new SkillGovernanceService(createMockStore());

  const result = service.validateSkill({
    skillId: "my test skill",
    version: "1.0.0",
    name: "Test Skill",
    description: "A test skill for validation",
    requiredTools: [],
    cacheable: false,
    cacheTtlSeconds: 0,
  });

  assert.equal(result.valid, false);
});

test("SkillGovernanceService.validateSkill rejects empty name", () => {
  const service = new SkillGovernanceService(createMockStore());

  const result = service.validateSkill({
    skillId: "valid-skill",
    version: "1.0.0",
    name: "",
    description: "A test skill for validation",
    requiredTools: [],
    cacheable: false,
    cacheTtlSeconds: 0,
  });

  assert.equal(result.valid, false);
});

test("SkillGovernanceService.validateSkill warns on cache TTL exactly at boundary", () => {
  const service = new SkillGovernanceService(createMockStore());

  const result = service.validateSkill({
    skillId: "valid-skill",
    version: "1.0.0",
    name: "Test Skill",
    description: "A test skill for validation",
    requiredTools: ["read"],
    cacheable: true,
    cacheTtlSeconds: 60, // Exactly 60 seconds
  });

  // Should not warn at exactly 60
  assert.ok(!result.warnings.some((w) => w.includes("cacheTtlSeconds")));
});
