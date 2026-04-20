import assert from "node:assert/strict";
import test from "node:test";

import * as domains from "../../../../src/domains/index.js";
import * as interaction from "../../../../src/interaction/index.js";
import * as orgGovernance from "../../../../src/org-governance/index.js";
import * as scaleEcosystem from "../../../../src/scale-ecosystem/index.js";
import * as opsMaturity from "../../../../src/ops-maturity/index.js";
import { DomainRegistryService } from "../../../../src/domains/registry/domain-registry-service.js";
import { DomainTaskDesignService } from "../../../../src/domains/domain-task-design-service.js";
import { DomainOnboardingService } from "../../../../src/domains/operations/domain-onboarding-service.js";
import { ApprovalRoutingService } from "../../../../src/org-governance/approval-routing/approval-routing-service.js";
import { RuntimeGovernanceService } from "../../../../src/scale-ecosystem/runtime-governance-service.js";
import { FeedbackImprovementService } from "../../../../src/scale-ecosystem/feedback-loop/feedback-improvement-service.js";
import { ConnectorFrameworkService } from "../../../../src/scale-ecosystem/integration/connector-framework-service.js";
import { PlatformPanicService } from "../../../../src/ops-maturity/emergency/platform-panic-service.js";
import { ExplanationPipelineService } from "../../../../src/ops-maturity/explainability/explanation-pipeline-service.js";
import { PlatformOpsAgentService } from "../../../../src/ops-maturity/platform-ops-agent/platform-ops-agent-service.js";
import { ComplianceReportPipelineService } from "../../../../src/ops-maturity/compliance-reporter/compliance-report-pipeline-service.js";
import { EdgeRuntimeSyncService } from "../../../../src/ops-maturity/edge-runtime/edge-runtime-sync-service.js";
import { WorkflowDebuggerService } from "../../../../src/ops-maturity/workflow-debugger/workflow-debugger-service.js";
import { AgentLifecycleService } from "../../../../src/ops-maturity/agent-lifecycle/agent-lifecycle-service.js";
import { CapacityPlanningService } from "../../../../src/ops-maturity/capacity-planner/capacity-planning-service.js";
import { CostOptimizationService } from "../../../../src/ops-maturity/cost-optimizer/cost-optimization-service.js";
import { MultimodalGatewayService } from "../../../../src/ops-maturity/multimodal/multimodal-gateway-service.js";
import { AutonomyGovernanceService } from "../../../../src/interaction/autonomy/autonomy-governance-service.js";
import { WorkflowBuilderService } from "../../../../src/interaction/ux/workflow-builder-service.js";
import type { OrgNode } from "../../../../src/org-governance/org-model/org-node/index.js";

test("contract: v2.7 extension barrels export canonical entrypoints", () => {
  assert.equal(typeof domains.computeDomainRiskLevel, "function");
  assert.equal(typeof domains.DomainTaskDesignService, "function");
  assert.equal(typeof interaction.parseIntentTokens, "function");
  assert.equal(typeof interaction.AutonomyGovernanceService, "function");
  assert.equal(typeof interaction.WorkflowBuilderService, "function");
  assert.equal(typeof orgGovernance.resolveApprovalRoute, "function");
  assert.equal(typeof scaleEcosystem.detectSlaBreach, "function");
  assert.equal(typeof scaleEcosystem.FeedbackImprovementService, "function");
  assert.equal(typeof scaleEcosystem.ConnectorFrameworkService, "function");
  assert.equal(typeof opsMaturity.renderStageExplanation, "function");
  assert.equal(typeof opsMaturity.PlatformPanicService, "function");
  assert.equal(typeof opsMaturity.ExplanationPipelineService, "function");
  assert.equal(typeof opsMaturity.PlatformOpsAgentService, "function");
  assert.equal(typeof opsMaturity.ComplianceReportPipelineService, "function");
  assert.equal(typeof opsMaturity.EdgeRuntimeSyncService, "function");
  assert.equal(typeof opsMaturity.WorkflowDebuggerService, "function");
  assert.equal(typeof opsMaturity.AgentLifecycleService, "function");
  assert.equal(typeof opsMaturity.CapacityPlanningService, "function");
  assert.equal(typeof opsMaturity.CostOptimizationService, "function");
  assert.equal(typeof opsMaturity.MultimodalGatewayService, "function");
});

test("contract: DomainOnboardingService enforces ordered evidence-backed activation flow", () => {
  const registry = new DomainRegistryService();
  registry.register({
    domainId: "ops",
    name: "Ops",
    description: "Operations",
    version: 1,
    workflows: [
      {
        workflowId: "wf_ops",
        name: "Ops Workflow",
        triggerConditions: {},
        steps: [
          {
            stepName: "inspect",
            toolHints: ["read"],
            modelHints: {},
            outputSchema: null,
            retryPolicy: { maxRetries: 0, backoffMs: 0 },
            requiresReview: false,
            timeoutMs: 1000,
            dependsOn: [],
          },
        ],
      },
    ],
    toolBundles: [
      {
        bundleId: "ops-default",
        tools: [{ toolName: "read", enabled: true, configOverrides: {} }],
      },
    ],
    outputContracts: [],
    promptOverrides: {},
    capabilities: {
      supportedTaskTypes: ["inspect"],
      requiredTools: ["read"],
      optionalTools: [],
      modelPreferences: {},
      budgetLimits: { maxTokensPerTask: 1000, maxCostPerTask: 1 },
      securityLevel: "standard",
    },
    status: "testing",
    externalAdapters: [],
    pluginBindings: [],
  });

  const service = new DomainOnboardingService(registry);
  service.start("ops");
  assert.throws(() => service.advance("ops", []), (error) => {
    assert.equal((error as { code?: string }).code, "domain_onboarding.evidence_required");
    return true;
  });
  service.advance("ops", ["artifact:modeling"]);
  service.advance("ops", ["artifact:validation"]);
  service.advance("ops", ["artifact:security"]);
  const finalSession = service.advance("ops", ["artifact:canary"]);
  assert.equal(finalSession.completed, true);
  assert.equal(registry.get("ops")?.status, "active");
});

test("contract: DomainTaskDesignService preserves review and interaction constraints", () => {
  const service = new DomainTaskDesignService({
    recipes: [
      {
        recipeId: "recipe_release",
        domainId: "coding",
        triggerPhrases: ["release"],
        defaultWorkflowId: "wf_release",
        defaultToolBundleIds: ["repo_tools"],
      },
    ],
    promptLibrary: {
      libraryId: "prompt_lib_coding",
      domainId: "coding",
      prompts: [
        {
          promptId: "prompt_release",
          stage: "execute",
          version: "1.0",
          template: "Release safely",
          guardrails: ["approval_required"],
        },
      ],
    },
    riskProfile: {
      profileId: "risk_coding",
      domainId: "coding",
      defaultRiskLevel: "low",
      dimensions: [],
    },
    evalFramework: {
      frameworkId: "eval_coding",
      domainId: "coding",
      evaluators: [
        { evaluatorId: "tests_pass", metric: "tests_pass", threshold: 0.95, blocking: true },
      ],
      onlineMetrics: [],
    },
    knowledgeSchema: {
      schemaId: "knowledge_coding",
      domainId: "coding",
      namespaceIds: ["repo"],
      freshnessWindowHours: 24,
      conflictResolution: "trust_priority",
      retentionDays: 30,
    },
    interactionRules: [
      {
        sourceDomainId: "coding",
        targetDomainId: "operations",
        mode: "approval_required",
        maxConcurrentWorkflows: 1,
        compensationRequired: true,
      },
    ],
  });
  const design = service.design({
    domainId: "coding",
    taskType: "release",
    userInput: "prepare release package",
    promptId: "prompt_release",
    riskScore: 88,
    targetDomainId: "operations",
  });
  assert.equal(design.reviewRequired, true);
  assert.equal(design.interactionMode, "approval_required");
});

test("contract: ApprovalRoutingService preserves delegation and escalation constraints", () => {
  const orgNodes: OrgNode[] = [
    {
      orgNodeId: "dept_finance",
      nodeType: "department",
      displayName: "Finance",
      parentOrgNodeId: null,
      ownerUserIds: ["finance_director"],
      active: true,
    },
  ];
  const service = new ApprovalRoutingService({
    orgNodes,
    delegations: [
      {
        delegationId: "delegate_finance",
        approverId: "finance_director",
        delegateApproverId: "finance_backup",
        scopeNodeIds: ["dept_finance"],
        startsAt: "2026-04-20T00:00:00.000Z",
        expiresAt: "2026-04-21T00:00:00.000Z",
        active: true,
      },
    ],
    escalationRules: [
      {
        ruleId: "escalate_high_risk",
        triggerAfterMinutes: 15,
        escalateToApproverId: "cfo",
        appliesToRiskLevels: ["high", "critical"],
      },
    ],
  });

  const result = service.route({
    requesterId: "user_finance",
    orgNodeId: "dept_finance",
    riskLevel: "critical",
    amountUsd: 5000,
  }, "2026-04-20T00:00:00.000Z", "2026-04-20T00:30:00.000Z");

  assert.deepEqual(result.approverChain, ["finance_backup", "cfo"]);
  assert.equal(result.delegated, true);
  assert.equal(result.escalatedTo, "cfo");
});

test("contract: RuntimeGovernanceService surfaces quota, SLA, and failover state together", () => {
  const service = new RuntimeGovernanceService();
  const result = service.evaluate({
    capability: "sync",
    connectors: [
      { connectorId: "crm_sync", provider: "crm", capabilities: ["sync"], lifecycleState: "enabled" },
    ],
    connectorHealthReports: [
      { connectorId: "crm_sync", status: "healthy", latencyMs: 100, checkedAt: "2026-04-20T00:00:00.000Z" },
    ],
    regions: [
      { regionId: "eu-central-1", jurisdiction: "EU", latencyScore: 20, residencyAllowed: true },
      { regionId: "eu-west-1", jurisdiction: "EU", latencyScore: 40, residencyAllowed: true },
    ],
    primaryRegionHealthy: false,
    quotaPolicy: { scopeId: "tenant_x", hardLimit: 5, currentUsage: 5 },
    requestedUnits: 1,
    queueItems: [{ itemId: "job_sync", tenantId: "tenant_x", priority: 1, ageMs: 1000 }],
    preemptionCandidates: [{ executionId: "exec_sync", priority: 1, progressPercent: 10 }],
    tiers: [{ tierId: "enterprise", displayName: "Enterprise", priority: 3, reservedCapacityPercent: 50 }],
    reservedCapacityPlan: [{ tierId: "enterprise", reservedPercent: 50 }],
    totalCapacityUnits: 20,
    observation: { latencyMs: 900, successRate: 0.95, queueWaitMs: 2000 },
    commitment: { maxLatencyMs: 300, minSuccessRate: 0.99, maxQueueWaitMs: 1000 },
  });

  assert.equal(result.connectorId, "crm_sync");
  assert.equal(result.regionId, "eu-central-1");
  assert.equal(result.failoverRegionId, "eu-west-1");
  assert.equal(result.quotaAllowed, false);
  assert.deepEqual(result.breaches, ["sla.latency_breach", "sla.success_rate_breach", "sla.queue_wait_breach"]);
});

test("contract: AutonomyGovernanceService cannot over-promote weak capabilities", () => {
  const service = new AutonomyGovernanceService();
  const decision = service.evaluateCapability("agent_a", {
    capabilityId: "cleanup",
    currentAutonomy: "full_auto",
    trustScore: 0,
    totalExecutions: 20,
    successfulExecutions: 10,
    failedExecutions: 5,
    humanOverrides: 8,
    incidents: 1,
    lastIncidentAgeDays: 1,
  });
  assert.equal(decision.recommendedLevel, "suggestion");
});

test("contract: WorkflowBuilderService must block wizard advance when current step incomplete", () => {
  const service = new WorkflowBuilderService();
  const result = service.build({
    session: {
      sessionId: "wizard_1",
      currentStepId: "capability_setup",
      steps: [
        { stepId: "business_type", title: "Business", completed: true },
        { stepId: "capability_setup", title: "Capability", completed: false },
      ],
    },
    template: {
      templateId: "tpl_release",
      title: "Release Template",
      steps: ["select trigger", "deploy"],
    },
    onboardingWizard: {
      steps: [
        { stepId: "business_type", title: "Business", description: "desc" },
        { stepId: "capability_setup", title: "Capability", description: "desc" },
        { stepId: "risk_setup", title: "Risk", description: "desc" },
        { stepId: "activation", title: "Activation", description: "desc" },
      ],
      recommendedDomains: ["coding"],
      defaultMode: {
        mode: "team",
        autoDetected: true,
        features: {
          multiTenancy: false,
          approvalEngine: "simple",
          securityReview: "auto_plus_manual",
          onboarding: "guided_1week",
          dashboardLevels: ["L1", "L2"],
          governance: "delegated",
        },
        upgradePath: "grow",
      },
    },
    components: [
      {
        componentId: "trigger_release",
        name: "Release Trigger",
        icon: "rocket",
        domainId: "coding",
        riskLevel: "medium",
        configSchema: {},
        previewDescription: "select trigger",
      },
    ],
  });
  assert.equal(result.nextStepAllowed, false);
  assert.equal(result.builder.validation.valid, false);
});

test("contract: feedback candidates without source signals cannot enter release chain", () => {
  const service = new FeedbackImprovementService();
  assert.throws(() => {
    service.createCandidate({
      learningSignalId: "learning_1",
      taskId: "task_1",
      sourceFeedbackId: "feedback_1",
      learningType: "failure_pattern",
      confidence: 0.8,
      valueSummary: "missing provenance",
      evidenceRefs: [],
      sourceSignalIds: [],
      relatedSignalIds: [],
      evidence: {},
      generatedAt: 1,
    });
  }, /feedback_improvement\.missing_source_signal/);
});

test("contract: unverified connectors cannot receive production events", () => {
  const service = new ConnectorFrameworkService();
  service.register({
    connectorId: "crm_sync",
    provider: "crm",
    capabilities: ["sync"],
    authMode: "oauth2",
    rateLimits: { perMinute: 60 },
    supportedEvents: ["crm.contact.updated"],
    lifecycleState: "configured",
  });
  assert.throws(() => {
    service.bind("crm_sync", "tenant_1", "prod");
  }, /connector_framework\.prod_requires_verified/);
});

test("contract: PlatformPanicService blocks execution until explicit resume", () => {
  const service = new PlatformPanicService();
  service.activate({
    scope: "platform/runtime",
    reasonCode: "security.compromise",
    activeIncidents: 1,
    issuedBy: "security_lead",
    issuedAt: "2026-04-20T00:00:00.000Z",
  });

  assert.equal(service.evaluateExecution({
    scope: "platform/runtime",
    mode: "automation",
  }).blocked, true);
  assert.equal(service.evaluateExecution({
    scope: "platform/runtime",
    mode: "automation",
  }).blocked, true);

  const receipt = service.resume("platform/runtime", {
    scope: "platform/runtime",
    approvedBy: "sre_manager",
    checkpointsVerified: true,
  }, "2026-04-20T00:05:00.000Z");
  assert.equal(receipt.resumed, true);
  assert.equal(service.evaluateExecution({
    scope: "platform/runtime",
    mode: "automation",
  }).blocked, false);
});

test("contract: ExplanationPipelineService keeps facts stable across depths and redacts unauthorized evidence", () => {
  const service = new ExplanationPipelineService();
  const request = {
    taskId: "task_release_1",
    stage: "approval",
    summary: "release requires manual approval",
    decisionFactors: ["production change", "error budget tight"],
    evidence: [
      { evidenceId: "evt_public_1", category: "trace" },
      { evidenceId: "evt_secret_1", category: "secret" },
    ],
    riskNotes: ["deploy affects production"],
    causalLinks: [
      { source: "observe", target: "approval", rationale: "error budget below threshold" },
    ],
    allowedEvidenceCategories: ["trace"],
    generatedAt: "2026-04-20T00:00:00.000Z",
  };

  const brief = service.generate(request, "brief");
  const audit = service.generate(request, "audit");

  assert.equal(brief.rationale.summary, audit.rationale.summary);
  assert.deepEqual(audit.rationale.evidenceRefs, ["evt_public_1"]);
  assert.deepEqual(audit.redactedEvidenceRefs, ["evt_secret_1"]);
});

test("contract: PlatformOpsAgentService requires approval for high-risk actions and cannot bypass panic", () => {
  const service = new PlatformOpsAgentService({
    agentId: "agent_ops_1",
    specialty: "incident_response",
    allowedActionTypes: ["investigate_incident", "scale_capacity"],
    requiredApprovals: ["sre_manager"],
    maxAutonomyLevel: "supervised_execution",
    evidenceRequirements: ["runbook:incident"],
  });

  const pendingProposal = service.createProposal({
    probes: [{ component: "queue", status: "failed" }],
    errorRate: 0.3,
    backlog: 1200,
    currentLoad: 100,
    projectedLoad: 260,
    observedAt: "2026-04-20T00:00:00.000Z",
  });
  assert.equal(pendingProposal.approvalStatus, "pending");
  assert.equal(pendingProposal.executable, false);

  const approved = service.recordApproval(pendingProposal.proposalId, "sre_manager");
  assert.equal(approved.executable, true);

  const blockedByPanic = service.createProposal({
    probes: [{ component: "queue", status: "failed" }],
    errorRate: 0.3,
    backlog: 1200,
    currentLoad: 100,
    projectedLoad: 260,
    panicActive: true,
    observedAt: "2026-04-20T00:05:00.000Z",
  });
  assert.ok(blockedByPanic.blockedBy.includes("ops_agent.blocked_by_panic"));
  assert.equal(blockedByPanic.executable, false);
});

test("contract: ComplianceReportPipelineService cannot mark missing-evidence reports as complete", () => {
  const service = new ComplianceReportPipelineService([
    {
      templateId: "soc2_monthly",
      framework: "SOC2",
      reportType: "monthly",
      requiredEvidenceTypes: ["audit_log", "control_test"],
      renderSchema: ["Template", "Evidence Coverage", "Completeness"],
      version: "2.0",
    },
  ]);

  const artifact = service.generate({
    templateId: "soc2_monthly",
    evidence: [{ evidenceId: "audit_1", evidenceType: "audit_log" }],
    requestedBy: "auditor_1",
    generatedAt: "2026-04-20T00:00:00.000Z",
  });
  assert.equal(artifact.status, "partial");
  assert.deepEqual(artifact.missingEvidenceTypes, ["control_test"]);
});

test("contract: EdgeRuntimeSyncService blocks restricted uploads when sync policy forbids them", () => {
  const service = new EdgeRuntimeSyncService();
  const profile = {
    edgeNodeId: "edge_store_1",
    capabilities: ["text", "sync"],
    connectivityMode: "offline" as const,
    maxLocalRetentionHours: 12,
    allowedModels: ["local-text"],
    syncPolicy: {
      allowRestrictedDataUpload: false,
      requireOrdering: true,
    },
  };
  const execution = service.executeOffline(
    profile,
    [{ modelId: "local-text", modalities: ["text"] }],
    {
      edgeNodeId: "edge_store_1",
      taskId: "task_inventory_1",
      modality: "text",
      createdAt: "2026-04-20T00:00:00.000Z",
    },
  );
  const restrictedEnvelope = service.buildSyncEnvelope(
    profile,
    execution.record,
    "digest:restricted",
    3,
    "restricted",
    "2026-04-20T00:06:00.000Z",
  );
  const receipt = service.sync(profile, [restrictedEnvelope], {});
  assert.deepEqual(receipt.rejectedEnvelopeIds, [restrictedEnvelope.envelopeId]);
  assert.equal(receipt.decisions[0]?.resolution, "reject");
});

test("contract: WorkflowDebuggerService forbids unauthorized production breakpoints", () => {
  const service = new WorkflowDebuggerService();
  assert.throws(() => {
    service.registerBreakpoint(
      {
        actorId: "viewer_1",
        canDebugProduction: false,
      },
      "prod",
      {
        breakpointId: "bp_prod_1",
        workflowId: "wf_release",
        stepSelector: "deploy",
        condition: "always",
        action: "pause",
      },
    );
  }, /workflow_debugger\.prod_breakpoint_forbidden/);
});

test("contract: retired agents cannot be bound to new tasks", () => {
  const service = new AgentLifecycleService();
  service.registerAgent({
    agentId: "agent_ops_1",
    displayName: "Ops Agent",
    domainId: "ops",
    capabilities: ["triage"],
    owner: "ops_lead",
    lifecycleState: "validated",
    currentVersionId: "v1",
  });
  service.addVersion({
    versionId: "v1",
    agentId: "agent_ops_1",
    promptRefs: ["prompt:v1"],
    toolBundleRefs: ["tools:v1"],
    policyRefs: ["policy:v1"],
    modelProfileRefs: ["model:v1"],
    createdAt: "2026-04-20T00:00:00.000Z",
    stable: true,
  });
  service.retire({
    agentId: "agent_ops_1",
    successorAgentId: null,
    revokeAt: "2026-04-20T01:00:00.000Z",
  }, "2026-04-20T01:00:00.000Z");

  assert.throws(() => {
    service.bindTask("agent_ops_1", "task_ops_1");
  }, /agent_lifecycle\.binding_forbidden_retired/);
});

test("contract: forecasts without a training window cannot enter the decision chain", () => {
  const service = new CapacityPlanningService();
  assert.throws(() => {
    service.forecast("workers", 2, {
      start: "2026-04-20T00:00:00.000Z",
      end: "2026-04-20T01:00:00.000Z",
    });
  }, /capacity_planning\.empty_window/);
});

test("contract: unsourced cost records cannot enter optimization recommendations", () => {
  const service = new CostOptimizationService();
  assert.throws(() => {
    service.recordCost({
      subjectType: "task",
      subjectId: "task_a",
      costType: "model",
      amountUsd: 5,
      decisionRef: "",
      capturedAt: "2026-04-20T00:00:00.000Z",
    });
  }, /cost_optimizer\.unsourced_record/);
  assert.equal(service.buildDashboardSlice().recommendations.length, 0);
});

test("contract: illegal modality types cannot silently downgrade to text execution", () => {
  const service = new MultimodalGatewayService();
  assert.throws(() => {
    service.handle({
      requestId: "mm_req_bad",
      modalities: ["text"],
      inputParts: [{ partId: "part_bad", type: "video", contentRef: "vid://1" }],
      requestedOutputs: ["summary"],
      safetyPolicyRef: "policy_mm_safe",
      costBudget: { maxUsd: 1 },
    });
  }, /multimodal_gateway\.unsupported_modality/);
});
