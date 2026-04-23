import { describe, expect, it } from "vitest";
import { AuthService, SessionGuard, TokenManager } from "@aa/shared-auth";
import { SyncCoordinator } from "@aa/shared-sync";
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

  it("tracks pending offline mutations and flushes them deterministically", () => {
    const coordinator = new SyncCoordinator();
    coordinator.queueMutations([
      { id: "m1", endpoint: "/api/v1/tasks", method: "POST", body: { ok: true }, createdAt: "2026-04-23T00:00:00.000Z" },
      { id: "m2", endpoint: "/api/v1/approvals", method: "PATCH", body: { status: "approved" }, createdAt: "2026-04-23T00:00:01.000Z" },
    ]);

    expect(coordinator.hasPending()).toBe(true);
    expect(coordinator.pendingCount()).toBe(2);
    expect(coordinator.peekPending()).toHaveLength(2);
    expect(coordinator.resolveConflict("server", "local", "local_wins")).toBe("local");

    const flushed = coordinator.flush("2026-04-23T08:00:00.000Z");
    expect(flushed.mutations).toHaveLength(2);
    expect(flushed.flushedAt).toBe("2026-04-23T08:00:00.000Z");
    expect(coordinator.pendingCount()).toBe(0);
  });

  it("creates state stores and runtime provider with real bootstrap state", () => {
    const realtimeStore = createRealtimeStore();
    realtimeStore.getState().setOfflineQueueSize(3);
    const syncStore = createSyncStore();
    syncStore.getState().setPendingMutations(4);
    syncStore.getState().markFlushed("2026-04-23T09:00:00.000Z");

    expect(realtimeStore.getState().offlineQueueSize).toBe(3);
    expect(syncStore.getState().lastFlushedAt).toBe("2026-04-23T09:00:00.000Z");
    expect(createQueryClientFactory().getDefaultOptions().queries?.staleTime).toBe(30_000);

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
});
