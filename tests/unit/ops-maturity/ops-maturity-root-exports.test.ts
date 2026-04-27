/**
 * Unit tests for OpsMaturity Root Index Exports
 *
 * @see src/ops-maturity/index.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import * as opsMaturity from "../../../src/ops-maturity/index.js";

describe("OpsMaturity Root Exports", () => {
  describe("Agent Lifecycle exports", () => {
    test("exports AgentLifecycleService", () => {
      assert.ok(opsMaturity.AgentLifecycleService !== undefined);
    });

    test("exports listActiveAgents function", () => {
      assert.ok(opsMaturity.listActiveAgents !== undefined);
    });

    test("exports isValidLifecycleTransition function", () => {
      assert.ok(opsMaturity.isValidLifecycleTransition !== undefined);
    });
  });

  describe("Capacity Planner exports", () => {
    test("exports CapacityPlanningService", () => {
      assert.ok(opsMaturity.CapacityPlanningService !== undefined);
    });
  });

  describe("Chaos exports", () => {
    test("exports ChaosExperimentScheduler", () => {
      assert.ok(opsMaturity.ChaosExperimentScheduler !== undefined);
    });
  });

  describe("Compliance Reporter exports", () => {
    test("exports ComplianceReportPipelineService", () => {
      assert.ok(opsMaturity.ComplianceReportPipelineService !== undefined);
    });
  });

  describe("Cost Optimizer exports", () => {
    test("exports CostOptimizationService", () => {
      assert.ok(opsMaturity.CostOptimizationService !== undefined);
    });
  });

  describe("Drift Detection exports", () => {
    test("exports EvolutionMvpService", () => {
      assert.ok(opsMaturity.EvolutionMvpService !== undefined);
    });

    test("exports ChangepointDetectorService", () => {
      assert.ok(opsMaturity.ChangepointDetectorService !== undefined);
    });

    test("exports CrossAgentAnalyzerService", () => {
      assert.ok(opsMaturity.CrossAgentAnalyzerService !== undefined);
    });
  });

  describe("Edge Runtime exports", () => {
    test("exports EdgeRuntimeSyncService", () => {
      assert.ok(opsMaturity.EdgeRuntimeSyncService !== undefined);
    });
  });

  describe("Emergency exports", () => {
    test("exports PlatformPanicService", () => {
      assert.ok(opsMaturity.PlatformPanicService !== undefined);
    });
  });

  describe("Explainability exports", () => {
    test("exports ExplanationPipelineService", () => {
      assert.ok(opsMaturity.ExplanationPipelineService !== undefined);
    });

    test("exports putExplanationCacheEntry", () => {
      assert.ok(opsMaturity.putExplanationCacheEntry !== undefined);
    });
  });

  describe("Monitoring exports", () => {
    test("exports AnomalyDetectionService", () => {
      assert.ok(opsMaturity.AnomalyDetectionService !== undefined);
    });
  });

  describe("Multimodal exports", () => {
    test("exports MultimodalGatewayService", () => {
      assert.ok(opsMaturity.MultimodalGatewayService !== undefined);
    });
  });

  describe("Platform Ops Agent exports", () => {
    test("exports PlatformOpsAgentService", () => {
      assert.ok(opsMaturity.PlatformOpsAgentService !== undefined);
    });

    test("exports RunbookAutomationService", () => {
      assert.ok(opsMaturity.RunbookAutomationService !== undefined);
    });

    test("exports SelfHealingService", () => {
      assert.ok(opsMaturity.SelfHealingService !== undefined);
    });
  });

  describe("Version Management exports", () => {
    test("exports SemverValidator", () => {
      assert.ok(opsMaturity.SemverValidator !== undefined);
    });
  });

  describe("Workflow Debugger exports", () => {
    test("exports WorkflowDebuggerService", () => {
      assert.ok(opsMaturity.WorkflowDebuggerService !== undefined);
    });

    test("exports TimeTravelDebugService", () => {
      assert.ok(opsMaturity.TimeTravelDebugService !== undefined);
    });

    test("exports isBreakpointHit", () => {
      assert.ok(opsMaturity.isBreakpointHit !== undefined);
    });
  });

  describe("Bootstrap exports", () => {
    test("exports buildOpsMaturityBootstrap", () => {
      assert.ok(opsMaturity.buildOpsMaturityBootstrap !== undefined);
    });

    test("exports registerOpsMaturityBootstrap", () => {
      assert.ok(opsMaturity.registerOpsMaturityBootstrap !== undefined);
    });

    test("exports listOpsMaturityCapabilityBaselines", () => {
      assert.ok(opsMaturity.listOpsMaturityCapabilityBaselines !== undefined);
    });

    test("exports resolveOpsMaturityCapabilityBaseline", () => {
      assert.ok(opsMaturity.resolveOpsMaturityCapabilityBaseline !== undefined);
    });
  });

  describe("Capability baselines", () => {
    test("lists 12 capability baselines", () => {
      const baselines = opsMaturity.listOpsMaturityCapabilityBaselines();
      assert.equal(baselines.length, 12);
    });

    test("resolves workflow-debugger baseline", () => {
      const baseline = opsMaturity.resolveOpsMaturityCapabilityBaseline("workflow-debugger");
      assert.equal(baseline.capabilityId, "workflow-debugger");
      assert.ok(baseline.architectureSections.includes("§65"));
    });

    test("throws for unknown capability id", () => {
      assert.throws(
        () => opsMaturity.resolveOpsMaturityCapabilityBaseline("unknown" as any),
        /ops_maturity_capability\.not_found/,
      );
    });
  });

  describe("Bootstrap builds correctly", () => {
    test("builds bootstrap with all capabilities", () => {
      const bootstrap = opsMaturity.buildOpsMaturityBootstrap();
      assert.equal(bootstrap.capabilityGroupId, "ops-maturity");
      assert.equal(bootstrap.catalog.length, 12);
    });

    test("bootstrap has correct service ids", () => {
      const bootstrap = opsMaturity.buildOpsMaturityBootstrap();
      assert.ok(bootstrap.registeredServiceIds.includes("w4.ops-maturity.catalog"));
      assert.ok(bootstrap.registeredServiceIds.includes("w4.ops-maturity.bootstrap"));
    });
  });
});