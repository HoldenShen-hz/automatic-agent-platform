import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
const mocks = vi.hoisted(() => ({
    createFeatureGuardContext: vi.fn((ctx) => ctx),
    createRouteGuardChain: vi.fn(() => ({
        evaluate: () => ({ allowed: true, reason: "" }),
    })),
}));
vi.mock("@aa/ui-core", () => ({
    applyResolvedTheme: vi.fn(),
    SystemStatusBar: ({ status }) => (_jsxs("div", { "data-testid": "system-status-bar", children: [_jsx("span", { children: status.ws }), _jsx("span", { children: status.offline })] })),
    designTokens: {
        color: {
            background: "#000000",
            text: "#ffffff",
            accent: "#00ff88",
            border: "#333333",
            subtle: "#888888",
        },
    },
}));
vi.mock("@aa/shared-state", () => ({
    UiRuntimeProvider: ({ children }) => _jsx("div", { "data-testid": "ui-runtime-provider", children: children }),
    useSystemStatus: () => ({ ws: "connected", offline: "idle" }),
    useThemeState: () => ({ resolvedThemeName: "light" }),
}));
vi.mock("@aa/shared-domain", () => ({
    createFeatureGuardContext: mocks.createFeatureGuardContext,
    createRouteGuardChain: mocks.createRouteGuardChain,
}));
vi.mock("@aa/shared-platform", () => ({
    createWebPlatformAdapter: vi.fn(() => ({ platform: "web" })),
    PlatformAdapterProvider: ({ children }) => _jsx("div", { "data-testid": "platform-adapter-provider", children: children }),
}));
import { WebAppShell } from "../../apps/web/src/app-shell";
describe("web app shell auth regression", () => {
    it("provides a platform adapter to the shell tree instead of rendering features without a provider", () => {
        render(_jsx(WebAppShell, { router: "memory", initialEntries: ["/mission-control/dashboard"], features: [
                {
                    manifest: {
                        id: "dashboard",
                        title: "Dashboard",
                        group: "Mission Control",
                        kind: "implemented",
                        status: "Implemented/Internal",
                    },
                    route: {
                        path: "/mission-control/dashboard",
                        featureId: "dashboard",
                        group: "Mission Control",
                        title: "Dashboard",
                        permission: "approval:read",
                        platforms: ["web"],
                        codeSplit: false,
                    },
                    Component: () => _jsx("div", { children: "Dashboard Content" }),
                },
            ] }));
        expect(screen.getByTestId("platform-adapter-provider")).toBeInTheDocument();
    });
    it("builds route guard context from the provided authContext instead of a hardcoded demo admin", () => {
        render(_jsx(WebAppShell, { router: "memory", initialEntries: ["/mission-control/dashboard"], authContext: {
                userId: "user-123",
                tenantId: "tenant-abc",
                permissions: ["approval:read"],
                roles: ["reviewer"],
            }, features: [
                {
                    manifest: {
                        id: "dashboard",
                        title: "Dashboard",
                        group: "Mission Control",
                        kind: "implemented",
                        status: "Implemented/Internal",
                    },
                    route: {
                        path: "/mission-control/dashboard",
                        featureId: "dashboard",
                        group: "Mission Control",
                        title: "Dashboard",
                        permission: "approval:read",
                        platforms: ["web"],
                        codeSplit: false,
                    },
                    Component: () => _jsx("div", { children: "Dashboard Content" }),
                },
            ] }));
        expect(screen.getByText("Dashboard Content")).toBeInTheDocument();
        expect(mocks.createFeatureGuardContext).toHaveBeenCalledWith(expect.objectContaining({
            authenticated: true,
            tenantId: "tenant-abc",
            permissions: ["approval:read"],
            roles: ["reviewer"],
        }));
    });
    it("renders an error boundary fallback when a feature crashes", () => {
        const consoleError = vi.spyOn(console, "error").mockImplementation(() => { });
        render(_jsx(WebAppShell, { router: "memory", initialEntries: ["/mission-control/dashboard"], features: [
                {
                    manifest: {
                        id: "dashboard",
                        title: "Dashboard",
                        group: "Mission Control",
                        kind: "implemented",
                        status: "Implemented/Internal",
                    },
                    route: {
                        path: "/mission-control/dashboard",
                        featureId: "dashboard",
                        group: "Mission Control",
                        title: "Dashboard",
                        permission: "approval:read",
                        platforms: ["web"],
                        codeSplit: false,
                    },
                    Component: () => {
                        throw new Error("feature exploded");
                    },
                },
            ] }));
        expect(screen.getByText("页面渲染失败")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "重试" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "上报问题" })).toBeInTheDocument();
        consoleError.mockRestore();
    });
});
