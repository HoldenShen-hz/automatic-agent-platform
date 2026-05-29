import { QueryClient } from "@tanstack/react-query";
import { afterEach, describe, expect, it } from "vitest";
import { BrowserWSClient, DefaultRESTClient, HttpTransport, InMemoryWSClient, MockTransport, WSEventRouter, approveApproval, createCsrfInterceptor, createTask, createTraceInterceptor, createUser, createWorkflow, deleteTask, endpointCatalog, fetchAgents, fetchDashboardSnapshot, fetchKnowledge, fetchPackVersions, fetchPlugins, fetchPrompts, fetchApprovals, fetchSystemConfig, fetchTasks, fetchWorkers, fetchWorkflowRunSteps, fetchWorkflows, mapEventToQuery, updateTask, updateUser, } from "@aa/shared-api-client";
describe("shared api-client", () => {
    afterEach(() => {
        document.head.innerHTML = "";
    });
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
    it("unwraps src-style collection envelopes for list endpoints", async () => {
        const client = new DefaultRESTClient(async (request) => {
            if (request.path.includes("/tasks")) {
                return { status: 200, data: { tasks: [{ id: "task-1", title: "Task", status: "queued", currentStep: "intake", domainId: "platform" }] } };
            }
            if (request.path.includes("/workflows")) {
                return { status: 200, data: { workflows: [{ id: "wf-1", title: "Workflow", status: "running", currentStage: "execute", owner: "ops", steps: [] }] } };
            }
            if (request.path.includes("/approvals")) {
                return { status: 200, data: { approvals: [{ approvalId: "approval-1", taskId: "task-1", riskLevel: "medium", reasonSummary: "review" }] } };
            }
            if (request.path.includes("/v1/workers")) {
                return { status: 200, data: { workers: [{ id: "worker-1", status: "idle", queue: "default", heartbeatLagMs: 0 }] } };
            }
            return { status: 200, data: { queues: [{ id: "default", ready: 1, inFlight: 0, retries: 0, dlq: 0 }] } };
        });
        await expect(fetchTasks(client)).resolves.toHaveLength(1);
        await expect(fetchWorkflows(client)).resolves.toHaveLength(1);
        await expect(fetchApprovals(client)).resolves.toHaveLength(1);
        await expect(fetchWorkers(client)).resolves.toHaveLength(1);
    });
    it("adds request ids through the trace interceptor", async () => {
        let requestId = "";
        const client = new DefaultRESTClient(async (request) => {
            requestId = request.headers.get("x-request-id") ?? "";
            return new MockTransport().send(request);
        }, [createTraceInterceptor()]);
        await client.get(endpointCatalog.dashboardSnapshot.path);
        expect(requestId.length).toBeGreaterThan(0);
    });
    it("supports websocket subscriptions and SSE fallback", () => {
        const client = new InMemoryWSClient();
        const events = [];
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
        expect(mapEventToQuery({ channel: "global", type: "progress", payload: {} }).queryKey).toEqual(["tasks"]);
        expect(mapEventToQuery({ channel: "global", type: "message_delta", payload: {} }).queryKey).toEqual(["tasks"]);
        expect(mapEventToQuery({ channel: "global", type: "artifact_ready", payload: {} }).queryKey).toEqual(["tasks"]);
        expect(mapEventToQuery({ channel: "global", type: "panic.activated", payload: {} }).scope).toBe("panic");
        expect(mapEventToQuery({ channel: "global", type: "config.feature-flags.updated", payload: {} }).queryKey).toEqual(["feature-flags"]);
        expect(Object.values(endpointCatalog).length).toBeGreaterThanOrEqual(41);
        expect(endpointCatalog.contractVersion.path).toBe("/v1/meta/contract-version");
    });
    it("routes websocket events through the query router", () => {
        const queryClient = new QueryClient();
        const ws = new InMemoryWSClient();
        const router = new WSEventRouter(ws, queryClient);
        const invalidateCalls = [];
        const original = queryClient.invalidateQueries.bind(queryClient);
        queryClient.invalidateQueries = ((args) => {
            const queryKey = args?.queryKey;
            invalidateCalls.push(String(queryKey?.[0] ?? ""));
            return original(args);
        });
        router.connect("ws://example", "token");
        router.subscribe("approvals");
        ws.publish({ channel: "approvals", type: "approval.resolved", payload: {} });
        router.disconnect();
        expect(invalidateCalls).toContain("approvals");
    });
    it("supports real http transport with injected fetch", async () => {
        const transport = new HttpTransport({
            baseUrl: "https://example.test",
            fetchImplementation: async (input) => new Response(JSON.stringify({ ok: true, url: String(input) }), { status: 200, headers: { "content-type": "application/json" } }),
        });
        const client = new DefaultRESTClient((request) => transport.send(request));
        const response = await client.get("/api/v1/health");
        expect(response.ok).toBe(true);
        expect(response.url).toContain("https://example.test/api/v1/health");
    });
    it("supports browser websocket client with a real socket contract", () => {
        class FakeSocket {
            static OPEN = 1;
            sent = [];
            readyState = FakeSocket.OPEN;
            onopen = null;
            onmessage = null;
            onclose = null;
            onerror = null;
            constructor(_url) {
                queueMicrotask(() => {
                    this.onopen?.();
                });
            }
            send(message) {
                this.sent.push(message);
            }
            close() {
                this.onclose?.();
            }
        }
        const client = new BrowserWSClient(FakeSocket, new InMemoryWSClient());
        const events = [];
        client.subscribe("dashboard", (event) => {
            events.push(event.type);
        });
        client.connect("ws://example", "token");
        client.publish({ channel: "dashboard", type: "dashboard.metric_updated", payload: {} });
        client.disconnect();
        expect(events).toEqual(["dashboard.metric_updated"]);
    });
    it("injects csrf tokens into write requests only", async () => {
        document.head.innerHTML = '<meta name="aa-csrf-token" content="csrf-token-123" />';
        let getToken = "";
        let postToken = "";
        const client = new DefaultRESTClient(async (request) => {
            if (request.method === "GET") {
                getToken = request.headers.get("x-csrf-token") ?? "";
            }
            if (request.method === "POST") {
                postToken = request.headers.get("x-csrf-token") ?? "";
            }
            return new MockTransport().send(request);
        }, [createCsrfInterceptor()]);
        await client.get("/tasks");
        await client.post("/tasks", { ok: true });
        expect(getToken).toBe("");
        expect(postToken).toBe("csrf-token-123");
    });
    it("exposes write endpoints and admin configuration helpers", async () => {
        const client = new DefaultRESTClient(async (request) => {
            if (request.method === "GET") {
                return new MockTransport().send(request);
            }
            return {
                status: 200,
                data: { ok: true, body: request.body },
            };
        });
        await expect(createTask(client, { title: "task" })).resolves.toMatchObject({ ok: true });
        await expect(updateTask(client, "task-1", { status: "running" })).resolves.toMatchObject({ ok: true });
        await expect(deleteTask(client, "task-1")).resolves.toMatchObject({ ok: true });
        await expect(createWorkflow(client, { title: "workflow" })).resolves.toMatchObject({ ok: true });
        await expect(approveApproval(client, "approval-1")).resolves.toMatchObject({ ok: true });
        await expect(createUser(client, { displayName: "Ops" })).resolves.toMatchObject({ ok: true });
        await expect(updateUser(client, "user-1", { status: "active" })).resolves.toMatchObject({ ok: true });
        await expect(fetchSystemConfig(client)).resolves.toMatchObject({ csrfEnabled: true });
        await expect(fetchWorkflowRunSteps(client, "workflow-run-1")).resolves.toBeDefined();
        await expect(fetchKnowledge(client)).resolves.toBeDefined();
        await expect(fetchPackVersions(client, "pack-1")).resolves.toBeDefined();
        await expect(fetchPlugins(client)).resolves.toBeDefined();
        await expect(fetchPrompts(client)).resolves.toBeDefined();
    });
});
