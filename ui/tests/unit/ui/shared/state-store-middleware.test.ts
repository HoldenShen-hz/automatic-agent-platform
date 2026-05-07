import { describe, expect, it } from "vitest";
import {
  CACHE_TIER_STALE_TIME,
  createAuthStore,
  createNotificationStore,
  createQueryClientFactory,
  createTieredQueryClientFactory,
  createRealtimeStore,
  createSyncStore,
  createThemeStore,
  createUiStore,
} from "@aa/shared-state";

describe("shared state store middleware", () => {
  it("keeps persist middleware attached while auth state updates through draft mutations", () => {
    const authStore = createAuthStore();

    authStore.getState().login({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      expiresAt: Date.now() + 60_000,
      userId: "user-1",
      tenantId: "tenant-1",
      roles: ["operator"],
      permissions: ["tasks.read"],
    });
    authStore.getState().updateTokens("access-token-2", "refresh-token-2");

    expect(typeof (authStore as { persist?: { rehydrate?: () => void } }).persist?.rehydrate).toBe("function");
    expect(authStore.getState().authenticated).toBe(true);
    expect(authStore.getState().accessToken).toBe("access-token-2");
    expect(authStore.getState().roles).toEqual(["operator"]);
  });

  it("exposes tiered query staleTime defaults for tasks, approvals, and config data", () => {
    expect(createQueryClientFactory().getDefaultOptions().queries?.staleTime).toBe(120_000);
    expect(createTieredQueryClientFactory("approvals").getDefaultOptions().queries?.staleTime).toBe(30_000);
    expect(createTieredQueryClientFactory("config").getDefaultOptions().queries?.staleTime).toBe(3_600_000);
    expect(CACHE_TIER_STALE_TIME).toMatchObject({
      tasks: 120_000,
      approvals: 30_000,
      config: 3_600_000,
    });
  });

  it("tracks realtime subscriptions, approvals, and incidents through the standardized store", () => {
    const realtimeStore = createRealtimeStore();

    realtimeStore.getState().subscribe("tasks");
    realtimeStore.getState().subscribe("tasks");
    realtimeStore.getState().subscribe("approvals");
    realtimeStore.getState().setPendingApprovalCount(3);
    realtimeStore.getState().addActiveIncident("incident-1");
    realtimeStore.getState().addActiveIncident("incident-1");

    expect(realtimeStore.getState().activeSubscriptions).toEqual(["tasks", "approvals"]);
    expect(realtimeStore.getState().pendingApprovalCount).toBe(3);
    expect(realtimeStore.getState().activeIncidents).toEqual(["incident-1"]);

    realtimeStore.getState().unsubscribe("tasks");
    realtimeStore.getState().removeActiveIncident("incident-1");

    expect(realtimeStore.getState().activeSubscriptions).toEqual(["approvals"]);
    expect(realtimeStore.getState().activeIncidents).toEqual([]);
  });

  it("applies draft-style mutations across notification, sync, theme, and ui stores", () => {
    const notificationStore = createNotificationStore();
    notificationStore.getState().addNotification({
      kind: "warning",
      title: "Session expiring",
      message: "Refresh soon",
    });
    const notificationId = notificationStore.getState().notifications[0]?.id;
    expect(notificationId).toBeDefined();
    notificationStore.getState().markRead(notificationId ?? "");

    const syncStore = createSyncStore();
    syncStore.getState().addConflict({
      id: "conflict-1",
      endpoint: "/api/v1/tasks/task-1",
      localValue: { title: "local" },
      serverValue: { title: "server" },
      occurredAt: "2026-05-07T00:00:00.000Z",
    });
    syncStore.getState().retrySync();
    syncStore.getState().resolveConflict("conflict-1", "merge");

    const themeStore = createThemeStore();
    themeStore.getState().setThemeMode("high-contrast");

    const uiStore = createUiStore();
    uiStore.getState().setActiveFeature("analytics");
    uiStore.getState().toggleSidebar();
    uiStore.getState().setCommandPaletteOpen(true);

    expect(notificationStore.getState().unreadCount).toBe(0);
    expect(notificationStore.getState().notifications[0]?.read).toBe(true);
    expect(syncStore.getState().syncStatus).toBe("syncing");
    expect(syncStore.getState().conflicts).toEqual([]);
    expect(themeStore.getState().resolvedThemeName).toBe("high-contrast");
    expect(uiStore.getState().activeFeature).toBe("analytics");
    expect(uiStore.getState().sidebarCollapsed).toBe(true);
    expect(uiStore.getState().commandPaletteOpen).toBe(true);
  });
});
