import { defaultMockApiShape } from "@aa/shared-api-client";

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
  // Use proper prefix matching with trailing slash to avoid false positives.
  const normalized = path.endsWith("/") ? path : path + "/";
  if (normalized.includes("/dashboard/")) {
    return defaultMockApiShape.dashboard;
  }
  if (normalized.includes("/tasks/")) {
    return defaultMockApiShape.tasks;
  }
  if (normalized.includes("/workflows/")) {
    return defaultMockApiShape.workflows;
  }
  if (normalized.includes("/approvals")) {
    return mockData.approvals;
  }
  if (normalized.includes("/agents")) {
    return mockData.agents;
  }
  if (normalized.includes("/admin/workers")) {
    return mockData.workers;
  }
  if (normalized.includes("/admin/queues")) {
    return mockData.queues;
  }
  if (normalized.includes("/incidents")) {
    return mockData.incidents;
  }
  if (normalized.includes("/dashboard/metrics")) {
    return mockData.analytics;
  }
  if (normalized.includes("/cost-reports")) {
    return mockData.costs;
  }
  if (normalized.includes("/marketplace")) {
    return mockData.marketplace;
  }
  if (normalized.includes("/knowledge")) {
    return mockData.knowledge;
  }
  if (normalized.includes("/packs")) {
    return mockData.packs;
  }
  if (normalized.includes("/plugins")) {
    return mockData.plugins;
  }
  if (normalized.includes("/prompts")) {
    return mockData.prompts;
  }
  if (normalized.includes("/explanations")) {
    return mockData.explanations;
  }
  if (normalized.includes("/admin/roles")) {
    return mockData.roles;
  }
  if (normalized.includes("/admin/feature-flags")) {
    return mockData.featureFlags;
  }
  if (normalized.includes("/admin/models")) {
    return mockData.models;
  }
  if (normalized.includes("/admin/domains")) {
    return mockData.domainConfigs;
  }
  if (normalized.includes("/admin/tenants")) {
    return mockData.tenants;
  }
  if (normalized.includes("/admin/users")) {
    return mockData.users;
  }
  if (normalized.includes("/admin/system-config")) {
    return { csrfEnabled: true, version: "1.0" };
  }
  if (normalized.includes("/webhooks")) {
    return mockData.webhooks;
  }
  if (normalized.includes("/preferences")) {
    return mockData.preferences;
  }
  if (normalized.includes("/workflows/builder")) {
    return { builderState: {} };
  }
  if (normalized.includes("/api/v1/meta/contract-version")) {
    return mockData.contractVersion;
  }
  // §R8-52: WebSocket mock - return upgrade guidance for ws paths
  if (normalized.includes("/ws") || path.includes("websocket")) {
    return describePlannedEndpoint("websocket.upgrade");
  }
  // §R8-52: Policy endpoints marked as planned
  if (normalized.includes("/policies")) {
    return describePlannedEndpoint("policies.list");
  }
  return {
    ok: true,
    path,
  };
}
