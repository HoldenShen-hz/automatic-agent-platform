import assert from "node:assert/strict";
import test from "node:test";

import type {
  EnvironmentReadinessRecord,
  EnterpriseCapabilityReportRecord,
  IncidentHandoffRecord,
  EnterpriseGovernanceReportRecord,
  ExtensionPackageRecord,
  MarketplaceReviewRecord,
  MarketplacePublicationRecord,
  MarketplaceGovernanceReportRecord,
  PerceptionSourceRecord,
  ActionProposalRecord,
} from "../../../../../../src/platform/contracts/types/domain/ops-types.js";
import type {
  EnvironmentName,
  DeploymentMode,
  EnvironmentReadinessComponentType,
  ExtensionPackageType,
  ExtensionTrustLevel,
  ExtensionLifecycleState,
  MarketplaceReviewStatus,
  MarketplacePublicationStatus,
  ActionProposalStatus,
  PerceptionSourceType,
} from "../../../../../../src/platform/contracts/types/domain/primitives.js";

test("EnvironmentReadinessRecord structure is correct", () => {
  const record: EnvironmentReadinessRecord = {
    readinessId: "ready_123",
    environment: "prod",
    componentType: "provider",
    componentId: "provider_abc",
    credentialReady: 1,
    secondaryGatesJson: '{"gate1":"passed"}',
    owner: "ops-team",
    lastVerifiedAt: "2026-04-14T00:00:00.000Z",
    isActive: 1,
    notes: null,
  };
  assert.equal(record.readinessId, "ready_123");
  assert.equal(record.environment, "prod");
  assert.equal(record.componentType, "provider");
  assert.equal(record.credentialReady, 1);
  assert.equal(record.isActive, 1);
});

test("EnvironmentReadinessRecord allows credentialNotReady state", () => {
  const record: EnvironmentReadinessRecord = {
    readinessId: "ready_456",
    environment: "staging",
    componentType: "sandbox",
    componentId: "sandbox_def",
    credentialReady: 0,
    secondaryGatesJson: "{}",
    owner: "platform-team",
    lastVerifiedAt: "2026-04-14T00:00:00.000Z",
    isActive: 0,
    notes: "Credentials expired",
  };
  assert.equal(record.credentialReady, 0);
  assert.equal(record.isActive, 0);
  assert.equal(record.notes, "Credentials expired");
});

test("EnvironmentReadinessComponentType accepts all valid values", () => {
  const types: EnvironmentReadinessComponentType[] = [
    "provider",
    "gateway",
    "sandbox",
    "worker_fleet",
    "artifact_store",
    "notification_channel",
    "external_service",
  ];
  assert.equal(types.length, 7);
});

test("EnterpriseCapabilityReportRecord structure is correct", () => {
  const record: EnterpriseCapabilityReportRecord = {
    reportId: "report_123",
    accountId: "acct_456",
    workspaceId: "ws_789",
    tenantId: "tenant_abc",
    environment: "prod",
    deploymentMode: "cloud_shared",
    summaryJson: '{"status":"healthy"}',
    reportJson: '{"details":"full report"}',
    generatedAt: "2026-04-14T00:00:00.000Z",
  };
  assert.equal(record.reportId, "report_123");
  assert.equal(record.accountId, "acct_456");
  assert.equal(record.deploymentMode, "cloud_shared");
});

test("EnterpriseCapabilityReportRecord allows null tenantId", () => {
  const record: EnterpriseCapabilityReportRecord = {
    reportId: "report_456",
    accountId: null,
    workspaceId: null,
    tenantId: null,
    environment: "dev",
    deploymentMode: "private_cloud",
    summaryJson: "{}",
    reportJson: "{}",
    generatedAt: "2026-04-14T00:00:00.000Z",
  };
  assert.equal(record.accountId, null);
  assert.equal(record.tenantId, null);
});

test("DeploymentMode accepts all valid values", () => {
  const modes: DeploymentMode[] = ["cloud_shared", "private_cloud", "on_prem"];
  assert.equal(modes.length, 3);
});

test("IncidentHandoffRecord structure is correct", () => {
  const record: IncidentHandoffRecord = {
    handoffId: "handoff_123",
    incidentId: "incident_456",
    environment: "prod",
    status: "ready",
    shiftOwner: "oncall-primary",
    primaryOncall: "alice@example.com",
    secondaryOncall: "bob@example.com",
    severity: "SEV2",
    handoffJson: '{"checklist":["verify system health"]}',
    createdAt: "2026-04-14T00:00:00.000Z",
  };
  assert.equal(record.handoffId, "handoff_123");
  assert.equal(record.status, "ready");
  assert.equal(record.severity, "SEV2");
});

test("IncidentHandoffRecord allows null incidentId and severity", () => {
  const record: IncidentHandoffRecord = {
    handoffId: "handoff_789",
    incidentId: null,
    environment: "staging",
    status: "warning",
    shiftOwner: "oncall-backup",
    primaryOncall: "charlie@example.com",
    secondaryOncall: "diana@example.com",
    severity: null,
    handoffJson: "{}",
    createdAt: "2026-04-14T00:00:00.000Z",
  };
  assert.equal(record.incidentId, null);
  assert.equal(record.severity, null);
  assert.equal(record.status, "warning");
});

test("IncidentHandoffRecord status accepts all valid values", () => {
  const statuses: IncidentHandoffRecord["status"][] = ["ready", "warning", "blocked"];
  assert.equal(statuses.length, 3);
});

test("EnterpriseGovernanceReportRecord structure is correct", () => {
  const record: EnterpriseGovernanceReportRecord = {
    reportId: "gov_report_123",
    taskId: "task_456",
    environment: "prod",
    status: "pass",
    shiftOwner: "security-team",
    summaryJson: '{"overallStatus":"pass"}',
    reportJson: '{"details":"full governance report"}',
    generatedAt: "2026-04-14T00:00:00.000Z",
    handoffId: "handoff_abc",
  };
  assert.equal(record.reportId, "gov_report_123");
  assert.equal(record.status, "pass");
  assert.equal(record.handoffId, "handoff_abc");
});

test("EnterpriseGovernanceReportRecord allows null taskId", () => {
  const record: EnterpriseGovernanceReportRecord = {
    reportId: "gov_report_456",
    taskId: null,
    environment: "test",
    status: "warning",
    shiftOwner: "qa-team",
    summaryJson: "{}",
    reportJson: "{}",
    generatedAt: "2026-04-14T00:00:00.000Z",
    handoffId: "handoff_def",
  };
  assert.equal(record.taskId, null);
  assert.equal(record.status, "warning");
});

test("EnterpriseGovernanceReportRecord status accepts all valid values", () => {
  const statuses: EnterpriseGovernanceReportRecord["status"][] = ["pass", "warning", "fail"];
  assert.equal(statuses.length, 3);
});

test("ExtensionPackageRecord structure is correct", () => {
  const record: ExtensionPackageRecord = {
    packageId: "pkg_123",
    tenantId: "tenant_456",
    extensionId: "ext_789",
    packageType: "tool",
    displayName: "My Tool",
    version: "1.0.0",
    owner: "developer@example.com",
    trustLevel: "verified",
    sourceUri: "https://registry.example.com/pkg_123",
    capabilitiesJson: '{"capabilities":["tool_use"]}',
    permissionsJson: '{"permissions":[]}',
    compatibilityJson: '{"platforms":["node18","node20"]}',
    signatureVerified: 1,
    manifestChecksum: "sha256:abc123",
    lifecycleState: "enabled",
    reviewRequired: 0,
    sbomVerified: 1,
    sandboxCertVerified: 1,
    egressPolicyCompliant: 1,
    createdAt: "2026-04-14T00:00:00.000Z",
    updatedAt: "2026-04-14T00:00:00.000Z",
  };
  assert.equal(record.packageId, "pkg_123");
  assert.equal(record.packageType, "tool");
  assert.equal(record.trustLevel, "verified");
  assert.equal(record.signatureVerified, 1);
});

test("ExtensionPackageRecord allows null tenantId", () => {
  const record: ExtensionPackageRecord = {
    packageId: "pkg_system",
    tenantId: null,
    extensionId: "ext_system",
    packageType: "mcp",
    displayName: "System MCP",
    version: "2.0.0",
    owner: "system",
    trustLevel: "internal",
    sourceUri: "file:./system-mcp",
    capabilitiesJson: "{}",
    permissionsJson: "{}",
    compatibilityJson: "{}",
    signatureVerified: 1,
    manifestChecksum: "sha256:system",
    lifecycleState: "installed",
    reviewRequired: 0,
    sbomVerified: 1,
    sandboxCertVerified: 1,
    egressPolicyCompliant: 1,
    createdAt: "2026-04-14T00:00:00.000Z",
    updatedAt: "2026-04-14T00:00:00.000Z",
  };
  assert.equal(record.tenantId, null);
  assert.equal(record.trustLevel, "internal");
});

test("ExtensionPackageType accepts all valid values", () => {
  const types: ExtensionPackageType[] = ["tool", "skill", "plugin", "mcp", "template"];
  assert.equal(types.length, 5);
});

test("ExtensionTrustLevel accepts all valid values", () => {
  const levels: ExtensionTrustLevel[] = ["internal", "verified", "community", "unknown"];
  assert.equal(levels.length, 4);
});

test("ExtensionLifecycleState accepts all valid values", () => {
  const states: ExtensionLifecycleState[] = [
    "discovered",
    "installed",
    "enabled",
    "disabled",
    "reloaded",
    "removed",
  ];
  assert.equal(states.length, 6);
});

test("MarketplaceReviewRecord structure is correct", () => {
  const record: MarketplaceReviewRecord = {
    reviewId: "review_123",
    tenantId: "tenant_456",
    packageId: "pkg_789",
    status: "submitted",
    submitter: "developer@example.com",
    reviewer: null,
    decisionReasonCode: null,
    findingsJson: "{}",
    permissionSurfaceHash: "hash_abc",
    submittedAt: "2026-04-14T00:00:00.000Z",
    decidedAt: null,
  };
  assert.equal(record.reviewId, "review_123");
  assert.equal(record.status, "submitted");
  assert.equal(record.reviewer, null);
});

test("MarketplaceReviewRecord allows approved state with reviewer", () => {
  const record: MarketplaceReviewRecord = {
    reviewId: "review_456",
    tenantId: "tenant_abc",
    packageId: "pkg_def",
    status: "approved",
    submitter: "developer@example.com",
    reviewer: "reviewer@example.com",
    decisionReasonCode: "security_approved",
    findingsJson: '{"findings":[]}',
    permissionSurfaceHash: "hash_def",
    submittedAt: "2026-04-14T00:00:00.000Z",
    decidedAt: "2026-04-14T01:00:00.000Z",
  };
  assert.equal(record.status, "approved");
  assert.equal(record.reviewer, "reviewer@example.com");
  assert.ok(record.decidedAt !== null);
});

test("MarketplaceReviewStatus accepts all valid values", () => {
  const statuses: MarketplaceReviewStatus[] = ["submitted", "approved", "rejected"];
  assert.equal(statuses.length, 3);
});

test("MarketplacePublicationRecord structure is correct", () => {
  const record: MarketplacePublicationRecord = {
    publicationId: "pub_123",
    tenantId: "tenant_456",
    packageId: "pkg_789",
    reviewId: "review_abc",
    channel: "stable",
    status: "published",
    compatibilityMatrixJson: '{"matrix":"data"}',
    revocationReasonCode: null,
    publishedAt: "2026-04-14T00:00:00.000Z",
    updatedAt: "2026-04-14T00:00:00.000Z",
  };
  assert.equal(record.publicationId, "pub_123");
  assert.equal(record.status, "published");
  assert.equal(record.channel, "stable");
});

test("MarketplacePublicationRecord allows revoked state", () => {
  const record: MarketplacePublicationRecord = {
    publicationId: "pub_456",
    tenantId: "tenant_def",
    packageId: "pkg_ghi",
    reviewId: "review_def",
    channel: "beta",
    status: "revoked",
    compatibilityMatrixJson: "{}",
    revocationReasonCode: "security_concern",
    publishedAt: "2026-04-14T00:00:00.000Z",
    updatedAt: "2026-04-14T02:00:00.000Z",
  };
  assert.equal(record.status, "revoked");
  assert.equal(record.revocationReasonCode, "security_concern");
});

test("MarketplacePublicationStatus accepts all valid values", () => {
  const statuses: MarketplacePublicationStatus[] = ["published", "revoked"];
  assert.equal(statuses.length, 2);
});

test("MarketplaceGovernanceReportRecord structure is correct", () => {
  const record: MarketplaceGovernanceReportRecord = {
    reportId: "gov_pub_123",
    tenantId: "tenant_456",
    summaryJson: '{"totalPackages":10,"approved":8}',
    reportJson: '{"details":"marketplace governance report"}',
    generatedAt: "2026-04-14T00:00:00.000Z",
  };
  assert.equal(record.reportId, "gov_pub_123");
  assert.equal(record.tenantId, "tenant_456");
});

test("MarketplaceGovernanceReportRecord allows null tenantId", () => {
  const record: MarketplaceGovernanceReportRecord = {
    reportId: "gov_pub_789",
    tenantId: null,
    summaryJson: "{}",
    reportJson: "{}",
    generatedAt: "2026-04-14T00:00:00.000Z",
  };
  assert.equal(record.tenantId, null);
});

test("PerceptionSourceRecord structure is correct", () => {
  const record: PerceptionSourceRecord = {
    sourceId: "source_123",
    tenantId: "tenant_456",
    type: "rss",
    name: "Tech News RSS",
    enabled: 1,
    scheduleJson: '{"interval":"1h"}',
    filtersJson: '{"keywords":["AI","ML"]}',
    priority: 10,
    createdAt: "2026-04-14T00:00:00.000Z",
    updatedAt: "2026-04-14T00:00:00.000Z",
  };
  assert.equal(record.sourceId, "source_123");
  assert.equal(record.type, "rss");
  assert.equal(record.enabled, 1);
  assert.equal(record.priority, 10);
});

test("PerceptionSourceRecord allows disabled state and null scheduleJson", () => {
  const record: PerceptionSourceRecord = {
    sourceId: "source_789",
    tenantId: "tenant_abc",
    type: "web",
    name: "Web Scraper",
    enabled: 0,
    scheduleJson: null,
    filtersJson: null,
    priority: 5,
    createdAt: "2026-04-14T00:00:00.000Z",
    updatedAt: "2026-04-14T00:00:00.000Z",
  };
  assert.equal(record.enabled, 0);
  assert.equal(record.scheduleJson, null);
  assert.equal(record.filtersJson, null);
});

test("PerceptionSourceType accepts all valid values", () => {
  const types: PerceptionSourceType[] = ["rss", "web", "github", "api", "custom"];
  assert.equal(types.length, 5);
});

test("ActionProposalRecord structure is correct", () => {
  const record: ActionProposalRecord = {
    proposalId: "proposal_123",
    tenantId: "tenant_456",
    briefId: "brief_789",
    intelId: "intel_abc",
    taskId: "task_def",
    title: "Scale up workers",
    summary: "Increase worker count due to high load",
    actionType: "scale_workers",
    status: "proposed",
    requiresApproval: 1,
    proposalJson: '{"action":"scale","count":5}',
    createdAt: "2026-04-14T00:00:00.000Z",
    decidedAt: null,
  };
  assert.equal(record.proposalId, "proposal_123");
  assert.equal(record.status, "proposed");
  assert.equal(record.requiresApproval, 1);
});

test("ActionProposalRecord allows null intelId and taskId", () => {
  const record: ActionProposalRecord = {
    proposalId: "proposal_456",
    tenantId: "tenant_def",
    briefId: "brief_ghi",
    intelId: null,
    taskId: null,
    title: "Budget adjustment",
    summary: "Increase task budget",
    actionType: "budget_adjustment",
    status: "approved",
    requiresApproval: 1,
    proposalJson: "{}",
    createdAt: "2026-04-14T00:00:00.000Z",
    decidedAt: null,
  };
  assert.equal(record.intelId, null);
  assert.equal(record.taskId, null);
  assert.equal(record.status, "approved");
});

test("ActionProposalStatus accepts all valid values", () => {
  const statuses: ActionProposalStatus[] = ["proposed", "approved", "rejected", "superseded"];
  assert.equal(statuses.length, 4);
});
