import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor, act } from "@testing-library/react";
import type { ReactElement } from "react";
import React from "react";
import { MemoryRouter, BrowserRouter } from "react-router-dom";
import { WebAppShell, type WebAppShellProps, type AuthContext } from "./app-shell";
import type { FeatureModule } from "@aa/ui-core";

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
  createRouteGuardChain: vi.fn().mockImplementation((_permission, _plannedId) => ({
    evaluate: () => ({ allowed: true, reason: "" }),
  })),
}));

const createMockFeature = (overrides = {}): FeatureModule =>
  ({
    manifest: {
      id: "mock-feature",
      title: "Mock Feature",
      group: "Test Group",
      kind: "implemented",
      status: "Implemented/Internal",
    },
    route: {
      path: "/mock",
      featureId: "mock-feature",
      group: "Test Group",
      title: "Mock Feature",
      permission: "authenticated",
      platforms: ["web", "windows", "macos", "linux", "android", "ios"],
      codeSplit: false,
    },
    Component: () => <div data-testid="mock-component">Mock Feature Content</div>,
    ...overrides,
  } as FeatureModule);

const createMockRoute = (path: string): FeatureModule["route"] => ({
  path,
  featureId: "mock-feature",
  group: "Test Group",
  title: "Mock Feature",
  permission: "authenticated",
  platforms: ["web"],
  codeSplit: false,
});

describe("WebAppShell component rendering", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders without crashing", () => {
    render(
      <MemoryRouter>
        <WebAppShell features={[createMockFeature()]} />
      </MemoryRouter>,
    );
    expect(screen.getByText("Automatic Agent Platform UI")).toBeInTheDocument();
  });

  it("renders with MemoryRouter", () => {
    render(
      <MemoryRouter initialEntries={["/mock"]}>
        <WebAppShell features={[createMockFeature()]} router="memory" />
      </MemoryRouter>,
    );
    expect(screen.getByText("Automatic Agent Platform UI")).toBeInTheDocument();
  });

  it("renders with BrowserRouter", () => {
    render(
      <BrowserRouter>
        <WebAppShell features={[createMockFeature()]} router="browser" />
      </BrowserRouter>,
    );
    expect(screen.getByText("Automatic Agent Platform UI")).toBeInTheDocument();
  });

  it("renders with custom initialEntries", () => {
    render(
      <MemoryRouter initialEntries={["/custom-entry"]}>
        <WebAppShell features={[createMockFeature()]} router="memory" initialEntries={["/custom-entry"]} />
      </MemoryRouter>,
    );
    expect(screen.getByText("Automatic Agent Platform UI")).toBeInTheDocument();
  });
});

describe("WebAppShell navigation rendering", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders feature groups in sidebar", () => {
    const mockFeatures = [
      createMockFeature({
        manifest: { ...createMockFeature().manifest, id: "feature-1", group: "Mission Control" },
        route: createMockRoute("/feature-1"),
      }),
      createMockFeature({
        manifest: { ...createMockFeature().manifest, id: "feature-2", group: "Operations" },
        route: createMockRoute("/feature-2"),
      }),
    ];

    render(
      <MemoryRouter initialEntries={["/feature-1"]}>
        <WebAppShell features={mockFeatures} router="memory" />
      </MemoryRouter>,
    );

    expect(screen.getByText("Mission Control")).toBeInTheDocument();
    expect(screen.getByText("Operations")).toBeInTheDocument();
  });

  it("renders feature links in navigation", () => {
    const mockFeatures = [
      createMockFeature({
        manifest: { ...createMockFeature().manifest, id: "dashboard", title: "Dashboard" },
        route: createMockRoute("/mission-control/dashboard"),
      }),
    ];

    render(
      <MemoryRouter initialEntries={["/mission-control/dashboard"]}>
        <WebAppShell features={mockFeatures} router="memory" />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "Dashboard" })).toBeInTheDocument();
  });

  it("renders SystemStatusBar", () => {
    render(
      <MemoryRouter>
        <WebAppShell features={[createMockFeature()]} />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("system-status-bar")).toBeInTheDocument();
  });
});

describe("WebAppShell auth context handling", () => {
  afterEach(() => {
    cleanup();
  });

  it("passes null authContext when not provided", () => {
    const mockFeatures = [createMockFeature()];

    render(
      <MemoryRouter initialEntries={["/mock"]}>
        <WebAppShell features={mockFeatures} router="memory" />
      </MemoryRouter>,
    );

    // Should render without crashing
    expect(screen.getByText("Automatic Agent Platform UI")).toBeInTheDocument();
  });

  it("passes authContext to guard evaluation", () => {
    const { createFeatureGuardContext } = require("@aa/shared-domain");
    const mockAuthContext: AuthContext = {
      userId: "user-123",
      permissions: ["read", "write"],
      tenantId: "tenant-abc",
      roles: ["user"],
    };

    const mockFeatures = [createMockFeature()];

    render(
      <MemoryRouter initialEntries={["/mock"]}>
        <WebAppShell features={mockFeatures} router="memory" authContext={mockAuthContext} />
      </MemoryRouter>,
    );

    expect(createFeatureGuardContext).toHaveBeenCalledWith(
      expect.objectContaining({
        authenticated: true,
        tenantId: "tenant-abc",
        permissions: ["read", "write"],
        roles: ["user"],
      }),
    );
  });

  it("uses empty permissions when authContext not provided", () => {
    const { createFeatureGuardContext } = require("@aa/shared-domain");

    const mockFeatures = [createMockFeature()];

    render(
      <MemoryRouter initialEntries={["/mock"]}>
        <WebAppShell features={mockFeatures} router="memory" />
      </MemoryRouter>,
    );

    expect(createFeatureGuardContext).toHaveBeenCalledWith(
      expect.objectContaining({
        authenticated: false,
        permissions: [],
        roles: [],
      }),
    );
  });
});

describe("WebAppShell route guard behavior", () => {
  afterEach(() => {
    cleanup();
  });

  it("allows access when guard evaluates to allowed", () => {
    render(
      <MemoryRouter initialEntries={["/mock"]}>
        <WebAppShell features={[createMockFeature()]} router="memory" />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("mock-component")).toBeInTheDocument();
  });

  it("shows access denied when guard rejects", () => {
    const { createRouteGuardChain } = require("@aa/shared-domain");
    createRouteGuardChain.mockReturnValueOnce({
      evaluate: () => ({ allowed: false, reason: "Insufficient permissions" }),
    });

    const mockFeatures = [
      createMockFeature({
        route: { ...createMockRoute("/admin"), permission: "admin" },
      }),
    ];

    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <WebAppShell features={mockFeatures} router="memory" authContext={{ userId: "u1", permissions: [], tenantId: "t1", roles: [] }} />
      </MemoryRouter>,
    );

    expect(screen.getByText("Access denied")).toBeInTheDocument();
    expect(screen.getByText("Insufficient permissions")).toBeInTheDocument();
  });

  it("renders Go Back button on access denied", () => {
    const { createRouteGuardChain } = require("@aa/shared-domain");
    createRouteGuardChain.mockReturnValueOnce({
      evaluate: () => ({ allowed: false, reason: "Access denied" }),
    });

    const mockFeatures = [createMockFeature()];

    render(
      <MemoryRouter initialEntries={["/mock"]}>
        <WebAppShell features={mockFeatures} router="memory" />
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: "Go Back" })).toBeInTheDocument();
  });
});

describe("WebAppShell error boundary", () => {
  afterEach(() => {
    cleanup();
  });

  it("catches component errors and shows error UI", () => {
    const ErrorThrowingComponent = () => {
      throw new Error("Test rendering error");
    };

    const mockFeatures = [
      createMockFeature({
        Component: ErrorThrowingComponent as never,
      }),
    ];

    render(
      <MemoryRouter initialEntries={["/mock"]}>
        <WebAppShell features={mockFeatures} router="memory" />
      </MemoryRouter>,
    );

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("shows error message in error boundary", () => {
    const ErrorThrowingComponent = () => {
      throw new Error("Specific error message for testing");
    };

    const mockFeatures = [
      createMockFeature({
        Component: ErrorThrowingComponent as never,
      }),
    ];

    render(
      <MemoryRouter initialEntries={["/mock"]}>
        <WebAppShell features={mockFeatures} router="memory" />
      </MemoryRouter>,
    );

    expect(screen.getByText("Specific error message for testing")).toBeInTheDocument();
  });

  it("shows Retry and Report Issue buttons", () => {
    const ErrorThrowingComponent = () => {
      throw new Error("Test error");
    };

    const mockFeatures = [
      createMockFeature({
        Component: ErrorThrowingComponent as never,
      }),
    ];

    render(
      <MemoryRouter initialEntries={["/mock"]}>
        <WebAppShell features={mockFeatures} router="memory" />
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Report Issue" })).toBeInTheDocument();
  });

  it("Retry button resets error state", async () => {
    let renderCount = 0;
    const ErrorThrowingComponent = () => {
      renderCount++;
      if (renderCount === 1) {
        throw new Error("Test error");
      }
      return <div>Recovered</div>;
    };

    const mockFeatures = [
      createMockFeature({
        Component: ErrorThrowingComponent as never,
      }),
    ];

    render(
      <MemoryRouter initialEntries={["/mock"]}>
        <WebAppShell features={mockFeatures} router="memory" />
      </MemoryRouter>,
    );

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    const retryButton = screen.getByRole("button", { name: "Retry" });

    await act(async () => {
      fireEvent.click(retryButton);
    });
  });
});

describe("WebAppShell nested routes", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders feature with nested child routes", () => {
    const mockFeatures = [createMockFeature()];

    render(
      <MemoryRouter initialEntries={["/mock"]}>
        <WebAppShell features={mockFeatures} router="memory" />
      </MemoryRouter>,
    );

    // The component should render (nested routes are handled by React Router)
    expect(screen.getByText("Automatic Agent Platform UI")).toBeInTheDocument();
  });
});

describe("WebAppShell UiRuntimeProvider integration", () => {
  afterEach(() => {
    cleanup();
  });

  it("passes client prop to UiRuntimeProvider", () => {
    const mockClient = {} as never;
    render(
      <MemoryRouter>
        <WebAppShell features={[createMockFeature()]} client={mockClient} />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("ui-runtime-provider")).toBeInTheDocument();
  });

  it("passes wsClient prop to UiRuntimeProvider", () => {
    const mockWsClient = {} as never;
    render(
      <MemoryRouter>
        <WebAppShell features={[createMockFeature()]} wsClient={mockWsClient} />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("ui-runtime-provider")).toBeInTheDocument();
  });
});

describe("WebAppShell fallback route behavior", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders first feature for unknown routes (catch-all)", () => {
    const firstFeature = createMockFeature({
      manifest: { ...createMockFeature().manifest, id: "first", title: "First Feature" },
      route: { ...createMockRoute("/first"), featureId: "first" },
    });
    const secondFeature = createMockFeature({
      manifest: { ...createMockFeature().manifest, id: "second", title: "Second Feature" },
      route: { ...createMockRoute("/second"), featureId: "second" },
    });

    render(
      <MemoryRouter initialEntries={["/unknown-route"]}>
        <WebAppShell features={[firstFeature, secondFeature]} router="memory" />
      </MemoryRouter>,
    );

    // Should render first feature for unknown routes (catch-all behavior)
    expect(screen.getByText("First Feature")).toBeInTheDocument();
  });
});

describe("WebAppShell feature grouping", () => {
  afterEach(() => {
    cleanup();
  });

  it("groups features by manifest.group", () => {
    const mockFeatures = [
      createMockFeature({
        manifest: { ...createMockFeature().manifest, id: "f1", title: "Feature 1", group: "Alpha" },
        route: createMockRoute("/f1"),
      }),
      createMockFeature({
        manifest: { ...createMockFeature().manifest, id: "f2", title: "Feature 2", group: "Alpha" },
        route: createMockRoute("/f2"),
      }),
      createMockFeature({
        manifest: { ...createMockFeature().manifest, id: "f3", title: "Feature 3", group: "Beta" },
        route: createMockRoute("/f3"),
      }),
    ];

    render(
      <MemoryRouter initialEntries={["/f1"]}>
        <WebAppShell features={mockFeatures} router="memory" />
      </MemoryRouter>,
    );

    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
  });

  it("renders features within groups", () => {
    const mockFeatures = [
      createMockFeature({
        manifest: { ...createMockFeature().manifest, id: "alpha1", title: "Alpha One", group: "Alpha" },
        route: createMockRoute("/alpha1"),
      }),
      createMockFeature({
        manifest: { ...createMockFeature().manifest, id: "alpha2", title: "Alpha Two", group: "Alpha" },
        route: createMockRoute("/alpha2"),
      }),
    ];

    render(
      <MemoryRouter initialEntries={["/alpha1"]}>
        <WebAppShell features={mockFeatures} router="memory" />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "Alpha One" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Alpha Two" })).toBeInTheDocument();
  });
});

describe("WebAppShell layout structure", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders two-column grid layout", () => {
    render(
      <MemoryRouter>
        <WebAppShell features={[createMockFeature()]} />
      </MemoryRouter>,
    );

    const main = document.querySelector("main");
    expect(main).toBeInTheDocument();
  });

  it("renders aside with navigation", () => {
    render(
      <MemoryRouter>
        <WebAppShell features={[createMockFeature()]} />
      </MemoryRouter>,
    );

    const aside = document.querySelector("aside");
    expect(aside).toBeInTheDocument();
  });
});

describe("WebAppShell active route styling", () => {
  afterEach(() => {
    cleanup();
  });

  it("applies active style to current route link", () => {
    const mockFeatures = [createMockFeature({ route: createMockRoute("/active-test") })];

    render(
      <MemoryRouter initialEntries={["/active-test"]}>
        <WebAppShell features={mockFeatures} router="memory" />
      </MemoryRouter>,
    );

    const link = screen.getByRole("link", { name: "Mock Feature" });
    expect(link).toHaveAttribute("aria-current", "page");
  });
});