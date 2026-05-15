import assert from "node:assert/strict";
import test from "node:test";

import { HitlInboxService } from "../../../src/platform/five-plane-orchestration/hitl/hitl-inbox-service.js";
import { PlatformWorkbenchSnapshotService } from "../../../src/interaction/ux/platform-workbench-snapshot-service.js";
import { SdkWorkbenchService } from "../../../src/sdk/workbench/index.js";
import { BenchmarkInventoryService } from "../../../src/platform/shared/stability/benchmark-inventory-service.js";
import { ProjectionInventoryService } from "../../../src/platform/five-plane-state-evidence/events/projection-inventory-service.js";
import { DeploymentInventoryService } from "../../../src/platform/shared/stability/deployment-inventory-service.js";
import { JudgeProviderRegistryService } from "../../../src/platform/prompt-engine/eval/judge-provider-registry-service.js";
import { ComplianceProgramTemplateService } from "../../../src/platform/compliance/compliance-program-template-service.js";

test("integration: platform workbench snapshot aggregates HITL, SDK, and inventory surfaces", () => {
  const hitlInbox = new HitlInboxService().buildInbox([
    {
      approvalId: "approval-1",
      taskId: "task-1",
      executionId: "exec-1",
      mode: "single_approval",
      title: "Approve canary rollout",
      reason: "Canary stage requires operator approval",
      riskLevel: "high",
      options: [{ optionId: "approve", label: "Approve", style: "primary", requiresConfirm: false }],
      recommendedOptionId: "approve",
      deadlineAt: "2026-04-22T10:15:00.000Z",
      timeoutPolicy: "remain_pending",
      explanation: {
        explanationId: "expl-1",
        taskId: "task-1",
        executionId: "exec-1",
        takeoverSessionId: null,
        decisionType: "approval_required",
        summary: "Pending rollout gate",
        factors: [
          { name: "policy", weight: 0.8, value: "prompt_release_contract", reason: "Release gate requires manual review" },
        ],
        recommendations: ["approve"],
        confidenceScore: 0.88,
        generatedAt: "2026-04-22T10:00:00.000Z",
        contextSnapshot: { tenantId: "tenant-1" },
      },
      feedbackLink: {
        approvalId: "approval-1",
        taskId: "task-1",
        stageRef: "release",
        loopIteration: 2,
        refId: "rollout-1",
        feedbackSignalId: null,
        decisionEffect: "continue",
      },
    },
  ], [], "2026-04-22T10:05:00.000Z");

  const sdkSnapshot = new SdkWorkbenchService().buildSnapshot({
    client: {
      baseUrl: "https://api.example.com",
      apiVersion: "v1",
      tenantId: "tenant-1",
    },
    plugins: [
      {
        pluginId: "ops-plugin",
        name: "Ops Plugin",
        version: "1.0.0",
        owner: "ops@example.com",
        publicSdkSurface: "1.0.0",
        spiTypes: ["adapter"],
        capabilityIds: ["deploy"],
        sandbox: { timeoutMs: 30000, runtimeIsolation: "shared_process", allowFilesystemWrite: false },
        trustLevel: "trusted",
        domainIds: ["ops"],
        extensionKind: "domain_plugin",
        settingsSchema: {},
      } as any,
    ],
    packs: [
      {
        packId: "ops-pack",
        version: "1.0.0",
        domain: "ops",
        owner: "ops@example.com",
        capabilities: [
          { capabilityKey: "deploy", maturity: "ga", requiredContracts: ["runtime_execution_contract"] },
        ],
      },
    ],
    availableContracts: ["runtime_execution_contract"],
  });

  const judgeRegistry = new JudgeProviderRegistryService();
  judgeRegistry.registerDefaults();
  const workbench = new PlatformWorkbenchSnapshotService().buildSnapshot({
    generatedAt: "2026-04-22T10:05:00.000Z",
    onboarding: {
      sessionId: "session-1",
      userRole: "operator",
      currentStep: "review_workbench",
      completedSteps: ["welcome", "connect_workspace"],
      recommendedTemplates: ["ops-template"],
    },
    dashboard: {
      attentionQueue: [
        {
          itemType: "approval_needed",
          priority: "high",
          title: "Approval pending",
          description: "Review rollout gate",
          actionOptions: ["open_approvals"],
          createdAt: "2026-04-22T10:00:00.000Z",
          domainId: "ops",
        },
      ],
      dailySummary: {
        tasksCompleted: 3,
        tasksInProgress: 1,
        tasksFailed: 0,
        totalCostToday: "$4.20",
        agentUptimePercent: 99,
        highlights: ["3 tasks completed"],
        concerns: [],
      },
      agentHealthCards: [],
      costBurn: { consumedUsd: 4.2, forecastUsd: 5.1 },
      activeGoals: [],
      recentCompletions: [],
      proactiveSuggestions: [],
    },
    hitlInbox,
    approvalQueue: [
      {
        approvalId: "approval-1",
        taskId: "task-1",
        riskLevel: "high",
        title: "Approve canary rollout",
        status: "requested",
      },
    ],
    sdkShortcuts: sdkSnapshot.workbenchShortcuts,
    inventorySummary: {
      benchmarkCount: new BenchmarkInventoryService().listBenchmarks().length,
      projectionCount: new ProjectionInventoryService().listProjectionInventory().length,
      deploymentCount: new DeploymentInventoryService().listDeployments().length,
      judgeCount: judgeRegistry.listDescriptors().length,
      complianceProgramCount: new ComplianceProgramTemplateService().listTemplates().length,
    },
  });

  assert.equal(workbench.hitlInbox.length, 1);
  assert.equal(workbench.sdkShortcuts.length, 4);
  assert.equal(workbench.inventorySummary.benchmarkCount, 6);
  assert.equal(workbench.inventorySummary.judgeCount, 3);
  assert.equal(workbench.operatorActions[0]?.route, "/console/approvals");
});
