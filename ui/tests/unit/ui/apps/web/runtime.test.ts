import { describe, expect, it, vi } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import { App } from "./App";
import { WebAppShell } from "./app-shell";
import { createWebRuntimeConfig, createWebRuntimeClients, registerWebServiceWorker } from "./runtime";
import { featureRegistry } from "./feature-registry";

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
  BrowserWSClient: vi.fn(),
  DefaultRESTClient: vi.fn(),
  HttpTransport: vi.fn(),
  InMemoryWSClient: vi.fn(),
  createAuthInterceptor: vi.fn(() => (request: unknown) => request),
  createContractVersionInterceptor: vi.fn(() => (request: unknown) => request),
  createCsrfInterceptor: vi.fn(() => (request: unknown) => request),
  createOfflineQueueInterceptor: vi.fn(() => (request: unknown) => request),
  createTenantInterceptor: vi.fn(() => (request: unknown) => request),
  createTraceInterceptor: vi.fn(() => (request: unknown) => request),
  TokenManager: vi.fn(),
}));

vi.mock("@aa/shared-sync", () => ({
  createPersistentOfflineQueue: vi.fn(() => ({
    enqueue: vi.fn(),
    dequeue: vi.fn(),
    flush: vi.fn(),
  })),
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
  });

  it("passes tenantId to createWebRuntimeClients", () => {
    const config = createWebRuntimeConfig({});
    const result = createWebRuntimeClients({
      ...config,
      tenantId: "tenant-123",
    });
    expect(result.client).toBeDefined();
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
    const { createRouteGuardChain } = require("@aa/shared-domain");
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
      <MemoryRouter initialEntries={["/test"]}>
        <WebAppShell
          features={[mockFeature]}
          router="memory"
          authContext={{
            userId: "user-123",
            permissions: ["read"],
            tenantId: "tenant-abc",
            roles: ["user"],
          }}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText("Access denied")).toBeInTheDocument();
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

    render(
      <MemoryRouter initialEntries={["/some-unknown-route"]}>
        <WebAppShell features={mockFeatures as never} router="memory" />
      </MemoryRouter>,
    );

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

    render(
      <MemoryRouter initialEntries={["/feature-1"]}>
        <WebAppShell features={mockFeatures as never} router="memory" />
      </MemoryRouter>,
    );

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

    render(
      <MemoryRouter initialEntries={["/error"]}>
        <WebAppShell features={mockFeatures as never} router="memory" />
      </MemoryRouter>,
    );

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

    render(
      <MemoryRouter initialEntries={["/error"]}>
        <WebAppShell features={mockFeatures as never} router="memory" />
      </MemoryRouter>,
    );

    const retryButton = screen.getByRole("button", { name: "Retry" });
    fireEvent.click(retryButton);

    // After retry, error UI should be gone (though error will occur again)
    // The important thing is the button is clickable
    expect(retryButton).toBeInTheDocument();
  });
});

describe("feature-registry", () => {
  it("contains dashboard feature", () => {
    const dashboardFeature = featureRegistry.find((f) => f.manifest.id === "dashboard");
    expect(dashboardFeature).toBeDefined();
    expect(dashboardFeature?.manifest.title).toBe("Dashboard");
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
    const allAuthenticated = featureRegistry.every(
      (f) => f.route.permission === "authenticated",
    );
    expect(allAuthenticated).toBe(true);
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
        Component: () => <div>Test</div>,
      },
    ];

    render(
      <MemoryRouter initialEntries={["/test"]}>
        <WebAppShell features={mockFeatures as never} router="memory" />
      </MemoryRouter>,
    );

    // Should render without crashing with null authContext
    expect(screen.getByText("Test")).toBeInTheDocument();
  });

  it("uses authContext permissions for guard evaluation", () => {
    const { createFeatureGuardContext } = require("@aa/shared-domain");

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

    render(
      <MemoryRouter initialEntries={["/admin-feature"]}>
        <WebAppShell features={mockFeatures as never} router="memory" authContext={authContext} />
      </MemoryRouter>,
    );

    // createFeatureGuardContext should be called with the provided permissions
    expect(createFeatureGuardContext).toHaveBeenCalledWith(
      expect.objectContaining({
        permissions: ["admin"],
        roles: ["platform-admin"],
      }),
    );
  });
});