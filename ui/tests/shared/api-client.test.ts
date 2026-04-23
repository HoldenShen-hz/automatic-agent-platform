import { describe, expect, it } from "vitest";
import { DefaultRESTClient, InMemoryWSClient, MockTransport, createTraceInterceptor, endpointCatalog, fetchDashboardSnapshot, fetchTasks } from "@aa/shared-api-client";

describe("shared api-client", () => {
  it("fetches dashboard and tasks through the mock REST client", async () => {
    const client = new DefaultRESTClient((request) => new MockTransport().send(request));

    const dashboard = await fetchDashboardSnapshot(client);
    const tasks = await fetchTasks(client);

    expect(dashboard.overallHealth).toBe("healthy");
    expect(tasks.length).toBeGreaterThan(0);
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
});
