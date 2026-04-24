import assert from "node:assert/strict";
import test from "node:test";

import type { InjectResponse } from "../../../../../src/platform/interface/api/http-api-server.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { createSeededApiContext } from "../../../../helpers/api.js";

interface Envelope<T> {
  requestId: string;
  data: T;
}

function readJson<T>(response: InjectResponse): Envelope<T> {
  return response.json<Envelope<T>>();
}

// TODO: fix - Test assertion at line 216 fails: pluginsPayload.data.plugins does not contain
// "plugin.coding.retriever" OR runtimeSandboxRoot is not present in the first plugin item.
// This could be due to incomplete seeded data or endpoint returning different plugin set.
// Need to verify the seeded API context creates the expected plugins and the /v1/plugins
// endpoint returns them correctly.
test("http api server serves mission control snapshot, task inspect, approval queue, and decision writeback", async () => {
  const workspace = createTempWorkspace("aa-http-api-");
  const context = createSeededApiContext(workspace);
  const server = context.createServer();

  // Get access token for authenticated requests
  const tokenResponse = await server.inject({
    url: "/v1/auth/token",
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ apiKey: "test-api-key" }),
  });
  const tokenData = readJson<{ accessToken: string }>(tokenResponse);
  const accessToken = tokenData.data.accessToken;

  try {
    const health = await server.inject({ url: "/healthz" });
    assert.equal(health.statusCode, 200);
    assert.equal(health.headers["x-frame-options"], "DENY");
    assert.equal(health.headers["x-content-type-options"], "nosniff");
    const healthPayload = readJson<{ status: string }>(health);
    assert.equal(healthPayload.data.status, "ok");

    const metrics = await server.inject({ url: "/metrics" });
    assert.equal(metrics.statusCode, 200);
    const metricsText = metrics.text();
    assert.match(metricsText, /# HELP http_requests_total/);
    assert.match(metricsText, /http_requests_total\{method="GET",path="\/healthz",status="200"\} 1/);
    assert.match(metricsText, /process_uptime_seconds/);

    const prometheus = await server.inject({ url: "/prometheus" });
    assert.equal(prometheus.statusCode, 200);
    assert.match(prometheus.text(), /process_uptime_seconds/);

    const preflight = await server.inject({
      url: "/v1/tasks",
      method: "OPTIONS",
      headers: {
        origin: "https://console.example.test",
        "access-control-request-method": "GET",
      },
    });
    assert.equal(preflight.statusCode, 204);
    assert.equal(preflight.headers["access-control-allow-origin"], "https://console.example.test");

    const snapshot = await server.inject({
      url: "/v1/dashboard/snapshot",
      headers: { authorization: `Bearer ${accessToken}` },
    });
    assert.equal(snapshot.statusCode, 200);
    const snapshotPayload = readJson<{
      taskBoard: Array<unknown>;
      gatewayTargets: Array<unknown>;
      productSignals: { billingAccounts: Array<unknown> };
    }>(
      snapshot,
    );
    assert.ok(snapshotPayload.data.taskBoard.length >= 1);
    assert.equal(snapshotPayload.data.productSignals.billingAccounts.length, 1);
    assert.ok(snapshotPayload.data.gatewayTargets.length >= 1);

    const targets = await server.inject({
      url: "/v1/gateway/targets?channel=telegram",
      headers: { authorization: `Bearer ${accessToken}` },
    });
    assert.equal(targets.statusCode, 200);
    const targetsPayload = readJson<{ targets: Array<{ targetId: string; displayName: string }> }>(targets);
    assert.ok(targetsPayload.data.targets.some((item) => item.displayName === "Finance Team"));

    const invoice = context.billingService.createInvoice({
      accountId: "acct-pro-1",
      createdAt: "2026-04-10T00:00:00.000Z",
    });
    const checkout = await context.billingService.createCheckoutSession({
      invoiceId: invoice.invoiceId,
      createdAt: "2026-04-10T00:05:00.000Z",
    });
    const billingWebhook = await server.inject({
      url: "/v1/billing/webhooks/reconcile",
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        gatewayKind: checkout.gatewayKind,
        gatewaySessionRef: checkout.gatewaySessionRef,
        status: "paid",
        occurredAt: "2026-04-10T00:10:00.000Z",
      }),
    });
    assert.equal(billingWebhook.statusCode, 200);
    const billingWebhookPayload = readJson<{
      session: { status: string };
      invoice: { status: string };
    }>(billingWebhook);
    assert.equal(billingWebhookPayload.data.session.status, "paid");
    assert.equal(billingWebhookPayload.data.invoice.status, "paid");

    const resolved = await server.inject({
      url: "/v1/gateway/targets/resolve?channel=telegram&query=finance",
      headers: { authorization: `Bearer ${accessToken}` },
    });
    assert.equal(resolved.statusCode, 200);
    const resolvedPayload = readJson<{ entry: { displayName: string }; matchedBy: string }>(resolved);
    assert.equal(resolvedPayload.data.entry.displayName, "Finance Team");
    assert.equal(resolvedPayload.data.matchedBy, "alias_exact");

    const tasks = await server.inject({
      url: "/v1/tasks?limit=5",
      headers: { authorization: `Bearer ${accessToken}` },
    });
    assert.equal(tasks.statusCode, 200);
    const taskPayload = readJson<{ tasks: Array<{ taskId: string }> }>(tasks);
    assert.ok(taskPayload.data.tasks.some((item) => item.taskId === context.seededTaskId));

    const workflows = await server.inject({
      url: "/v1/workflows?limit=5",
      headers: { authorization: `Bearer ${accessToken}` },
    });
    assert.equal(workflows.statusCode, 200);
    const workflowPayload = readJson<{ workflows: Array<{ taskId: string; workflowId: string }> }>(workflows);
    assert.ok(workflowPayload.data.workflows.some((item) => item.taskId === context.seededTaskId));

    const knowledgeNamespaces = await server.inject({
      url: "/v1/knowledge/namespaces",
      headers: { authorization: `Bearer ${accessToken}` },
    });
    assert.equal(knowledgeNamespaces.statusCode, 200);
    const knowledgeNamespacesPayload = readJson<{ namespaces: Array<{ path: string }> }>(knowledgeNamespaces);
    assert.ok(knowledgeNamespacesPayload.data.namespaces.some((item) => item.path === "coding.repo"));

    const knowledgeQuery = await server.inject({
      url: "/v1/knowledge/query?q=retry&domainId=coding&namespace=coding.repo",
      headers: { authorization: `Bearer ${accessToken}` },
    });
    assert.equal(knowledgeQuery.statusCode, 200);
    const knowledgeQueryPayload = readJson<{ hits: Array<{ knowledgeRef: string }> }>(knowledgeQuery);
    assert.ok(knowledgeQueryPayload.data.hits.some((item) => item.knowledgeRef.startsWith("knowledge:")));

    const knowledgeGraph = await server.inject({
      url: `/v1/knowledge/graph?knowledgeRef=${encodeURIComponent(knowledgeQueryPayload.data.hits[0]!.knowledgeRef)}`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    assert.equal(knowledgeGraph.statusCode, 200);
    const knowledgeGraphPayload = readJson<{ nodes: Array<{ nodeType: string }>; edges: Array<{ relation: string }> }>(knowledgeGraph);
    assert.ok(knowledgeGraphPayload.data.nodes.some((item) => item.nodeType === "chunk"));
    assert.ok(knowledgeGraphPayload.data.edges.length >= 1);

    const semanticInspect = await server.inject({
      url: "/v1/knowledge/semantic/inspect",
      headers: { authorization: `Bearer ${accessToken}` },
    });
    assert.equal(semanticInspect.statusCode, 200);
    const semanticInspectPayload = readJson<{ backend: string; ready: boolean; details: Record<string, unknown> }>(semanticInspect);
    assert.equal(semanticInspectPayload.data.backend, "local_hash");
    assert.equal(semanticInspectPayload.data.ready, true);

    const knowledgeInspect = await server.inject({
      url: "/v1/knowledge/coding.repo/inspect",
      headers: { authorization: `Bearer ${accessToken}` },
    });
    assert.equal(knowledgeInspect.statusCode, 200);
    const knowledgeInspectPayload = readJson<{ namespace: string; documentCount: number }>(knowledgeInspect);
    assert.equal(knowledgeInspectPayload.data.namespace, "coding.repo");
    assert.ok(knowledgeInspectPayload.data.documentCount >= 1);

    const domains = await server.inject({
      url: "/v1/domains",
      headers: { authorization: `Bearer ${accessToken}` },
    });
    assert.equal(domains.statusCode, 200);
    const domainsPayload = readJson<{ domains: Array<{ domainId: string }> }>(domains);
    assert.ok(domainsPayload.data.domains.some((item) => item.domainId === "coding"));

    const domainDetail = await server.inject({
      url: "/v1/domains/coding",
      headers: { authorization: `Bearer ${accessToken}` },
    });
    assert.equal(domainDetail.statusCode, 200);
    const domainDetailPayload = readJson<{ domain: { domainId: string } | null; capabilityEntry: { pluginIds: string[] } | null }>(domainDetail);
    assert.equal(domainDetailPayload.data.domain?.domainId, "coding");
    assert.ok(domainDetailPayload.data.capabilityEntry?.pluginIds.includes("plugin.coding.presenter"));

    const domainPlugins = await server.inject({
      url: "/v1/domains/coding/plugins",
      headers: { authorization: `Bearer ${accessToken}` },
    });
    assert.equal(domainPlugins.statusCode, 200);
    const domainPluginsPayload = readJson<{ bindings: Array<{ pluginId: string }>; plugins: Array<{ manifest: { pluginId: string } }> }>(domainPlugins);
    assert.ok(domainPluginsPayload.data.bindings.some((item) => item.pluginId === "plugin.coding.retriever"));
    assert.ok(domainPluginsPayload.data.plugins.some((item) => item.manifest.pluginId === "plugin.coding.presenter"));

    const plugins = await server.inject({
      url: "/v1/plugins",
      headers: { authorization: `Bearer ${accessToken}` },
    });
    assert.equal(plugins.statusCode, 200);
    const pluginsPayload = readJson<{ plugins: Array<{ manifest: { pluginId: string }; runtimeSandboxRoot: string | null }> }>(plugins);
    assert.ok(pluginsPayload.data.plugins.some((item) => item.manifest.pluginId === "plugin.coding.retriever"));
    assert.ok("runtimeSandboxRoot" in pluginsPayload.data.plugins[0]!);

    const artifactPreview = await server.inject({
      url: "/v1/artifacts/bundles/preview",
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        taskId: context.seededTaskId,
        domainId: "coding",
        bundleType: "release_bundle",
        artifacts: [
          {
            artifactId: "artifact_1",
            taskId: context.seededTaskId,
            stepId: "respond",
            agentRole: "builder",
            type: "source_code",
            path: "src/index.ts",
            contentHash: "hash",
            version: 1,
            parentArtifactId: null,
            size: 128,
            createdAt: new Date().toISOString(),
            status: "draft",
          },
        ],
      }),
    });
    assert.equal(artifactPreview.statusCode, 200);
    const artifactPreviewPayload = readJson<{ bundle: { bundleId: string; publishStatus: string }; governance: { allowed: boolean } }>(artifactPreview);
    assert.equal(artifactPreviewPayload.data.bundle.publishStatus, "draft");
    assert.equal(artifactPreviewPayload.data.governance.allowed, true);

    const artifactPublish = await server.inject({
      url: "/v1/artifacts/bundles/publish",
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        bundle: artifactPreviewPayload.data.bundle,
      }),
    });
    assert.equal(artifactPublish.statusCode, 200);
    const artifactPublishPayload = readJson<{ bundle: { publishStatus: string } }>(artifactPublish);
    assert.equal(artifactPublishPayload.data.bundle.publishStatus, "published");

    const artifactPublishes = await server.inject({
      url: "/v1/artifacts/publishes",
      headers: { authorization: `Bearer ${accessToken}` },
    });
    assert.equal(artifactPublishes.statusCode, 200);
    const artifactPublishesPayload = readJson<{ publishes: Array<{ bundleId: string; publishStatus: string }> }>(artifactPublishes);
    assert.ok(artifactPublishesPayload.data.publishes.some((item) => item.bundleId === artifactPreviewPayload.data.bundle.bundleId));
    assert.ok(artifactPublishesPayload.data.publishes.some((item) => item.publishStatus === "published"));

    const inspect = await server.inject({
      url: `/v1/tasks/${context.seededTaskId}/inspect`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    assert.equal(inspect.statusCode, 200);
    const inspectPayload = readJson<{ task: { id: string } }>(inspect);
    assert.equal(inspectPayload.data.task.id, context.seededTaskId);

    const workflowInspect = await server.inject({
      url: `/v1/workflows/${context.seededTaskId}`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    assert.equal(workflowInspect.statusCode, 200);
    const workflowInspectPayload = readJson<{ summary: { taskId: string }; timeline: { entries: Array<unknown> } }>(
      workflowInspect,
    );
    assert.equal(workflowInspectPayload.data.summary.taskId, context.seededTaskId);
    assert.ok(workflowInspectPayload.data.timeline.entries.length >= 1);

    const approvals = await server.inject({
      url: "/v1/approvals?status=requested",
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    });
    assert.equal(approvals.statusCode, 200);
    const approvalsPayload = readJson<{ approvals: Array<{ decisionId: string }> }>(approvals);
    assert.ok(approvalsPayload.data.approvals.some((item) => item.decisionId === context.approvalId));

    const decision = await server.inject({
      method: "POST",
      url: `/v1/approvals/${context.approvalId}/decision`,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        decisionType: "option_selected",
        selectedOptionId: "approve",
      }),
    });
    assert.equal(decision.statusCode, 200);
    const decisionPayload = readJson<{ approval: { id: string; status: string } }>(decision);
    assert.equal(decisionPayload.data.approval.id, context.approvalId);
    assert.equal(decisionPayload.data.approval.status, "approved");

    const stability = await server.inject({
      url: "/v1/stability",
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    });
    assert.equal(stability.statusCode, 200);
    const stabilityPayload = readJson<{
      health: { status: string };
      workers: Array<{ workerId: string }>;
      pendingApprovals: Array<unknown>;
    }>(stability);
    assert.equal(stabilityPayload.data.health.status, "ok");
    assert.ok(stabilityPayload.data.workers.some((worker) => worker.workerId === context.seededWorkerId));
    assert.equal(stabilityPayload.data.pendingApprovals.length, 0);

    const admin = await server.inject({
      url: `/v1/admin/tasks/${context.seededTaskId}`,
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    });
    assert.equal(admin.statusCode, 200);
    const adminPayload = readJson<{
      scope: { taskId: string };
      activeWorker: { workerId: string } | null;
      inspect: { takeoverSessions: Array<{ id: string }> };
    }>(admin);
    assert.equal(adminPayload.data.scope.taskId, context.seededTaskId);
    assert.equal(adminPayload.data.activeWorker?.workerId, context.seededWorkerId);
    assert.ok(adminPayload.data.inspect.takeoverSessions.some((session) => session.id === context.takeoverSessionId));

    const consolePage = await server.inject({
      url: "/console",
      headers: { authorization: `Bearer ${accessToken}` },
    });
    assert.equal(consolePage.statusCode, 200);
    const consoleHtml = consolePage.text();
    assert.match(consoleHtml, /Mission Control/);
    assert.match(consoleHtml, /Approval Center/);
    assert.match(consoleHtml, /Gateway Targets/);
    assert.match(consoleHtml, /Workflow Cockpit/);
    assert.match(consoleHtml, /Stability Panel/);
    assert.match(consoleHtml, /Admin Takeover Console/);

    const workflowConsole = await server.inject({
      url: "/console/workflows",
      headers: { authorization: `Bearer ${accessToken}` },
    });
    assert.equal(workflowConsole.statusCode, 200);
    const workflowConsoleHtml = workflowConsole.text();
    assert.match(workflowConsoleHtml, /Workflow Cockpit/);
    assert.match(workflowConsoleHtml, /single_agent_minimal/);

    const workflowDetailConsole = await server.inject({
      url: `/console/workflows/${context.seededTaskId}`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    assert.equal(workflowDetailConsole.statusCode, 200);
    const workflowDetailHtml = workflowDetailConsole.text();
    assert.match(workflowDetailHtml, /Recovery Recommendation/);
    assert.match(workflowDetailHtml, /Timeline/);

    const stabilityConsole = await server.inject({
      url: "/console/stability",
      headers: { authorization: `Bearer ${accessToken}` },
    });
    assert.equal(stabilityConsole.statusCode, 200);
    const stabilityConsoleHtml = stabilityConsole.text();
    assert.match(stabilityConsoleHtml, /Stability Panel/);
    assert.match(stabilityConsoleHtml, /Worker Count/);

    const adminConsole = await server.inject({
      url: `/console/admin/tasks/${context.seededTaskId}`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    assert.equal(adminConsole.statusCode, 200);
    const adminConsoleHtml = adminConsole.text();
    assert.match(adminConsoleHtml, /Admin Takeover Console/);
    assert.match(adminConsoleHtml, /Takeover Sessions/);
    assert.match(adminConsoleHtml, /worker-api-1/);

    const targetConsole = await server.inject({
      url: "/console/targets",
      headers: { authorization: `Bearer ${accessToken}` },
    });
    assert.equal(targetConsole.statusCode, 200);
    const targetConsoleHtml = targetConsole.text();
    assert.match(targetConsoleHtml, /Finance Team/);
  } finally {
    context.db.close();
    cleanupPath(workspace);
  }
});
