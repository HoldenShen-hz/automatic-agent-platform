// @ts-nocheck
import assert from "node:assert/strict";
import test from "node:test";

import {
  StalledExecutionEscalationService,
  type StalledExecutionEscalationPackage,
} from "../../../../../src/platform/execution/recovery/stalled-execution-escalation-service.js";
import type {
  StalledExecutionFinding,
  StalledExecutionDetectionOptions,
} from "../../../../../src/platform/execution/recovery/stalled-execution-detector.js";
import type {
  DiagnosticsService,
  DiagnosticWarningSummary,
  IncidentTimelineReport,
} from "../../../../../src/shared/observability/diagnostics-service.js";
import type { TaskSnapshot } from "../../../..//shared/observability/diagnostics-service.js";

// Mock DiagnosticsService
function createMockDiagnosticsService(snapshot: Partial<TaskSnapshot> = {}, warnings: DiagnosticWarningSummary = { critical: [], warning: [] }, incident: Partial<IncidentTimelineReport> = {}): DiagnosticsService {
  return {
    buildTaskSnapshot: () => snapshot as TaskSnapshot,
    buildDebugDump: () => ({
      taskId: snapshot.taskId ?? "task-1",
      executionId: snapshot.inspect?.agentExecutions?.[0]?.executionId ?? "exec-1",
      warningSummary: warnings,
      dump: {},
    }),
    buildIncidentTimelineReport: () => ({
      summary: {
        totalEntries: incident.summary?.totalEntries ?? 0,
        highestSeverity: incident.summary?.highestSeverity ?? "info",
      },
      candidateRootCauses: incident.candidateRootCauses ?? [],
      window: {
        startedAt: incident.window?.startedAt ?? null,
        endedAt: incident.window?.endedAt ?? null,
      },
      entries: [],
    }),
  } as unknown as DiagnosticsService;
}

// Mock StalledExecutionDetector
function createMockStalledDetector(findings: StalledExecutionFinding[] = []): StalledExecutionDetector {
  return {
    detect: (options?: StalledExecutionDetectionOptions) => findings,
  } as unknown as StalledExecutionDetector;
}

test("StalledExecutionEscalationService builds packages for detected stalled executions", () => {
  const findings: StalledExecutionFinding[] = [
    {
      executionId: "exec-1",
      taskId: "task-1",
      agentId: "agent-1",
      status: "executing",
      lastProgressAt: "2025-01-01T00:00:00.000Z",
      lastHeartbeatAt: "2025-01-01T00:01:00.000Z",
      staleKind: "missing_heartbeat",
      recommendedAction: "lease_reclaim",
    },
  ];

  const mockSnapshot: Partial<TaskSnapshot> = {
    taskId: "task-1",
    traceSummary: { traceId: "trace-1", correlationId: null },
    inspect: {
      agentExecutions: [{
        executionId: "exec-1",
        currentStepId: "step-1",
        runtimeInstanceId: "instance-1",
      }],
      dispatchDecisions: [],
    },
    health: { status: "healthy" },
  };

  const detector = createMockStalledDetector(findings);
  const diagnostics = createMockDiagnosticsService(mockSnapshot);

  const service = new StalledExecutionEscalationService(detector, diagnostics);
  const packages = service.buildPackages();

  assert.equal(packages.length, 1);
  assert.equal(packages[0]!.executionId, "exec-1");
  assert.equal(packages[0]!.taskId, "task-1");
  assert.equal(packages[0]!.agentId, "agent-1");
  assert.equal(packages[0]!.staleKind, "missing_heartbeat");
  assert.equal(packages[0]!.recommendedAction, "lease_reclaim");
  assert.equal(packages[0]!.suggestedOperatorAction, "reclaim_lease_and_requeue");
});

test("StalledExecutionEscalationService maps restart_or_escalate to restart_execution_or_takeover", () => {
  const findings: StalledExecutionFinding[] = [
    {
      executionId: "exec-1",
      taskId: "task-1",
      agentId: "agent-1",
      status: "executing",
      lastProgressAt: "2025-01-01T00:00:00.000Z",
      lastHeartbeatAt: "2025-01-01T00:00:30.000Z",
      staleKind: "no_progress",
      recommendedAction: "restart_or_escalate",
    },
  ];

  const mockSnapshot: Partial<TaskSnapshot> = {
    taskId: "task-1",
    traceSummary: { traceId: "trace-1", correlationId: null },
    inspect: { agentExecutions: [], dispatchDecisions: [] },
    health: { status: "degraded" },
  };

  const detector = createMockStalledDetector(findings);
  const diagnostics = createMockDiagnosticsService(mockSnapshot);

  const service = new StalledExecutionEscalationService(detector, diagnostics);
  const packages = service.buildPackages();

  assert.equal(packages[0]!.suggestedOperatorAction, "restart_execution_or_takeover");
});

test("StalledExecutionEscalationService.buildPackages returns empty when no findings", () => {
  const detector = createMockStalledDetector([]);
  const diagnostics = createMockDiagnosticsService();

  const service = new StalledExecutionEscalationService(detector, diagnostics);
  const packages = service.buildPackages();

  assert.deepEqual(packages, []);
});

test("StalledExecutionEscalationPackage has correct structure", () => {
  const findings: StalledExecutionFinding[] = [
    {
      executionId: "exec-1",
      taskId: "task-1",
      agentId: "agent-1",
      status: "executing",
      lastProgressAt: "2025-01-01T00:00:00.000Z",
      lastHeartbeatAt: null,
      staleKind: "missing_heartbeat",
      recommendedAction: "lease_reclaim",
    },
  ];

  const mockSnapshot: Partial<TaskSnapshot> = {
    taskId: "task-1",
    traceSummary: { traceId: "trace-1", correlationId: "corr-1" },
    inspect: {
      agentExecutions: [],
      dispatchDecisions: [{ outcome: "dispatched" }],
    },
    health: { status: "healthy" },
  };

  const detector = createMockStalledDetector(findings);
  const diagnostics = createMockDiagnosticsService(mockSnapshot);

  const service = new StalledExecutionEscalationService(detector, diagnostics);
  const packages = service.buildPackages();

  const pkg = packages[0]!;
  assert.ok("executionId" in pkg);
  assert.ok("taskId" in pkg);
  assert.ok("agentId" in pkg);
  assert.ok("status" in pkg);
  assert.ok("staleKind" in pkg);
  assert.ok("recommendedAction" in pkg);
  assert.ok("suggestedOperatorAction" in pkg);
  assert.ok("generatedAt" in pkg);
  assert.ok("traceId" in pkg);
  assert.ok("correlationId" in pkg);
  assert.ok("currentStepId" in pkg);
  assert.ok("runtimeInstanceId" in pkg);
  assert.ok("lastProgressAt" in pkg);
  assert.ok("lastHeartbeatAt" in pkg);
  assert.ok("dispatchOutcome" in pkg);
  assert.ok("healthStatus" in pkg);
  assert.ok("warnings" in pkg);
  assert.ok("incident" in pkg);
});

test("StalledExecutionEscalationService handles missing agent execution data", () => {
  const findings: StalledExecutionFinding[] = [
    {
      executionId: "exec-1",
      taskId: "task-1",
      agentId: "agent-1",
      status: "executing",
      lastProgressAt: "2025-01-01T00:00:00.000Z",
      lastHeartbeatAt: null,
      staleKind: "missing_heartbeat",
      recommendedAction: "lease_reclaim",
    },
  ];

  const mockSnapshot: Partial<TaskSnapshot> = {
    taskId: "task-1",
    traceSummary: { traceId: "trace-1", correlationId: null },
    inspect: {
      agentExecutions: [], // Empty - no agent execution found
      dispatchDecisions: [],
    },
    health: { status: "unknown" },
  };

  const detector = createMockStalledDetector(findings);
  const diagnostics = createMockDiagnosticsService(mockSnapshot);

  const service = new StalledExecutionEscalationService(detector, diagnostics);
  const packages = service.buildPackages();

  assert.equal(packages[0]!.currentStepId, null);
  assert.equal(packages[0]!.runtimeInstanceId, null);
});

test("StalledExecutionEscalationService handles no dispatch decisions", () => {
  const findings: StalledExecutionFinding[] = [
    {
      executionId: "exec-1",
      taskId: "task-1",
      agentId: "agent-1",
      status: "executing",
      lastProgressAt: "2025-01-01T00:00:00.000Z",
      lastHeartbeatAt: null,
      staleKind: "missing_heartbeat",
      recommendedAction: "lease_reclaim",
    },
  ];

  const mockSnapshot: Partial<TaskSnapshot> = {
    taskId: "task-1",
    traceSummary: { traceId: "trace-1", correlationId: null },
    inspect: {
      agentExecutions: [],
      dispatchDecisions: [], // No dispatch decisions
    },
    health: { status: "healthy" },
  };

  const detector = createMockStalledDetector(findings);
  const diagnostics = createMockDiagnosticsService(mockSnapshot);

  const service = new StalledExecutionEscalationService(detector, diagnostics);
  const packages = service.buildPackages();

  assert.equal(packages[0]!.dispatchOutcome, null);
});

test("StalledExecutionEscalationService passes through incident data", () => {
  const findings: StalledExecutionFinding[] = [
    {
      executionId: "exec-1",
      taskId: "task-1",
      agentId: "agent-1",
      status: "executing",
      lastProgressAt: "2025-01-01T00:00:00.000Z",
      lastHeartbeatAt: null,
      staleKind: "missing_heartbeat",
      recommendedAction: "lease_reclaim",
    },
  ];

  const mockSnapshot: Partial<TaskSnapshot> = {
    taskId: "task-1",
    traceSummary: { traceId: "trace-1", correlationId: null },
    inspect: { agentExecutions: [], dispatchDecisions: [] },
    health: { status: "healthy" },
  };

  const detector = createMockStalledDetector(findings);
  const diagnostics = createMockDiagnosticsService(
    mockSnapshot,
    { critical: ["memory"], warning: ["slow"] },
    {
      summary: { totalEntries: 5, highestSeverity: "warning" as const },
      candidateRootCauses: ["timeout", "memory"],
      window: { startedAt: "2025-01-01T00:00:00.000Z", endedAt: "2025-01-01T00:05:00.000Z" },
    },
  );

  const service = new StalledExecutionEscalationService(detector, diagnostics);
  const packages = service.buildPackages();

  assert.equal(packages[0]!.incident.totalEntries, 5);
  assert.equal(packages[0]!.incident.highestSeverity, "warning");
  assert.deepEqual(packages[0]!.incident.candidateRootCauses, ["timeout", "memory"]);
  assert.equal(packages[0]!.incident.startedAt, "2025-01-01T00:00:00.000Z");
  assert.equal(packages[0]!.incident.endedAt, "2025-01-01T00:05:00.000Z");
});

test("StalledExecutionEscalationService.buildPackage builds single package", () => {
  const finding: StalledExecutionFinding = {
    executionId: "exec-1",
    taskId: "task-1",
    agentId: "agent-1",
    status: "executing",
    lastProgressAt: "2025-01-01T00:00:00.000Z",
    lastHeartbeatAt: "2025-01-01T00:01:00.000Z",
    staleKind: "missing_heartbeat",
    recommendedAction: "lease_reclaim",
  };

  const mockSnapshot: Partial<TaskSnapshot> = {
    taskId: "task-1",
    traceSummary: { traceId: "trace-1", correlationId: null },
    inspect: { agentExecutions: [], dispatchDecisions: [] },
    health: { status: "healthy" },
  };

  const detector = createMockStalledDetector([finding]);
  const diagnostics = createMockDiagnosticsService(mockSnapshot);

  const service = new StalledExecutionEscalationService(detector, diagnostics);
  const pkg = service.buildPackage(finding);

  assert.equal(pkg.executionId, "exec-1");
  assert.equal(pkg.taskId, "task-1");
  assert.equal(pkg.staleKind, "missing_heartbeat");
});

test("StalledExecutionEscalationService.buildPackage uses custom generatedAt", () => {
  const finding: StalledExecutionFinding = {
    executionId: "exec-1",
    taskId: "task-1",
    agentId: "agent-1",
    status: "executing",
    lastProgressAt: "2025-01-01T00:00:00.000Z",
    lastHeartbeatAt: null,
    staleKind: "missing_heartbeat",
    recommendedAction: "lease_reclaim",
  };

  const mockSnapshot: Partial<TaskSnapshot> = {
    taskId: "task-1",
    traceSummary: { traceId: "trace-1", correlationId: null },
    inspect: { agentExecutions: [], dispatchDecisions: [] },
    health: { status: "healthy" },
  };

  const detector = createMockStalledDetector([]);
  const diagnostics = createMockDiagnosticsService(mockSnapshot);

  const service = new StalledExecutionEscalationService(detector, diagnostics);
  const customTime = "2025-06-15T12:00:00.000Z";
  const pkg = service.buildPackage(finding, customTime);

  assert.equal(pkg.generatedAt, customTime);
});
