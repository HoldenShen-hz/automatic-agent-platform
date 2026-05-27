import assert from "node:assert/strict";
import test from "node:test";

import {
  SkillGovernanceService,
  computeSkillHealth,
} from "../../../../../src/platform/five-plane-execution/tool-executor/skill-governance-service.js";
import { SKILL_GOVERNANCE_FOUNDATION_SQL } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-migration-runtime-part3.js";

const createMockStore = () => {
  const policies = new Map<string, {
    skill_id: string;
    allow_execution: number;
    require_approval: number;
    max_concurrent_executions: number;
    max_executions_per_hour: number;
    rate_limit_window_ms: number;
    blocked_message: string | null;
  }>();
  const connection = {
    exec: () => {},
    prepare: (sql: string) => ({
      run: (...args: unknown[]) => {
        if (sql.includes("INSERT INTO skill_execution_policies")) {
          policies.set(String(args[0]), {
            skill_id: String(args[0]),
            allow_execution: Number(args[1]),
            require_approval: Number(args[2]),
            max_concurrent_executions: Number(args[3]),
            max_executions_per_hour: Number(args[4]),
            rate_limit_window_ms: Number(args[5]),
            blocked_message: (args[6] as string | null | undefined) ?? null,
          });
        }
      },
      get: (skillId?: string) => {
        if (sql.includes("SELECT * FROM skill_execution_policies")) {
          return policies.get(String(skillId)) ?? undefined;
        }
        return undefined;
      },
      all: () => [],
    }),
  };
  return {
    withConnection: <T>(work: (db: typeof connection) => T): T => work(connection),
  };
};

test("computeSkillHealth returns 0.5 for never-executed skills [skill-governance-service]", () => {
  const health = computeSkillHealth(0, 0);
  assert.equal(health, 0.5);
});

test("computeSkillHealth converges toward success rate for executed skills [skill-governance-service]", () => {
  const health = computeSkillHealth(100, 0.9);
  assert.ok(Math.abs(health - 0.8921568627450981) < 1e-12);
});

test("computeSkillHealth uses smoothing for sparse samples and converges at scale [skill-governance-service]", () => {
  const lowSampleHealth = computeSkillHealth(1, 1);
  assert.equal(lowSampleHealth, 2 / 3);

  const health = computeSkillHealth(1000, 0.5);
  assert.ok(Math.abs(health - 0.5) < 0.001);
});

test("skill governance schema constrains skill ids at the database layer [skill-governance-service]", () => {
  assert.match(SKILL_GOVERNANCE_FOUNDATION_SQL, /skill_id TEXT PRIMARY KEY CHECK\(skill_id GLOB '\[A-Za-z\]\[A-Za-z0-9_-\]\*'\)/);
});

test("SkillGovernanceService.validateSkill returns valid for correct input [skill-governance-service]", () => {
  const service = new SkillGovernanceService(createMockStore() as unknown as import("../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js").AuthoritativeTaskStore);

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

test("SkillGovernanceService.validateSkill rejects invalid skillId [skill-governance-service]", () => {
  const service = new SkillGovernanceService(createMockStore() as unknown as import("../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js").AuthoritativeTaskStore);

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

test("SkillGovernanceService.validateSkill rejects invalid version [skill-governance-service]", () => {
  const service = new SkillGovernanceService(createMockStore() as unknown as import("../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js").AuthoritativeTaskStore);

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

test("SkillGovernanceService.validateSkill rejects short name [skill-governance-service]", () => {
  const service = new SkillGovernanceService(createMockStore() as unknown as import("../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js").AuthoritativeTaskStore);

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

test("SkillGovernanceService.validateSkill warns on short description [skill-governance-service]", () => {
  const service = new SkillGovernanceService(createMockStore() as unknown as import("../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js").AuthoritativeTaskStore);

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

test("SkillGovernanceService.validateSkill warns on short cache TTL [skill-governance-service]", () => {
  const service = new SkillGovernanceService(createMockStore() as unknown as import("../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js").AuthoritativeTaskStore);

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

test("SkillGovernanceService.authorizeExecution denies when no policy exists [skill-governance-service]", () => {
  const service = new SkillGovernanceService(createMockStore() as unknown as import("../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js").AuthoritativeTaskStore);

  const result = service.authorizeExecution({
    skillId: "test-skill",
    skillVersion: "1.0.0",
    sessionId: "session-1",
    executionId: "exec-1",
    requestedTools: ["read"],
  });

  assert.equal(result.authorized, false);
  assert.equal(result.policy, null);
  assert.match(result.deniedReasons[0] ?? "", /not configured/i);
});

test("SkillGovernanceService.listSkills returns empty array [skill-governance-service]", () => {
  const service = new SkillGovernanceService(createMockStore() as unknown as import("../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js").AuthoritativeTaskStore);

  const skills = service.listSkills();
  assert.ok(Array.isArray(skills));
});

test("SkillGovernanceService.getExecutionPolicy returns null for unknown skill [skill-governance-service]", () => {
  const service = new SkillGovernanceService(createMockStore() as unknown as import("../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js").AuthoritativeTaskStore);

  const policy = service.getExecutionPolicy("test-skill");

  assert.equal(policy, null);
});

test("SkillGovernanceService.authorizeExecution enforces rate limits [skill-governance-service]", () => {
  const service = new SkillGovernanceService(createMockStore() as unknown as import("../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js").AuthoritativeTaskStore);
  service.setExecutionPolicy({
    skillId: "limited-skill",
    allowExecution: true,
    requireApproval: false,
    maxConcurrentExecutions: 1,
    maxExecutionsPerHour: 1,
    rateLimitWindowMs: 60_000,
    blockedMessage: null,
  });

  const first = service.authorizeExecution({
    skillId: "limited-skill",
    skillVersion: "1.0.0",
    sessionId: "session-1",
    executionId: "exec-1",
    requestedTools: ["read"],
  });
  const second = service.authorizeExecution({
    skillId: "limited-skill",
    skillVersion: "1.0.0",
    sessionId: "session-1",
    executionId: "exec-2",
    requestedTools: ["read"],
  });

  assert.equal(first.authorized, true);
  assert.equal(second.authorized, false);
  assert.match(second.deniedReasons.join(" "), /rate limit/i);
});

test("SkillGovernanceService.getSkill returns null for non-existent skill [skill-governance-service]", () => {
  const service = new SkillGovernanceService(createMockStore() as unknown as import("../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js").AuthoritativeTaskStore);

  const skill = service.getSkill("non-existent");
  assert.equal(skill, null);
});

test("SkillGovernanceService.getSkillHealth returns 0 for non-existent skill [skill-governance-service]", () => {
  const service = new SkillGovernanceService(createMockStore() as unknown as import("../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js").AuthoritativeTaskStore);

  const health = service.getSkillHealth("non-existent");
  assert.equal(health, 0);
});
