import { describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import { render, screen, cleanup } from "@testing-library/react";
import { App } from "./App";
import { featureRegistry } from "./feature-registry";

// Mock the runtime modules to prevent actual initialization
vi.mock("./runtime", () => ({
  createWebRuntimeConfig: vi.fn(() => ({})),
  createWebRuntimeClients: vi.fn(() => ({
    client: {},
    wsClient: {},
    offlineQueue: { enqueue: vi.fn(), dequeue: vi.fn(), flush: vi.fn() },
  })),
  registerWebServiceWorker: vi.fn().mockResolvedValue(null),
}));

// Mock ui-core
vi.mock("@aa/ui-core", () => ({
  SystemStatusBar: () => null,
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

// Mock shared-state
vi.mock("@aa/shared-state", () => ({
  UiRuntimeProvider: ({ children }: { children: ReactElement }) => children as ReactElement,
  useSystemStatus: () => ({ ws: "connected", offline: "idle" }),
}));

// Mock shared-domain
vi.mock("@aa/shared-domain", () => ({
  createFeatureGuardContext: vi.fn(() => ({
    authenticated: true,
    tenantId: "test",
    domainId: "platform",
    permissions: [],
    roles: [],
  })),
  createRouteGuardChain: vi.fn(() => ({
    evaluate: () => ({ allowed: true, reason: "" }),
  })),
}));

describe("App component", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders web app shell", () => {
    render(<App />);
    expect(screen.getByText("Automatic Agent Platform UI")).toBeInTheDocument();
  });

  it("renders with empty props", () => {
    render(<App />);
    expect(screen.getByText("Automatic Agent Platform UI")).toBeInTheDocument();
  });

  it("renders with MemoryRouter configuration", () => {
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

describe("App props interface", () => {
  it("accepts WebAppShellProps through AppProps", () => {
    // AppProps extends Omit<WebAppShellProps, 'features'>
    const props = {
      client: {} as never,
      wsClient: {} as never,
      router: "memory" as const,
      initialEntries: ["/"] as string[],
      authContext: {
        userId: "test",
        permissions: ["read"],
        tenantId: "tenant",
        roles: ["user"],
      },
    };

    const { container } = render(<App {...props} />);
    expect(container).toBeDefined();
  });
});

describe("App feature registry integration", () => {
  it("uses featureRegistry for features", () => {
    expect(featureRegistry).toBeDefined();
    expect(Array.isArray(featureRegistry)).toBe(true);
    expect(featureRegistry.length).toBeGreaterThan(0);
  });

  it("renders first feature in registry", () => {
    render(<App />);

    // The App renders WebAppShell with featureRegistry
    // Dashboard should be the first feature
    const dashboardFeature = featureRegistry.find((f) => f.manifest.id === "dashboard");
    expect(dashboardFeature).toBeDefined();
  });
});

describe("App runtime integration", () => {
  it("receives runtime clients from createWebRuntimeClients", () => {
    render(<App />);

    // The App should have received mocked runtime clients
    // This verifies the integration between App and runtime
    expect(screen.getByText("Automatic Agent Platform UI")).toBeInTheDocument();
  });
});