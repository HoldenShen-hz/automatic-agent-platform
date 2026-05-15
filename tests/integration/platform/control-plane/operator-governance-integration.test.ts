import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";

import { PolicyCenterService } from "../../../../src/platform/five-plane-control-plane/policy-center/index.js";
import { TenantBoundaryRegistryService } from "../../../../src/platform/five-plane-control-plane/tenant/index.js";
import { OperatorConsoleBackendService } from "../../../../src/platform/five-plane-interface/console-backend/index.js";
import { WebhookIngressService } from "../../../../src/platform/five-plane-interface/webhook/index.js";

test("integration: webhook intake, tenant boundary, console planning, and policy escalation align on a high-risk org flow", () => {
  const tenantRegistry = new TenantBoundaryRegistryService({
    users: [
      { userId: "op-1", displayName: "Operator", status: "active", identityProvider: "oidc" },
    ],
    organizations: [
      {
        organizationId: "org-1",
        displayName: "Org One",
        billingAccountId: null,
        defaultTenantId: "tenant-1",
        createdAt: "2026-04-20T00:00:00.000Z",
        updatedAt: "2026-04-20T00:00:00.000Z",
      },
    ],
    workspaces: [
      {
        workspaceId: "workspace-1",
        ownerId: "op-1",
        displayName: "Workspace One",
        planId: "enterprise",
        defaultPolicySet: "strict",
        organizationId: "org-1",
        createdAt: "2026-04-20T00:00:00.000Z",
        updatedAt: "2026-04-20T00:00:00.000Z",
      },
    ],
    tenants: [
      {
        tenantId: "tenant-1",
        organizationId: "org-1",
        storageScope: "storage-1",
        identityScope: "identity-1",
        policyScope: "policy-1",
        artifactScope: "artifact-1",
        isolationMode: "dedicated_runtime",
        deploymentMode: "private_cloud",
        createdAt: "2026-04-20T00:00:00.000Z",
        updatedAt: "2026-04-20T00:00:00.000Z",
      },
    ],
    workspaceMemberships: [
      {
        workspaceId: "workspace-1",
        userId: "op-1",
        role: "owner",
        joinedAt: "2026-04-20T00:00:00.000Z",
      },
    ],
  });

  const webhook = new WebhookIngressService();
  webhook.registerEndpoint({
    endpointId: "admin-console",
    source: "console",
    tenantId: "tenant-1",
    workspaceId: "workspace-1",
    enabled: true,
    allowedEventTypes: ["org.change.requested"],
    algorithm: "sha256_hmac",
    signingSecret: "console-secret",
    dispatchTargetRef: "approval-center",
  });
  const body = JSON.stringify({
    eventType: "org.change.requested",
    eventId: "evt-1",
    targetTenantId: "tenant-1",
  });
  const signature = createHmac("sha256", "console-secret").update(body).digest("hex");
  const envelope = webhook.receive({
    endpointId: "admin-console",
    headers: {
      "x-aa-signature": `sha256=${signature}`,
    },
    body,
  });

  const tenantDecision = tenantRegistry.authorizeTenantAccess({
    userId: "op-1",
    tenantId: "tenant-1",
    workspaceId: "workspace-1",
  });

  const consoleBackend = new OperatorConsoleBackendService({
    listPendingApprovals: () => [
      {
        approvalId: envelope.envelopeId,
        taskId: "task-1",
        tenantId: envelope.tenantId,
        riskLevel: "critical",
        reason: envelope.eventType,
        createdAt: envelope.acceptedAt,
      },
    ],
    listTasks: () => [
      {
        taskId: "task-1",
        tenantId: "tenant-1",
        workspaceId: "workspace-1",
        status: "blocked",
        riskLevel: "critical",
        updatedAt: envelope.acceptedAt,
      },
    ],
    listWorkers: () => [
      { workerId: "worker-1", status: "online", activeExecutionCount: 1, queueDepth: 0 },
    ],
    listIncidents: () => [
      {
        incidentId: "incident-1",
        taskId: "task-1",
        tenantId: "tenant-1",
        severity: "critical",
        summary: "org change waiting for approval",
        createdAt: envelope.acceptedAt,
      },
    ],
    listTenants: () => [
      { tenantId: "tenant-1", organizationId: "org-1", isolationMode: "dedicated_runtime" },
    ],
  });
  const actionPlan = consoleBackend.planHumanTakeoverAction({
    actionId: "opact-1",
    actionType: "finish_task",
    taskId: "task-1",
    tenantId: "tenant-1",
    workspaceId: "workspace-1",
    operator: {
      operatorId: "op-1",
      roles: ["operator"],
      tenantId: "tenant-1",
    },
    reasonCode: "org_change.manual_gate",
  });
  const policy = new PolicyCenterService({
    subjectRoles: { "op-1": ["operator"] },
    allowedActionsByRole: { operator: ["org_change"] },
  });
  const policyDecision = policy.evaluate({
    decisionId: "decision-1",
    taskId: "task-1",
    subjectType: "user",
    subjectId: "op-1",
    action: "org_change",
    resourceRef: "tenant:tenant-1",
    riskCategory: "org_changing",
    mode: "auto",
    stage: "release",
  });
  const snapshot = consoleBackend.buildSnapshot({
    operatorId: "op-1",
    roles: ["operator"],
    tenantId: "tenant-1",
  });

  assert.equal(envelope.signatureVerified, true);
  assert.equal(tenantDecision.decision, "allow");
  assert.equal(actionPlan.requiresPolicyEvaluation, true);
  assert.equal(policyDecision.decision, "escalate_for_approval");
  assert.ok(snapshot.findings.includes("critical approval waiting for operator decision"));
});
