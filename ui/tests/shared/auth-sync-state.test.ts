import { describe, expect, it } from "vitest";
import { AuthService, SessionGuard, TokenManager } from "@aa/shared-auth";
import { SyncCoordinator, createMemoryOfflineMutationStore, createPersistentOfflineQueue } from "@aa/shared-sync";
import {
  UiRuntimeProvider,
  createQueryClientFactory,
  createRealtimeStore,
  createSyncStore,
  useUiState,
} from "@aa/shared-state";
import { fireEvent, render, screen } from "@testing-library/react";
import { createElement, type ReactElement } from "react";

function createOfflineMutation(id: string, endpoint: string, method: "POST" | "PUT" | "PATCH" | "DELETE", body: unknown, createdAt: string) {
  return {
    id,
    endpoint,
    method,
    body,
    createdAt,
    idempotencyKey: `idem-${id}`,
    retryCount: 0,
    status: "pending" as const,
    tenantId: "tenant-1",
    traceId: `trace-${id}`,
    principal: {
      principalId: "user-1",
      tenantId: "tenant-1",
      roles: ["operator"],
    },
  };
}

describe("shared auth/sync/state split modules", () => {
  it("hydrates auth session and validates guard", () => {
    const tokenManager = new TokenManager();
    const authService = new AuthService(tokenManager);
    const guard = new SessionGuard(tokenManager);
    const session = authService.login("a1", "r1", 3600);

    expect(session.accessToken).toBe("a1");
    expect(authService.isAuthenticated()).toBe(true);
    expect(guard.requireAuthenticated().refreshToken).toBe("r1");
    expect(authService.resolveIdentity(new URLSearchParams("display_name=Ops&locale=en-US")).displayName).toBe("Ops");
  });

  it("tracks pending offline mutations and flushes them deterministically", async () => {
    const queue = createPersistentOfflineQueue(createMemoryOfflineMutationStore([]));
    await queue.whenReady();
    const coordinator = new SyncCoordinator(queue, undefined, {
      request: async () => ({}),
    } as never);
    coordinator.queueMutations([
      createOfflineMutation("m1", "/api/v1/tasks", "POST", { ok: true }, "2026-04-23T00:00:00.000Z"),
      createOfflineMutation("m2", "/api/v1/approvals", "PATCH", { status: "approved" }, "2026-04-23T00:00:01.000Z"),
    ]);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(coordinator.hasPending()).toBe(true);
    expect(coordinator.pendingCount()).toBe(2);
    expect(coordinator.peekPending()).toHaveLength(2);
    expect(coordinator.resolveConflict("server", "local", "local_wins")).toBe("local");

    const flushed = await coordinator.flush();
    expect(flushed.succeeded).toHaveLength(2);
    expect(flushed.failed).toHaveLength(0);
    expect(flushed.conflicts).toHaveLength(0);
    expect(coordinator.pendingCount()).toBe(0);
  });

  it("persists offline mutations in the queue store and supports merge conflict resolution", async () => {
    const store = createMemoryOfflineMutationStore([
      createOfflineMutation("m0", "/api/v1/tasks", "POST", { title: "queued" }, "2026-04-23T00:00:00.000Z"),
    ]);
    const queue = createPersistentOfflineQueue(store);
    await queue.whenReady();

    expect(queue.size()).toBe(1);
    await queue.enqueue({
      ...createOfflineMutation("m1", "/api/v1/tasks/task-1", "PUT", { title: "local", tags: ["ops"] }, "2026-04-23T00:00:01.000Z"),
      conflictKey: "task-1",
      version: 2,
    });

    expect(queue.peek()).toHaveLength(2);
    const coordinator = new SyncCoordinator(queue);
    expect(coordinator.resolveConflict({ server: true }, { local: true }, "merge")).toEqual({ server: true, local: true });
  });

  it("creates state stores and runtime provider with real bootstrap state", () => {
    const realtimeStore = createRealtimeStore();
    realtimeStore.getState().setOfflineQueueSize(3);
    const syncStore = createSyncStore();
    syncStore.getState().setPendingMutations(4);
    syncStore.getState().markFlushed("2026-04-23T09:00:00.000Z");

    expect(realtimeStore.getState().offlineQueueSize).toBe(3);
    expect(syncStore.getState().lastFlushedAt).toBe("2026-04-23T09:00:00.000Z");
    expect(createQueryClientFactory().getDefaultOptions().queries?.staleTime).toBe(120_000);

    render(createElement(UiRuntimeProvider, undefined, createElement("div", undefined, "runtime ready")));

    expect(screen.getByText("runtime ready")).toBeInTheDocument();
  });

  it("rerenders ui state consumers when the zustand store changes", () => {
    function Harness(): ReactElement {
      const ui = useUiState();
      return createElement(
        "button",
        {
          onClick: () => {
            ui.setActiveFeature("analytics");
          },
          type: "button",
        },
        ui.activeFeature,
      );
    }

    render(createElement(UiRuntimeProvider, undefined, createElement(Harness)));
    fireEvent.click(screen.getByRole("button", { name: "dashboard" }));
    expect(screen.getByRole("button", { name: "analytics" })).toBeInTheDocument();
  });

  it("evaluates route access through the five-layer guard chain", () => {
    const tokenManager = new TokenManager();
    tokenManager.setSession({
      accessToken: "a1",
      refreshToken: "r1",
      expiresAt: Date.now() + 60_000,
    });

    const guard = new SessionGuard(tokenManager);
    const result = guard.requireRouteAccess("platform_sre", {
      requiredRoles: ["operator"],
      allowedDomains: ["platform"],
      featureFlag: "ops-panel",
      featureId: "ops-panel",
    });

    expect(result.allowed).toBe(true);
    expect(result.evaluatedLayers).toEqual(["auth", "role", "permission", "feature-flag", "domain"]);
  });
});
