import type {
  AgentDTO,
  AnalyticsMetricDTO,
  ApprovalDTO,
  CostReportDTO,
  DashboardSnapshotDTO,
  DivisionInventorySnapshotDTO,
  DomainConfigDTO,
  ExplanationDTO,
  FeatureFlagDTO,
  IncidentDTO,
  LeadershipClaimsConsoleDTO,
  MarketplacePackDTO,
  ModelConfigDTO,
  QueueDTO,
  RoleDTO,
  SystemConfigDTO,
  TaskDTO,
  TenantDTO,
  UserDTO,
  UserPreferenceDTO,
  WebhookDTO,
  WorkerDTO,
  WorkflowRunStepDTO,
  WorkflowDTO,
} from "@aa/shared-types";

export interface MockApiShape {
  readonly dashboard: DashboardSnapshotDTO;
  readonly tasks: readonly TaskDTO[];
  readonly workflowRunSteps: Readonly<Record<string, readonly WorkflowRunStepDTO[]>>;
  readonly workflows: readonly WorkflowDTO[];
  readonly approvals: readonly ApprovalDTO[];
  readonly incidents: readonly IncidentDTO[];
  readonly workers: readonly WorkerDTO[];
  readonly queues: readonly QueueDTO[];
  readonly agents: readonly AgentDTO[];
  readonly analytics: readonly AnalyticsMetricDTO[];
  readonly costs: readonly CostReportDTO[];
  readonly marketplace: readonly MarketplacePackDTO[];
  readonly explanations: readonly ExplanationDTO[];
  readonly roles: readonly RoleDTO[];
  readonly featureFlags: readonly FeatureFlagDTO[];
  readonly models: readonly ModelConfigDTO[];
  readonly domainConfigs: readonly DomainConfigDTO[];
  readonly tenants: readonly TenantDTO[];
  readonly webhooks: readonly WebhookDTO[];
  readonly users: readonly UserDTO[];
  readonly systemConfig: SystemConfigDTO;
  readonly preferences: UserPreferenceDTO;
  readonly divisionInventory: DivisionInventorySnapshotDTO;
  readonly leadershipClaims: LeadershipClaimsConsoleDTO;
}

export const defaultMockApiShape: MockApiShape = {
  dashboard: {
    overallHealth: "healthy",
    queueDepth: 7,
    activeExecutions: 12,
    approvalBacklog: 3,
    alertSummary: "2 medium alerts",
    successRate: 98.2,
    avgDurationMs: 1840,
    activeAgents: 9,
    errorRate: 0.7,
    p50LatencyMs: 420,
    p99LatencyMs: 1560,
    budgetUtilizationPercent: 73,
    uptimePercent: 99.94,
  },
  tasks: [
    { id: "task-1", title: "春季营销活动", status: "running", domainId: "marketing", currentStep: "launch-assets", owner: "growth-ops", evidenceCount: 6, timelineDepth: 5 },
    { id: "task-2", title: "量化策略检查", status: "blocked", domainId: "quant-trading", currentStep: "approval", owner: "quant-review", evidenceCount: 9, timelineDepth: 5 },
  ],
  workflowRunSteps: {
    "task-1": [
      { id: "task-1-step-1", title: "Collect demand signals", status: "completed", executor: "growth-ops", startedAt: "2026-04-23T15:00:00Z", completedAt: "2026-04-23T15:04:00Z" },
      { id: "task-1-step-2", title: "Launch assets", status: "running", executor: "agent-growth-launcher", startedAt: "2026-04-23T15:05:00Z" },
    ],
    "task-2": [
      { id: "task-2-step-1", title: "Evaluate risk envelope", status: "completed", executor: "quant-review", startedAt: "2026-04-23T15:10:00Z", completedAt: "2026-04-23T15:16:00Z" },
      { id: "task-2-step-2", title: "Prepare approval packet", status: "running", executor: "agent-risk-sentinel", startedAt: "2026-04-23T15:16:30Z" },
    ],
    approval: [
      { id: "approval-step-1", title: "Request operator review", status: "running", executor: "operator-console", startedAt: "2026-04-23T15:20:00Z" },
    ],
  },
  workflows: [
    {
      id: "workflow-1",
      title: "Campaign Launch",
      status: "running",
      currentStage: "Execute",
      owner: "growth-ops",
      steps: [
        { id: "s1", title: "Observe demand signals", phase: "Observe", status: "completed" },
        { id: "s2", title: "Assess constraints", phase: "Assess", status: "completed" },
        { id: "s3", title: "Plan rollout", phase: "Plan", status: "completed" },
        { id: "s4", title: "Execute launch", phase: "Execute", status: "running" },
      ],
    },
    {
      id: "workflow-2",
      title: "Risk Approval Loop",
      status: "paused",
      currentStage: "Feedback",
      owner: "quant-review",
      steps: [
        { id: "r1", title: "Observe trade anomaly", phase: "Observe", status: "completed" },
        { id: "r2", title: "Assess exposure", phase: "Assess", status: "completed" },
        { id: "r3", title: "Feedback to approver", phase: "Feedback", status: "running" },
      ],
    },
  ],
  approvals: [
    { approvalId: "approval-1", taskId: "task-2", riskLevel: "critical", reasonSummary: "策略需要人工审批" },
  ],
  incidents: [
    { id: "inc-1", severity: "high", title: "Queue lag rising", summary: "dispatch queue lag exceeded target for 8m", createdAt: "2026-04-23T16:00:00Z" },
    { id: "inc-2", severity: "medium", title: "Approval backlog", summary: "critical approvals waiting longer than 20m", createdAt: "2026-04-23T16:10:00Z" },
  ],
  workers: [
    { id: "worker-1", status: "busy", queue: "dispatch", heartbeatLagMs: 140 },
    { id: "worker-2", status: "idle", queue: "approval", heartbeatLagMs: 80 },
    { id: "worker-3", status: "draining", queue: "recovery", heartbeatLagMs: 260 },
  ],
  queues: [
    { id: "dispatch", ready: 42, inFlight: 8, retries: 2, dlq: 1 },
    { id: "approval", ready: 3, inFlight: 1, retries: 0, dlq: 0 },
  ],
  agents: [
    { id: "agent-1", name: "Growth Strategist", domainId: "marketing", status: "healthy", load: 0.62 },
    { id: "agent-2", name: "Risk Sentinel", domainId: "quant-trading", status: "degraded", load: 0.88 },
  ],
  analytics: [
    { id: "m1", label: "Task Success Rate", value: "98.2%", trend: "up", changePercent: 1.1, layer: "tasks", description: "Completed tasks that reached success." },
    { id: "m2", label: "Approval SLA", value: "14m", trend: "flat", changePercent: 0.3, layer: "approvals", description: "Median approval turnaround." },
    { id: "m3", label: "Queue Throughput", value: "1.8k/h", trend: "up", changePercent: 4.8, layer: "workflows", description: "Processed queue volume per hour." },
    { id: "m4", label: "Workflow Completion", value: "91%", trend: "up", changePercent: 2.4, layer: "workflows", description: "Workflow runs closed without rollback." },
    { id: "m5", label: "Agent Utilization", value: "76%", trend: "flat", changePercent: 0.5, layer: "agents", description: "Average agent load across active domains." },
    { id: "m6", label: "Budget Burn", value: "73%", trend: "up", changePercent: 6.2, layer: "cost", description: "Budget consumed vs monthly guardrail." },
  ],
  costs: [
    { id: "c1", scope: "marketing", amountUsd: 1240, budgetUsd: 1600 },
    { id: "c2", scope: "quant-trading", amountUsd: 2280, budgetUsd: 2400 },
  ],
  marketplace: [
    { id: "pack-1", name: "Campaign Optimizer", category: "marketing", version: "1.4.0" },
    { id: "pack-2", name: "Risk Lens", category: "finance", version: "2.1.3" },
  ],
  explanations: [
    { id: "exp-1", title: "Budget Alert Explanation", summary: "Spend increased because approval turnaround improved", evidenceCount: 4 },
    { id: "exp-2", title: "Workflow Pause Explanation", summary: "Workflow paused waiting for quant approval", evidenceCount: 7 },
  ],
  roles: [
    { id: "role-l1", name: "Operator", scope: "personal", permissionCount: 12, userCount: 150 },
    { id: "role-l2", name: "Domain Admin", scope: "domain", permissionCount: 28, userCount: 25 },
    { id: "role-l3", name: "Platform SRE", scope: "platform", permissionCount: 45, userCount: 8 },
  ],
  featureFlags: [
    { id: "analytics", enabled: true, rolloutPercentage: 100, target: "global" },
    { id: "workflow-builder", enabled: true, rolloutPercentage: 35, target: "pack-developers" },
    { id: "marketplace", enabled: true, rolloutPercentage: 60, target: "shared" },
  ],
  models: [
    { id: "model-1", provider: "minimax", model: "MiniMax-M2.7", boundDomains: ["marketing", "quant-trading"], budgetUsd: 2400 },
    { id: "model-2", provider: "minimax", model: "MiniMax-Text-01", boundDomains: ["customer-service", "education"], budgetUsd: 900 },
  ],
  domainConfigs: [
    { id: "marketing", displayName: "Marketing", owner: "growth-ops", defaultDrillDepth: 3, featureVisibilityCount: 12 },
    { id: "quant-trading", displayName: "Quant Trading", owner: "risk-office", defaultDrillDepth: 5, featureVisibilityCount: 14 },
  ],
  tenants: [
    { id: "tenant-default", name: "Default Tenant", domains: ["marketing", "quant-trading"], status: "active" },
    { id: "tenant-beta", name: "Beta Sandbox", domains: ["customer-service"], status: "paused" },
  ],
  webhooks: [
    { id: "wh-1", targetUrl: "https://ops.example.com/webhooks/incidents", eventCount: 6, enabled: true },
    { id: "wh-2", targetUrl: "https://audit.example.com/webhooks/config", eventCount: 3, enabled: true },
  ],
  users: [
    { id: "user-1", displayName: "Ops Lead", roleIds: ["role-l3"], tenantId: "tenant-default", status: "active" },
    { id: "user-2", displayName: "Quant Reviewer", roleIds: ["role-l2"], tenantId: "tenant-default", status: "invited" },
  ],
  systemConfig: {
    environment: "staging",
    cspMode: "enforced",
    csrfEnabled: true,
    telemetryEndpoint: "https://telemetry.example.com/v1/logs",
  },
  preferences: {
    locale: "zh-CN",
    theme: "dark",
    defaultDashboardLayout: ["overview", "tasks", "approvals"],
  },
  divisionInventory: {
    generatedAt: "2026-06-01T00:00:00.000Z",
    records: [
      {
        divisionId: "coding",
        normalizedDivisionId: "coding",
        familyId: "engineering",
        status: "pilot_ready",
        riskLevel: "high",
        hasDivisionYaml: true,
        hasCoverageCard: true,
        hasScenarioCard: true,
        hasEval: true,
        hasRedTeam: true,
        hasTrainingPolicy: true,
        hasOwner: true,
        blockers: [],
        coverageCardPath: "config/division-coverage/divisions/coding.yaml",
        scenarioRefs: ["config/division-coverage/scenarios/issue-to-patch.yaml"],
      },
      {
        divisionId: "customer-service",
        normalizedDivisionId: "customer-service",
        familyId: "enterprise-ops",
        status: "pilot_ready",
        riskLevel: "high",
        hasDivisionYaml: true,
        hasCoverageCard: true,
        hasScenarioCard: true,
        hasEval: true,
        hasRedTeam: true,
        hasTrainingPolicy: true,
        hasOwner: true,
        blockers: [],
        coverageCardPath: "config/division-coverage/divisions/customer-service.yaml",
      },
      {
        divisionId: "legal",
        normalizedDivisionId: "legal",
        familyId: "regulated",
        status: "coverage_draft",
        riskLevel: "critical",
        hasDivisionYaml: true,
        hasCoverageCard: true,
        hasScenarioCard: false,
        hasEval: false,
        hasRedTeam: false,
        hasTrainingPolicy: false,
        hasOwner: true,
        blockers: ["missing_scenario_card", "missing_eval", "missing_redteam", "missing_training_policy"],
        coverageCardPath: "config/division-coverage/divisions/legal.yaml",
      },
    ],
    summary: {
      totalDivisions: 32,
      p0Divisions: 5,
      blockedDivisions: 1,
      orphanSourceModules: 0,
    },
  },
  leadershipClaims: {
    generatedAt: "2026-05-31T00:00:00.000Z",
    families: [
      {
        familyId: "engineering",
        displayName: "Engineering",
        readinessStatus: "local_leadership_ready",
        targetClaimLevel: "local_leader",
        owner: "engineering-platform-owner",
        canonicalFamilies: ["engineering", "data", "operations", "quality"],
        canonicalDivisions: ["coding", "data-engineering", "devops", "engineering_ops", "quality-assurance"],
        benchmarkRefs: ["swe-bench-verified", "bfcl-v4", "aidev-github"],
        minimumEvidenceRef: "engineering-core",
        notes: "issue-to-patch closure is measurable",
        benchmarks: [
          { benchmarkId: "swe-bench-verified", label: "SWE-bench Verified", url: "https://www.swebench.com/verified.html", purpose: "issue-to-patch correctness" },
        ],
        internalMappings: [
          { metricId: "patch_correctness", description: "patched repo remains semantically correct after tests" },
        ],
        mvpThresholds: [
          { label: "Internal SWE-style tasks", requirement: ">=50" },
        ],
        leadershipThresholds: [
          { label: "Internal SWE-style tasks", requirement: ">=200" },
        ],
      },
      {
        familyId: "regulated",
        displayName: "Regulated",
        readinessStatus: "governance_ready",
        targetClaimLevel: "designed",
        owner: "regulated-governance-owner",
        canonicalFamilies: ["legal", "finance", "healthcare", "security"],
        canonicalDivisions: ["legal", "finance-accounting", "healthcare", "security"],
        benchmarkRefs: ["nist-genai-profile", "owasp-ai-agent", "csa-agentic-rmf"],
        minimumEvidenceRef: "regulated-core",
        notes: "lead through HITL and audit, not autonomy",
        benchmarks: [
          { benchmarkId: "nist-genai-profile", label: "NIST AI RMF GenAI Profile", url: "https://www.nist.gov/", purpose: "control mapping" },
        ],
        internalMappings: [
          { metricId: "hitl_coverage", description: "high-impact actions remain human gated" },
        ],
        mvpThresholds: [
          { label: "High-impact action HITL coverage", requirement: "100%" },
        ],
        leadershipThresholds: [
          { label: "Audit export completeness", requirement: ">=99.9%" },
        ],
      },
    ],
    claims: [
      {
        claimId: "engineering-coding-local-leader-v3-2",
        familyId: "engineering",
        divisionId: "coding",
        scenarioId: "issue-to-patch",
        claimLevel: "local_leader",
        claimText: "coding division 在内部 issue-to-patch pilot 中达到局部领先。",
        allowedSurfaces: ["docs", "ui"],
        evidenceRefs: ["eval://divisions/coding/swe-style/report-2026-05-01"],
        reviewedBy: ["engineering-platform-owner"],
        expiresAt: "2026-08-01T00:00:00.000Z",
        status: "approved",
        effectiveStatus: "approved",
        effectiveStatusReasonCode: null,
        revokedBy: null,
        revokedAt: null,
        replacementRequired: false,
      },
    ],
    allowlist: [
      {
        filePath: "docs_zh/reference/automatic_agent_platform_v3_2_final_release.md",
        matchedText: "industry-leading",
        reason: "governance_rule_definition",
        owner: "platform-governance-owner",
        expiresAt: "2027-12-31T00:00:00.000Z",
        expired: false,
      },
    ],
    scannerHits: [
      {
        filePath: "docs_zh/reference/automatic_agent_platform_v3_2_final_release.md",
        matchedText: "industry-leading",
        lineNumber: 8,
        excerpt: "claim wording is allowlisted only for governance definition",
        surface: "docs",
        status: "allowlisted",
        claimId: null,
        reason: "governance_rule_definition",
      },
    ],
    scannerGeneratedAt: "2026-05-31T00:00:00.000Z",
    reviewRequests: [
      {
        requestId: "review-1",
        familyId: "engineering",
        divisionId: "coding",
        scenarioId: "issue-to-patch",
        requestedClaimLevel: "local_leader",
        requestedSurfaces: ["docs", "ui"],
        requestedBy: "release-owner",
        rationale: "evidence package is complete",
        requestedAt: "2026-05-30T16:00:00.000Z",
        status: "pending",
        reviewedBy: null,
        reviewedAt: null,
        decisionReasonCode: null,
        decisionComment: null,
      },
    ],
    noGoActions: [
      {
        familyId: null,
        id: "no-auto-payment",
        description: "禁止自动付款、转账、退款、财务结算。",
        riskClass: "R5",
        scopes: ["finance", "commerce", "regulated"],
        enforcementSurfaces: ["ToolRisk", "ReleaseGate", "ClaimScanner"],
        blockModes: ["autonomous_execution"],
      },
    ],
    summary: {
      familyCount: 2,
      approvedClaimCount: 1,
      expiringClaimCount: 1,
      pendingReviewRequestCount: 1,
      blockedScannerHitCount: 0,
      expiredAllowlistCount: 0,
      revokedClaimCount: 0,
      expiredClaimCount: 0,
    },
  },
};
