import { jsx as _jsx } from "react/jsx-runtime";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WebAppShell } from "../../../../../apps/web/src/app-shell";
import { checkWebContractVersion } from "../../../../../apps/web/src/runtime";
const mocks = vi.hoisted(() => ({
    fetchContractVersion: vi.fn(),
}));
vi.mock("@aa/ui-core", () => ({
    applyResolvedTheme: vi.fn(),
    SystemStatusBar: () => _jsx("div", { "data-testid": "system-status-bar", children: "status" }),
    designTokens: {
        color: {
            background: "#0a0a0f",
            text: "#e8e8ed",
            accent: "#00d4aa",
            border: "#1f1f2e",
            subtle: "#6b6b80",
        },
    },
}));
vi.mock("@aa/shared-state", () => ({
    UiRuntimeProvider: ({ children }) => _jsx("div", { children: children }),
    useSystemStatus: () => ({ ws: "connected", offline: "idle" }),
    useThemeState: () => ({ resolvedThemeName: "light" }),
}));
vi.mock("@aa/shared-domain", () => ({
    createFeatureGuardContext: vi.fn(() => ({
        authenticated: true,
        tenantId: "tenant-1",
        domainId: "platform",
        permissions: ["admin"],
        roles: ["platform-admin"],
    })),
    createRouteGuardChain: vi.fn(() => ({
        evaluate: () => ({ allowed: true, reason: "" }),
    })),
}));
vi.mock("@aa/shared-api-client", () => ({
    DEFAULT_ACCEPT_VERSIONS: ["2026-04-01", "2026-01-01"],
    BrowserWSClient: vi.fn(),
    DefaultRESTClient: vi.fn(),
    HttpTransport: vi.fn(),
    InMemoryWSClient: vi.fn(),
    createRuntimeWSClient: vi.fn(() => ({ connect: vi.fn(), disconnect: vi.fn(), subscribe: vi.fn(), onStatusChange: vi.fn(), publish: vi.fn(), useSseFallback: vi.fn() })),
    fetchContractVersion: mocks.fetchContractVersion,
    createAuthInterceptor: vi.fn(() => (request) => request),
    createContractVersionInterceptor: vi.fn(() => (request) => request),
    createCsrfInterceptor: vi.fn(() => (request) => request),
    createIdempotencyKeyInterceptor: vi.fn(() => (request) => request),
    createOfflineQueueInterceptor: vi.fn(() => (request) => request),
    createTenantInterceptor: vi.fn(() => (request) => request),
    createTraceInterceptor: vi.fn(() => (request) => request),
}));
vi.mock("@aa/shared-sync", () => ({
    createPersistentOfflineQueue: vi.fn(() => ({
        enqueue: vi.fn(),
        dequeue: vi.fn(),
        flush: vi.fn(),
    })),
}));
vi.mock("@aa/shared-platform", () => ({
    createWebPlatformAdapter: vi.fn(() => ({ platform: "web" })),
    PlatformAdapterProvider: ({ children }) => _jsx("div", { children: children }),
}));
describe("runtime contract version bootstrap", () => {
    it("returns a warning banner when server and client contract versions drift", async () => {
        mocks.fetchContractVersion.mockResolvedValueOnce({
            contractVersion: "2027-01-01",
            minServerVersion: "2027-01-01",
            supportedVersions: ["2027-01-01"],
        });
        await expect(checkWebContractVersion({})).resolves.toEqual({
            tone: "warning",
            title: "Contract version mismatch",
            message: "Server contract 2027-01-01 is outside the client-supported set 2026-04-01, 2026-01-01.",
        });
    });
    it("renders the startup banner in the web shell", () => {
        const mockFeature = {
            manifest: {
                id: "test-feature",
                title: "Test Feature",
                group: "Test Group",
                kind: "implemented",
                status: "Implemented/Internal",
            },
            route: {
                path: "/test",
                featureId: "test-feature",
                group: "Test Group",
                title: "Test Feature",
                permission: "admin",
                platforms: ["web"],
                codeSplit: false,
            },
            Component: () => _jsx("div", { children: "Feature Content" }),
        };
        render(_jsx(WebAppShell, { features: [mockFeature], router: "memory", initialEntries: ["/test"], startupBanner: {
                tone: "warning",
                title: "Contract version mismatch",
                message: "Server contract 2027-01-01 is outside the client-supported set 2026-04-01, 2026-01-01.",
            } }));
        expect(screen.getByRole("alert")).toHaveTextContent("Contract version mismatch");
        expect(screen.getByRole("alert")).toHaveTextContent("Server contract 2027-01-01 is outside the client-supported set 2026-04-01, 2026-01-01.");
    });
});
