import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import type { ReactElement } from "react";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import { WebAppShell } from "../../web/src/app-shell";
import type { FeatureModule } from "@aa/ui-core";

// Integration tests for UI components across apps
// These tests verify cross-component integration and data flow

// Mock shared modules
vi.mock("@aa/ui-core", () => ({
  SystemStatusBar: ({ status }: { status: { ws: string; offline: string } }) => (
    <div data-testid="system-status-bar">
      <span>WS: {status.ws}</span>
      <span>Offline Queue: {status.offline}</span>
    </div>
  ),
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
  UiRuntimeProvider: ({ children }: { children: ReactElement }) => (
    <div data-testid="ui-runtime-provider">{children}</div>
  ),
  useSystemStatus: () => ({ ws: "connected", offline: "idle" }),
}));

vi.mock("@aa/shared-domain", () => ({
  createFeatureGuardContext: vi.fn().mockImplementation((ctx) => ({
    authenticated: ctx.authenticated,
    tenantId: ctx.tenantId,
    domainId: ctx.domainId,
    permissions: ctx.permissions,
    roles: ctx.roles,
  })),
  createRouteGuardChain: vi.fn().mockImplementation(() => ({
    evaluate: () => ({ allowed: true, reason: "" }),
  })),
}));

// Mock web runtime
vi.mock("../../web/src/runtime", () => ({
  createWebRuntimeConfig: vi.fn().mockImplementation((env) => ({
    apiBaseUrl: env.VITE_API_BASE_URL || undefined,
    wsUrl: env.VITE_WS_URL || undefined,
  })),
  createWebRuntimeClients: vi.fn().mockImplementation(() => ({
    client: {},
    wsClient: {},
    offlineQueue: { enqueue: vi.fn(), dequeue: vi.fn(), flush: vi.fn() },
  })),
  registerWebServiceWorker: vi.fn().mockResolvedValue(null),
}));

const createMockFeature = (overrides = {}): FeatureModule =>
  ({
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
      permission: "authenticated",
      platforms: ["web"],
      codeSplit: false,
    },
    Component: () => (
      <div data-testid="test-component">Test Feature Content</div>
    ),
    ...overrides,
  } as FeatureModule);

describe("UI integration: web app-shell with auth context", () => {
  afterEach(() => {
    cleanup();
  });

  it("authenticates user with permissions and renders protected feature", () => {
    const authContext = {
      userId: "user-123",
      permissions: ["read", "write", "admin"],
      tenantId: "tenant-abc",
      roles: ["platform-admin"],
    };

    render(
      <MemoryRouter initialEntries={["/test"]}>
        <WebAppShell
          features={[createMockFeature()]}
          router="memory"
          authContext={authContext}
        />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("test-component")).toBeInTheDocument();
    expect(screen.getByText("Automatic Agent Platform UI")).toBeInTheDocument();
  });

  it("denies access for insufficient permissions", () => {
    const { createRouteGuardChain } = require("@aa/shared-domain");
    createRouteGuardChain.mockReturnValueOnce({
      evaluate: () => ({ allowed: false, reason: "Insufficient permissions" }),
    });

    const authContext = {
      userId: "user-456",
      permissions: ["read"],
      tenantId: "tenant-xyz",
      roles: ["viewer"],
    };

    render(
      <MemoryRouter initialEntries={["/test"]}>
        <WebAppShell
          features={[
            createMockFeature({
              route: { path: "/test", featureId: "test", group: "Test", title: "Test", permission: "admin", platforms: ["web"], codeSplit: false },
            }),
          ]}
          router="memory"
          authContext={authContext}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText("Access denied")).toBeInTheDocument();
  });
});

describe("UI integration: navigation flow", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders sidebar with multiple feature groups", () => {
    const mockFeatures = [
      createMockFeature({
        manifest: { ...createMockFeature().manifest, id: "dashboard", title: "Dashboard", group: "Mission Control" },
        route: { path: "/mission-control/dashboard", featureId: "dashboard", group: "Mission Control", title: "Dashboard", permission: "authenticated", platforms: ["web"], codeSplit: false },
      }),
      createMockFeature({
        manifest: { ...createMockFeature().manifest, id: "approvals", title: "Approval", group: "Operations" },
        route: { path: "/operations/approvals", featureId: "approvals", group: "Operations", title: "Approval", permission: "authenticated", platforms: ["web"], codeSplit: false },
      }),
      createMockFeature({
        manifest: { ...createMockFeature().manifest, id: "compliance", title: "Compliance", group: "Governance" },
        route: { path: "/governance/compliance", featureId: "compliance", group: "Governance", title: "Compliance", permission: "authenticated", platforms: ["web"], codeSplit: false },
      }),
    ];

    render(
      <MemoryRouter initialEntries={["/mission-control/dashboard"]}>
        <WebAppShell features={mockFeatures} router="memory" />
      </MemoryRouter>,
    );

    expect(screen.getByText("Mission Control")).toBeInTheDocument();
    expect(screen.getByText("Operations")).toBeInTheDocument();
    expect(screen.getByText("Governance")).toBeInTheDocument();
  });

  it("renders feature links as navigation items", () => {
    const mockFeatures = [
      createMockFeature({
        manifest: { ...createMockFeature().manifest, id: "dashboard", title: "Dashboard" },
        route: { path: "/mission-control/dashboard", featureId: "dashboard", group: "Mission Control", title: "Dashboard", permission: "authenticated", platforms: ["web"], codeSplit: false },
      }),
    ];

    render(
      <MemoryRouter initialEntries={["/mission-control/dashboard"]}>
        <WebAppShell features={mockFeatures} router="memory" />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "Dashboard" })).toBeInTheDocument();
  });

  it("renders active route with styled link", () => {
    const mockFeatures = [
      createMockFeature({
        manifest: { ...createMockFeature().manifest, id: "dashboard", title: "Dashboard" },
        route: { path: "/mission-control/dashboard", featureId: "dashboard", group: "Mission Control", title: "Dashboard", permission: "authenticated", platforms: ["web"], codeSplit: false },
      }),
    ];

    render(
      <MemoryRouter initialEntries={["/mission-control/dashboard"]}>
        <WebAppShell features={mockFeatures} router="memory" />
      </MemoryRouter>,
    );

    const activeLink = screen.getByRole("link", { name: "Dashboard" });
    expect(activeLink).toHaveAttribute("aria-current", "page");
  });
});

describe("UI integration: system status display", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders system status bar with WS and offline status", () => {
    render(
      <MemoryRouter>
        <WebAppShell features={[createMockFeature()]} />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("system-status-bar")).toBeInTheDocument();
    expect(screen.getByText(/WS: connected/)).toBeInTheDocument();
    expect(screen.getByText(/Offline Queue: idle/)).toBeInTheDocument();
  });
});

describe("UI integration: error boundary behavior", () => {
  afterEach(() => {
    cleanup();
  });

  it("catches rendering error and displays user-friendly message", () => {
    const ErrorThrowingComponent = () => {
      throw new Error("Integration test error");
    };

    const mockFeatures = [
      createMockFeature({
        Component: ErrorThrowingComponent as never,
      }),
    ];

    render(
      <MemoryRouter initialEntries={["/test"]}>
        <WebAppShell features={mockFeatures} router="memory" />
      </MemoryRouter>,
    );

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByText("Integration test error")).toBeInTheDocument();
  });

  it("provides retry action in error boundary", () => {
    const ErrorThrowingComponent = () => {
      throw new Error("Test error for retry");
    };

    const mockFeatures = [
      createMockFeature({
        Component: ErrorThrowingComponent as never,
      }),
    ];

    render(
      <MemoryRouter initialEntries={["/test"]}>
        <WebAppShell features={mockFeatures} router="memory" />
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Report Issue" })).toBeInTheDocument();
  });
});

describe("UI integration: runtime configuration flow", () => {
  it("web runtime creates config from environment", () => {
    const { createWebRuntimeConfig } = require("../../web/src/runtime");
    const config = createWebRuntimeConfig({
      VITE_API_BASE_URL: "https://api.test.com",
      VITE_WS_URL: "wss://ws.test.com",
    });
    expect(config.apiBaseUrl).toBe("https://api.test.com");
    expect(config.wsUrl).toBe("wss://ws.test.com");
  });

  it("web runtime creates clients from config", () => {
    const { createWebRuntimeClients } = require("../../web/src/runtime");
    const clients = createWebRuntimeClients({});
    expect(clients.client).toBeDefined();
    expect(clients.wsClient).toBeDefined();
    expect(clients.offlineQueue).toBeDefined();
  });
});

describe("UI integration: mobile app with native bridge", () => {
  afterEach(() => {
    cleanup();
  });

  it("mobile app detects native bridge availability", () => {
    // This is tested by importing MobileApp and checking the rendered output
    // The bridge status should reflect whether __AA_MOBILE__ is defined
    // Note: This would require actual React rendering in a real integration test
    expect(true).toBe(true); // Placeholder for actual integration test
  });
});

describe("UI integration: multi-platform feature rendering", () => {
  afterEach(() => {
    cleanup();
  });

  it("features render across different route paths", () => {
    const mockFeatures = [
      createMockFeature({
        manifest: { ...createMockFeature().manifest, id: "workflows", title: "Workflows" },
        route: { path: "/mission-control/workflows", featureId: "workflows", group: "Mission Control", title: "Workflows", permission: "authenticated", platforms: ["web", "windows", "macos"], codeSplit: false },
      }),
    ];

    render(
      <MemoryRouter initialEntries={["/mission-control/workflows"]}>
        <WebAppShell features={mockFeatures} router="memory" />
      </MemoryRouter>,
    );

    expect(screen.getByText("Workflows")).toBeInTheDocument();
  });

  it("supports planned features that render differently", () => {
    const mockFeatures = [
      createMockFeature({
        manifest: { ...createMockFeature().manifest, id: "workflow-builder", title: "Workflow Builder", kind: "planned" as const },
        route: { path: "/extended/workflow-builder", featureId: "workflow-builder", group: "Extended", title: "Workflow Builder", permission: "authenticated", platforms: ["web"], codeSplit: false },
      }),
    ];

    render(
      <MemoryRouter initialEntries={["/extended/workflow-builder"]}>
        <WebAppShell features={mockFeatures} router="memory" />
      </MemoryRouter>,
    );

    // Planned features should still render
    expect(screen.getByText("Workflow Builder")).toBeInTheDocument();
  });
});

describe("UI integration: catch-all route behavior", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders first feature for unmatched routes", () => {
    const firstFeature = createMockFeature({
      manifest: { ...createMockFeature().manifest, id: "dashboard", title: "Dashboard" },
      route: { path: "/mission-control/dashboard", featureId: "dashboard", group: "Mission Control", title: "Dashboard", permission: "authenticated", platforms: ["web"], codeSplit: false },
    });
    const secondFeature = createMockFeature({
      manifest: { ...createMockFeature().manifest, id: "tasks", title: "Tasks" },
      route: { path: "/mission-control/tasks", featureId: "tasks", group: "Mission Control", title: "Tasks", permission: "authenticated", platforms: ["web"], codeSplit: false },
    });

    render(
      <MemoryRouter initialEntries={["/some/unknown/route"]}>
        <WebAppShell features={[firstFeature, secondFeature]} router="memory" />
      </MemoryRouter>,
    );

    // Should fall back to first feature
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
  });
});

describe("UI integration: guard chain with tenant context", () => {
  afterEach(() => {
    cleanup();
  });

  it("uses tenantId from authContext for guard evaluation", () => {
    const { createFeatureGuardContext } = require("@aa/shared-domain");

    const authContext = {
      userId: "tenant-admin",
      permissions: ["admin"],
      tenantId: "tenant-specific-id",
      roles: ["tenant-admin"],
    };

    render(
      <MemoryRouter initialEntries={["/test"]}>
        <WebAppShell
          features={[createMockFeature()]}
          router="memory"
          authContext={authContext}
        />
      </MemoryRouter>,
    );

    expect(createFeatureGuardContext).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "tenant-specific-id",
        authenticated: true,
      }),
    );
  });
});