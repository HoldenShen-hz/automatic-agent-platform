import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import {
  DefaultRESTClient,
  InMemoryWSClient,
  MockTransport,
  WSEventRouter,
  createTraceInterceptor,
  endpointCatalog,
  fetchAgents,
  fetchDashboardSnapshot,
  fetchTasks,
  fetchWorkflows,
  mapEventToQuery,
} from "@aa/shared-api-client";

describe("shared api-client", () => {
  it("fetches dashboard and tasks through the mock REST client", async () => {
    const client = new DefaultRESTClient((request) => new MockTransport().send(request));

    const dashboard = await fetchDashboardSnapshot(client);
    const tasks = await fetchTasks(client);
    const workflows = await fetchWorkflows(client);
    const agents = await fetchAgents(client);

    expect(dashboard.overallHealth).toBe("healthy");
    expect(tasks.length).toBeGreaterThan(0);
    expect(workflows.length).toBeGreaterThan(0);
    expect(agents.length).toBeGreaterThan(0);
  });

  it("adds request ids through the trace interceptor", async () => {
    let requestId = "";
    const client = new DefaultRESTClient(
      async (request) => {
        requestId = request.headers.get("x-request-id") ?? "";
        return new MockTransport().send(request);
      },
      [createTraceInterceptor()],
    );

    await client.get(endpointCatalog.dashboardSnapshot.path);
    expect(requestId.length).toBeGreaterThan(0);
  });

  it("supports websocket subscriptions and SSE fallback", () => {
    const client = new InMemoryWSClient();
    const events: string[] = [];
    let status = "disconnected";

    client.onStatusChange((nextStatus) => {
      status = nextStatus;
    });
    const unsubscribe = client.subscribe("dashboard", (event) => {
      events.push(event.type);
    });

    client.connect("ws://example", "token");
    client.publish({ channel: "dashboard", type: "metric.updated", payload: { value: 1 } });
    client.useSseFallback();
    unsubscribe();

    expect(events).toEqual(["metric.updated"]);
    expect(status).toBe("sse-fallback");
  });

  it("maps realtime events into query invalidation scopes", () => {
    expect(mapEventToQuery({ channel: "global", type: "incident.created", payload: {} }).queryKey).toEqual(["incidents"]);
    expect(mapEventToQuery({ channel: "global", type: "panic.activated", payload: {} }).scope).toBe("panic");
  });

  it("routes websocket events through the query router", () => {
    const queryClient = new QueryClient();
    const ws = new InMemoryWSClient();
    const router = new WSEventRouter(ws, queryClient);
    const invalidateCalls: string[] = [];
    const original = queryClient.invalidateQueries.bind(queryClient);
    queryClient.invalidateQueries = ((args) => {
      const queryKey = args?.queryKey;
      invalidateCalls.push(String(queryKey?.[0] ?? ""));
      return original(args);
    }) as typeof queryClient.invalidateQueries;

    router.connect("ws://example", "token");
    router.subscribe("approvals");
    ws.publish({ channel: "approvals", type: "approval.resolved", payload: {} });
    router.disconnect();

    expect(invalidateCalls).toContain("approvals");
  });
});
