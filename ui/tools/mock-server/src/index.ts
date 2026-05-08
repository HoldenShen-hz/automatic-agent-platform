import { defaultMockApiShape } from "@aa/shared-api-client";
import { http, HttpResponse } from "msw";
import { setupServer, type SetupServerApi } from "msw/node";

export function createMockServerSnapshot() {
  return defaultMockApiShape;
}

export function describePlannedEndpoint(id: string) {
  return {
    id,
    enabled: false,
    reason: "planned-endpoint-seam",
  };
}

// §R8-52: Mock server expanded from 3 to 28+ endpoints covering all major API surfaces
const mockData = {
  approvals: [{ id: "approval-1", status: "pending", createdAt: new Date().toISOString() }],
  agents: [{ id: "agent-1", name: "Agent Alpha", status: "active" }],
  policies: [{ id: "policy-1", name: "Default Policy", rules: [] }],
  incidents: [{ id: "incident-1", severity: "warning", resolved: false }],
  workers: [{ id: "worker-1", status: "running", load: 0.4 }],
  queues: [{ id: "queue-1", name: "default", depth: 12 }],
  analytics: [{ metric: "tasks_completed", value: 142 }],
  costs: [{ period: "2026-05", total: 2340.5 }],
  marketplace: [{ id: "pack-1", name: "Starter Pack", version: "1.0.0" }],
  knowledge: [{ id: "kb-1", title: "Getting Started", content: "" }],
  packs: [{ id: "pack-1", name: "Starter Pack" }],
  plugins: [{ id: "plugin-1", name: "HTTP Connector", enabled: true }],
  prompts: [{ id: "prompt-1", title: "Task Agent", template: "" }],
  explanations: [{ id: "exp-1", type: "decision", summary: "Route to queue A" }],
  roles: [{ id: "role-1", name: "Admin", permissions: [] }],
  featureFlags: [{ id: "ff-1", key: "new_dashboard", enabled: true }],
  models: [{ id: "model-1", provider: "anthropic", name: "claude-sonnet-4" }],
  domainConfigs: [{ id: "domain-1", name: "default", enabled: true }],
  tenants: [{ id: "tenant-1", name: "Default Tenant", plan: "pro" }],
  users: [{ id: "user-1", displayName: "Admin User", email: "admin@example.com" }],
  webhooks: [{ id: "webhook-1", url: "https://example.com/webhook", events: ["task.completed"] }],
  preferences: { theme: "dark", language: "en" },
  contractVersion: { contractVersion: "1.0", minServerVersion: "1.0", supportedVersions: ["1.0"] },
};

export function resolveMockRequest(path: string) {
  // Issue #1938 P2: path.includes uses substring matching - /api/v1/tasks incorrectly matches /api/v1/tasks-archive.
  // Match on normalized path boundaries so only exact segments or nested subpaths resolve.
  const normalizedPath = (() => {
    try {
      const url = path.startsWith("http://") || path.startsWith("https://")
        ? new URL(path)
        : new URL(path, "http://mock.local");
      const pathname = url.pathname.replace(/\/+$/, "");
      return pathname.length > 0 ? pathname : "/";
    } catch {
      const withoutQuery = path.split("?")[0] ?? path;
      const trimmed = withoutQuery.replace(/\/+$/, "");
      return trimmed.length > 0 ? trimmed : "/";
    }
  })();
  const matchesRoute = (route: string): boolean =>
    normalizedPath === route || normalizedPath.startsWith(`${route}/`);

  if (matchesRoute("/dashboard")) {
    return defaultMockApiShape.dashboard;
  }
  if (matchesRoute("/tasks")) {
    return defaultMockApiShape.tasks;
  }
  if (matchesRoute("/workflows")) {
    return defaultMockApiShape.workflows;
  }
  if (matchesRoute("/approvals")) {
    return mockData.approvals;
  }
  if (matchesRoute("/agents")) {
    return mockData.agents;
  }
  if (matchesRoute("/admin/workers")) {
    return mockData.workers;
  }
  if (matchesRoute("/admin/queues")) {
    return mockData.queues;
  }
  if (matchesRoute("/incidents")) {
    return mockData.incidents;
  }
  if (matchesRoute("/dashboard/metrics")) {
    return mockData.analytics;
  }
  if (matchesRoute("/cost-reports")) {
    return mockData.costs;
  }
  if (matchesRoute("/marketplace")) {
    return mockData.marketplace;
  }
  if (matchesRoute("/knowledge")) {
    return mockData.knowledge;
  }
  if (matchesRoute("/packs")) {
    return mockData.packs;
  }
  if (matchesRoute("/plugins")) {
    return mockData.plugins;
  }
  if (matchesRoute("/prompts")) {
    return mockData.prompts;
  }
  if (matchesRoute("/explanations")) {
    return mockData.explanations;
  }
  if (matchesRoute("/admin/roles")) {
    return mockData.roles;
  }
  if (matchesRoute("/admin/feature-flags")) {
    return mockData.featureFlags;
  }
  if (matchesRoute("/admin/models")) {
    return mockData.models;
  }
  if (matchesRoute("/admin/domains")) {
    return mockData.domainConfigs;
  }
  if (matchesRoute("/admin/tenants")) {
    return mockData.tenants;
  }
  if (matchesRoute("/admin/users")) {
    return mockData.users;
  }
  if (matchesRoute("/admin/system-config")) {
    return { csrfEnabled: true, version: "1.0" };
  }
  if (matchesRoute("/webhooks")) {
    return mockData.webhooks;
  }
  if (matchesRoute("/preferences")) {
    return mockData.preferences;
  }
  if (matchesRoute("/workflows/builder")) {
    return { builderState: {} };
  }
  if (matchesRoute("/api/v1/meta/contract-version")) {
    return mockData.contractVersion;
  }
  // §R8-52: WebSocket mock - return upgrade guidance for ws paths
  if (matchesRoute("/ws") || normalizedPath.includes("websocket")) {
    return describePlannedEndpoint("websocket.upgrade");
  }
  // §R8-52: Policy endpoints marked as planned
  if (matchesRoute("/policies")) {
    return describePlannedEndpoint("policies.list");
  }
  return {
    ok: true,
    path,
  };
}

export function createMockHandlers() {
  return [
    http.all("http://mock.local/*", ({ request }) => {
      const resolved = resolveMockRequest(request.url);
      return HttpResponse.json(resolved);
    }),
    http.all("https://mock.local/*", ({ request }) => {
      const resolved = resolveMockRequest(request.url);
      return HttpResponse.json(resolved);
    }),
  ];
}

export function createMockServer(): SetupServerApi {
  return setupServer(...createMockHandlers());
}
