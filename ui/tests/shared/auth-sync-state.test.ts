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

describe("shared auth/sync/state split modules", () => {
  it("hydrates auth session and validates guard", () => {
    const tokenManager = new TokenManager();
    const authService = new AuthService(tokenManager);
    const session = authService.handleSsoCallback(new URLSearchParams("access_token=a1&refresh_token=r1&locale=en-US"));
    const guard = new SessionGuard(tokenManager);

    expect(session.accessToken).toBe("a1");
    expect(authService.isAuthenticated()).toBe(true);
    expect(guard.requireAuthenticated().refreshToken).toBe("r1");
    expect(authService.resolveIdentity(new URLSearchParams("display_name=Ops&locale=en-US")).displayName).toBe("Ops");
  });

  it("tracks pending offline mutations and flushes them deterministically", async () => {
    const dispatched: string[] = [];
    const coordinator = new SyncCoordinator(
      undefined,
      undefined,
      {
        async dispatch(mutation) {
          dispatched.push(mutation.id);
        },
      },
    );
    coordinator.queueMutations([
      { id: "m1", endpoint: "/api/v1/tasks", method: "POST", body: { ok: true }, createdAt: "2026-04-23T00:00:00.000Z" },
      { id: "m2", endpoint: "/api/v1/approvals", method: "PATCH", body: { status: "approved" }, createdAt: "2026-04-23T00:00:01.000Z" },
    ]);

    expect(coordinator.hasPending()).toBe(true);
    expect(coordinator.pendingCount()).toBe(2);
    expect(coordinator.peekPending()).toHaveLength(2);
    expect(coordinator.resolveConflict("server", "local", "local_wins")).toBe("local");

    const flushed = await coordinator.flush("2026-04-23T08:00:00.000Z");
    expect(dispatched).toEqual(["m1", "m2"]);
    expect(flushed.mutations).toHaveLength(2);
    expect(flushed.flushedAt).toBe("2026-04-23T08:00:00.000Z");
    expect(coordinator.pendingCount()).toBe(0);
  });

  it("persists offline mutations in the queue store and supports merge conflict resolution", async () => {
    const store = createMemoryOfflineMutationStore([
      { id: "m0", endpoint: "/api/v1/tasks", method: "POST", body: { title: "queued" }, createdAt: "2026-04-23T00:00:00.000Z" },
    ]);
    const queue = createPersistentOfflineQueue(store);
    await queue.whenReady();

    expect(queue.size()).toBe(1);
    queue.enqueue({
      id: "m1",
      endpoint: "/api/v1/tasks/task-1",
      method: "PUT",
      body: { title: "local", tags: ["ops"] },
      conflictKey: "task-1",
      version: 2,
      createdAt: "2026-04-23T00:00:01.000Z",
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
    expect(createQueryClientFactory().getDefaultOptions().queries?.staleTime).toBe(300_000);

    render(createElement(UiRuntimeProvider, undefined, createElement("div", undefined, "runtime ready")));

    expect(screen.getByText("runtime ready")).toBeInTheDocument();
  });

  it("rerenders ui state consumers when the zustand store changes", () => {
    function Harness(): ReactElement {
      const activeFeature = useUiState((state) => state.activeFeature);
      const setActiveFeature = useUiState((state) => state.setActiveFeature);
      return createElement(
        "button",
        {
          onClick: () => {
            setActiveFeature("analytics");
          },
          type: "button",
        },
        activeFeature,
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
