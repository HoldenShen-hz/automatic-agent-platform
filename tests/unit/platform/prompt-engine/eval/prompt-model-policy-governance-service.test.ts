import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import {
  LLM_EVAL_DDL,
  LlmEvalService,
} from "../../../../../src/platform/prompt-engine/eval/llm-eval-service.js";
import {
  PROMPT_MODEL_POLICY_GOVERNANCE_DDL,
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

test("governance service registers prompt, model, and policy releases", () => {
  const h = createHarness("aa-governance-register-");
  try {
    const suite = h.evalService.defineSuite({
      name: "governance-register-suite",
      kind: "golden",
      cases: [{ id: "c1", input: "prompt", expectedOutput: "prompt" }],
    });

    const prompt = h.governance.registerPromptRelease({
      promptKey: "support.intake",
      version: "prompt.v2",
      owner: "ops.ai",
      evaluationSuiteId: suite.id,
      lintEvidence: ["lint-ok", "tests-ok"],
    });
    const model = h.governance.registerModelRelease({
      profileName: "balanced",
      version: "model.v3",
      owner: "ops.ai",
      frozenModelId: "claude-sonnet-4-20250514",
      evaluationSuiteId: suite.id,
      fallbackProfiles: ["reasoning-medium"],
      rollbackProfileName: "reasoning-medium",
    });
    const policy = h.governance.registerPolicyBundleRelease({
      bundleName: "prod-risk-policy",
      version: "policy.v4",
      owner: "security.team",
      changeTicket: "SEC-123",
      effectiveScope: "prod",
      denyAllowDeltaSummary: "tighten prod command execution",
      auditEvidence: ["audit-1"],
    });

    assert.equal(h.governance.listReleases().length, 3);
    assert.equal(prompt.status, "review_required");
    assert.equal(model.rollbackVersion, "reasoning-medium");
    assert.equal(policy.releaseType, "policy");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("governance service promotes prompt release after a passing CI gate", () => {
  const h = createHarness("aa-governance-prompt-gate-");
  try {
    const suite = h.evalService.defineSuite({
      name: "prompt-gate-suite",
      kind: "golden",
      cases: [{ id: "c1", input: "input", expectedOutput: "expected" }],
    });
    const prompt = h.governance.registerPromptRelease({
      promptKey: "support.summary",
      version: "prompt.v3",
      owner: "ops.ai",
      evaluationSuiteId: suite.id,
      reviewRequired: false,
      rolloutScope: "canary",
    });

    const result = h.governance.evaluateReleaseGate({
      releaseId: prompt.id,
      modelId: "gpt-4",
      promptVersion: "prompt.v3",
      promoteTo: "active",
      evaluator: ({ caseDefinition }) => ({
        actualOutput: caseDefinition.expectedOutput,
        passed: true,
        score: 1,
      }),
    });

    assert.equal(result.gate.passed, true);
    assert.equal(result.event.decision, "promote");
    assert.equal(result.release.status, "active");
    assert.equal(h.governance.listGateEvents(prompt.id).length, 1);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("governance service degrades failing model release to fallback recommendation", () => {
  const h = createHarness("aa-governance-model-gate-");
  try {
    const suite = h.evalService.defineSuite({
      name: "model-gate-suite",
      kind: "regression",
      cases: [{ id: "c1", input: "input", expectedOutput: "expected" }],
    });
    const model = h.governance.registerModelRelease({
      profileName: "balanced",
      version: "model.v5",
      owner: "ops.ai",
      frozenModelId: "claude-sonnet-4-20250514",
      evaluationSuiteId: suite.id,
      reviewRequired: false,
      fallbackProfiles: ["reasoning-medium", "fast"],
      rollbackProfileName: "reasoning-medium",
    });

    const result = h.governance.evaluateReleaseGate({
      releaseId: model.id,
      modelId: "balanced",
      promptVersion: "model.v5",
      baselinePromptVersion: "model.v4",
      evaluator: () => ({
        actualOutput: "wrong",
        passed: false,
        score: 0.1,
      }),
    });

    assert.equal(result.gate.passed, false);
    assert.equal(result.event.decision, "degrade_to_fallback");
    assert.equal(result.event.shouldDegrade, true);
    assert.equal(result.event.recommendedFallbackKey, "reasoning-medium");
    assert.equal(result.release.status, "blocked");

    const snapshot = h.governance.buildModelGovernanceSnapshot();
    assert.equal(snapshot.profileStatuses.balanced, "degraded");
    assert.equal(snapshot.rollbackTargets.balanced, "reasoning-medium");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("governance service records policy bundle rollback on failing gate", () => {
  const h = createHarness("aa-governance-policy-gate-");
  try {
    const suite = h.evalService.defineSuite({
      name: "policy-gate-suite",
      kind: "golden",
      cases: [{ id: "c1", input: "policy", expectedOutput: "allow" }],
    });
    const policy = h.governance.registerPolicyBundleRelease({
      bundleName: "ops-policy",
      version: "policy.v2",
      owner: "security.team",
      changeTicket: "SEC-999",
      effectiveScope: "ops",
      denyAllowDeltaSummary: "deny prod shell exec",
      evaluationSuiteId: suite.id,
      reviewRequired: false,
      rollbackVersion: "policy.v1",
    });

    const result = h.governance.evaluateReleaseGate({
      releaseId: policy.id,
      modelId: "policy-eval",
      promptVersion: "policy.v2",
      evaluator: () => ({
        actualOutput: "deny",
        passed: false,
        score: 0,
      }),
    });

    assert.equal(result.event.decision, "rollback");
    assert.equal(result.release.status, "rolled_back");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});
