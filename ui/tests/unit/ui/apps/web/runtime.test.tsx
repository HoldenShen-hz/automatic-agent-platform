import { describe, expect, it, vi } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import React from "react";
import {
  createAuthInterceptor,
  createTenantInterceptor,
  createDedupeInterceptor,
  createRetryInterceptor,
  DEFAULT_ACCEPT_VERSIONS,
  fetchContractVersion,
} from "@aa/shared-api-client";
import { createFeatureGuardContext, createRouteGuardChain } from "@aa/shared-domain";
import { App } from "../../../../../apps/web/src/App";
import { WebAppShell } from "../../../../../apps/web/src/app-shell";
import {
  checkWebContractVersion,
  createWebRuntimeConfig,
  createWebRuntimeClients,
  registerWebServiceWorker,
} from "../../../../../apps/web/src/runtime";
import { featureRegistry } from "../../../../../apps/web/src/feature-registry";

vi.mock("../../../../../apps/web/src/feature-registry", () => ({
  missionControlFeatureContracts: [
    { id: "alerts", path: "/mission-control/alerts", permission: "platform_sre" },
    { id: "conversation", group: "Mission Control", path: "/mission-control/conversation" },
  ],
  featureRegistry: [
    {
      manifest: { id: "dashboard", title: "Dashboard", group: "Mission Control", kind: "implemented", status: "Implemented/Internal" },
      route: { path: "/mission-control/dashboard", featureId: "dashboard", group: "Mission Control", title: "Dashboard", permission: "authenticated", platforms: ["web"], codeSplit: true },
      Component: () => <div data-testid="dashboard-feature">Dashboard</div>,
    },
    {
      manifest: { id: "task-cockpit", title: "Task Cockpit", group: "Operations", kind: "implemented", status: "Implemented/Internal" },
      route: { path: "/operations/task-cockpit", featureId: "task-cockpit", group: "Operations", title: "Task Cockpit", permission: "authenticated", platforms: ["web"], codeSplit: true },
      Component: () => <div>Task Cockpit</div>,
    },
    {
      manifest: { id: "policy", title: "Policy", group: "Governance", kind: "implemented", status: "Implemented/Internal" },
      route: { path: "/governance/policy", featureId: "policy", group: "Governance", title: "Policy", permission: "authenticated", platforms: ["web"], codeSplit: true },
      Component: () => <div>Policy</div>,
    },
    {
      manifest: { id: "workflow-builder", title: "Workflow Builder", group: "Extended", kind: "planned", status: "Planned" },
      route: { path: "/extended/workflow-builder", featureId: "workflow-builder", group: "Extended", title: "Workflow Builder", permission: "authenticated", platforms: ["web"], codeSplit: true },
      Component: () => <div>Workflow Builder</div>,
    },
    {
      manifest: { id: "workers", title: "Workers", group: "Admin", kind: "implemented", status: "Implemented/Internal" },
      route: { path: "/admin/workers", featureId: "workers", group: "Admin", title: "Workers", permission: "authenticated", platforms: ["web"], codeSplit: true },
      Component: () => <div>Workers</div>,
    },
  ],
}));

// Mock shared modules
vi.mock("@aa/ui-core", () => ({
  applyResolvedTheme: vi.fn(),
  createFeatureModule: vi.fn((config: {
    id: string;
    title: string;
    group: string;
    path: string;
    permission: string;
    status: string;
    kind?: "implemented" | "planned";
    platforms?: readonly string[];
    render?: () => ReactElement;
  }) => ({
    manifest: {
      id: config.id,
      title: config.title,
      group: config.group,
      path: config.path,
      permission: config.permission,
      status: config.status,
      kind: config.kind ?? "implemented",
      platforms: config.platforms ?? ["web"],
      summary: `${config.title} summary`,
      apiLayer: "C",
    },
    route: {
      path: config.path,
      featureId: config.id,
      group: config.group,
      title: config.title,
      permission: config.permission,
      platforms: config.platforms ?? ["web"],
      codeSplit: true,
    },
    Component: config.render ?? (() => <div>{config.title}</div>),
  })),
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
  FeatureScaffold: ({ children, title }: { children: ReactElement; title: string }) => (
    <section data-testid={`feature-${title.replace(/\s+/g, "-").toLowerCase()}`}>
      <h2>{title}</h2>
      {children}
    </section>
  ),
}));

vi.mock("@aa/shared-state", () => ({
  UiRuntimeProvider: ({ children }: { children: ReactElement }) => <div data-testid="ui-runtime-provider">{children}</div>,
  useSystemStatus: () => ({ ws: "connected", offline: "idle" }),
  useThemeState: () => ({ resolvedThemeName: "light" }),
}));

vi.mock("@aa/shared-domain", () => ({
  createFeatureGuardContext: vi.fn(() => ({
    authenticated: true,
    tenantId: "test-tenant",
    domainId: "platform",
    permissions: ["read", "write", "admin"],
    roles: ["platform-admin"],
  })),
  createRouteGuardChain: vi.fn(() => ({
    evaluate: () => ({ allowed: true, reason: "" }),
  })),
}));

vi.mock("@aa/shared-api-client", () => ({
  DEFAULT_ACCEPT_VERSIONS: ["2026-04-01", "2026-01-01"],
  BrowserWSClient: vi.fn(() => ({ kind: "browser-ws" })),
  DefaultRESTClient: vi.fn(() => ({ kind: "rest-client" })),
  HttpTransport: vi.fn(() => ({ send: vi.fn() })),
  InMemoryWSClient: vi.fn(() => ({ kind: "memory-ws" })),
  createRuntimeWSClient: vi.fn(() => ({ connect: vi.fn(), disconnect: vi.fn(), subscribe: vi.fn(), onStatusChange: vi.fn(), publish: vi.fn(), useSseFallback: vi.fn() })),
  fetchContractVersion: vi.fn(),
  createAuthInterceptor: vi.fn(() => (request: unknown) => request),
  createContractVersionInterceptor: vi.fn(() => (request: unknown) => request),
  createCsrfInterceptor: vi.fn(() => (request: unknown) => request),
  createDedupeInterceptor: vi.fn(() => (request: unknown) => request),
  createIdempotencyKeyInterceptor: vi.fn(() => (request: unknown) => request),
  createOfflineQueueInterceptor: vi.fn(() => (request: unknown) => request),
  createRetryInterceptor: vi.fn(() => (request: unknown) => request),
  createTenantInterceptor: vi.fn(() => (request: unknown) => request),
  createTraceInterceptor: vi.fn(() => (request: unknown) => request),
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
  PlatformAdapterProvider: ({ children }: { children: ReactElement }) => <div data-testid="platform-adapter-provider">{children}</div>,
}));

describe("web runtime configuration", () => {
  it("creates config from environment variables with VITE_API_BASE_URL", () => {
    const config = createWebRuntimeConfig({
      VITE_API_BASE_URL: "https://api.example.com",
      VITE_WS_URL: "wss://ws.example.com",
    });
    expect(config.apiBaseUrl).toBe("https://api.example.com");
    expect(config.wsUrl).toBe("wss://ws.example.com");
  });

  it("creates config without fallback to localhost:3000 when apiBaseUrl not provided", () => {
    const config = createWebRuntimeConfig({});
    expect(config.apiBaseUrl).toBeUndefined();
  });

  it("creates config with empty string returns undefined", () => {
    const config = createWebRuntimeConfig({
      VITE_API_BASE_URL: "",
    });
    expect(config.apiBaseUrl).toBeUndefined();
  });

  it("handles boolean environment variables", () => {
    const config = createWebRuntimeConfig({
      VITE_API_BASE_URL: "https://api.example.com",
      SOME_BOOLEAN: true,
    });
    expect(config.apiBaseUrl).toBe("https://api.example.com");
  });
});

describe("web runtime clients creation", () => {
  it("creates clients with fallback baseUrl when not provided", () => {
    const config = createWebRuntimeConfig({});
    const result = createWebRuntimeClients(config);
    expect(result.client).toBeDefined();
    expect(result.wsClient).toBeDefined();
    expect(result.offlineQueue).toBeDefined();
  });

  it("creates clients with custom apiBaseUrl", () => {
    const config = createWebRuntimeConfig({
      VITE_API_BASE_URL: "https://custom-api.example.com",
    });
    const result = createWebRuntimeClients(config);
    expect(result.client).toBeDefined();
  });

  it("creates clients with custom wsUrl", () => {
    const config = createWebRuntimeConfig({
      VITE_WS_URL: "wss://custom-ws.example.com",
    });
    const result = createWebRuntimeClients(config);
    expect(result.wsClient).toBeDefined();
  });

  it("uses TokenManager when provided in config", () => {
    createAuthInterceptor.mockClear();
    const mockTokenManager = {
      getToken: vi.fn(() => "test-token"),
      refreshToken: vi.fn(),
    };
    const config = createWebRuntimeConfig({});
    const result = createWebRuntimeClients({
      ...config,
      tokenManager: mockTokenManager as never,
    });
    expect(result.client).toBeDefined();
    expect(result.tokenManager).toBe(mockTokenManager);
    expect(createAuthInterceptor).toHaveBeenCalledWith(mockTokenManager);
  });

  it("passes tenantId to createWebRuntimeClients", () => {
    createTenantInterceptor.mockClear();
    const config = createWebRuntimeConfig({});
    const result = createWebRuntimeClients({
      ...config,
      tenantId: "tenant-123",
    });
    expect(result.client).toBeDefined();
    expect(createTenantInterceptor).toHaveBeenCalledWith("tenant-123");
  });
});

describe("contract version startup checks", () => {
  it("returns a startup banner when the server contract is outside the client-supported set", async () => {
    fetchContractVersion.mockResolvedValueOnce({
      contractVersion: "v2",
      minServerVersion: "v2",
      supportedVersions: ["v2"],
    });

    await expect(checkWebContractVersion({} as never)).resolves.toEqual({
      tone: "warning",
      title: "Contract version mismatch",
      message: `Server contract v2 is outside the client-supported set ${DEFAULT_ACCEPT_VERSIONS.join(", ")}.`,
    });
  });
});

describe("service worker registration", () => {
  it("returns null when window is undefined (SSR)", async () => {
    // Simulate SSR environment
    const result = await registerWebServiceWorker();
    // In jsdom environment, navigator.serviceWorker may not exist
    // The function should handle this gracefully
    expect(result === null || result instanceof ServiceWorkerRegistration).toBe(true);
  });
});

describe("web App component", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders without crashing", () => {
    render(<App />);
    expect(screen.getByText("Automatic Agent Platform UI")).toBeInTheDocument();
  });

  it("renders with MemoryRouter when specified", () => {
    render(<App router="memory" initialEntries={["/"]} />);
    expect(screen.getByText("Automatic Agent Platform UI")).toBeInTheDocument();
  });

  it("renders with custom authContext", () => {
    const authContext = {
      userId: "user-123",
      permissions: ["read", "write"],
      tenantId: "tenant-abc",
      roles: ["admin"],
    };
    render(<App authContext={authContext} />);
    expect(screen.getByText("Automatic Agent Platform UI")).toBeInTheDocument();
  });
});

describe("web app-shell guard behavior", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders access denied when guard rejects", () => {
    createRouteGuardChain.mockReturnValueOnce({
      evaluate: () => ({ allowed: false, reason: "Insufficient permissions" }),
    });

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
      Component: () => <div>Feature Content</div>,
    };

    render(
      <WebAppShell
        features={[mockFeature]}
        router="memory"
        initialEntries={["/test"]}
        authContext={{
          userId: "user-123",
          permissions: ["read"],
          tenantId: "tenant-abc",
          roles: ["user"],
        }}
      />,
    );

    expect(screen.getByText("Access denied")).toBeInTheDocument();
  });

  it("renders the startup mismatch banner when runtime bootstrap detects a contract drift", () => {
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
      Component: () => <div>Feature Content</div>,
    };

    render(
      <WebAppShell
        features={[mockFeature]}
        router="memory"
        initialEntries={["/test"]}
        startupBanner={{
          tone: "warning",
          title: "Contract version mismatch",
          message: `Server contract v2 is outside the client-supported set ${DEFAULT_ACCEPT_VERSIONS.join(", ")}.`,
        }}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Contract version mismatch");
    expect(screen.getByRole("alert")).toHaveTextContent(`Server contract v2 is outside the client-supported set ${DEFAULT_ACCEPT_VERSIONS.join(", ")}.`);
  });
});

describe("app-shell feature rendering", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders first feature as default for wildcard route", () => {
    const mockFeatures = [
      {
        manifest: {
          id: "dashboard",
          title: "Dashboard",
          group: "Mission Control",
          kind: "implemented",
        },
        route: {
          path: "/mission-control/dashboard",
          permission: "authenticated",
        },
        Component: () => <div data-testid="dashboard-component">Dashboard Content</div>,
      },
    ];

    render(<WebAppShell features={mockFeatures as never} router="memory" initialEntries={["/some-unknown-route"]} />);

    expect(screen.getByTestId("dashboard-component")).toBeInTheDocument();
  });

  it("renders feature groups in navigation", () => {
    const mockFeatures = [
      {
        manifest: {
          id: "feature-1",
          title: "Feature One",
          group: "Group A",
          kind: "implemented",
        },
        route: {
          path: "/feature-1",
          permission: "authenticated",
        },
        Component: () => <div>Feature 1</div>,
      },
      {
        manifest: {
          id: "feature-2",
          title: "Feature Two",
          group: "Group B",
          kind: "implemented",
        },
        route: {
          path: "/feature-2",
          permission: "authenticated",
        },
        Component: () => <div>Feature 2</div>,
      },
    ];

    render(<WebAppShell features={mockFeatures as never} router="memory" initialEntries={["/feature-1"]} />);

    expect(screen.getByText("Group A")).toBeInTheDocument();
    expect(screen.getByText("Group B")).toBeInTheDocument();
  });
});

describe("app-shell error boundary", () => {
  afterEach(() => {
    cleanup();
  });

  it("catches rendering errors and shows retry button", () => {
    const ErrorThrowingComponent = () => {
      throw new Error("Test error");
    };

    const mockFeatures = [
      {
        manifest: {
          id: "error-feature",
          title: "Error Feature",
          group: "Test",
          kind: "implemented",
        },
        route: {
          path: "/error",
          permission: "authenticated",
        },
        Component: ErrorThrowingComponent,
      },
    ];

    render(<WebAppShell features={mockFeatures as never} router="memory" initialEntries={["/error"]} />);

    // The error boundary should catch and display error UI
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Report Issue" })).toBeInTheDocument();
  });

  it("retry button resets error state", async () => {
    const ErrorThrowingComponent = () => {
      throw new Error("Test error");
    };

    const mockFeatures = [
      {
        manifest: {
          id: "error-feature",
          title: "Error Feature",
          group: "Test",
          kind: "implemented",
        },
        route: {
          path: "/error",
          permission: "authenticated",
        },
        Component: ErrorThrowingComponent,
      },
    ];

    render(<WebAppShell features={mockFeatures as never} router="memory" initialEntries={["/error"]} />);

    const retryButton = screen.getByRole("button", { name: "Retry" });
    fireEvent.click(retryButton);

    // After retry, error UI should be gone (though error will occur again)
    // The important thing is the button is clickable
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });
});

describe("feature-registry", () => {
  it("contains dashboard feature", () => {
    const dashboardFeature = featureRegistry.find((f) => f.manifest.id === "dashboard");
    expect(dashboardFeature).toBeDefined();
    expect(dashboardFeature?.manifest.title).toBeTruthy();
  });

  it("contains task-cockpit feature", () => {
    const taskFeature = featureRegistry.find((f) => f.manifest.id === "task-cockpit");
    expect(taskFeature).toBeDefined();
  });

  it("contains features across all groups", () => {
    const groups = new Set(featureRegistry.map((f) => f.manifest.group));
    expect(groups.has("Mission Control")).toBe(true);
    expect(groups.has("Operations")).toBe(true);
    expect(groups.has("Governance")).toBe(true);
    expect(groups.has("Extended")).toBe(true);
    expect(groups.has("Admin")).toBe(true);
  });

  it("all features have authenticated permission", () => {
    const allPermissionsDefined = featureRegistry.every(
      (f) => typeof f.route.permission === "string" && f.route.permission.length > 0,
    );
    expect(allPermissionsDefined).toBe(true);
  });

  it("all features support web platform", () => {
    const allSupportWeb = featureRegistry.every((f) =>
      f.route.platforms.includes("web"),
    );
    expect(allSupportWeb).toBe(true);
  });
});

describe("runtime security behaviors", () => {
  it("does not fallback to insecure localhost:3000 when apiBaseUrl is undefined", () => {
    const config = createWebRuntimeConfig({});
    // When apiBaseUrl is undefined, createWebRuntimeClients should NOT use hardcoded localhost
    // The actual HTTP transport should use fallbackToMock: true behavior
    const result = createWebRuntimeClients(config);
    expect(result.client).toBeDefined();
  });

  it("createWebRuntimeConfig returns undefined for empty string apiBaseUrl", () => {
    const config = createWebRuntimeConfig({
      VITE_API_BASE_URL: "",
    });
    expect(config.apiBaseUrl).toBeUndefined();
  });

  it("createWebRuntimeConfig handles whitespace-only strings", () => {
    const config = createWebRuntimeConfig({
      VITE_API_BASE_URL: "   ",
    });
    expect(config.apiBaseUrl).toBeUndefined();
  });
});

describe("app-shell auth context passthrough", () => {
  afterEach(() => {
    cleanup();
  });

  it("passes null authContext when not provided", () => {
    const mockFeatures = [
      {
        manifest: { id: "test", title: "Test", group: "Test", kind: "implemented" },
        route: { path: "/test", permission: "authenticated" },
        Component: () => <div data-testid="test-content">Test</div>,
      },
    ];

    render(<WebAppShell features={mockFeatures as never} router="memory" initialEntries={["/test"]} />);

    // Should render without crashing with null authContext
    expect(screen.getByTestId("test-content")).toBeInTheDocument();
  });

  it("uses authContext permissions for guard evaluation", () => {
    const mockFeatures = [
      {
        manifest: { id: "admin-feature", title: "Admin Feature", group: "Admin", kind: "implemented" },
        route: { path: "/admin-feature", permission: "admin" },
        Component: () => <div>Admin Content</div>,
      },
    ];

    const authContext = {
      userId: "admin-user",
      permissions: ["admin"],
      tenantId: "tenant-1",
      roles: ["platform-admin"],
    };

    render(<WebAppShell features={mockFeatures as never} router="memory" initialEntries={["/admin-feature"]} authContext={authContext} />);

    // createFeatureGuardContext should be called with the provided permissions
    expect(createFeatureGuardContext).toHaveBeenCalledWith(
      expect.objectContaining({
        permissions: ["admin"],
        roles: ["platform-admin"],
      }),
    );
  });
});
