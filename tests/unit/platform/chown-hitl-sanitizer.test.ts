import assert from "node:assert/strict";
import test from "node:test";

import { PluginEcosystemRuntimeService } from "../../../src/domains/registry/plugin-ecosystem-runtime-service.js";
import { ApprovalRoutingService } from "../../../src/org-governance/approval-routing/approval-routing-service.js";
import {
  ApprovalRouteRequestSchema,
  OrgChartRoutingStrategy,
  resolveAmountRoute,
  resolveApprovalRoute,
  type AmountThresholdRule,
} from "../../../src/org-governance/approval-routing/route-engine/index.js";
import { resolveDelegatedApprover } from "../../../src/org-governance/approval-routing/delegation/index.js";
import { SdkVersionHandshakeService } from "../../../src/platform/five-plane-interface/api/middleware/sdk-version-handshake.js";
import { WEB_FETCH_TOOL_METADATA, WEB_SEARCH_TOOL_METADATA } from "../../../src/platform/five-plane-execution/tool-executor/tool-metadata.js";
import { CommandSafetyClassifier, createDefaultCommandPolicies } from "../../../src/platform/five-plane-execution/tool-executor/command-security.js";
import { sanitizeToolOutput } from "../../../src/platform/five-plane-execution/tool-executor/tool-output-sanitizer.js";
import { HitlRuntime } from "../../../src/platform/five-plane-orchestration/harness/hitl-runtime.js";
import { HarnessLoopController } from "../../../src/platform/five-plane-orchestration/harness/loop/index.js";
import { RecoveryController } from "../../../src/platform/five-plane-orchestration/harness/recovery-controller.js";
import { SyncBackedAsyncService } from "../../../src/platform/shared/async/sync-backed-async-service.js";

function makeConstraintPack(maxSteps = 9) {
  return {
    budgetEnvelope: {
      maxSteps,
      maxCost: 100,
      maxDurationMs: 60_000,
    },
  } as const;
}

class ThrowingSyncService extends SyncBackedAsyncService<{ value: string }> {
  public constructor() {
    super(() => ({ value: "ok" }));
  }

  public fail(): Promise<string> {
    return this.asPromise(() => {
      throw new Error("sync_failure");
    });
  }
}

class CountingPluginEcosystemRuntimeService extends PluginEcosystemRuntimeService {
  public buildPlanCalls = 0;

  public override buildPlan(input: {
    domainId: string;
    tenantId: string;
    environment: "dev" | "staging" | "prod";
    connectorIds?: readonly string[];
  }) {
    this.buildPlanCalls += 1;
    return super.buildPlan(input);
  }
}

function createRouteRequest(overrides: Partial<ReturnType<typeof ApprovalRouteRequestSchema.parse>> = {}) {
  return ApprovalRouteRequestSchema.parse({
    requesterId: "requester-1",
    orgNodeId: "team-1",
    riskLevel: "low",
    amountUsd: 0,
    ...overrides,
  });
}

test("R30-16 chown treats arg[1] as the write target path", () => {
  const classifier = new CommandSafetyClassifier();
  const assessment = classifier.assess("chown", ["owner:group", "/workspace/file.txt"]);

  assert.equal(assessment.allowed, true);
  assert.deepEqual(assessment.sandboxWriteArgPaths, ["/workspace/file.txt"]);
});

test("R30-17 HITL resolve rejects double resolution", () => {
  const runtime = new HitlRuntime();
  const request = runtime.open({
    runId: "run-1",
    domainId: "legal",
    reason: "needs approval",
    evidenceRefs: [],
  });

  runtime.resolve(request.requestId, "approved", "operator-1");
  assert.throws(() => runtime.resolve(request.requestId, "rejected", "operator-2"), /request_already_resolved/);
});

test("R30-18 sanitizer removes CSI and OSC escape sequences", () => {
  const result = sanitizeToolOutput("\u001b[2Kcleared\u001b]0;secret-title\u0007visible");

  assert.equal(result.sanitizedText, "clearedvisible");
  assert.equal(result.ansiRemoved, true);
});

test("R30-19 web_search metadata is read-only", () => {
  assert.equal(WEB_SEARCH_TOOL_METADATA.readOnly, true);
  assert.equal(WEB_SEARCH_TOOL_METADATA.approvalMode, "never");
});

test("R30-20 web_fetch metadata is read-only", () => {
  assert.equal(WEB_FETCH_TOOL_METADATA.readOnly, true);
  assert.equal(WEB_FETCH_TOOL_METADATA.approvalMode, "never");
});

test("R30-21 grep/rg path extraction includes every file argument", () => {
  const classifier = new CommandSafetyClassifier();
  const grepAssessment = classifier.assess("grep", ["pattern", "file-1.txt", "file-2.txt"]);
  const rgAssessment = classifier.assess("rg", ["pattern", "dir/a.ts", "dir/b.ts"]);

  assert.deepEqual(grepAssessment.sandboxReadArgPaths, ["file-1.txt", "file-2.txt"]);
  assert.deepEqual(rgAssessment.sandboxReadArgPaths, ["dir/a.ts", "dir/b.ts"]);
});

test("R30-23 interpreter commands allow script arguments after script path", () => {
  const classifier = new CommandSafetyClassifier();
  const assessment = classifier.assess("python3", ["script.py", "--verbose"]);

  assert.equal(assessment.allowed, true);
  assert.equal(assessment.reasonCode, null);
});

test("R30-24 replan guard fails closed at the configured boundary", () => {
  const controller = new HarnessLoopController(makeConstraintPack(), { maxReplans: 2 });
  controller.recordReplan();
  assert.equal(controller.getGuardViolation(), null);
  controller.recordReplan();
  assert.equal(controller.getGuardViolation(), "harness.guard.max_replans_reached");
});

test("R30-25 default command policies keep a single write-aware touch/mkdir definition", () => {
  const policies = createDefaultCommandPolicies();
  assert.deepEqual(policies.get("touch")?.writePathArgPositions, [0]);
  assert.deepEqual(policies.get("mkdir")?.writePathArgPositions, [0]);
});

test("R30-27 sanitizer strips bare ESC bytes via control-character removal", () => {
  const result = sanitizeToolOutput(`before\u001bafter`);

  assert.equal(result.sanitizedText, "beforeafter");
  assert.equal(result.controlCharsRemoved, 1);
});

test("R30-28 worker_crash recovery schedules a retry lease instead of leaving the run stuck", () => {
  const persisted: Array<Record<string, unknown>> = [];
  const controller = new RecoveryController(
    {
      getCheckpointRef: () => null,
      restoreFromCheckpoint: () => null,
      restore: () => null,
      persist: (run: Record<string, unknown>) => {
        persisted.push(run);
      },
    } as never,
    {
      recover: (run: Record<string, unknown>) => ({ ...run, status: "paused", pauseReason: "recovery" }),
      sleep: (run: Record<string, unknown>, reason: string, resumeAt: string, retryAttempt: number) => ({
        ...run,
        status: "paused",
        pauseReason: "sleep",
        sleepLease: { reason, resumeAt, retryAttempt },
      }),
      openHitlReview: (run: Record<string, unknown>) => run,
    } as never,
  );

  const result = controller.handleFailure({
    runId: "run-worker-crash",
    status: "running",
    sleepLease: null,
  } as never, "worker_crash");

  assert.equal(result.status, "paused");
  assert.equal(result.pauseReason, "recovery");
  assert.equal(result.sleepLease, null);
  assert.equal(persisted.length, 1);
});

test("R30-29 sync-backed async wrapper converts sync throws into rejected promises", async () => {
  const service = new ThrowingSyncService();
  await assert.rejects(() => service.fail(), /sync_failure/);
});

test("R30-30 org-chart routing fails closed when org node is missing", () => {
  const strategy = new OrgChartRoutingStrategy();
  const request = createRouteRequest({ orgNodeId: "missing-node" });
  assert.equal(strategy.selectNode([
    { orgNodeId: "team-1", nodeType: "team", active: true, ownerUserIds: ["owner-1"] },
  ] as never, request), null);

  assert.throws(() => resolveApprovalRoute([
    { orgNodeId: "team-1", nodeType: "team", active: true, ownerUserIds: ["owner-1"] },
  ] as never, request), /approval_route\.org_node_not_found/);
});

test("R30-31 runtime activation reuses the plan built at the start of activation", async () => {
  const service = new CountingPluginEcosystemRuntimeService(
    {
      get: () => ({ domainId: "domain-1", status: "active" }),
      getPluginBindings: () => [{ bindingId: "binding-1", pluginId: "plugin-1", pluginType: "workflow" }],
    } as never,
    {
      get: () => ({
        lifecycleState: "enabled",
        manifest: { sandbox: { runtimeIsolation: "process" } },
      }),
      ensureActive: async () => undefined,
    } as never,
    {
      getManifest: () => ({ lifecycleState: "verified" }),
      listBindings: () => [],
      bind: () => ({ bindingId: "connector-binding-1" }),
    } as never,
  );

  const activation = await service.activateRuntime({
    domainId: "domain-1",
    tenantId: "tenant-1",
    environment: "prod",
    connectorIds: ["connector-1"],
    autoBindConnectors: true,
  });

  assert.equal(service.buildPlanCalls, 1);
  assert.equal(activation.plan.domainId, "domain-1");
});

test("R30-32 approval routing audit record ids stay unique across repeated requests", () => {
  const service = new ApprovalRoutingService({
    orgNodes: [
      { orgNodeId: "team-1", nodeType: "team", active: true, ownerUserIds: ["owner-1"], displayName: "Team 1", parentOrgNodeId: null, costCenter: "", metadata: {} },
    ],
  });

  const first = service.route(createRouteRequest(), "2026-05-11T00:00:00.000Z", "2026-05-11T00:00:00.000Z");
  const second = service.route(createRouteRequest(), "2026-05-11T00:00:01.000Z", "2026-05-11T00:00:01.000Z");

  assert.notEqual(first.auditRecord.recordId, second.auditRecord.recordId);
});

test("R30-33 invalid SDK versions are rejected instead of parsing as 0.0.0", () => {
  const service = new SdkVersionHandshakeService({
    platformVersion: "2026.04.01",
    contractVersion: "1.0.0",
    minimumSdkVersion: "1.0.0",
    recommendedSdkVersion: "2.0.0",
  });

  const decision = service.evaluate({
    headers: { "x-sdk-version": "a.b.c" },
  });

  assert.equal(decision.accepted, false);
  assert.equal(decision.reasonCode, "sdk.upgrade_required");
});

test("R30-34 equal thresholds match the lower approval rule instead of escalating past it", () => {
  const rules: readonly AmountThresholdRule[] = [
    { maxAmountCny: 1_000, targetNodeTypes: ["team"] },
    { maxAmountCny: 10_000, targetNodeTypes: ["department"] },
  ];
  const request = createRouteRequest({
    amount: { value: 1_000, currency: "CNY" },
  });
  const nodes = [
    { orgNodeId: "team-1", nodeType: "team", active: true, ownerUserIds: ["owner-1"] },
    { orgNodeId: "dept-1", nodeType: "department", active: true, ownerUserIds: ["owner-2"], parentOrgNodeId: "team-1" },
    { orgNodeId: "company-1", nodeType: "company", active: true, ownerUserIds: ["owner-3"] },
  ];

  const selected = resolveAmountRoute(nodes as never, request, rules);
  assert.equal(selected?.nodeType, "team");
});

test("R30-35 delegation validity uses numeric timestamps across mixed timezone formats", () => {
  const resolved = resolveDelegatedApprover([
    {
      delegationId: "del-1",
      approverId: "owner-1",
      delegateApproverId: "backup-1",
      delegationType: "temporary_cover",
      scopeNodeIds: ["team-1"],
      conflictOfInterestApproverIds: [],
      coiReviewStatus: "pending",
      startsAt: "2026-05-11T08:00:00+08:00",
      expiresAt: "2026-05-11T09:00:00+08:00",
      active: true,
    },
  ], "owner-1", "team-1", "2026-05-11T00:30:00.000Z");

  assert.equal(resolved, "backup-1");
});
