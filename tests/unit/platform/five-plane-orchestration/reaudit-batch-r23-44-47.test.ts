import assert from "node:assert/strict";
import test from "node:test";

import { AutoRollbackService } from "../../../../src/platform/five-plane-orchestration/improve-rollout/auto-rollback-service.js";
import { ImprovementCandidateRegistry, type CandidatePersistenceStore } from "../../../../src/platform/five-plane-orchestration/improve-rollout/improvement-candidate-registry.js";
import { PromptRolloutService, normalizePromptRolloutMode } from "../../../../src/platform/prompt-engine/rollout/index.js";
import { LlmEvalService } from "../../../../src/platform/prompt-engine/eval/llm-eval-service.js";
import type { RolloutRecord } from "../../../../src/platform/five-plane-orchestration/oapeflir/types/rollout-record.js";
import type { LearningObject } from "../../../../src/platform/five-plane-orchestration/learn/learning-object-model.js";

function makeRolloutRecord(): RolloutRecord {
  return {
    recordId: "rollout-r23-44",
    candidateId: "candidate-r23-44",
    level: "L2_canary",
    previousLevel: "L1_evaluate",
    fromLevel: "L1_evaluate",
    toLevel: "L2_canary",
    strategyVersionId: null,
    status: "canary_5",
    transitionedAt: Date.now(),
    createdAt: "2026-05-01T00:00:00.000Z",
    triggeredBy: "scheduler",
    metrics: {
      errorRate: 0,
      latencyP99: 100,
      successRate: 1,
      sampleCount: 10,
    },
    auditContext: {
      evidenceRefs: [],
      reasonCodes: [],
    },
    guardrailReasonCodes: [],
    evidence: [],
  };
}

function makeLearningObject(): LearningObject {
  const learningType: LearningObject["learningType"] = "failure_pattern";
  return {
    learningObjectId: "lo-r23-45",
    objectId: "lo-r23-45",
    learningType,
    kind: learningType,
    title: "Repeated failure",
    summary: "Regression in rollout",
    content: {
      title: "Repeated failure",
      summary: "Regression in rollout",
      evidenceRefs: ["evidence-r23-45"],
      sourceSignalIds: ["signal-r23-45"],
      recommendation: "Tighten policy",
    },
    confidence: 0.9,
    evidenceRefs: ["evidence-r23-45"],
    sourceSignalIds: ["signal-r23-45"],
    recommendation: "Tighten policy",
    validatedBy: "evidence",
    promotionStatus: "validated",
    status: "validated",
    createdAt: "2026-05-01T00:00:00.000Z",
  };
}

function createInMemoryEvalDb() {
  const suites = new Map<string, Record<string, unknown>>();
  const runs = new Map<string, Record<string, unknown>>();
  const caseResults: Record<string, unknown>[] = [];

  return {
    connection: {
      exec() {},
      prepare(sql: string) {
        return {
          run(...args: unknown[]) {
            if (sql.startsWith("INSERT INTO eval_suites")) {
              const [id, name, kind, description, cases, createdAt, updatedAt] = args;
              suites.set(String(id), {
                id,
                name,
                kind,
                description,
                cases,
                created_at: createdAt,
                updated_at: updatedAt,
              });
              return;
            }
            if (sql.startsWith("INSERT INTO eval_runs")) {
              const [id, suiteId, modelId, promptVersion, status, totalCases, passedCases, failedCases, averageScore, verdict, startedAt, completedAt, triggeredBy, metadata] = args;
              runs.set(String(id), {
                id,
                suite_id: suiteId,
                model_id: modelId,
                prompt_version: promptVersion,
                status,
                total_cases: totalCases,
                passed_cases: passedCases,
                failed_cases: failedCases,
                average_score: averageScore,
                verdict,
                started_at: startedAt,
                completed_at: completedAt,
                triggered_by: triggeredBy,
                metadata,
              });
              return;
            }
            if (sql.startsWith("INSERT INTO eval_case_results")) {
              const [id, runId, caseId, input, expectedOutput, actualOutput, score, passed, latencyMs, metadata] = args;
              caseResults.push({
                id,
                run_id: runId,
                case_id: caseId,
                input,
                expected_output: expectedOutput,
                actual_output: actualOutput,
                score,
                passed,
                latency_ms: latencyMs,
                metadata,
              });
              return;
            }
            if (sql.startsWith("UPDATE eval_runs SET")) {
              const [status, passedCases, failedCases, averageScore, verdict, completedAt, runId] = args;
              const existing = runs.get(String(runId));
              if (existing) {
                runs.set(String(runId), {
                  ...existing,
                  status,
                  passed_cases: passedCases,
                  failed_cases: failedCases,
                  average_score: averageScore,
                  verdict,
                  completed_at: completedAt,
                });
              }
            }
          },
          get(...args: unknown[]) {
            if (sql.startsWith("SELECT * FROM eval_suites WHERE id = ?")) {
              return suites.get(String(args[0]));
            }
            if (sql.startsWith("SELECT * FROM eval_runs WHERE id = ?")) {
              return runs.get(String(args[0]));
            }
            return undefined;
          },
          all(...args: unknown[]) {
            if (sql.startsWith("SELECT * FROM eval_case_results WHERE run_id = ?")) {
              return caseResults.filter((row) => row.run_id === args[0]);
            }
            return [];
          },
        };
      },
    },
  };
}

test("AutoRollbackService triggers the rollback handler when thresholds are exceeded", () => {
  let invoked: { candidateId: string; reasons: string[] } | null = null;
  const service = new AutoRollbackService({
    rollbackHandler(rollout, reasonCodes) {
      invoked = {
        candidateId: rollout.candidateId,
        reasons: [...reasonCodes],
      };
    },
  });

  const decision = service.evaluate(makeRolloutRecord(), {
    requestCount: 100,
    failureRate: 0.2,
    p99LatencyMs: 500,
    baselineP99LatencyMs: 100,
    observationWindowMs: 120_000,
  });

  assert.equal(decision.rollback, true);
  assert.ok(invoked != null);
  assert.equal(invoked!.candidateId, "candidate-r23-44");
  assert.ok(invoked!.reasons.includes("rollout.failure_rate_exceeded"));
});

test("ImprovementCandidateRegistry hydrates from a persistence store and evicts expired candidates", () => {
  const persisted = [
    {
      candidateId: "candidate-expired",
      taskId: "task-expired",
      learningObjectId: "lo-r23-45",
      source: "failure_pattern" as const,
      targetScope: "domain" as const,
      priority: "high" as const,
      rolloutLevel: "L0_off" as const,
      metrics: { errorRate: 0, latencyP99: 0, successRate: 1, sampleCount: 0 },
      guardrails: [],
      sourceSignalRefs: ["evidence-r23-45"],
      sourceLearningObjectIds: ["lo-r23-45"],
      changeScope: "policy" as const,
      description: "Expired candidate",
      expectedBenefit: "Do not keep forever",
      status: "candidate_created" as const,
      createdAt: "2026-05-01T00:00:00.000Z",
      updatedAt: "2026-05-01T00:00:00.000Z",
    },
  ];
  const deletedIds: string[] = [];
  const store: CandidatePersistenceStore = {
    saveCandidate() {},
    loadCandidates() {
      return persisted;
    },
    deleteCandidate(candidateId) {
      deletedIds.push(candidateId);
    },
  };

  const registry = new ImprovementCandidateRegistry({
    store,
    ttlMs: 1,
  });

  const loadedBeforeExpiry = registry.list();
  assert.equal(loadedBeforeExpiry.length, 0);
  assert.deepEqual(deletedIds, ["candidate-expired"]);

  const created = registry.register({
    taskId: "task-active",
    target: "planning_policy",
    learningObjects: [makeLearningObject()],
    description: "Active candidate",
  });
  assert.equal(created.status, "candidate_created");
});

test("PromptRolloutService exposes canonical L0-L5 rollout modes", () => {
  const rollout = new PromptRolloutService();

  assert.equal(normalizePromptRolloutMode("canary"), "L3_canary");
  assert.equal(normalizePromptRolloutMode("stable"), "L5_stable");

  const stableDecision = rollout.evaluateGuardrail({
    mode: "L5_stable",
    regressionPassed: true,
    domainBlockCompatible: true,
  });
  const partialDecision = rollout.evaluateGuardrail({
    mode: "L4_partial",
    regressionPassed: true,
    domainBlockCompatible: true,
  });

  assert.equal(stableDecision.nextStatus, "stable");
  assert.equal(partialDecision.nextStatus, "canary_20");
});

test("LlmEvalService runAbTest uses the real llmClient path and reports mockEvaluation=false", async () => {
  const service = new LlmEvalService(createInMemoryEvalDb() as never);
  const suite = service.defineSuite({
    name: "A/B suite",
    kind: "ab_test",
    description: "Tests real client path",
    cases: [
      { id: "case-1", input: "hello", expectedOutput: "world" },
      { id: "case-2", input: "foo", expectedOutput: "bar" },
    ],
  });

  const result = await service.runAbTest(suite.id, {
    controlModelId: "model-a",
    treatmentModelId: "model-b",
    controlPromptVersion: "v1",
    treatmentPromptVersion: "v2",
    minSampleSize: 2,
    significanceThreshold: 0.01,
  }, {
    llmClient: {
      async evaluate({ modelId }) {
        return modelId === "model-a"
          ? { actualOutput: "control", score: 0.6, latencyMs: 10 }
          : { actualOutput: "treatment", score: 0.9, latencyMs: 12 };
      },
    },
  });

  assert.equal(result.mockEvaluation, false);
  assert.ok(result.treatmentAvgScore > result.controlAvgScore);
});
