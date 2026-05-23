import assert from "node:assert/strict";
import test from "node:test";

import { buildPlatformArchitectureBootstrapSummary } from "../../src/platform-architecture-bootstrap.js";
import type {
  PlatformRootSummary,
  PlatformRootSummaryBuilderDeps,
  PlatformRootDemoLegacySnapshot,
  PlatformRootDemoSummary,
} from "../../src/platform-root-types.js";

test("PlatformRootSummary structure validation", () => {
  // Build a minimal valid summary object to verify structure
  const summary: PlatformRootSummary = {
    architecture: null,
    domains: {
      startupOrder: ["domain-a", "domain-b"],
      totalCapabilityCount: 10,
      capabilityCounts: {
        ring1: 3,
        ring2: 4,
        ring3: 3,
      },
    },
    planes: {
      startupOrder: ["five-plane-interface", "five-plane-control-plane"],
      totalCapabilityCount: 20,
      capabilityCounts: {
        interface: 4,
        x1Fabric: 3,
        controlPlane: 4,
        orchestration: 3,
        execution: 3,
        stateEvidence: 3,
      },
    },
    aiOperations: {
      startupOrder: ["model-gateway"],
      totalCapabilityCount: 5,
      capabilityCounts: {
        modelGateway: 2,
        promptEngine: 1,
        compliance: 1,
        harness: 1,
      },
    },
    interactionGovernance: {
      startupOrder: ["interaction"],
      totalCapabilityCount: 3,
      capabilityCounts: {
        interaction: 2,
        governance: 1,
      },
    },
    scaleOps: {
      startupOrder: ["scale-ecosystem", "ops-maturity"],
      totalCapabilityCount: 8,
      capabilityCounts: {
        scaleEcosystem: 4,
        opsMaturity: 4,
      },
    },
  };

  assert.equal(summary.architecture, null);
  assert.equal(summary.domains.startupOrder.length, 2);
  assert.equal(summary.domains.totalCapabilityCount, 10);
  assert.equal(summary.domains.capabilityCounts.ring1, 3);
  assert.equal(summary.domains.capabilityCounts.ring2, 4);
  assert.equal(summary.domains.capabilityCounts.ring3, 3);
  assert.equal(summary.planes.startupOrder.length, 2);
  assert.equal(summary.planes.totalCapabilityCount, 20);
  assert.equal(summary.planes.capabilityCounts.interface, 4);
  assert.equal(summary.planes.capabilityCounts.x1Fabric, 3);
  assert.equal(summary.planes.capabilityCounts.controlPlane, 4);
  assert.equal(summary.planes.capabilityCounts.orchestration, 3);
  assert.equal(summary.planes.capabilityCounts.execution, 3);
  assert.equal(summary.planes.capabilityCounts.stateEvidence, 3);
  assert.equal(summary.aiOperations.startupOrder.length, 1);
  assert.equal(summary.aiOperations.totalCapabilityCount, 5);
  assert.equal(summary.aiOperations.capabilityCounts.modelGateway, 2);
  assert.equal(summary.aiOperations.capabilityCounts.promptEngine, 1);
  assert.equal(summary.aiOperations.capabilityCounts.compliance, 1);
  assert.equal(summary.aiOperations.capabilityCounts.harness, 1);
  assert.equal(summary.interactionGovernance.startupOrder.length, 1);
  assert.equal(summary.interactionGovernance.totalCapabilityCount, 3);
  assert.equal(summary.interactionGovernance.capabilityCounts.interaction, 2);
  assert.equal(summary.interactionGovernance.capabilityCounts.governance, 1);
  assert.equal(summary.scaleOps.startupOrder.length, 2);
  assert.equal(summary.scaleOps.totalCapabilityCount, 8);
  assert.equal(summary.scaleOps.capabilityCounts.scaleEcosystem, 4);
  assert.equal(summary.scaleOps.capabilityCounts.opsMaturity, 4);
});

test("PlatformRootSummaryBuilderDeps structure validation", () => {
  // This type defines the dependencies needed to build a summary
  // Create minimal mock functions to satisfy the function types
  const mockDeps: PlatformRootSummaryBuilderDeps = {
    buildArchitectureSummary: () => buildPlatformArchitectureBootstrapSummary(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    buildDomainsStartupPlan: () => ({ steps: [], totalCapabilityCount: 0, startupOrder: [] }) as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    buildDomainsRuntimeCatalog: () => ({ ring1: [], ring2: [], ring3: [] }) as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    buildFivePlaneStartupPlan: () => ({ steps: [], totalCapabilityCount: 0, startupOrder: [] }) as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    buildFivePlaneRuntimeCatalog: () => ({ planes: [], totalCount: 0 }) as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    buildAiOperationsStartupPlan: () => ({ startupOrder: [], totalCapabilityCount: 0, capabilityCounts: { modelGateway: 0, promptEngine: 0, compliance: 0, harness: 0 } }) as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    buildAiOperationsRuntimeCatalog: () => ({ operations: [], totalCount: 0 }) as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    buildInteractionGovernanceStartupPlan: () => ({ startupOrder: [], totalCapabilityCount: 0, capabilityCounts: { interaction: 0, governance: 0 } }) as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    buildInteractionGovernanceRuntimeCatalog: () => ({ governance: [], totalCount: 0 }) as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    buildScaleOpsStartupPlan: () => ({ startupOrder: [], totalCapabilityCount: 0, capabilityCounts: { scaleEcosystem: 0, opsMaturity: 0 } }) as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    buildScaleOpsRuntimeCatalog: () => ({ scaleEcosystem: [], opsMaturity: [] }) as any,
  };

  assert.equal(typeof mockDeps.buildArchitectureSummary, "function");
  assert.equal(typeof mockDeps.buildDomainsStartupPlan, "function");
  assert.equal(typeof mockDeps.buildDomainsRuntimeCatalog, "function");
  assert.equal(typeof mockDeps.buildFivePlaneStartupPlan, "function");
  assert.equal(typeof mockDeps.buildFivePlaneRuntimeCatalog, "function");
  assert.equal(typeof mockDeps.buildAiOperationsStartupPlan, "function");
  assert.equal(typeof mockDeps.buildAiOperationsRuntimeCatalog, "function");
  assert.equal(typeof mockDeps.buildInteractionGovernanceStartupPlan, "function");
  assert.equal(typeof mockDeps.buildInteractionGovernanceRuntimeCatalog, "function");
  assert.equal(typeof mockDeps.buildScaleOpsStartupPlan, "function");
  assert.equal(typeof mockDeps.buildScaleOpsRuntimeCatalog, "function");
});

test("PlatformRootDemoLegacySnapshot structure validation", () => {
  const legacy: PlatformRootDemoLegacySnapshot = {
    task: {
      id: "task-123",
      status: "completed",
      outputJson: '{"result": "success"}',
    },
    workflow: {
      status: "running",
      currentStepIndex: 2,
    },
    execution: {
      id: "exec-456",
      status: "active",
      traceId: "trace-abc",
    },
    session: {
      id: "session-789",
      status: "active",
    },
    stepOutputs: ["output-1", "output-2"],
    events: [
      { eventType: "task.created", eventTier: "platform" },
      { eventType: "workflow.started", eventTier: "orchestration" },
    ],
  };

  assert.equal(legacy.task.id, "task-123");
  assert.equal(legacy.task.status, "completed");
  assert.equal(legacy.task.outputJson, '{"result": "success"}');
  assert.equal(legacy.workflow?.status, "running");
  assert.equal(legacy.workflow?.currentStepIndex, 2);
  assert.equal(legacy.execution?.id, "exec-456");
  assert.equal(legacy.execution?.status, "active");
  assert.equal(legacy.execution?.traceId, "trace-abc");
  assert.equal(legacy.session?.id, "session-789");
  assert.equal(legacy.session?.status, "active");
  assert.equal(legacy.stepOutputs.length, 2);
  assert.equal(legacy.events.length, 2);
  assert.equal(legacy.events[0]?.eventType, "task.created");
  assert.equal(legacy.events[0]?.eventTier, "platform");
});

test("PlatformRootDemoLegacySnapshot allows null optional fields", () => {
  const minimal: PlatformRootDemoLegacySnapshot = {
    task: {
      id: "task-001",
      status: "pending",
      outputJson: null,
    },
    workflow: null,
    execution: null,
    session: null,
    stepOutputs: [],
    events: [],
  };

  assert.equal(minimal.task.outputJson, null);
  assert.equal(minimal.workflow, null);
  assert.equal(minimal.execution, null);
  assert.equal(minimal.session, null);
  assert.equal(minimal.stepOutputs.length, 0);
  assert.equal(minimal.events.length, 0);
});

test("PlatformRootDemoSummary structure validation", () => {
  const summary: PlatformRootDemoSummary = {
    contractSurface: "platform_root_demo_summary_v1",
    runRef: {
      taskId: "task-demo-1",
      executionId: "exec-demo-1",
      sessionId: "session-demo-1",
      traceId: "trace-demo-1",
    },
    lifecycle: {
      taskStatus: "completed",
      workflowStatus: "completed",
      executionStatus: "completed",
      sessionStatus: "completed",
      currentStepIndex: 5,
    },
    result: {
      output: { message: "Hello World" },
      stepOutputCount: 3,
    },
    events: [
      { eventType: "demo.started", eventTier: "platform" },
      { eventType: "demo.completed", eventTier: "platform" },
    ],
  };

  assert.equal(summary.contractSurface, "platform_root_demo_summary_v1");
  assert.equal(summary.runRef.taskId, "task-demo-1");
  assert.equal(summary.runRef.executionId, "exec-demo-1");
  assert.equal(summary.runRef.sessionId, "session-demo-1");
  assert.equal(summary.runRef.traceId, "trace-demo-1");
  assert.equal(summary.lifecycle.taskStatus, "completed");
  assert.equal(summary.lifecycle.workflowStatus, "completed");
  assert.equal(summary.lifecycle.executionStatus, "completed");
  assert.equal(summary.lifecycle.sessionStatus, "completed");
  assert.equal(summary.lifecycle.currentStepIndex, 5);
  assert.deepEqual(summary.result.output, { message: "Hello World" });
  assert.equal(summary.result.stepOutputCount, 3);
  assert.equal(summary.events.length, 2);
});

test("PlatformRootDemoSummary allows null runRef fields", () => {
  const summary: PlatformRootDemoSummary = {
    contractSurface: "platform_root_demo_summary_v1",
    runRef: {
      taskId: "task-only",
      executionId: null,
      sessionId: null,
      traceId: null,
    },
    lifecycle: {
      taskStatus: "pending",
      workflowStatus: null,
      executionStatus: null,
      sessionStatus: null,
      currentStepIndex: null,
    },
    result: {
      output: null,
      stepOutputCount: 0,
    },
    events: [],
  };

  assert.equal(summary.runRef.executionId, null);
  assert.equal(summary.runRef.sessionId, null);
  assert.equal(summary.runRef.traceId, null);
  assert.equal(summary.lifecycle.workflowStatus, null);
  assert.equal(summary.lifecycle.executionStatus, null);
  assert.equal(summary.lifecycle.sessionStatus, null);
  assert.equal(summary.lifecycle.currentStepIndex, null);
  assert.equal(summary.result.output, null);
  assert.equal(summary.result.stepOutputCount, 0);
  assert.equal(summary.events.length, 0);
});

test("PlatformRootSummary ring3 capability count matches sum", () => {
  const summary: PlatformRootSummary = {
    architecture: null,
    domains: {
      startupOrder: [],
      totalCapabilityCount: 0,
      capabilityCounts: {
        ring1: 1,
        ring2: 2,
        ring3: 3,
      },
    },
    planes: {
      startupOrder: [],
      totalCapabilityCount: 0,
      capabilityCounts: {
        interface: 0,
        x1Fabric: 0,
        controlPlane: 0,
        orchestration: 0,
        execution: 0,
        stateEvidence: 0,
      },
    },
    aiOperations: {
      startupOrder: [],
      totalCapabilityCount: 0,
      capabilityCounts: {
        modelGateway: 0,
        promptEngine: 0,
        compliance: 0,
        harness: 0,
      },
    },
    interactionGovernance: {
      startupOrder: [],
      totalCapabilityCount: 0,
      capabilityCounts: {
        interaction: 0,
        governance: 0,
      },
    },
    scaleOps: {
      startupOrder: [],
      totalCapabilityCount: 0,
      capabilityCounts: {
        scaleEcosystem: 0,
        opsMaturity: 0,
      },
    },
  };

  const ringSum =
    summary.domains.capabilityCounts.ring1 +
    summary.domains.capabilityCounts.ring2 +
    summary.domains.capabilityCounts.ring3;
  assert.equal(ringSum, 6);
});

test("PlatformRootSummary plane capability count matches sum", () => {
  const summary: PlatformRootSummary = {
    architecture: null,
    domains: {
      startupOrder: [],
      totalCapabilityCount: 0,
      capabilityCounts: {
        ring1: 0,
        ring2: 0,
        ring3: 0,
      },
    },
    planes: {
      startupOrder: [],
      totalCapabilityCount: 0,
      capabilityCounts: {
        interface: 1,
        x1Fabric: 2,
        controlPlane: 3,
        orchestration: 4,
        execution: 5,
        stateEvidence: 6,
      },
    },
    aiOperations: {
      startupOrder: [],
      totalCapabilityCount: 0,
      capabilityCounts: {
        modelGateway: 0,
        promptEngine: 0,
        compliance: 0,
        harness: 0,
      },
    },
    interactionGovernance: {
      startupOrder: [],
      totalCapabilityCount: 0,
      capabilityCounts: {
        interaction: 0,
        governance: 0,
      },
    },
    scaleOps: {
      startupOrder: [],
      totalCapabilityCount: 0,
      capabilityCounts: {
        scaleEcosystem: 0,
        opsMaturity: 0,
      },
    },
  };

  const planeSum =
    summary.planes.capabilityCounts.interface +
    summary.planes.capabilityCounts.x1Fabric +
    summary.planes.capabilityCounts.controlPlane +
    summary.planes.capabilityCounts.orchestration +
    summary.planes.capabilityCounts.execution +
    summary.planes.capabilityCounts.stateEvidence;
  assert.equal(planeSum, 21);
});
