import { createElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BrowserWSClient, DefaultRESTClient, createDedupeInterceptor, createRetryInterceptor, } from "@aa/shared-api-client";
import { UiRuntimeProvider, createAuthStore, createQueryClientFactory, createRealtimeStore, createSyncStore, createUiStore, useUiState, } from "@aa/shared-state";
describe("reaudit batch R26-45 to R26-54", () => {
    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });
    it("R26-45 auth store carries session metadata and tenant switching", () => {
        const store = createAuthStore();
        store.getState().login({
            accessToken: "access",
            refreshToken: "refresh",
            expiresAt: Date.now() + 60_000,
            userId: "user-1",
            tenantId: "tenant-a",
            roles: ["operator"],
            permissions: ["tasks.read"],
            displayName: "Ops",
        });
        store.getState().switchTenant("tenant-b");
        expect(store.getState().displayName).toBe("Ops");
        expect(store.getState().tenantId).toBe("tenant-b");
        expect(store.getState().permissions).toEqual(["tasks.read"]);
        store.getState().logout();
        expect(store.getState().authenticated).toBe(false);
    });
    it("R26-46 auth store exposes explicit auth state machine transitions", () => {
        const store = createAuthStore();
        store.getState().beginAuthentication();
        expect(store.getState().authStatus).toBe("authenticating");
        store.getState().login({
            accessToken: "access",
            refreshToken: "refresh",
            expiresAt: Date.now() + 60_000,
            userId: "user-1",
            tenantId: "tenant-a",
            roles: [],
            permissions: [],
        });
        expect(store.getState().authStatus).toBe("authenticated");
        store.getState().beginRefresh();
        expect(store.getState().authStatus).toBe("refreshing");
        store.getState().updateTokens("access-2", "refresh-2");
        expect(store.getState().authStatus).toBe("authenticated");
        store.getState().expireSession();
        expect(store.getState().authStatus).toBe("expired");
    });
    it("R26-47 websocket clients replay buffered events and send lastEventId on reconnect", async () => {
        vi.useFakeTimers();
        const sentMessages = [];
        const sockets = [];
        class ReplaySocket {
            static OPEN = 1;
            readyState = ReplaySocket.OPEN;
            onopen = null;
            onmessage = null;
            onclose = null;
            onerror = null;
            constructor(_url, _protocols) {
                sockets.push(this);
                queueMicrotask(() => this.onopen?.());
            }
            send(message) {
                sentMessages.push(message);
            }
            close() {
                this.onclose?.();
            }
        }
        const client = new BrowserWSClient(ReplaySocket, undefined, { replayBufferSize: 5, heartbeatIntervalMs: 1_000, heartbeatTimeoutMs: 500 });
        const replayed = [];
        client.subscribe("dashboard", (event) => {
            replayed.push(String(event.payload.value ?? ""));
        });
        client.connect("wss://example.test/realtime", "secret-token");
        await vi.runAllTicks();
        sockets[0]?.onmessage?.({
            data: JSON.stringify({
                channel: "dashboard",
                type: "dashboard.metric_updated",
                eventId: "evt-1",
                payload: { value: "first" },
            }),
        });
        const replayedByLateSubscriber = [];
        client.subscribe("dashboard", (event) => {
            replayedByLateSubscriber.push(String(event.payload.value ?? ""));
        });
        await vi.runAllTicks();
        sockets[0]?.close();
        await vi.advanceTimersByTimeAsync(1000);
        await vi.runAllTicks();
        expect(replayed).toContain("first");
        expect(replayedByLateSubscriber).toContain("first");
        expect(sentMessages.some((message) => message.includes('"lastEventId":"evt-1"'))).toBe(true);
    });
    it("R26-48 stores keep persist/devtools middleware attached", () => {
        expect(typeof createAuthStore().persist?.rehydrate).toBe("function");
        expect(typeof createUiStore().persist?.rehydrate).toBe("function");
        expect(typeof createRealtimeStore().persist?.rehydrate).toBe("function");
        expect(typeof createSyncStore().persist?.rehydrate).toBe("function");
    });
    it("R26-49 selector-based hooks avoid rerendering on unrelated store updates", () => {
        let renderCount = 0;
        function Harness() {
            const activeFeature = useUiState((state) => state.activeFeature);
            const setActiveRoute = useUiState((state) => state.setActiveRoute);
            renderCount += 1;
            return createElement("button", {
                type: "button",
                onClick: () => setActiveRoute("/another-route"),
                children: activeFeature,
            });
        }
        render(createElement(UiRuntimeProvider, undefined, createElement(Harness)));
        const initialRenderCount = renderCount;
        fireEvent.click(screen.getByRole("button", { name: "dashboard" }));
        expect(renderCount).toBe(initialRenderCount);
    });
    it("R26-50 ui store keeps sidebar, command palette, theme, and NL panel state together", () => {
        const store = createUiStore();
        store.getState().toggleSidebar();
        store.getState().setCommandPaletteOpen(true);
        store.getState().setNlPanelOpen(true);
        store.getState().setThemeMode("dark");
        expect(store.getState().sidebarCollapsed).toBe(true);
        expect(store.getState().commandPaletteOpen).toBe(true);
        expect(store.getState().nlPanelOpen).toBe(true);
        expect(store.getState().themeMode).toBe("dark");
    });
    it("R26-51 realtime store tracks subscriptions and incident counters", () => {
        const store = createRealtimeStore();
        store.getState().subscribe("tasks");
        store.getState().subscribe("incidents");
        store.getState().setIncidentCounts(3, 2);
        store.getState().addActiveIncident("incident-1");
        expect(store.getState().activeSubscriptions).toEqual(["tasks", "incidents"]);
        expect(store.getState().incidentCount).toBe(3);
        expect(store.getState().criticalIncidentCount).toBe(2);
    });
    it("R26-52 sync store tracks online state, conflicts, error state, and retry", () => {
        const store = createSyncStore();
        store.getState().setOnline(false);
        store.getState().addConflict({
            id: "conflict-1",
            endpoint: "/api/v1/tasks/task-1",
            localValue: { title: "local" },
            serverValue: { title: "server" },
            occurredAt: "2026-05-11T00:00:00.000Z",
        });
        store.getState().markSyncError("timeout");
        expect(store.getState().syncStatus).toBe("error");
        store.getState().retrySync();
        expect(store.getState().online).toBe(false);
        expect(store.getState().conflicts).toHaveLength(1);
        expect(store.getState().lastError).toBeNull();
        expect(store.getState().syncStatus).toBe("syncing");
    });
    it("R26-53 query client defaults to 5 minute stale time with focus/reconnect refetch", () => {
        const queries = createQueryClientFactory().getDefaultOptions().queries;
        expect(queries?.staleTime).toBe(300_000);
        expect(queries?.refetchOnWindowFocus).toBe(true);
        expect(queries?.refetchOnReconnect).toBe(true);
    });
    it("R26-54 retry and dedupe interceptors are available to runtime clients", async () => {
        vi.useFakeTimers();
        let attempts = 0;
        const client = new DefaultRESTClient(async (request) => {
            attempts += 1;
            if (request.path === "/dedupe") {
                await new Promise((resolve) => setTimeout(resolve, 10));
                return { status: 200, data: { ok: true, attempts } };
            }
            if (attempts < 2) {
                throw new Error("temporary");
            }
            return { status: 200, data: { ok: true, attempts } };
        }, [
            createRetryInterceptor({ maxRetries: 1, baseDelayMs: 10 }),
            createDedupeInterceptor(),
        ]);
        const retryPromise = client.get("/retry");
        await vi.runAllTimersAsync();
        const retryResult = await retryPromise;
        expect(retryResult.attempts).toBe(2);
        attempts = 0;
        const first = client.post("/dedupe", { action: "dedupe" });
        const second = client.post("/dedupe", { action: "dedupe" });
        await vi.runAllTimersAsync();
        const [firstResult, secondResult] = await Promise.all([first, second]);
        expect(firstResult.attempts).toBe(1);
        expect(secondResult.attempts).toBe(1);
    });
});
