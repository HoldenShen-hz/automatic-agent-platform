import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { AutoStopLossService, type StopLossPlaybook } from "../../../src/platform/five-plane-control-plane/incident-control/auto-stop-loss-service.js";
import {
  computeTier1AuditChainHash,
  computeTier1AuditEventChecksum,
  verifyTier1AuditIntegrity,
} from "../../../src/platform/five-plane-control-plane/iam/audit-event-integrity.js";
import { DegradationController } from "../../../src/platform/model-gateway/degradation/degradation-controller.js";
import {
  ComplianceReportPipelineService,
  type ComplianceReportArtifact,
  type ComplianceReportTemplateDefinition,
} from "../../../src/ops-maturity/compliance-reporter/compliance-report-pipeline-service.js";
import { CommandSafetyClassifier } from "../../../src/platform/five-plane-execution/tool-executor/command-security.js";
import { FencingTokenService } from "../../../src/platform/five-plane-state-evidence/events/cas/fencing-token-service.js";
import { CasService } from "../../../src/platform/five-plane-state-evidence/events/cas/cas-service.js";
import { approvalQueueProjectionHandler, type ApprovalQueueState } from "../../../src/platform/five-plane-state-evidence/events/projections/approval-queue-projection.js";
import { toolUsageProjectionHandler, type ToolUsageState } from "../../../src/platform/five-plane-state-evidence/events/projections/tool-usage-projection.js";
import { workflowRunProjectionHandler, type WorkflowRunState } from "../../../src/platform/five-plane-state-evidence/events/projections/workflow-run-projection.js";
import { LayeredEventInbox } from "../../../src/platform/five-plane-state-evidence/events/layered-event-inbox.js";
import { KnowledgeArchive } from "../../../src/platform/five-plane-state-evidence/knowledge/archive/knowledge-archive.js";
import { KnowledgeSnapshotStore } from "../../../src/platform/five-plane-state-evidence/knowledge/archive/knowledge-snapshot-store.js";
import { SemanticKnowledgeGraph } from "../../../src/platform/five-plane-state-evidence/knowledge/semantic-knowledge-graph.js";
import { LayerTransitionService } from "../../../src/platform/five-plane-state-evidence/memory/layer-transition-service.js";
import {
  createPlatformFactEvent,
  type EventEnvelope,
} from "../../../src/platform/contracts/executable-contracts/index.js";

function makeKnowledgeRecord(input?: {
  checksum?: string;
  documentId?: string;
  chunkIds?: string[];
  rawText?: string | null;
}) {
  const documentId = input?.documentId ?? "doc-1";
  const chunkIds = input?.chunkIds ?? ["chunk-1", "chunk-2"];
  return {
    source: {
      sourceId: `src-${documentId}`,
      type: "file",
      uri: `file:///tmp/${documentId}.md`,
      contentHash: input?.checksum ?? "checksum-a",
      metadata: {},
      ingestedAt: "2026-05-11T00:00:00.000Z",
      namespace: "test-ns",
      language: null,
      tags: [],
      trustLevel: "verified",
      freshnessTimestamp: "2026-05-11T00:00:00.000Z",
      checksum: input?.checksum ?? "checksum-a",
    },
    document: {
      documentId,
      sourceId: `src-${documentId}`,
      title: `Document ${documentId}`,
      version: 1,
      tags: [],
      domainScope: [],
      status: "indexed",
      namespace: "test-ns",
      mimeType: "text/plain",
      rawText: input?.rawText ?? "hello",
      structuredText: null,
      archived: false,
      archivedAt: null,
    },
    chunks: chunkIds.map((chunkId, index) => ({
      chunkId,
      documentId,
      content: `${chunkId} content`,
      chunkType: "concept" as const,
      metadata: { relevantFiles: [] },
      embedding: null,
      tokenCount: 5,
      namespace: "test-ns",
      ordinal: index,
      summary: `${chunkId} summary`,
      keywords: index === 0 ? ["shared", "alpha"] : ["shared", "beta"],
      embeddingId: null,
      locator: {},
    })),
  };
}

function makeProjectionEvent(eventId: string, eventType: string, payload: Record<string, unknown>, taskId = "task-1") {
  return {
    eventId,
    eventType,
    taskId,
    payloadJson: JSON.stringify(payload),
    createdAt: "2026-05-11T00:00:00.000Z",
  };
}

function makeTier1Event(eventId: string, createdAt: string) {
  return {
    id: eventId,
    taskId: "task-1",
    sessionId: null,
    executionId: null,
    eventType: "audit:test",
    eventTier: "tier_1",
    payloadJson: JSON.stringify({ eventId }),
    traceId: `trace-${eventId}`,
    createdAt,
  };
}

test("R29-53 human signoff comparison uses numeric time rather than ISO string ordering", () => {
  const template: ComplianceReportTemplateDefinition = {
    templateId: "soc2-quarterly",
    framework: "SOC2",
    reportType: "quarterly",
    requiredEvidenceTypes: [],
    renderSchema: [],
    version: "1.0.0",
  };
  const pipeline = new ComplianceReportPipelineService([template]);
  const artifact = pipeline.generate({
    templateId: "soc2-quarterly",
    evidence: [],
    requestedBy: "auditor",
    generatedAt: "2026-05-11T00:00:00.000Z",
  });

  const result = pipeline.evaluateHumanSignoff({
    artifact,
    signoffDueAt: "2026-05-11T08:00:00+08:00",
    signedAt: "2026-05-11T00:00:00.000Z",
    now: "2026-05-11T00:00:01.000Z",
  });

  assert.equal(result.status, "signed");
});

test("R29-54 auto stop-loss keeps bounded history and prunes stale execution buckets", async () => {
  let now = new Date("2026-05-11T00:00:00.000Z");
  const service = new AutoStopLossService({
    now: () => now,
    playbooks: [],
  });
  const playbook: StopLossPlaybook = {
    id: "stoploss-history",
    name: "Stoploss History",
    description: "bounded history",
    enabled: true,
    triggerCondition: { type: "anomaly_severity", severityThreshold: "critical" },
    actions: ["circuit_break"],
    cooldownMs: 0,
    maxExecutionsPerHour: 1,
    requireHumanApproval: false,
  };
  service.registerPlaybook(playbook);

  for (let index = 0; index < 1005; index += 1) {
    await service.executePlaybook(playbook, `execution-${index}`);
  }
  assert.equal(service.getExecutionHistory(2_000).length, 1000);

  now = new Date("2026-05-11T01:00:00.000Z");
  const evaluation = service.evaluateAnomaly("critical", "error_rate");
  assert.equal(evaluation.matchingPlaybooks.some((candidate) => candidate.id === playbook.id), true);
});

test("R29-55 audit integrity verification sorts out-of-order entries before computing latestChainHash", () => {
  const firstEvent = makeTier1Event("evt-1", "2026-05-11T00:00:00.000Z");
  const firstChecksum = computeTier1AuditEventChecksum(firstEvent);
  const firstChainHash = computeTier1AuditChainHash({
    chainPosition: 1,
    previousChainHash: null,
    eventChecksum: firstChecksum,
    eventId: "evt-1",
  });
  const secondEvent = makeTier1Event("evt-2", "2026-05-11T00:01:00.000Z");
  const secondChecksum = computeTier1AuditEventChecksum(secondEvent);
  const secondChainHash = computeTier1AuditChainHash({
    chainPosition: 2,
    previousChainHash: firstChainHash,
    eventChecksum: secondChecksum,
    eventId: "evt-2",
  });

  const report = verifyTier1AuditIntegrity([
    {
      integrityRecord: {
        eventId: "evt-2",
        chainPosition: 2,
        eventType: "audit:test",
        eventCreatedAt: secondEvent.createdAt,
        eventChecksum: secondChecksum,
        previousChainHash: firstChainHash,
        chainHash: secondChainHash,
        recordedAt: secondEvent.createdAt,
        algorithm: "hmac-sha256",
      },
      event: secondEvent as never,
    },
    {
      integrityRecord: {
        eventId: "evt-1",
        chainPosition: 1,
        eventType: "audit:test",
        eventCreatedAt: firstEvent.createdAt,
        eventChecksum: firstChecksum,
        previousChainHash: null,
        chainHash: firstChainHash,
        recordedAt: firstEvent.createdAt,
        algorithm: "hmac-sha256",
      },
      event: firstEvent as never,
    },
  ]);

  assert.equal(report.chainBreaks, 0);
  assert.equal(report.latestChainHash, secondChainHash);
});

test("R30-01 fencing token validation handles hyphenated execution ids", () => {
  const service = new FencingTokenService("node-a");
  service.clearAllFences();
  const token = service.generateFencingToken("run-123e4567-e89b-12d3-a456-426614174000", "node-a");

  const result = service.validateFencingToken(token, "node-a");
  assert.equal(result.valid, true);
  assert.equal(result.executionId, "run-123e4567-e89b-12d3-a456-426614174000");
});

test("R30-02 knowledge archive removes stale checksum entry on document checksum change", () => {
  const archive = new KnowledgeArchive();
  archive.upsert(makeKnowledgeRecord({ checksum: "checksum-a", documentId: "doc-1", chunkIds: ["chunk-a"] }));
  archive.upsert(makeKnowledgeRecord({ checksum: "checksum-b", documentId: "doc-1", chunkIds: ["chunk-b"] }));

  assert.equal(archive.getChunk("chunk-a"), null);
  assert.ok(archive.getChunk("chunk-b"));
  assert.equal(archive.list().length, 1);
});

test("R30-03 knowledge archive removes stale chunks when checksum matches an updated document", () => {
  const archive = new KnowledgeArchive();
  archive.upsert(makeKnowledgeRecord({ checksum: "checksum-a", documentId: "doc-1", chunkIds: ["chunk-a", "chunk-b"] }));
  archive.upsert(makeKnowledgeRecord({ checksum: "checksum-a", documentId: "doc-1", chunkIds: ["chunk-c"] }));

  assert.equal(archive.getChunk("chunk-a"), null);
  assert.equal(archive.getChunk("chunk-b"), null);
  assert.ok(archive.getChunk("chunk-c"));
});

test("R30-04 semantic knowledge graph de-duplicates edges across repeated upserts", () => {
  const graph = new SemanticKnowledgeGraph();
  const record = makeKnowledgeRecord();

  graph.upsertRecord(record);
  const first = graph.inspect({});
  graph.upsertRecord(record);
  const second = graph.inspect({});

  assert.equal(second.edges.length, first.edges.length);
});

test("R30-05 CAS setValue keeps versions monotonic", () => {
  const service = new CasService();

  service.setValue("key-1", "v1");
  service.setValue("key-1", "v2");

  assert.equal(service.getVersion("key-1"), 2);
});

test("R30-06 fencing token counter is shared across service instances", () => {
  const service1 = new FencingTokenService("node-1");
  service1.clearAllFences();
  const service2 = new FencingTokenService("node-2");

  const token1 = service1.generateFencingToken("exec-1", "node-1");
  const token2 = service2.generateFencingToken("exec-2", "node-2");

  assert.ok(token1.includes("::1::"));
  assert.ok(token2.includes("::2::"));
});

test("R30-07 approval rejection increments by one instead of forcing all approvers rejected", () => {
  const requestedState = approvalQueueProjectionHandler(null, makeProjectionEvent("evt-1", "decision:requested", {
    approvalId: "approval-1",
    context: { originalRequiredApprovals: 3 },
  })) as ApprovalQueueState;

  const rejectedState = approvalQueueProjectionHandler(requestedState as unknown as Record<string, unknown>, makeProjectionEvent("evt-2", "decision:rejected", {
    approvalId: "approval-1",
    respondedBy: "reviewer-1",
  })) as ApprovalQueueState;

  assert.equal(rejectedState.approvalsRequired, 3);
  assert.equal(rejectedState.rejectionsReceived, 1);
});

test("R30-08 shared fence on another node blocks exclusive acquisition", () => {
  const service1 = new FencingTokenService("node-1");
  service1.clearAllFences();
  const service2 = new FencingTokenService("node-2");

  assert.ok(service1.acquireFence("exec-1", "shared"));
  assert.equal(service2.acquireFence("exec-1", "exclusive"), null);
});

test("R30-10 workflow projection uses Set-based processed event ids", () => {
  const state = workflowRunProjectionHandler(null, makeProjectionEvent("evt-1", "workflow_run.created", {
    workflowId: "wf-1",
  })) as WorkflowRunState;

  assert.ok(state.processedEventIds instanceof Set);
  assert.equal(state.processedEventIds.has("evt-1"), true);
});

test("R30-11 layered event inbox compacts after consumers drain the backlog", () => {
  const inbox = new LayeredEventInbox();
  inbox.registerConsumer({ consumerId: "truth-projector", kind: "truth" });

  for (let index = 1; index <= 10_000; index += 1) {
    inbox.append(createPlatformFactEvent({
      eventType: "platform.harness_run.updated",
      aggregateType: "HarnessRun",
      aggregateId: `run-${index}`,
      aggregateSeq: index,
      tenantId: "tenant-1",
      traceId: `trace-${index}`,
      payload: { index },
    }) as EventEnvelope);
  }
  inbox.drain("truth-projector");
  inbox.append(createPlatformFactEvent({
    eventType: "platform.harness_run.updated",
    aggregateType: "HarnessRun",
    aggregateId: "run-10001",
    aggregateSeq: 10001,
    tenantId: "tenant-1",
    traceId: "trace-10001",
    payload: { index: 10001 },
  }) as EventEnvelope);

  assert.ok(inbox.size() < 10_001);
});

test("R30-12 tool usage projection marks invocation_completed as completed", () => {
  const started = toolUsageProjectionHandler(null, makeProjectionEvent("evt-1", "plugin:invocation_started", {
    pluginId: "plugin-1",
    toolName: "chmod",
  })) as ToolUsageState;

  const completed = toolUsageProjectionHandler(started as unknown as Record<string, unknown>, makeProjectionEvent("evt-2", "plugin:invocation_completed", {
    pluginId: "plugin-1",
    status: "completed",
  })) as ToolUsageState;

  assert.equal(completed.status, "completed");
  assert.equal(completed.successCount, 1);
});

test("R30-13 knowledge snapshot load rejects structurally invalid payloads", () => {
  mkdirSync(join("data", "tmp"), { recursive: true });
  const workspace = mkdtempSync(join("data", "tmp", "knowledge-snapshot-"));
  const snapshotPath = join(workspace, "snapshot.json");
  try {
    writeFileSync(snapshotPath, JSON.stringify({ generatedAt: "2026-05-11T00:00:00.000Z", records: [] }), "utf8");
    const store = new KnowledgeSnapshotStore({ snapshotPath });
    assert.equal(store.load(), null);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test("R30-14 layer transition age uses the newest observable layer timestamp", () => {
  const service = new LayerTransitionService();
  const evaluation = service.evaluateTransition({
    id: "mem-1",
    taskId: null,
    sessionId: null,
    agentId: null,
    executionId: null,
    memoryLayer: "layer_5",
    scope: "episodic",
    contentJson: "{}",
    classification: "general",
    sourceTrustLevel: "trusted",
    qualityScore: 0.9,
    hitCount: 20,
    createdAt: "2026-05-01T00:00:00.000Z",
    lastAccessedAt: "2026-05-11T23:00:00.000Z",
    expiresAt: null,
    revokedAt: null,
    revocationReason: null,
    kind: "general",
    status: "active",
    importanceScore: 0.9,
    freshnessScore: 0.9,
    contentHash: "hash-1",
  }, "2026-05-12T00:00:00.000Z");

  assert.equal(evaluation.canTransition, false);
  assert.ok(evaluation.blockers.some((blocker) => blocker.includes("age")));
});

test("R30-15 command security treats chmod arg[1] as the write target path", () => {
  const classifier = new CommandSafetyClassifier();
  const assessment = classifier.assess("chmod", ["755", "/workspace/file.txt"]);

  assert.equal(assessment.allowed, true);
  assert.deepEqual(assessment.sandboxWriteArgPaths, ["/workspace/file.txt"]);
});

test("R29-52 degradation controller keeps an explicit max recursion depth guard in degraded routing", () => {
  const controller = new DegradationController({
    primaryProvider: {
      createChatCompletion: async () => {
        throw new Error("primary failed");
      },
      getAvailableProfiles: () => [{ provider: "fallback", profileName: "fallback-model" }],
    } as never,
    fallbackProvider: {
      createChatCompletion: async () => {
        throw new Error("fallback failed");
      },
      getAvailableProfiles: () => [{ provider: "fallback", profileName: "fallback-model" }],
    } as never,
    fallbackService: {
      selectFallback: () => ({ selectedProfileName: "fallback-model" }),
    } as never,
    cacheService: {
      get: () => null,
      put: () => undefined,
    } as never,
  });

  return controller.route({
    model: "primary-model",
    routeClass: "general",
    messages: [{ role: "user", content: "hello" }],
  }).then((response) => {
    assert.equal(response.degradationLevel, 3);
  });
});
