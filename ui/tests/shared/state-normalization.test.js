import { describe, expect, it } from "vitest";
import { createAuthStore, createNotificationStore, createRealtimeStore, createSyncStore, } from "@aa/shared-state";
describe("state normalization", () => {
    it("normalizes auth roles and permissions into O(1) lookup records", () => {
        const store = createAuthStore();
        store.getState().login({
            accessToken: "access",
            refreshToken: "refresh",
            expiresAt: Date.now() + 30_000,
            userId: "user-1",
            tenantId: "tenant-1",
            roles: ["operator", "auditor"],
            permissions: ["tasks.read", "tasks.write"],
        });
        expect(store.getState().roleLookup.operator).toBe(true);
        expect(store.getState().permissionLookup["tasks.write"]).toBe(true);
    });
    it("normalizes realtime subscriptions and active incidents", () => {
        const store = createRealtimeStore();
        store.getState().subscribe("dashboard");
        store.getState().addActiveIncident("incident-1");
        expect(store.getState().subscriptionLookup.dashboard).toBe(true);
        expect(store.getState().activeIncidentLookup["incident-1"]).toBe(true);
    });
    it("normalizes sync conflicts by id", () => {
        const store = createSyncStore();
        store.getState().addConflict({
            id: "conflict-1",
            endpoint: "/api/v1/tasks/task-1",
            localValue: { title: "local" },
            serverValue: { title: "server" },
            occurredAt: "2026-05-11T00:00:00.000Z",
        });
        expect(store.getState().conflictLookup["conflict-1"]?.endpoint).toBe("/api/v1/tasks/task-1");
        store.getState().resolveConflict("conflict-1", "merge");
        expect(store.getState().conflictLookup["conflict-1"]).toBeUndefined();
    });
    it("normalizes notifications by id", () => {
        const store = createNotificationStore();
        store.getState().addNotification({
            kind: "warning",
            title: "Session expiring",
            message: "Refresh soon",
        });
        const notificationId = store.getState().notifications[0]?.id;
        expect(notificationId).toBeDefined();
        expect(store.getState().notificationLookup[notificationId ?? ""]?.title).toBe("Session expiring");
    });
});
