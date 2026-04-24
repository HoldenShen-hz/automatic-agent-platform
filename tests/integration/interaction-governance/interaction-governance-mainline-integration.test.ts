import assert from "node:assert/strict";
import test from "node:test";

import { registerInteractionGovernanceRuntimeOrchestrator } from "../../../src/interaction-governance-runtime-orchestrator.js";
import { AutonomyGovernanceService } from "../../../src/interaction/autonomy/autonomy-governance-service.js";
import { DashboardAggregationService } from "../../../src/interaction/dashboard/index.js";
import { GoalDecompositionService } from "../../../src/interaction/goal-decomposer/index.js";
import { ConversationContextManager, NlEntryService } from "../../../src/interaction/nl-gateway/index.js";
import { ProactiveAgentService } from "../../../src/interaction/proactive-agent/index.js";
import { UserExperienceOrchestrationService } from "../../../src/interaction/ux/user-experience-orchestration-service.js";
import { ApprovalRoutingService } from "../../../src/org-governance/approval-routing/approval-routing-service.js";
import { ComplianceGovernanceService } from "../../../src/org-governance/compliance-engine/compliance-governance-service.js";
import { DelegatedGovernanceService } from "../../../src/org-governance/delegated-governance/delegated-governance-service.js";
import { KnowledgeBoundaryService } from "../../../src/org-governance/knowledge-boundary/knowledge-boundary-service.js";
import { GroupRoleMappingService } from "../../../src/org-governance/sso-scim/group-role-mapping-service.js";
import { IdentitySyncService } from "../../../src/org-governance/sso-scim/identity-sync-service.js";
import { ServiceRegistry } from "../../../src/platform/shared/lifecycle/service-registry.js";
import type { SystemSituation } from "../../../src/platform/shared/observability/system-situation-model.js";
import type { TaskBoardItem } from "../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import type { OrgNode } from "../../../src/org-governance/org-model/org-node/index.js";

function makeSystemSituation(overrides: Partial<SystemSituation> = {}): SystemSituation {
  return {
    healthStatus: "degraded",
    providerHealth: {
      status: "healthy",
      successRate: 0.98,
      recentCalls: 24,
    },
    resourceUtilization: {
      memoryRssMb: 640,
      cpuPercent: 38,
      activeProcesses: 12,
    },
    queueBacklog: {
      size: 1,
      degraded: false,
    },
    eventBusBacklog: {
      tier1PendingAcks: 0,
    },
    findings: ["approval queue requires follow-up"],
    observedAt: Date.parse("2026-04-22T00:45:00.000Z"),
    ...overrides,
  };
}

test("integration: interaction-governance mainline composes intake, UX, autonomy, approvals, identity, knowledge, and dashboard flow", async () => {
  const registry = ServiceRegistry.getInstance();

  try {
    const orchestrator = registerInteractionGovernanceRuntimeOrchestrator(registry);
    const startup = orchestrator.startup();
    assert.equal(startup.ready, true);
    assert.deepEqual(startup.startupOrder, ["interaction", "org-governance"]);

    const identity = new IdentitySyncService();
    const identitySnapshot = identity.bootstrap(
      {
        providerId: "oidc_finance",
        issuer: "https://id.example.com",
        clientId: "finance-portal",
        redirectUri: "https://app.example.com/callback",
        scopes: ["openid", "profile", "groups"],
      },
      {
        providerId: "saml_finance",
        entryPoint: "https://id.example.com/saml",
        issuer: "app.example.com",
        certificateFingerprint: "sha256:finance",
        allowUnsignedAssertions: false,
      },
      [
        {
          eventId: "evt_user_created",
          action: "user_created",
          subjectId: "manager_finance",
          occurredAt: "2026-04-22T00:00:00.000Z",
        },
      ],
    );
    const groupRoleMapping = new GroupRoleMappingService();
    groupRoleMapping.register({
      groupName: "finance-approvers",
      roleIds: ["finance_manager", "budget_approver"],
    });
    assert.deepEqual(identitySnapshot.activeSubjects, ["manager_finance"]);
    assert.deepEqual(groupRoleMapping.resolve(["finance-approvers"]), ["finance_manager", "budget_approver"]);

    const ux = new UserExperienceOrchestrationService();
    const uxBootstrap = await ux.bootstrap({
      session: {
        userId: "manager_finance",
        tenantId: "tenant_finance",
      },
      context: {
        memberCount: 24,
        departmentCount: 2,
        requiresSso: true,
      },
      userRole: "domain_admin",
      businessDescription: "为 Finance 团队搭建预算审批通过后发送 Slack 通知的自动化流程",
      template: {
        templateId: "budget_approval_notify",
        title: "Budget Approval Notify",
        steps: ["approval", "notify", "audit"],
      },
      wizardSession: {
        sessionId: "wizard_finance",
        currentStepId: "capability_setup",
        steps: [
          { stepId: "business_type", title: "业务类型", completed: true },
          { stepId: "capability_setup", title: "能力配置", completed: true },
        ],
      },
      components: [
        {
          componentId: "approval_gate",
          name: "Approval",
          icon: "shield",
          domainId: "finance",
          riskLevel: "high",
          configSchema: {},
          previewDescription: "budget approval",
        },
        {
          componentId: "notify_slack",
          name: "Slack Notify",
          icon: "message",
          domainId: "finance",
          riskLevel: "low",
          configSchema: {},
          previewDescription: "slack notification",
        },
      ],
    });
    assert.equal(uxBootstrap.draft.validationFindings.length, 0);
    assert.equal(uxBootstrap.guidedSession.userRole, "domain_admin");

    const nlEntry = new NlEntryService();
    const intakeRequest = {
      tenantId: "tenant_finance",
      userId: "manager_finance",
      channel: "slack",
      message: "请批准 Finance 团队在 2026-04-25 前上线预算 12000 美元的 Slack 通知自动化",
    } as const;
    const detailedIntent = await nlEntry.parseDetailed(intakeRequest);
    const taskBuild = await nlEntry.buildTask(intakeRequest);
    assert.equal(detailedIntent.detectedIntents[0]?.intentType, "approval_action");
    assert.equal(taskBuild.riskPreview.approvalNeeded, true);
    assert.equal(taskBuild.confirmationRequired, true);

    const conversation = new ConversationContextManager().addTurn(
      intakeRequest.tenantId,
      intakeRequest.userId,
      intakeRequest.message,
      detailedIntent.detectedIntents[0]!,
    );
    assert.equal(conversation.turnCount, 1);
    assert.equal(conversation.lastIntent?.intentType, "approval_action");

    const decomposition = await new GoalDecompositionService().decompose({
      goalId: "goal_budget_notify",
      description: taskBuild.requestEnvelope.payload.request,
      owner: "manager_finance",
      successCriteria: [
        {
          metric: "approval_latency",
          target: "< 30m",
          evaluationMethod: "human_review",
        },
      ],
      constraints: ["必须保留审批链和预算审计记录"],
      priority: "critical",
    });
    assert.equal(decomposition.requiresHumanReview, true);
    assert.ok((decomposition.tasks.length ?? 0) >= 3);

    const proactive = new ProactiveAgentService({
      declaredTriggerIdsByDomain: { finance: ["approval_queue_watch"] },
      dailyTriggerBudgetByDomain: { finance: 5 },
    });
    await proactive.registerTrigger({
      triggerId: "approval_queue_watch",
      domainId: "finance",
      name: "Approval Queue Watch",
      type: "threshold",
      config: {
        metricSource: "dashboard",
        metricName: "approval_queue_depth",
        condition: "gt",
        threshold: 0,
        evaluationWindow: "5m",
        consecutiveBreaches: 1,
      },
      action: {
        actionType: "suggest_to_user",
        template: { action: "review_approval_queue" },
        requireConfirmation: true,
      },
      enabled: true,
      riskLevel: "medium",
      maxFireRate: "2/hour",
      cooldown: "5m",
    });
    const proactiveDecision = proactive.evaluate("approval_queue_watch", {
      kind: "threshold",
      now: "2026-04-22T00:30:00.000Z",
      metric: {
        source: "dashboard",
        name: "approval_queue_depth",
        value: 1,
        previousValue: 0,
      },
    });
    assert.equal(proactiveDecision.allowed, true);
    assert.equal(proactiveDecision.actionMode, "suggest");
    assert.equal(proactive.listSuggestions("finance").length, 1);

    const autonomySnapshot = new AutonomyGovernanceService().evaluateProfile({
      agentId: "agent_finance_ops",
      domainId: "finance",
      overallTrustLevel: "supervised",
      lastEvaluation: "2026-04-22T00:00:00.000Z",
      capabilityScores: [
        {
          capabilityId: "approval_review",
          currentAutonomy: "supervised",
          trustScore: 0,
          totalExecutions: 250,
          successfulExecutions: 247,
          failedExecutions: 1,
          humanOverrides: 3,
          incidents: 0,
          lastIncidentAgeDays: 90,
        },
        {
          capabilityId: "budget_change",
          currentAutonomy: "full_auto",
          trustScore: 0,
          totalExecutions: 20,
          successfulExecutions: 10,
          failedExecutions: 5,
          humanOverrides: 8,
          incidents: 1,
          lastIncidentAgeDays: 1,
        },
      ],
    });
    assert.equal(
      autonomySnapshot.decisions.find((item) => item.capabilityId === "approval_review")?.recommendedLevel,
      "semi_auto",
    );
    assert.equal(
      autonomySnapshot.decisions.find((item) => item.capabilityId === "budget_change")?.recommendedLevel,
      "suggestion",
    );

    const orgNodes: OrgNode[] = [
      {
        orgNodeId: "root",
        nodeType: "company",
        displayName: "Root",
        parentOrgNodeId: null,
        ownerUserIds: ["ceo"],
        active: true,
        metadata: {},
        costCenter: "",
      },
      {
        orgNodeId: "dept_finance",
        nodeType: "department",
        displayName: "Finance",
        parentOrgNodeId: "root",
        ownerUserIds: ["finance_director"],
        active: true,
        metadata: {},
        costCenter: "FIN-001",
      },
    ];
    const compliance = new ComplianceGovernanceService(
      orgNodes,
      {
        root: [{ policyId: "root_policy", rules: { approvalRequired: true, residency: "cn" } }],
        dept_finance: [{ policyId: "finance_policy", rules: { approvalRequired: true, residency: "cn", auditTrail: true } }],
      },
    );
    const complianceResult = compliance.evaluate({
      actorId: "manager_finance",
      orgNodeId: "dept_finance",
      action: "finance.approve_budget",
      requiredPolicyKeys: ["approvalRequired", "residency"],
      occurredAt: "2026-04-22T00:30:00.000Z",
    });
    assert.equal(complianceResult.allowed, true);

    const delegatedGovernance = new DelegatedGovernanceService([
      {
        delegationId: "del_finance_manager",
        grantorId: "finance_director",
        granteeId: "manager_finance",
        orgNodeIds: ["dept_finance"],
        domainIds: ["finance"],
        permissions: ["manage_approvals"],
        guardrails: [],
        expiresAt: "2026-04-30T00:00:00.000Z",
        revocable: true,
        status: "active",
      },
      {
        delegationId: "guardrail_finance_budget",
        grantorId: "platform_team",
        granteeId: "policy_runtime",
        orgNodeIds: ["dept_finance"],
        domainIds: ["finance"],
        permissions: [],
        guardrails: [
          {
            guardrailId: "max_budget_finance",
            type: "max_budget",
            value: 10000,
            setBy: "platform_team",
            overridable: false,
          },
        ],
        expiresAt: "2026-04-30T00:00:00.000Z",
        revocable: false,
        status: "active",
      },
    ]);
    const delegationResult = delegatedGovernance.resolve(
      "manager_finance",
      {
        orgNodeId: "dept_finance",
        domainId: "finance",
        capability: "approve_budget",
        permission: "manage_approvals",
      },
      "2026-04-22T00:30:00.000Z",
    );
    const guardrailCheck = delegatedGovernance.checkOperation(
      {
        actorId: "manager_finance",
        actorRole: "department_admin",
        orgNodeId: "dept_finance",
        domainId: "finance",
      },
      "modify_approval_rules",
      12000,
    );
    assert.equal(delegationResult.allowed, true);
    assert.equal(guardrailCheck.allowed, false);

    const approval = new ApprovalRoutingService({
      orgNodes,
      delegations: [
        {
          delegationId: "approval_del_finance",
          approverId: "finance_director",
          delegateApproverId: "backup_finance_director",
          scopeNodeIds: ["dept_finance"],
          startsAt: "2026-04-20T00:00:00.000Z",
          expiresAt: "2026-04-30T00:00:00.000Z",
          active: true,
        },
      ],
      escalationRules: [
        {
          ruleId: "approval_escalation_high_risk",
          triggerAfterMinutes: 30,
          escalateToApproverId: "vp_finance",
          appliesToRiskLevels: ["high", "critical"],
        },
      ],
    });
    const approvalResult = approval.route(
      {
        requesterId: "manager_finance",
        orgNodeId: "dept_finance",
        riskLevel: "high",
        amountUsd: 12000,
      },
      "2026-04-22T00:00:00.000Z",
      "2026-04-22T01:00:00.000Z",
    );
    assert.deepEqual(approvalResult.approverChain, ["backup_finance_director", "vp_finance"]);
    assert.equal(approvalResult.escalatedTo, "vp_finance");

    const knowledge = new KnowledgeBoundaryService();
    const knowledgeDecision = knowledge.evaluateAccess(
      {
        boundaryId: "kb_finance_budget",
        ownerOrgNodeId: "dept_finance",
        namespaceIds: ["finance.budget"],
        defaultVisibility: "private",
        allowedOrgNodeIds: [],
      },
      "manager_finance",
      "dept_finance",
      "review approval packet",
      [],
      {
        policyId: "cw_finance_legal",
        conflictGroups: {
          sensitive_review: ["dept_finance", "dept_legal"],
        },
      },
      "2026-04-22T00:35:00.000Z",
    );
    assert.equal(knowledgeDecision.allowed, true);
    assert.equal(knowledge.listRedactedLogs("kb_finance_budget").length, 1);

    const dashboardTask: TaskBoardItem = {
      taskId: taskBuild.requestEnvelope.requestId,
      title: taskBuild.requestEnvelope.payload.title,
      priority: "high",
      taskStatus: "pending",
      workflowStatus: "running",
      divisionId: "finance",
      currentStepIndex: 0,
      sessionStatus: "open",
      latestEventAt: "2026-04-22T00:40:00.000Z",
      updatedAt: "2026-04-22T00:40:00.000Z",
    };
    const dashboard = new DashboardAggregationService({
      taskSource: {
        list: () => [dashboardTask],
      },
      systemSource: {
        build: () => makeSystemSituation(),
      },
      currentTime: () => "2026-04-22T00:45:00.000Z",
      costBurnUsd: 16,
      forecastCostUsd: 12,
      activeGoals: [{ goalId: decomposition.goalId, progressPercent: 20 }],
      suggestions: proactive.listSuggestions("finance").map((suggestion) => ({
        itemType: "suggestion",
        priority: "normal",
        title: suggestion.title,
        description: "审批队列存在待处理项，建议人工复核。",
        actionOptions: [String(suggestion.action.actionType)],
        createdAt: suggestion.createdAt,
        domainId: suggestion.domainId,
      })),
    }).buildOperatorDashboard();

    assert.ok(dashboard.attentionQueue.some((item) => item.itemType === "approval_needed"));
    assert.ok(dashboard.attentionQueue.some((item) => item.itemType === "budget_warning"));
    assert.equal(dashboard.proactiveSuggestions.length, 1);
    assert.equal(dashboard.activeGoals[0]?.goalId, decomposition.goalId);
  } finally {
    await registry.reset();
  }
});
