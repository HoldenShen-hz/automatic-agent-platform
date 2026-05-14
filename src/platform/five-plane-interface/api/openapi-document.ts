export interface ApiRouteSpec {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  summary: string;
  tags: string[];
  queryParameters?: readonly {
    name: string;
    schema: { type: string };
    description: string;
  }[];
}

const ROUTES: ApiRouteSpec[] = [
  { method: "GET", path: "/healthz", summary: "Healthz alias-free health check", tags: ["health"] },
  { method: "GET", path: "/health", summary: "Compatibility health alias", tags: ["health"] },
  { method: "GET", path: "/metrics", summary: "Prometheus metrics endpoint", tags: ["meta", "metrics"] },
  { method: "GET", path: "/v1/metrics", summary: "Versioned Prometheus metrics endpoint", tags: ["meta", "metrics"] },
  { method: "GET", path: "/prometheus", summary: "Standalone Prometheus scrape endpoint", tags: ["meta", "metrics"] },
  { method: "GET", path: "/v1/openapi.json", summary: "OpenAPI document", tags: ["meta"] },
  { method: "POST", path: "/v1/auth/token", summary: "Exchange API key for bearer token", tags: ["auth"] },
  { method: "GET", path: "/v1/dashboard/snapshot", summary: "Mission control shared snapshot", tags: ["dashboard"] },
  { method: "POST", path: "/v1/missions", summary: "Create a Mission governance context", tags: ["missions"] },
  { method: "GET", path: "/v1/missions", summary: "List Mission governance contexts for a tenant", tags: ["missions"] },
  { method: "GET", path: "/v1/missions/{missionId}", summary: "Read Mission governance context", tags: ["missions"] },
  { method: "PATCH", path: "/v1/missions/{missionId}", summary: "Patch Mission metadata under If-Match", tags: ["missions"] },
  { method: "POST", path: "/v1/missions/{missionId}:activate", summary: "Activate Mission", tags: ["missions"] },
  { method: "POST", path: "/v1/missions/{missionId}:pause", summary: "Pause Mission", tags: ["missions"] },
  { method: "POST", path: "/v1/missions/{missionId}:resume", summary: "Resume Mission", tags: ["missions"] },
  { method: "POST", path: "/v1/missions/{missionId}:freeze", summary: "Freeze Mission", tags: ["missions"] },
  { method: "POST", path: "/v1/missions/{missionId}:unfreeze", summary: "Unfreeze Mission to paused", tags: ["missions"] },
  { method: "POST", path: "/v1/missions/{missionId}:complete", summary: "Complete Mission", tags: ["missions"] },
  { method: "POST", path: "/v1/missions/{missionId}:archive", summary: "Archive Mission", tags: ["missions"] },
  { method: "GET", path: "/v1/missions/{missionId}/members", summary: "List Mission members", tags: ["missions"] },
  { method: "POST", path: "/v1/missions/{missionId}/members", summary: "Grant Mission membership", tags: ["missions"] },
  { method: "DELETE", path: "/v1/missions/{missionId}/members/{membershipId}", summary: "Revoke Mission membership", tags: ["missions"] },
  { method: "GET", path: "/v1/missions/{missionId}/tasks", summary: "List Mission-bound tasks", tags: ["missions"] },
  { method: "GET", path: "/v1/missions/{missionId}/runs", summary: "List Mission-bound runs", tags: ["missions"] },
  { method: "GET", path: "/v1/missions/{missionId}/evidence", summary: "List Mission evidence records", tags: ["missions"] },
  { method: "GET", path: "/v1/missions/{missionId}/budget", summary: "Read Mission budget envelope summary", tags: ["missions"] },
  { method: "POST", path: "/v1/mission-resolutions:dry-run", summary: "Dry-run Mission resolution for a task", tags: ["missions"] },
  { method: "POST", path: "/v1/yono/markets", summary: "Create YONO prediction market", tags: ["yono"] },
  { method: "GET", path: "/v1/yono/markets", summary: "List YONO prediction markets", tags: ["yono"] },
  { method: "GET", path: "/v1/yono/markets/{marketId}", summary: "Read YONO prediction market", tags: ["yono"] },
  { method: "POST", path: "/v1/yono/markets/{marketId}/review", summary: "Review YONO market", tags: ["yono"] },
  { method: "POST", path: "/v1/yono/markets/{marketId}/open", summary: "Open YONO market", tags: ["yono"] },
  { method: "POST", path: "/v1/yono/markets/{marketId}/pause", summary: "Pause YONO market", tags: ["yono"] },
  { method: "POST", path: "/v1/yono/markets/{marketId}/close", summary: "Close YONO market", tags: ["yono"] },
  { method: "POST", path: "/v1/yono/markets/{marketId}/resolve", summary: "Resolve YONO market", tags: ["yono"] },
  { method: "POST", path: "/v1/yono/markets/{marketId}/comments", summary: "Create YONO market comment", tags: ["yono"] },
  { method: "GET", path: "/v1/yono/markets/{marketId}/comments", summary: "List YONO market comments", tags: ["yono"] },
  { method: "POST", path: "/v1/yono/markets/{marketId}/forecasts", summary: "Submit YONO explicit forecast", tags: ["yono"] },
  { method: "GET", path: "/v1/yono/markets/{marketId}/forecasts", summary: "List YONO forecasts", tags: ["yono"] },
  { method: "GET", path: "/v1/yono/markets/{marketId}/consensus", summary: "Calculate YONO consensus probability", tags: ["yono"] },
  { method: "POST", path: "/v1/yono/orders", summary: "Create YONO points order", tags: ["yono"] },
  { method: "GET", path: "/v1/yono/orders", summary: "List YONO orders", tags: ["yono"] },
  { method: "GET", path: "/v1/yono/positions", summary: "List YONO positions", tags: ["yono"] },
  { method: "GET", path: "/v1/yono/trades", summary: "List YONO trades", tags: ["yono"] },
  { method: "POST", path: "/v1/yono/markets/{marketId}/resolution-draft", summary: "Draft YONO market resolution", tags: ["yono"] },
  { method: "POST", path: "/v1/yono/markets/{marketId}/disputes", summary: "Submit YONO dispute", tags: ["yono"] },
  { method: "GET", path: "/v1/yono/markets/{marketId}/disputes", summary: "List YONO disputes", tags: ["yono"] },
  { method: "GET", path: "/v1/workbench/snapshot", summary: "Platform workbench aggregated snapshot", tags: ["dashboard"] },
  { method: "POST", path: "/v1/webhooks/{endpointId}/receive", summary: "Receive a signed webhook and stage it into outbox", tags: ["webhooks"] },
  { method: "GET", path: "/v1/divisions", summary: "List configured divisions", tags: ["divisions"] },
  { method: "GET", path: "/v1/gateway/targets", summary: "List gateway targets", tags: ["gateway"] },
  { method: "GET", path: "/v1/gateway/targets/resolve", summary: "Resolve human-readable gateway target", tags: ["gateway"] },
  { method: "POST", path: "/v1/gateway/messages/send", summary: "Send gateway message via configured channel adapter", tags: ["gateway"] },
  {
    method: "GET",
    path: "/v1/tasks",
    summary: "List tasks with cursor pagination",
    tags: ["tasks"],
    queryParameters: [
      { name: "limit", schema: { type: "integer" }, description: "Page size capped per route policy." },
      { name: "cursor", schema: { type: "string" }, description: "Opaque cursor returned by the previous page." },
    ],
  },
  { method: "GET", path: "/v1/tasks/{taskId}", summary: "Load task snapshot", tags: ["tasks"] },
  { method: "GET", path: "/v1/tasks/{taskId}/events", summary: "List task events", tags: ["tasks"] },
  { method: "GET", path: "/v1/tasks/{taskId}/inspect", summary: "Inspect task details", tags: ["tasks"] },
  { method: "GET", path: "/v1/knowledge/namespaces", summary: "List knowledge namespaces", tags: ["knowledge"] },
  { method: "GET", path: "/v1/knowledge/query", summary: "Query knowledge plane", tags: ["knowledge"] },
  { method: "GET", path: "/v1/knowledge/graph", summary: "Inspect semantic knowledge graph neighborhood", tags: ["knowledge"] },
  { method: "GET", path: "/v1/knowledge/semantic/inspect", summary: "Inspect semantic retrieval infrastructure", tags: ["knowledge"] },
  { method: "GET", path: "/v1/knowledge/{namespace}/inspect", summary: "Inspect knowledge namespace", tags: ["knowledge"] },
  { method: "GET", path: "/v1/domains", summary: "List registered domains", tags: ["domains"] },
  { method: "GET", path: "/v1/domains/{domainId}", summary: "Load domain definition and capability entry", tags: ["domains"] },
  { method: "GET", path: "/v1/domains/{domainId}/plugins", summary: "List plugins bound to a domain", tags: ["domains", "plugins"] },
  { method: "GET", path: "/v1/plugins", summary: "List plugin registry records", tags: ["plugins"] },
  { method: "GET", path: "/v1/artifacts/publishes", summary: "List artifact publish ledger entries", tags: ["artifacts"] },
  { method: "POST", path: "/v1/artifacts/bundles/preview", summary: "Build artifact bundle preview", tags: ["artifacts"] },
  { method: "POST", path: "/v1/artifacts/bundles/publish", summary: "Publish artifact bundle", tags: ["artifacts"] },
  { method: "GET", path: "/v1/approvals", summary: "List approvals", tags: ["approvals"] },
  {
    method: "GET",
    path: "/v1/workflows",
    summary: "List workflows with cursor pagination",
    tags: ["tasks"],
    queryParameters: [
      { name: "limit", schema: { type: "integer" }, description: "Page size capped per route policy." },
      { name: "cursor", schema: { type: "string" }, description: "Opaque cursor returned by the previous page." },
    ],
  },
  { method: "POST", path: "/v1/approvals/{approvalId}/decision", summary: "Submit approval decision", tags: ["approvals"] },
  { method: "GET", path: "/v1/admin/control-plane/load-balancing", summary: "Get control-plane load balancing summary", tags: ["admin"] },
  { method: "POST", path: "/v1/admin/control-plane/load-balancing/select", summary: "Select coordinator for control-plane request", tags: ["admin"] },
  { method: "GET", path: "/v1/admin/inventories/benchmarks", summary: "List benchmark inventory records", tags: ["admin"] },
  { method: "GET", path: "/v1/admin/inventories/projections", summary: "List projection inventory records", tags: ["admin"] },
  { method: "GET", path: "/v1/admin/inventories/deployments", summary: "List deployment inventory records", tags: ["admin"] },
  { method: "GET", path: "/v1/admin/inventories/schema", summary: "List authoritative schema inventory records", tags: ["admin"] },
  { method: "GET", path: "/v1/admin/judges", summary: "List judge provider descriptors", tags: ["admin"] },
  { method: "GET", path: "/v1/admin/compliance/program-templates", summary: "List compliance program templates", tags: ["admin"] },
];

export function buildOpenApiDocument() {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const route of ROUTES) {
    const existing = paths[route.path] ?? {};
    existing[route.method.toLowerCase()] = {
      summary: route.summary,
      tags: route.tags,
      parameters: route.queryParameters?.map((parameter) => ({
        name: parameter.name,
        in: "query",
        required: false,
        description: parameter.description,
        schema: parameter.schema,
      })) ?? [],
      responses: {
        200: {
          description: "Successful response",
          content: {
            "application/json": {
              schema: {
                type: "object",
              },
            },
          },
        },
      },
    };
    paths[route.path] = existing;
  }

  return {
    openapi: "3.1.0",
    info: {
      title: "Automatic Agent API",
      version: "0.1.0",
    },
    paths,
  };
}

export function listApiRoutes(): ApiRouteSpec[] {
  return ROUTES.filter((route) => route.method === "GET" || route.method === "POST");
}
