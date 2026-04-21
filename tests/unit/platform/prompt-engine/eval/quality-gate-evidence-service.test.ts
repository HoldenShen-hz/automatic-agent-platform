import assert from "node:assert/strict";
import test from "node:test";

import { QualityGateEvidenceService } from "../../../../../src/platform/prompt-engine/eval/quality-gate-evidence-service.js";
import type { QualityGateConfig } from "../../../../../src/platform/prompt-engine/eval/types.js";
import type { ArtifactStore, ArtifactWriteInput, ArtifactWriteResult } from "../../../../../src/platform/state-evidence/artifacts/artifact-store.js";

const config: QualityGateConfig = {
  qualityGate: {
    defaultPassThreshold: 0.75,
    criticalPassThreshold: 0.9,
    enforcement: "blocking",
  },
  qualityScoreWeights: {
    successSignal: 0.4,
    completionOutcome: 0.3,
    failureSignal: 0.2,
    partialSignal: 0.1,
  },
  actionThresholds: {
    completeMinScore: 0.85,
    approvalRequiredScore: 0.7,
    retryMaxFailures: 1,
  },
  evidence: {
    enabled: true,
    artifactKind: "quality-evaluation",
    retentionDays: 30,
  },
};

function createArtifactStoreMock(calls: ArtifactWriteInput[]): ArtifactStore {
  return {
    writeTextArtifact(input: ArtifactWriteInput): ArtifactWriteResult {
      calls.push(input);
      return {
        record: {
          artifactId: "artifact_quality_1",
          taskId: input.taskId,
          executionId: input.executionId ?? null,
          stepId: input.stepId ?? null,
          kind: input.kind,
          storagePath: "/tmp/quality-evaluation.json",
          fileName: input.fileName,
          mimeType: input.mimeType ?? "text/plain",
          sizeBytes: input.content.length,
          checksum: "checksum",
          lineageJson: JSON.stringify(input.lineage ?? {}),
          createdAt: new Date().toISOString(),
        },
        ref: {
          artifactId: "artifact_quality_1",
          taskId: input.taskId,
          kind: input.kind,
          storagePath: "/tmp/quality-evaluation.json",
        } as any,
        scan: {
          redactionCount: 0,
          controlCharsRemoved: 0,
          ansiRemoved: false,
          injectionRisk: "low",
          matchedInjectionRules: [],
          warnings: [],
          contentSanitized: false,
          sensitiveFindings: [],
          sensitiveFindingCount: 0,
          criticalSensitiveFindingCount: 0,
        },
      };
    },
  } as unknown as ArtifactStore;
}

test("QualityGateEvidenceService persists evaluation evidence to artifact store", () => {
  const calls: ArtifactWriteInput[] = [];
  const service = new QualityGateEvidenceService({
    artifactStore: createArtifactStoreMock(calls),
    config,
  });

  const artifactId = service.persistEvaluation(
    {
      evaluationId: "eval_1",
      taskId: "task_1",
      qualityScore: 0.93,
      passed: true,
      reasons: ["quality_gate.passed"],
      nextAction: "complete",
      evaluatedAt: Date.now(),
      factorBreakdown: {
        successSignals: 4,
        failureSignals: 0,
        partialSignals: 1,
        completionBonus: 0.2,
        failurePenalty: 0,
        partialPenalty: 0.05,
      },
    } as any,
    {
      accepted: true,
      releaseStage: "released",
      reasonCodes: ["release.approved"],
    } as any,
    "exec_1",
  );

  assert.equal(artifactId, "artifact_quality_1");
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.taskId, "task_1");
  assert.equal(calls[0]?.executionId, "exec_1");
  assert.equal(calls[0]?.kind, "quality-evaluation");
  assert.match(calls[0]?.content ?? "", /"verdict": "pass"/);
});

test("QualityGateEvidenceService returns empty artifact id when evidence persistence disabled", () => {
  const calls: ArtifactWriteInput[] = [];
  const service = new QualityGateEvidenceService({
    artifactStore: createArtifactStoreMock(calls),
    config: {
      ...config,
      evidence: {
        ...config.evidence,
        enabled: false,
      },
    },
  });

  const artifactId = service.persistEvaluation(
    {
      evaluationId: "eval_2",
      taskId: "task_2",
      qualityScore: 0.4,
      passed: false,
      reasons: ["quality_gate.failed"],
      nextAction: "retry",
      evaluatedAt: Date.now(),
      factorBreakdown: {
        successSignals: 1,
        failureSignals: 3,
        partialSignals: 0,
        completionBonus: 0,
        failurePenalty: 0.4,
        partialPenalty: 0,
      },
    } as any,
    {
      accepted: false,
      releaseStage: "blocked",
      reasonCodes: ["release.blocked"],
    } as any,
  );

  assert.equal(artifactId, "");
  assert.equal(calls.length, 0);
});
