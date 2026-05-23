import assert from "node:assert/strict";
import test from "node:test";

import * as domains from "../../../../src/domains/index.js";
import * as interaction from "../../../../src/interaction/index.js";
import * as orgGovernance from "../../../../src/org-governance/index.js";
import * as scaleEcosystem from "../../../../src/scale-ecosystem/index.js";
import * as opsMaturity from "../../../../src/ops-maturity/index.js";
import { DomainRegistryService } from "../../../../src/domains/registry/domain-registry-service.js";
import { DomainDescriptorOrchestrationService } from "../../../../src/domains/domain-descriptor-orchestration-service.js";
import type { DomainEvalFramework } from "../../../../src/domains/eval-framework/index.js";
import { DomainEvaluationGateService } from "../../../../src/domains/eval-framework/domain-evaluation-gate-service.js";
import type { DomainPromptLibrary } from "../../../../src/domains/prompt-library/index.js";
import { DomainPromptGovernanceService } from "../../../../src/domains/prompt-library/domain-prompt-governance-service.js";
import { DomainTaskDesignService } from "../../../../src/domains/domain-task-design-service.js";
import { DomainOnboardingService } from "../../../../src/domains/operations/domain-onboarding-service.js";
import { ApprovalRoutingService } from "../../../../src/org-governance/approval-routing/approval-routing-service.js";
import { ComplianceGovernanceService } from "../../../../src/org-governance/compliance-engine/compliance-governance-service.js";
import { DelegatedGovernanceService } from "../../../../src/org-governance/delegated-governance/delegated-governance-service.js";
import { KnowledgeBoundaryService } from "../../../../src/org-governance/knowledge-boundary/knowledge-boundary-service.js";
import { IdentitySyncService } from "../../../../src/org-governance/sso-scim/identity-sync-service.js";
import { RuntimeGovernanceService } from "../../../../src/scale-ecosystem/runtime-governance-service.js";
import { CrossRegionRoutingService } from "../../../../src/scale-ecosystem/multi-region/cross-region-routing-service.js";
import { FeedbackImprovementService } from "../../../../src/scale-ecosystem/feedback-loop/feedback-improvement-service.js";
import { ConnectorFrameworkService } from "../../../../src/scale-ecosystem/integration/connector-framework-service.js";
import { FairSchedulingService } from "../../../../src/scale-ecosystem/resource-manager/fair-scheduling-service.js";
import { SlaOperationsService } from "../../../../src/scale-ecosystem/sla-engine/sla-operations-service.js";
import { PlatformPanicService } from "../../../../src/ops-maturity/emergency/platform-panic-service.js";
import { ExplanationPipelineService } from "../../../../src/ops-maturity/explainability/explanation-pipeline-service.js";
import { PlatformOpsAgentService } from "../../../../src/ops-maturity/platform-ops-agent/platform-ops-agent-service.js";
import { ComplianceReportPipelineService } from "../../../../src/ops-maturity/compliance-reporter/compliance-report-pipeline-service.js";
import { EdgeRuntimeSyncService, type EdgeRuntimeProfile } from "../../../../src/ops-maturity/edge-runtime/edge-runtime-sync-service.js";
import { WorkflowDebuggerService } from "../../../../src/ops-maturity/workflow-debugger/workflow-debugger-service.js";
import { AgentLifecycleService } from "../../../../src/ops-maturity/agent-lifecycle/agent-lifecycle-service.js";
import { CapacityPlanningService } from "../../../../src/ops-maturity/capacity-planner/capacity-planning-service.js";
import { CostOptimizationService } from "../../../../src/ops-maturity/cost-optimizer/cost-optimization-service.js";
import { MultimodalGatewayService } from "../../../../src/ops-maturity/multimodal/multimodal-gateway-service.js";
import { AutonomyGovernanceService } from "../../../../src/interaction/autonomy/autonomy-governance-service.js";
import { UserExperienceOrchestrationService } from "../../../../src/interaction/ux/user-experience-orchestration-service.js";
import { WorkflowBuilderService } from "../../../../src/interaction/ux/workflow-builder-service.js";
import type { OrgNode } from "../../../../src/org-governance/org-model/org-node/index.js";

test("contract: v2.7 extension barrels export canonical entrypoints", () => {
  assert.equal(typeof domains.computeDomainRiskLevel, "function");
  assert.equal(typeof domains.DomainDescriptorOrchestrationService, "function");
  assert.equal(typeof domains.DomainEvaluationGateService, "function");
  assert.equal(typeof domains.DomainPromptGovernanceService, "function");
  assert.equal(typeof domains.DomainTaskDesignService, "function");
  assert.equal(typeof interaction.parseIntentTokensWithModel, "function");
  assert.equal(typeof interaction.AutonomyGovernanceService, "function");
  assert.equal(typeof interaction.UserExperienceOrchestrationService, "function");
  assert.equal(typeof interaction.WorkflowBuilderService, "function");
  assert.equal(typeof orgGovernance.resolveApprovalRoute, "function");
  assert.equal(typeof orgGovernance.ComplianceGovernanceService, "function");
  assert.equal(typeof orgGovernance.DelegatedGovernanceService, "function");
  assert.equal(typeof orgGovernance.KnowledgeBoundaryService, "function");
  assert.equal(typeof orgGovernance.IdentitySyncService, "function");
  assert.equal(typeof scaleEcosystem.detectSlaBreach, "function");
  assert.equal(typeof scaleEcosystem.multiRegion.CrossRegionRoutingService, "function");
  assert.equal(typeof scaleEcosystem.FeedbackImprovementService, "function");
  assert.equal(typeof scaleEcosystem.FairSchedulingService, "function");
  assert.equal(typeof scaleEcosystem.ConnectorFrameworkService, "function");
  assert.equal(typeof scaleEcosystem.SlaOperationsService, "function");
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
    status: "validated",
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
        archetype: "research" as const,
        triggerPhrases: ["release"],
        defaultWorkflowId: "wf_release",
        defaultToolBundleIds: ["repo_tools"],
        riskProfileRef: "coding.risk",
        guardrailOverlay: {},
        recommendedWorkflowIds: ["wf_release"],
        defaultPromptBundleRef: "coding.default-prompt",
        acceptanceChecklistRef: "coding.acceptance",
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
      fewShotExamples: [],
      evaluators: [
        { evaluatorId: "tests_pass", metric: "tests_pass", threshold: 0.95, blocking: true },
      ],
      onlineMetrics: [],
      releaseGates: { minFewShotCount: 5, minRegressionCaseCount: 20, requirePromptInjectionCoverage: true },
    },
    knowledgeSchema: {
      schemaId: "knowledge_coding",
      domainId: "coding",
      namespaceIds: ["repo"],
      freshnessWindowHours: 24,
      conflictResolution: "trust_priority",
      retentionDays: 30,
      knowledgeSources: [],
      retrievalStrategy: { strategy: "hybrid", maxResults: 10, minRelevanceScore: 0.7, rerankEnabled: true },
      freshnessPolicy: { maxStalenessHours: 24, refreshTrigger: "scheduled", backgroundRefreshEnabled: true },
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

test("contract: prompt rollout cannot activate without lint/eval evidence and approval ticket for guarded prompt", () => {
  const service = new DomainPromptGovernanceService();
  const library: DomainPromptLibrary = {
    libraryId: "prompt_release",
    domainId: "coding",
    prompts: [
      {
        promptId: "release_prompt",
        stage: "release",
        version: "2.0.0",
        template: "Release with checks",
        guardrails: ["approval_required"],
      },
      {
        promptId: "release_prompt",
        stage: "release",
        version: "1.9.0",
        template: "Release old",
        guardrails: ["approval_required"],
      },
    ],
  };

  assert.throws(() => {
    service.proposeRelease(library, {
      promptId: "release_prompt",
      owner: "eng_lead",
      rolloutScope: ["tenant:alpha"],
      rolloutMode: "shadow",
      lintEvidence: ["lint:ok"],
      evalEvidence: ["eval:ok"],
    });
  }, /prompt_governance\.approval_ticket_required/);

  const release = service.proposeRelease(library, {
    promptId: "release_prompt",
    owner: "eng_lead",
    rolloutScope: ["tenant:alpha"],
    rolloutMode: "shadow",
    lintEvidence: ["lint:ok"],
    evalEvidence: ["eval:ok"],
    approvalTicketId: "CHG-300",
    rollbackVersion: "1.9.0",
  });
  assert.equal(service.activate(release.releaseId).status, "active");
});

test("contract: blocking regression gate failures must hold prompt promotion", () => {
  const service = new DomainEvaluationGateService();
  const framework: DomainEvalFramework = {
    frameworkId: "eval_release",
    domainId: "coding",
    fewShotExamples: [],
    evaluators: [
      { evaluatorId: "tests_pass", metric: "pass_rate", threshold: 0.95, blocking: true },
      { evaluatorId: "latency", metric: "latency_score", threshold: 0.8, blocking: false },
    ],
    onlineMetrics: ["latency_score"],
    releaseGates: { minFewShotCount: 5, minRegressionCaseCount: 20, requirePromptInjectionCoverage: true },
  };
  const report = service.evaluateSuite(framework, {
    suiteId: "suite_bad",
    domainId: "coding",
    releaseType: "pre_release",
    executionMode: "supervised",
    storageMode: "sqlite",
    cases: [
      { caseId: "case_1", metric: "pass_rate", score: 0.81, expectedClass: "coding" },
      { caseId: "case_2", metric: "latency_score", score: 0.91, expectedClass: "coding" },
    ],
  });

  assert.equal(report.releaseDecision, "hold");
  assert.deepEqual(report.blockingFailures, [
    "tests_pass",
    "domain_eval.min_few_shot_gate",
    "domain_eval.min_regression_case_gate",
  ]);
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
      metadata: {},
      costCenter: "FIN-001",
      effectivePolicies: {},
      status: "active",
    },
  ];
  const service = new ApprovalRoutingService({
    orgNodes,
    delegations: [
      {
        delegationId: "delegate_finance",
        approverId: "finance_director",
        delegateApproverId: "finance_backup",
        delegationType: "manager_cover" as const,
        scopeNodeIds: ["dept_finance"],
        conflictOfInterestApproverIds: [],
        coiReviewStatus: "pending" as const,
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
    requesterManagerIds: [],
    conflictedApproverIds: [],
    evidenceRefs: [],
    policyVersion: "1.0",
    orgVersion: "1.0",
  }, "2026-04-20T00:00:00.000Z", "2026-04-20T00:30:00.000Z");

  assert.deepEqual(result.approverChain, ["finance_backup", "cfo"]);
  assert.equal(result.delegated, true);
  assert.equal(result.escalatedTo, "cfo");
});

test("contract: ComplianceGovernanceService must deny missing required policy keys", () => {
  const service = new ComplianceGovernanceService(
    [
      {
        orgNodeId: "root",
        nodeType: "company",
        displayName: "Root",
        parentOrgNodeId: null,
        ownerUserIds: ["ceo"],
        active: true,
        metadata: {},
        costCenter: "",
        effectivePolicies: {},
        status: "active",
      },
    ],
    {
      root: [{ policyId: "p_root", rules: { approvalRequired: true } }],
    },
  );
  const result = service.evaluate({
    actorId: "ceo",
    orgNodeId: "root",
    action: "finance.export",
    requiredPolicyKeys: ["approvalRequired", "retentionDays"],
    occurredAt: "2026-04-20T00:00:00.000Z",
  });
  assert.equal(result.allowed, false);
  assert.deepEqual(result.missingKeys, ["retentionDays"]);
});

test("contract: DelegatedGovernanceService only grants active scoped delegations", () => {
  const service = new DelegatedGovernanceService([
    {
      delegationId: "del_1",
      grantorId: "director",
      granteeId: "manager",
      level: "admin" as const,
      delegatable: false,
      orgNodeIds: ["dept_finance"],
      domainIds: ["finance"],
      derivedDelegationIds: [],
      permissions: [],
      guardrails: [],
      expiresAt: "2026-04-21T00:00:00.000Z",
      revocable: true,
      status: "active",
    },
  ]);
  const result = service.resolve("manager", {
    orgNodeId: "dept_finance",
    domainId: "finance",
    capability: "approve_budget",
  }, "2026-04-20T00:00:00.000Z");
  assert.equal(result.allowed, true);
});

test("contract: KnowledgeBoundaryService logs and redacts denied access", () => {
  const service = new KnowledgeBoundaryService();
  const result = service.evaluateAccess(
    {
      boundaryId: "kb_finance",
      ownerOrgNodeId: "dept_finance",
      namespaceIds: ["finance_docs"],
      defaultVisibility: "private",
      allowedOrgNodeIds: [],
      auditOnAccess: false,
      fieldAllowlist: [],
      classificationRules: [],
      sharePolicy: { mode: "explicit_grant", allowCrossTenant: false, requireAudit: true, allowOrgNodeIds: [] },
    },
    "user_1",
    "dept_hr",
    "investigate",
    [],
    undefined,
    "2026-04-20T00:00:00.000Z",
  );
  assert.equal(result.allowed, false);
  assert.ok(service.listRedactedLogs("kb_finance")[0]?.requesterId.startsWith("redacted:"));
});

test("contract: IdentitySyncService must drop terminal SCIM subjects from active set", () => {
  const service = new IdentitySyncService();
  const snapshot = service.bootstrap(
    {
      providerId: "oidc_main",
      issuer: "https://id.example.com",
      clientId: "client_1",
      redirectUri: "https://app.example.com/callback",
      scopes: ["openid", "profile"],
    },
    {
      providerId: "saml_main",
      entryPoint: "https://id.example.com/saml",
      issuer: "app.example.com",
      certificateFingerprint: "sha256:abc",
    },
    [
      {
        eventId: "evt_1",
        action: "user_created",
        subjectId: "user_a",
        occurredAt: "2026-04-20T00:00:00.000Z",
      },
      {
        eventId: "evt_2",
        action: "user_disabled",
        subjectId: "user_a",
        occurredAt: "2026-04-20T00:01:00.000Z",
      },
    ],
  );
  assert.deepEqual(snapshot.activeSubjects, []);
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
      { regionId: "eu-central-1", jurisdiction: "EU", latencyScore: 20, residencyAllowed: true, provider: "aws", endpoints: { api: "https://eu-central-1.api.example.com" }, dataResidencyPolicy: "regional" as const },
      { regionId: "eu-west-1", jurisdiction: "EU", latencyScore: 40, residencyAllowed: true, provider: "aws", endpoints: { api: "https://eu-west-1.api.example.com" }, dataResidencyPolicy: "regional" as const },
    ],
    primaryRegionHealthy: false,
    quotaPolicy: {
      scope: "tenant",
      scopeId: "tenant_x",
      workerUnits: { hardLimit: 0, currentUsage: 0 },
    },
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
      schemaVersion: 1,
      steps: [
        { stepId: "business_type", title: "Business", completed: true, riskLevel: "low" as const, requiredAnswerKeys: [], riskHints: [] },
        { stepId: "capability_setup", title: "Capability", completed: false, riskLevel: "low" as const, requiredAnswerKeys: [], riskHints: [] },
      ],
      history: [],
      answers: {},
      visitedStepIds: [],
    },
    template: {
      templateId: "tpl_release",
      title: "Release Template",
      steps: ["select trigger", "deploy"],
      requiredCapabilities: [],
      parameters: [
        { name: "param1", label: "Param 1", type: "string" as const, required: false, options: [] },
      ],
      catalogTags: [],
    },
    onboardingWizard: {
      steps: [
        { stepId: "business_type", title: "Business", description: "desc" },
        { stepId: "capability_setup", title: "Capability", description: "desc" },
        { stepId: "risk_setup", title: "Risk", description: "desc" },
        { stepId: "activation", title: "Activation", description: "desc" },
      ],
      recommendedDomains: ["coding"],
      progressiveDisclosure: {
        level: "minimal" as const,
        visibleSections: ["business_type", "capability_setup"],
        hiddenSections: ["risk_setup", "activation"],
      },
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
    requiredApprovers: ["security_lead", "sre_manager"],
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
    planId: "resume_plan_1",
    scope: "platform/runtime",
    scopeRef: "platform/runtime/ref",
    approvedBy: ["sre_manager", "security_lead"],
    approvalCount: 2,
    approvedRoles: ["platform_admin", "security_team"],
    compatibilityCheckRef: "compat_check_1",
    mode: "standard",
    checkpointsVerified: true,
    forensicSnapshotReviewed: true,
    rollbackPlanReady: true,
    validationRunPassed: true,
    createdAt: "2026-04-20T00:05:00.000Z",
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

  const brief = service.generate(request, "L1");
  const audit = service.generate(request, "L3", { forensicBudgetReservationId: "budget_1" });

  assert.equal(brief.rationale.summary, audit.rationale.summary);
  assert.deepEqual(audit.rationale.evidenceRefs, ["evt_public_1"]);
  assert.deepEqual(audit.redactedEvidenceRefs, ["evt_secret_1"]);
});

test("contract: PlatformOpsAgentService requires approval for high-risk actions and cannot bypass panic", () => {
  const service = new PlatformOpsAgentService({
    agentId: "agent_ops_1",
    specialty: "incident_response",
    allowedActionTypes: ["investigate_incident", "scale_capacity", "restart_service", "failover"],
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
  const profile: EdgeRuntimeProfile = {
    edgeNodeId: "edge_store_1",
    deviceId: "device_edge_store_1",
    offlineMaxDuration: 31536000000,
    keyLease: "lease_key_1",
    capabilities: ["text", "sync"],
    connectivityMode: "offline" as const,
    maxLocalRetentionHours: 12,
    allowedModels: ["local-text"],
    syncPolicy: {
      allowRestrictedDataUpload: false,
      requireOrdering: true,
    },
    deviceAttestation: { status: "valid" as const, attestedAt: "2026-04-20T00:00:00.000Z" },
    certificateStatus: "valid" as const,
    riskLevel: "low" as const,
  };
  const execution = service.executeOffline(
    profile,
    [{ modelId: "local-text", modalities: ["text"] }],
    {
      edgeNodeId: "edge_store_1",
      taskId: "task_inventory_1",
      modality: "text",
      createdAt: "2026-04-20T00:00:00.000Z",
      riskScore: 0.2,
      taskType: "summarize",
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
        allowedRuntime: "non_prod" as const,
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
    name: "Ops Agent",
    domainId: "ops",
    owner: { path: "ops_lead", orgNodeId: "ops" },
    components: {
      pack: { packId: "ops-pack", version: "1.0.0" },
      connectorBindings: [],
      promptBundle: { bundleId: "ops-prompts", version: "1.0.0" },
      modelBinding: { provider: "openai", model: "gpt-4", fallbackChain: [] },
      trustProfile: { initialLevel: "supervised_auto", scoringConfig: { successWeight: 0.4, latencyWeight: 0.3, errorWeight: 0.3 } },
      triggerSet: [],
      autonomyConfig: { maxAutomationLevel: "supervised_auto", requireHumanApprovalForHighRisk: true, maxRetriesBeforeApproval: 3 },
    },
    lifecycleState: "testing",
    currentVersionId: "v1",
    createdAt: "2026-04-20T00:00:00.000Z",
    updatedAt: "2026-04-20T00:00:00.000Z",
  });
  service.addVersion({
    versionId: "v1",
    agentId: "agent_ops_1",
    createdAt: "2026-04-20T00:00:00.000Z",
    semver: "1.0.0",
    componentSnapshot: {
      packVersion: "1.0.0",
      promptBundleVersion: "1.0.0",
      modelBindingHash: "hash1",
      trustProfileHash: "hash1",
      triggerSetHash: "hash1",
      autonomyConfigHash: "hash1",
    },
    createdBy: "ops_lead",
    releaseNote: "v1 release",
  });
  service.retire({
    agentId: "agent_ops_1",
    reason: "superseded",
    successorAgentId: null,
    transferItems: ["triggers", "subscriptions", "scheduled_tasks", "ownership"],
    gracePeriodDays: 30,
    notificationTargets: ["ops_lead"],
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
      llmCostUsd: 0,
      toolCostUsd: 0,
      computeCostUsd: 0,
      storageCostUsd: 0,
      egressCostUsd: 0,
      humanReviewCostUsd: 0,
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
  }, /multimodal_gateway\.modality_not_declared:video/);
});

test("contract: domain descriptors without workflow/tool/prompt/eval anchors remain non-ready", () => {
  const service = new DomainDescriptorOrchestrationService();
  const review = service.review({
    domainId: "finance",
    displayName: "Finance",
    description: "Finance operations",
    ownerOrgNodeId: "org_finance",
    lifecycleState: "draft",
    version: 1,
    riskProfile: {
      profileId: "risk_finance",
      domainId: "finance",
      defaultRiskLevel: "medium",
      dimensions: [],
    },
    knowledgeSchema: {
      schemaId: "knowledge_finance",
      domainId: "finance",
      namespaceIds: [],
      freshnessWindowHours: 24,
      conflictResolution: "human_review",
      retentionDays: 90,
      knowledgeSources: [],
      retrievalStrategy: { strategy: "hybrid", maxResults: 10, minRelevanceScore: 0.7, rerankEnabled: true },
      freshnessPolicy: { maxStalenessHours: 48, refreshTrigger: "scheduled", backgroundRefreshEnabled: true },
    },
    evalFramework: {
      frameworkId: "eval_finance",
      domainId: "finance",
      fewShotExamples: [],
      evaluators: [],
      onlineMetrics: [],
      releaseGates: { minFewShotCount: 5, minRegressionCaseCount: 20, requirePromptInjectionCoverage: true },
    },
    promptLibrary: {
      libraryId: "prompt_finance",
      domainId: "finance",
      prompts: [],
    },
    recipes: [],
    defaultToolBundleIds: [],
    defaultWorkflowIds: [],
  });

  assert.equal(review.onboardingReadiness, "needs_evidence");
  assert.ok(review.findings.includes("domain_descriptor.default_workflow_missing"));
  assert.ok(review.findings.includes("domain_descriptor.blocking_evaluator_missing"));
});

test("contract: guided onboarding must produce structured session and workflow draft DTOs", async () => {
  const service = new UserExperienceOrchestrationService();
  const result = await service.bootstrap({
    session: {
      userId: "user_ops",
      tenantId: "tenant_ops",
    },
    context: {
      memberCount: 5,
      departmentCount: 1,
      requiresSso: false,
    },
    userRole: "operator",
    businessDescription: "Build approval notify flow",
    template: {
      templateId: "tmpl_ops",
      title: "Ops Flow",
      steps: ["approval", "notify"],
      requiredCapabilities: [],
      parameters: [
        { name: "param1", label: "Param 1", type: "string" as const, required: false, options: [] },
      ],
      catalogTags: [],
    },
    wizardSession: {
      sessionId: "wizard_ops",
      currentStepId: "capability_setup",
      steps: [
        { stepId: "business_type", title: "Business", completed: true, riskLevel: "low" as const, requiredAnswerKeys: [], riskHints: [] },
        { stepId: "capability_setup", title: "Capability", completed: true, riskLevel: "low" as const, requiredAnswerKeys: [], riskHints: [] },
      ],
      schemaVersion: 1,
      history: [],
      answers: {},
      visitedStepIds: [],
    },
    components: [
      {
        componentId: "approval_gate",
        name: "Approval",
        icon: "shield",
        domainId: "operations",
        riskLevel: "medium",
        configSchema: {},
        previewDescription: "approval",
      },
      {
        componentId: "output_notify",
        name: "Notify",
        icon: "message",
        domainId: "operations",
        riskLevel: "low",
        configSchema: {},
        previewDescription: "notify",
      },
    ],
  });

  assert.equal(typeof result.guidedSession.sessionId, "string");
  assert.equal(result.guidedSession.currentStep, "capability_setup");
  assert.deepEqual(result.draft.steps, ["approval", "notify"]);
});

test("contract: residency, quota, and SLA violations must surface as explicit structured decisions", () => {
  const routing = new CrossRegionRoutingService();
  const route = routing.route({
    regions: [
      { regionId: "cn-sh", jurisdiction: "CN", latencyScore: 20, residencyAllowed: true, capabilities: ["llm", "storage"], provider: "aws", endpoints: { api: "https://cn-sh.api.example.com" }, dataResidencyPolicy: "regional" as const },
      { regionId: "us-west-2", jurisdiction: "US", latencyScore: 10, residencyAllowed: true, capabilities: ["llm", "storage"], provider: "aws", endpoints: { api: "https://us-west-2.api.example.com" }, dataResidencyPolicy: "regional" as const },
    ],
    policy: {
      policyId: "cn_only",
      allowedJurisdictions: ["CN"],
      requiredCapabilities: ["llm", "storage"],
      crossBorderTransferClass: "local_only" as const,
    },
    primaryRegionHealthy: false,
  });
  assert.equal(route.selectedRegionId, null);
  assert.equal(route.recoveryTopology.failoverRegionId, null);
  assert.ok(route.blockedRegions.includes("us-west-2"));

  const scheduling = new FairSchedulingService();
  const queue = scheduling.schedule({
    quotaPolicy: {
      scope: "tenant",
      scopeId: "tenant_a",
      workerUnits: { hardLimit: 5, currentUsage: 5 },
    },
    claim: {
      claimId: "claim_a",
      schedulingClass: {
        tenantId: "tenant_a",
        orgNodeId: "org_a",
        domainId: "ops",
        slaTierId: "enterprise",
        priority: 10,
      },
      requestedUnits: 2,
    },
    queueItems: [
      { itemId: "job_old", tenantId: "tenant_b", priority: 1, ageMs: 20 * 60_000 },
      { itemId: "job_new", tenantId: "tenant_a", priority: 10, ageMs: 30_000 },
    ],
    preemptionCandidates: [
      { executionId: "exec_low", priority: 1, progressPercent: 5, lastCheckpointTimestampMs: Date.now(), checkpointLatencyMs: 25 },
    ],
  });
  assert.equal(queue.queue.quotaExceeded, true);
  assert.equal(queue.preemption.victimExecutionId, "exec_low");

  const sla = new SlaOperationsService();
  const slaDecision = sla.evaluate({
    tiers: [
      {
        tierId: "enterprise",
        displayName: "Enterprise",
        priority: 3,
        reservedCapacityPercent: 40,
        targetLatencyMs: 300,
        targetSuccessRate: 0.995,
        maxQueueWaitMs: 800,
        preemptionPriority: 10,
      },
    ],
    selectedTierId: "enterprise",
    workflowClass: "deterministic",
    observation: {
      latencyMs: 600,
      successRate: 0.99,
      queueWaitMs: 1200,
    },
    totalCapacityUnits: 20,
    observedAt: "2026-04-20T00:00:00.000Z",
  });
  assert.deepEqual(
    slaDecision.breachRecords[0]?.breachCodes,
    ["sla.latency_breach", "sla.success_rate_breach", "sla.queue_wait_breach"],
  );
});
