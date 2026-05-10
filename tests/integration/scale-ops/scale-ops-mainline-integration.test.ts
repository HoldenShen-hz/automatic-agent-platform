import assert from "node:assert/strict";
import test from "node:test";

import { registerScaleOpsRuntimeOrchestrator } from "../../../src/scale-ops-runtime-orchestrator.js";
import { RuntimeGovernanceService } from "../../../src/scale-ecosystem/runtime-governance-service.js";
import { ConnectorFrameworkService } from "../../../src/scale-ecosystem/integration/connector-framework-service.js";
import { FeedbackImprovementService } from "../../../src/scale-ecosystem/feedback-loop/feedback-improvement-service.js";
import { CapacityPlanningService } from "../../../src/ops-maturity/capacity-planner/capacity-planning-service.js";
import { CostOptimizationService } from "../../../src/ops-maturity/cost-optimizer/cost-optimization-service.js";
import { PlatformOpsAgentService } from "../../../src/ops-maturity/platform-ops-agent/platform-ops-agent-service.js";
import { PlatformPanicService } from "../../../src/ops-maturity/emergency/platform-panic-service.js";
import { ExplanationPipelineService } from "../../../src/ops-maturity/explainability/explanation-pipeline-service.js";
import { WorkflowDebuggerService } from "../../../src/ops-maturity/workflow-debugger/workflow-debugger-service.js";
import { ComplianceReportPipelineService } from "../../../src/ops-maturity/compliance-reporter/compliance-report-pipeline-service.js";
import { MultimodalGatewayService } from "../../../src/ops-maturity/multimodal/multimodal-gateway-service.js";
import { ServiceRegistry } from "../../../src/platform/shared/lifecycle/service-registry.js";

test("integration: scale-ops mainline composes routing, connectors, feedback, ops, panic, explainability, debugging, compliance, and multimodal flow", async () => {
  const registry = ServiceRegistry.getInstance();

  try {
    const orchestrator = registerScaleOpsRuntimeOrchestrator(registry);
    const startup = orchestrator.startup();
    assert.equal(startup.ready, true);
    assert.deepEqual(startup.startupOrder, ["scale-ecosystem", "ops-maturity"]);

    const runtimeGovernance = new RuntimeGovernanceService();
    const governanceDecision = runtimeGovernance.evaluate({
      capability: "send_message",
      connectors: [
        {
          connectorId: "slack_primary",
          provider: "slack",
          capabilities: ["send_message", "open_modal"],
          supportedEvents: ["incident.opened"],
          lifecycleState: "enabled",
        },
        {
          connectorId: "github_primary",
          provider: "github",
          capabilities: ["create_pr"],
          supportedEvents: ["pull_request.opened"],
          lifecycleState: "enabled",
        },
      ],
      connectorHealthReports: [
        {
          connectorId: "slack_primary",
          status: "healthy",
          latencyMs: 120,
          checkedAt: "2026-04-22T08:00:00.000Z",
        },
      ],
      regions: [
        { regionId: "cn-shanghai", provider: "aws", jurisdiction: "cn", residencyAllowed: true, latencyScore: 25, endpoints: { api: "https://cn-shanghai.api.example.com" }, dataResidencyPolicy: "local_only" as const },
        { regionId: "us-west", provider: "aws", jurisdiction: "us", residencyAllowed: true, latencyScore: 80, endpoints: { api: "https://us-west.api.example.com" }, dataResidencyPolicy: "regional" as const },
      ],
      primaryRegionHealthy: false,
      quotaPolicy: { scope: "tenant" as const, scopeId: "tenant_finance", workerUnits: { hardLimit: 10, currentUsage: 3 } },
      requestedUnits: 4,
      queueItems: [
        { itemId: "job_a", tenantId: "tenant_finance", priority: 10, ageMs: 300_000 },
        { itemId: "job_b", tenantId: "tenant_shared", priority: 5, ageMs: 120_000 },
      ],
      preemptionCandidates: [
        { executionId: "exec_low", priority: 1, progressPercent: 20 },
      ],
      tiers: [
        { tierId: "gold", displayName: "Gold", priority: 10, targetSuccessRate: 0.99, targetLatencyMs: 500 },
        { tierId: "silver", displayName: "Silver", priority: 5, targetSuccessRate: 0.95, targetLatencyMs: 1000 },
      ],
      reservedCapacityPlan: [
        { tierId: "gold", reservedPercent: 60 },
        { tierId: "silver", reservedPercent: 40 },
      ],
      totalCapacityUnits: 100,
      observation: { latencyMs: 420, successRate: 0.97, queueWaitMs: 180 },
      commitment: { maxLatencyMs: 500, minSuccessRate: 0.95, maxQueueWaitMs: 300 },
    });
    assert.equal(governanceDecision.connectorId, "slack_primary");
    assert.equal(governanceDecision.regionId, "cn-shanghai");
    assert.equal(governanceDecision.failoverRegionId, "us-west");
    assert.equal(governanceDecision.quotaAllowed, true);

    const connectors = new ConnectorFrameworkService();
    connectors.register({
      connectorId: "slack_primary",
      provider: "slack",
      capabilities: ["send_message", "open_modal"],
      supportedEvents: ["incident.opened"],
      lifecycleState: "enabled",
    });
    connectors.bind("slack_primary", "tenant_finance", "prod", "2026-04-22T08:03:00.000Z");
    connectors.recordHealth({
      connectorId: "slack_primary",
      status: "healthy",
      latencyMs: 110,
      checkedAt: "2026-04-22T08:04:00.000Z",
    });
    const connectorExecution = connectors.execute(
      {
        connectorId: governanceDecision.connectorId!,
        capability: "send_message",
        payload: {
          channel: "#finance-ops",
          message: "capacity risk rising",
        },
        policyRef: "policy.connector.slack_primary",
        secretBindings: [{ secretRef: "secret://slack_primary/token", purpose: "bot_token" }],
      },
      {
        environment: "prod",
        eventType: "incident.opened",
        executedAt: "2026-04-22T08:05:00.000Z",
      },
    );
    assert.equal(connectorExecution.success, true);
    assert.equal(connectorExecution.status, "succeeded");

    const feedback = new FeedbackImprovementService();
    const feedbackIngest = feedback.ingest({
      taskId: "task_scale_ops_mainline",
      executionId: connectorExecution.executionKey,
      signals: [
        {
          signalId: "sig_timeout",
          taskId: "task_scale_ops_mainline",
          source: "execution",
          category: "failure",
          severity: "error",
          payload: { summary: "slack alert delayed", reasonCode: "connector.timeout" },
          stepOutputRefs: ["connector_dispatch"],
          timestamp: Date.parse("2026-04-22T08:06:00.000Z"),
          feedbackTrustScore: 0.85,
          trustFactors: { sourceReliability: 0.9, historicalAccuracy: 0.85, authenticatedSource: true, attackSurfaceExposure: 0.1, holdoutOverlap: 0 },
        },
        {
          signalId: "sig_user_fix",
          taskId: "task_scale_ops_mainline",
          source: "user",
          category: "correction",
          severity: "warning",
          payload: { summary: "route via verified slack workspace", reasonCode: "policy.routing_adjustment" },
          stepOutputRefs: ["connector_dispatch"],
          timestamp: Date.parse("2026-04-22T08:07:00.000Z"),
          feedbackTrustScore: 0.9,
          trustFactors: { sourceReliability: 0.95, historicalAccuracy: 0.9, authenticatedSource: true, attackSurfaceExposure: 0.1, holdoutOverlap: 0 },
        },
      ],
    });
    assert.ok(feedbackIngest.candidates.length >= 1);
    const approvedCandidate = feedback.review(
      feedbackIngest.candidates[0]!.candidateId,
      "ops_reviewer",
      "approved",
      {
        rolloutGatePassed: true,
        policyGatePassed: true,
        reviewedAt: "2026-04-22T08:08:00.000Z",
      },
    );
    const releasedCandidate = feedback.release(approvedCandidate.candidateId, "ops_release_manager");
    const feedbackSnapshot = feedback.buildSnapshot(feedbackIngest.feedback.signals, "2026-04-22T08:09:00.000Z");
    assert.equal(releasedCandidate.reviewStatus, "released");
    assert.equal(feedbackSnapshot.candidateCount >= 1, true);

    const capacityPlanning = new CapacityPlanningService();
    for (const signal of [
      { usage: 60, timestamp: "2026-04-22T07:00:00.000Z" },
      { usage: 66, timestamp: "2026-04-22T07:20:00.000Z" },
      { usage: 72, timestamp: "2026-04-22T07:40:00.000Z" },
      { usage: 79, timestamp: "2026-04-22T08:00:00.000Z" },
    ]) {
      capacityPlanning.recordSignal({
        resourceType: "worker_pool",
        regionId: governanceDecision.regionId ?? undefined,
        timestamp: signal.timestamp,
        usage: signal.usage,
        queueDepth: 8,
        errorBudgetBurn: 0.03,
      });
    }
    const capacityForecast = capacityPlanning.forecast("worker_pool", 3, {
      regionId: governanceDecision.regionId ?? undefined,
      start: "2026-04-22T07:00:00.000Z",
      end: "2026-04-22T08:00:00.000Z",
      generatedAt: "2026-04-22T08:10:00.000Z",
    });
    const capacityRecommendation = capacityPlanning.buildRecommendation(capacityForecast, {
      costPerUnit: 2.5,
      targetHeadroomPercent: 20,
      maxQueueDepth: 20,
      latestQueueDepth: 8,
      latestErrorBudgetBurn: 0.03,
    });
    assert.equal(capacityRecommendation.recommendedAction, "hold");

    const costOptimization = new CostOptimizationService();
    costOptimization.recordCost({
      subjectType: "workflow",
      subjectId: "workflow_scale_ops_mainline",
      costType: "runtime",
      amountUsd: 12.4,
      llmCostUsd: 0,
      toolCostUsd: 12.4,
      computeCostUsd: 0,
      storageCostUsd: 0,
      egressCostUsd: 0,
      humanReviewCostUsd: 0,
      decisionRef: connectorExecution.executionKey,
      capturedAt: "2026-04-22T08:11:00.000Z",
    });
    costOptimization.recordCost({
      subjectType: "model",
      subjectId: "vision_audit",
      costType: "model",
      amountUsd: 3.6,
      llmCostUsd: 3.6,
      toolCostUsd: 0,
      computeCostUsd: 0,
      storageCostUsd: 0,
      egressCostUsd: 0,
      humanReviewCostUsd: 0,
      decisionRef: releasedCandidate.candidateId,
      modelRef: "gpt-5.4-mini",
      capturedAt: "2026-04-22T08:11:30.000Z",
    });
    const costDashboard = costOptimization.buildDashboardSlice("2026-04-22T08:12:00.000Z");
    assert.equal(costDashboard.totalCostUsd, 16);
    assert.equal(costDashboard.recommendations.length >= 1, true);

    const opsAgent = new PlatformOpsAgentService({
      agentId: "ops_guardian",
      specialty: "scale-ops",
      allowedActionTypes: ["scale_capacity", "tune_config", "investigate_incident", "developer_assist"],
      requiredApprovals: [],
      maxAutonomyLevel: "trusted_automation",
      evidenceRequirements: ["connector_run", "capacity_forecast", "cost_dashboard"],
    });
    const opsProposal = opsAgent.createProposal({
      probes: [
        { component: "connector_runtime", status: "healthy", latencyMs: 110, timestamp: "2026-04-22T08:12:30.000Z" },
        { component: "worker_pool", status: "degraded", latencyMs: 240, timestamp: "2026-04-22T08:12:30.000Z" },
      ],
      errorRate: 0.01,
      backlog: 32,
      currentLoad: 80,
      projectedLoad: 90,
      observedAt: "2026-04-22T08:12:30.000Z",
    });
    const opsReceipt = opsAgent.execute(opsProposal.proposalId);
    assert.equal(opsProposal.actionType, "tune_config");
    assert.equal(opsReceipt.executed, true);

    const multimodal = new MultimodalGatewayService();
    const multimodalRun = multimodal.handle(
      {
        requestId: "mm_scale_ops",
        modalities: ["text", "image"],
        inputParts: [
          {
            partId: "part_text",
            type: "text",
            contentRef: "task://summary",
            text: "worker pool latency increased after slack alert burst",
            mimeType: "text/plain",
            dataClassification: "internal",
          },
          {
            partId: "part_image",
            type: "image",
            contentRef: "artifact://dashboard.png",
            mimeType: "image/png",
            imageMetadata: { width: 1600, height: 900 },
            dataClassification: "internal",
          },
        ],
        requestedOutputs: ["triage_summary"],
        safetyPolicyRef: "policy.multimodal.internal",
        costBudget: { maxUsd: 1 },
        traceId: "trace_scale_ops",
      },
      "2026-04-22T08:13:00.000Z",
    );
    assert.equal(multimodalRun.blocked, false);
    assert.equal(multimodalRun.routeDecisions.length, 2);

    const explanationPipeline = new ExplanationPipelineService();
    const explanation = explanationPipeline.generate(
      {
        taskId: "task_scale_ops_mainline",
        stageId: "ops_triage",
        summary: `${capacityRecommendation.recommendedAction} via ${opsProposal.actionType}`,
        decision: "accept",
        decisionFactors: [
          `connector=${governanceDecision.connectorId}`,
          `region=${governanceDecision.regionId}`,
          `projected_peak=${capacityRecommendation.projectedPeak}`,
        ],
        evidence: [
          { evidenceId: connectorExecution.executionKey, category: "connector_run", sourceRef: governanceDecision.connectorId ?? undefined },
          { evidenceId: opsProposal.proposalId, category: "ops_proposal" },
          { evidenceId: multimodalRun.gatewayRunId, category: "multimodal_run" },
        ],
        riskNotes: [...governanceDecision.breaches, `cost_total=${costDashboard.totalCostUsd}`],
        causalLinks: [
          { source: "connector_health", target: "ops_proposal", rationale: "connector burst raised operational attention" },
          { source: "capacity_forecast", target: "ops_proposal", rationale: "forecast stayed below scale-up threshold" },
        ],
        allowedEvidenceCategories: ["connector_run", "ops_proposal"],
        generatedAt: "2026-04-22T08:14:00.000Z",
      },
      "L3",
    );
    assert.equal(explanation.redactedEvidenceRefs.includes(multimodalRun.gatewayRunId), true);
    assert.equal(explanationPipeline.getCached(explanation.cacheKey), null);

    const debuggerService = new WorkflowDebuggerService();
    debuggerService.registerBreakpoint(
      {
        actorId: "ops_debugger",
        allowedRuntime: "replay_sandbox",
      },
      "prod",
      {
        breakpointId: "bp_triage",
        workflowId: "workflow_scale_ops_mainline",
        stepSelector: "explain",
        condition: "always",
        action: "snapshot",
      },
    );
    const workflowFrames = [
      {
        workflowId: "workflow_scale_ops_mainline",
        stepId: "route",
        status: "completed",
        timestamp: "2026-04-22T08:05:00.000Z",
        label: "Route connector request",
      },
      {
        workflowId: "workflow_scale_ops_mainline",
        stepId: "explain",
        status: "completed",
        timestamp: "2026-04-22T08:14:00.000Z",
        label: "Render explanation bundle",
      },
    ] as const;
    const breakpointHits = debuggerService.evaluateTrace(workflowFrames);
    const comparison = debuggerService.buildComparisonReport(
      "workflow_scale_ops_mainline",
      workflowFrames,
      [
        workflowFrames[0],
        {
          workflowId: "workflow_scale_ops_mainline",
          stepId: "explain",
          status: "failed",
          timestamp: "2026-04-22T08:14:10.000Z",
          label: "Render explanation bundle",
        },
      ],
    );
    assert.equal(breakpointHits.length, 1);
    assert.equal(comparison.differences.length >= 1, true);
    assert.equal(debuggerService.renderTraceTimeline(workflowFrames).length, 2);

    const compliancePipeline = new ComplianceReportPipelineService([
      {
        templateId: "scale_ops_audit",
        framework: "internal_ops",
        reportType: "post_incident",
        requiredEvidenceTypes: ["connector_run", "ops_receipt", "explanation"],
        renderSchema: ["template", "coverage", "completeness"],
        version: "1.0.0",
      },
    ]);
    const complianceReport = compliancePipeline.generate({
      templateId: "scale_ops_audit",
      evidence: [
        { evidenceId: connectorExecution.executionKey, evidenceType: "connector_run" },
        { evidenceId: opsReceipt.proposalId, evidenceType: "ops_receipt" },
        { evidenceId: explanation.explanationId, evidenceType: "explanation" },
      ],
      requestedBy: "ops_auditor",
      generatedAt: "2026-04-22T08:15:00.000Z",
    });
    const accessReceipt = compliancePipeline.recordReadAccess(
      complianceReport,
      "ops_auditor",
      "2026-04-22T08:15:30.000Z",
    );
    assert.equal(complianceReport.status, "generated");
    assert.equal(accessReceipt.accessMode, "read_only");

    const panicService = new PlatformPanicService();
    const activation = panicService.activate({
      scope: "tenant/tenant_finance/scale-ops",
      reasonCode: "security.connector_abuse",
      activeIncidents: 1,
      issuedBy: "ops_guardian",
      issuedAt: "2026-04-22T08:16:00.000Z",
      requiredApprovers: ["platform_admin_1", "platform_admin_2"],
      targetScopes: ["tenant/tenant_finance/scale-ops", "tenant/tenant_finance/scale-ops/workflow_scale_ops_mainline"],
      forensicArtifactIds: [complianceReport.artifactId, explanation.explanationId],
      triggerSignals: ["connector_abuse", "panic_manual_review"],
      severity: "critical",
    });
    const panicDecision = panicService.evaluateExecution({
      scope: "tenant/tenant_finance/scale-ops/workflow_scale_ops_mainline",
      mode: "automation",
    });
    const resumed = panicService.resume("tenant/tenant_finance/scale-ops", {
      planId: "resume_plan_001",
      scope: "tenant/tenant_finance/scale-ops",
      scopeRef: "scope_ref_001",
      approvedBy: ["security_lead", "ops_lead"],
      approvalCount: 2,
      approvedRoles: ["platform_admin", "platform_admin"],
      compatibilityCheckRef: "compat_check_001",
      mode: "standard",
      checkpointsVerified: true,
      forensicSnapshotReviewed: true,
      rollbackPlanReady: true,
      validationRunPassed: true,
      createdAt: "2026-04-22T08:20:00.000Z",
    }, "2026-04-22T08:20:00.000Z");
    assert.equal(activation.propagationRecords.length, 2);
    assert.equal(panicDecision.blocked, true);
    assert.equal(resumed.resumed, true);
  } finally {
    await registry.reset();
  }
});
