import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import {
  LLM_EVAL_DDL,
  PROMPT_MODEL_POLICY_GOVERNANCE_DDL,
} from "../../../../../src/platform/prompt-engine/eval/prompt-model-policy-governance-schema.js";
import {
  LlmEvalService,
} from "../../../../../src/platform/prompt-engine/eval/llm-eval-service.js";
import {
  PromptModelPolicyGovernanceService,
} from "../../../../../src/platform/prompt-engine/eval/prompt-model-policy-governance-service.js";
import { SqliteDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";

function createHarness(prefix: string) {
  const workspace = createTempWorkspace(prefix);
  const dbPath = join(workspace, "governance.db");
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  db.connection.exec(LLM_EVAL_DDL);
  db.connection.exec(PROMPT_MODEL_POLICY_GOVERNANCE_DDL);
  const evalService = new LlmEvalService(db);
  const governance = new PromptModelPolicyGovernanceService(db, evalService);
  return { workspace, db, evalService, governance };
}

test("governance service getRelease returns null for nonexistent release", () => {
  const h = createHarness("gov-get-none-");
  try {
    const result = h.governance.getRelease("nonexistent-id");
    assert.equal(result, null);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("governance service listReleases returns empty when no releases", () => {
  const h = createHarness("gov-list-empty-");
  try {
    const releases = h.governance.listReleases();
    assert.equal(releases.length, 0);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("governance service listReleases filters by releaseType", () => {
  const h = createHarness("gov-list-filter-");
  try {
    const suite = h.evalService.defineSuite({
      name: "filter-suite",
      kind: "golden",
      cases: [{ id: "c1", input: "a", expectedOutput: "a" }],
    });

    h.governance.registerPromptRelease({
      promptKey: "p1",
      version: "v1",
      owner: "owner1",
      evaluationSuiteId: suite.id,
    });
    h.governance.registerModelRelease({
      profileName: "m1",
      version: "v1",
      owner: "owner1",
      frozenModelId: "model-1",
    });

    const all = h.governance.listReleases();
    assert.equal(all.length, 2);

    const prompts = h.governance.listReleases("prompt");
    assert.equal(prompts.length, 1);
    assert.equal(prompts[0]!.releaseType, "prompt");

    const models = h.governance.listReleases("model");
    assert.equal(models.length, 1);
    assert.equal(models[0]!.releaseType, "model");

    const policies = h.governance.listReleases("policy");
    assert.equal(policies.length, 0);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("governance service registerPromptRelease sets correct defaults", () => {
  const h = createHarness("gov-prompt-reg-");
  try {
    const prompt = h.governance.registerPromptRelease({
      promptKey: "support.triage",
      version: "v1.0.0",
      owner: "team.ops",
      rollbackVersion: "v0.9.0",
    });

    assert.equal(prompt.releaseType, "prompt");
    assert.equal(prompt.objectKey, "support.triage");
    assert.equal(prompt.version, "v1.0.0");
    assert.equal(prompt.owner, "team.ops");
    assert.equal(prompt.status, "review_required");
    assert.equal(prompt.reviewRequired, true);
    assert.equal(prompt.rolloutScope, "canary");
    assert.equal(prompt.rollbackVersion, "v0.9.0");

    const parsed = JSON.parse(prompt.metadata);
    assert.deepEqual(parsed.lintEvidence, []);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("governance service registerModelRelease sets model metadata", () => {
  const h = createHarness("gov-model-reg-");
  try {
    const model = h.governance.registerModelRelease({
      profileName: "balanced",
      version: "v2.0.0",
      owner: "team.ml",
      frozenModelId: "claude-sonnet-4-20250514",
      fallbackProfiles: ["fast", "reasoning"],
      rollbackProfileName: "fast",
      authProfileRouting: "sticky",
      sessionAffinity: false,
    });

    assert.equal(model.releaseType, "model");
    assert.equal(model.objectKey, "balanced");
    assert.equal(model.rollbackVersion, "fast");

    const parsed = JSON.parse(model.metadata);
    assert.equal(parsed.profileName, "balanced");
    assert.equal(parsed.frozenModelId, "claude-sonnet-4-20250514");
    assert.deepEqual(parsed.fallbackProfiles, ["fast", "reasoning"]);
    assert.equal(parsed.authProfileRouting, "sticky");
    assert.equal(parsed.sessionAffinity, false);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("governance service registerPolicyBundleRelease sets policy metadata", () => {
  const h = createHarness("gov-policy-reg-");
  try {
    const policy = h.governance.registerPolicyBundleRelease({
      bundleName: "security.policy",
      version: "v3.0.0",
      owner: "security.team",
      changeTicket: "SEC-456",
      effectiveScope: "production",
      denyAllowDeltaSummary: "added new commands",
      auditEvidence: ["audit-log-1", "audit-log-2"],
    });

    assert.equal(policy.releaseType, "policy");
    assert.equal(policy.objectKey, "security.policy");

    const parsed = JSON.parse(policy.metadata);
    assert.equal(parsed.changeTicket, "SEC-456");
    assert.equal(parsed.effectiveScope, "production");
    assert.equal(parsed.denyAllowDeltaSummary, "added new commands");
    assert.deepEqual(parsed.auditEvidence, ["audit-log-1", "audit-log-2"]);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("governance service registerModelRelease dedupes fallback profiles", () => {
  const h = createHarness("gov-model-dedup-");
  try {
    const model = h.governance.registerModelRelease({
      profileName: "dedup",
      version: "v1",
      owner: "o",
      frozenModelId: "m",
      fallbackProfiles: ["a", "b", "a", "c", "b"],
    });

    const parsed = JSON.parse(model.metadata);
    assert.deepEqual(parsed.fallbackProfiles, ["a", "b", "c"]);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("governance service getRelease keeps newly registered releases at review_required even when reviewRequired=false", () => {
  const h = createHarness("gov-get-reg-");
  try {
    const prompt = h.governance.registerPromptRelease({
      promptKey: "test.prompt",
      version: "v1",
      owner: "owner",
      reviewRequired: false,
    });

    const retrieved = h.governance.getRelease(prompt.id);
    assert.ok(retrieved);
    assert.equal(retrieved?.id, prompt.id);
    assert.equal(retrieved?.objectKey, "test.prompt");
    assert.equal(retrieved?.version, "v1");
    assert.equal(retrieved?.status, "review_required");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("governance service listGateEvents returns empty for release with no events", () => {
  const h = createHarness("gov-gate-events-");
  try {
    const prompt = h.governance.registerPromptRelease({
      promptKey: "test",
      version: "v1",
      owner: "o",
      reviewRequired: false,
    });

    const events = h.governance.listGateEvents(prompt.id);
    assert.equal(events.length, 0);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("governance service evaluateReleaseGate throws when release not found", () => {
  const h = createHarness("gov-gate-missing-");
  try {
    assert.throws(
      () =>
        h.governance.evaluateReleaseGate({
          releaseId: "nonexistent",
          modelId: "model",
          promptVersion: "v1",
        }),
      /release_not_found/,
    );
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("governance service evaluateReleaseGate throws when suite missing", () => {
  const h = createHarness("gov-gate-no-suite-");
  try {
    const prompt = h.governance.registerPromptRelease({
      promptKey: "test",
      version: "v1",
      owner: "o",
      reviewRequired: false,
    });

    assert.throws(
      () =>
        h.governance.evaluateReleaseGate({
          releaseId: prompt.id,
          modelId: "model",
          promptVersion: "v1",
        }),
      /missing_eval_suite/,
    );
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("governance service evaluateReleaseGate records gate event", () => {
  const h = createHarness("gov-gate-event-");
  try {
    const suite = h.evalService.defineSuite({
      name: "event-suite",
      kind: "golden",
      cases: [{ id: "c1", input: "a", expectedOutput: "a" }],
    });

    const prompt = h.governance.registerPromptRelease({
      promptKey: "test",
      version: "v1",
      owner: "o",
      evaluationSuiteId: suite.id,
      reviewRequired: false,
    });

    const result = h.governance.evaluateReleaseGate({
      releaseId: prompt.id,
      modelId: "model-x",
      promptVersion: "v1",
      evaluator: ({ caseDefinition }) => ({
        actualOutput: caseDefinition.expectedOutput,
        passed: true,
        score: 1,
      }),
    });

    assert.equal(result.event.releaseId, prompt.id);
    assert.equal(result.event.modelId, "model-x");
    assert.equal(result.event.promptVersion, "v1");
    assert.ok(result.event.summary.length > 0);

    const events = h.governance.listGateEvents(prompt.id);
    assert.equal(events.length, 1);
    assert.equal(events[0]!.id, result.event.id);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("governance service buildModelGovernanceSnapshot returns empty when no model releases", () => {
  const h = createHarness("gov-snapshot-empty-");
  try {
    const suite = h.evalService.defineSuite({
      name: "snap-suite",
      kind: "golden",
      cases: [{ id: "c1", input: "a", expectedOutput: "a" }],
    });

    h.governance.registerPromptRelease({
      promptKey: "p1",
      version: "v1",
      owner: "o",
      evaluationSuiteId: suite.id,
    });

    const snapshot = h.governance.buildModelGovernanceSnapshot();
    assert.deepEqual(snapshot.profileStatuses, {});
    assert.deepEqual(snapshot.rollbackTargets, {});
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("governance service buildModelGovernanceSnapshot tracks model releases", () => {
  const h = createHarness("gov-snapshot-models-");
  try {
    const suite = h.evalService.defineSuite({
      name: "snap-suite-2",
      kind: "golden",
      cases: [{ id: "c1", input: "a", expectedOutput: "a" }],
    });

    h.governance.registerModelRelease({
      profileName: "profile-a",
      version: "v1",
      owner: "o",
      frozenModelId: "model-a",
      rollbackProfileName: "fallback-a",
    });
    h.governance.registerModelRelease({
      profileName: "profile-b",
      version: "v1",
      owner: "o",
      frozenModelId: "model-b",
      rollbackProfileName: "fallback-b",
    });

    const snapshot = h.governance.buildModelGovernanceSnapshot();
    assert.equal(snapshot.profileStatuses["profile-a"], "degraded");
    assert.equal(snapshot.profileStatuses["profile-b"], "degraded");
    assert.equal(snapshot.rollbackTargets["profile-a"], "fallback-a");
    assert.equal(snapshot.rollbackTargets["profile-b"], "fallback-b");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("governance service rolls back sibling releases when new one becomes active", () => {
  const h = createHarness("gov-sibling-rb-");
  try {
    const suite = h.evalService.defineSuite({
      name: "sib-suite",
      kind: "golden",
      cases: [{ id: "c1", input: "a", expectedOutput: "a" }],
    });

    const v1 = h.governance.registerModelRelease({
      profileName: "model-x",
      version: "v1",
      owner: "o",
      frozenModelId: "model-x-v1",
      evaluationSuiteId: suite.id,
    });

    const v1Result = h.governance.evaluateReleaseGate({
      releaseId: v1.id,
      modelId: "model-x",
      promptVersion: "v1",
      promoteTo: "active",
      evaluator: ({ caseDefinition }) => ({
        actualOutput: caseDefinition.expectedOutput,
        passed: true,
        score: 1,
      }),
    });
    assert.equal(v1Result.release.status, "active");

    const v2 = h.governance.registerModelRelease({
      profileName: "model-x",
      version: "v2",
      owner: "o",
      frozenModelId: "model-x-v2",
      evaluationSuiteId: suite.id,
    });

    const v2Result = h.governance.evaluateReleaseGate({
      releaseId: v2.id,
      modelId: "model-x",
      promptVersion: "v2",
      promoteTo: "active",
      evaluator: ({ caseDefinition }) => ({
        actualOutput: caseDefinition.expectedOutput,
        passed: true,
        score: 1,
      }),
    });
    assert.equal(v2Result.release.status, "active");

    const v1Updated = h.governance.getRelease(v1.id);
    assert.equal(v1Updated?.status, "rolled_back");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});
