import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import React from "react";
import { WebAppShell, type AuthContext } from "../../../../../apps/web/src/app-shell";
import type { FeatureModule } from "@aa/ui-core";

const sharedDomainMocks = vi.hoisted(() => ({
  createFeatureGuardContext: vi.fn().mockImplementation((ctx) => ctx),
  createRouteGuardChain: vi.fn().mockImplementation(() => ({
    evaluate: () => ({ allowed: true, reason: "" }),
  })),
}));

const sharedPlatformMocks = vi.hoisted(() => ({
  createWebPlatformAdapter: vi.fn(() => ({ platform: "web" })),
}));

vi.mock("@aa/ui-core", () => ({
  applyResolvedTheme: vi.fn(),
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
  useThemeState: () => ({ resolvedThemeName: "light" }),
}));

vi.mock("@aa/shared-domain", () => sharedDomainMocks);

vi.mock("@aa/shared-platform", () => ({
  PlatformAdapterProvider: ({ children }: { children: ReactElement }) => (
    <div data-testid="platform-adapter-provider">{children}</div>
  ),
  createWebPlatformAdapter: sharedPlatformMocks.createWebPlatformAdapter,
}));

function createMockRoute(path: string): FeatureModule["route"] {
  return {
    path,
    featureId: "mock-feature",
    group: "Test Group",
    title: "Mock Feature",
    permission: "authenticated",
    platforms: ["web"],
    codeSplit: true,
  };
}

function createMockFeature(overrides: Partial<FeatureModule> = {}): FeatureModule {
  return {
    manifest: {
      id: "mock-feature",
      title: "Mock Feature",
      group: "Test Group",
      kind: "implemented",
      status: "Implemented/Internal",
      path: "/mock",
      permission: "authenticated",
      platforms: ["web"],
      apiLayer: "C",
      summary: "Mock feature summary",
    },
    route: createMockRoute("/mock"),
    Component: () => <div data-testid="mock-component">Mock Feature Content</div>,
    ...overrides,
  } as FeatureModule;
}

function createMockSubPage(id: string, label: string) {
  return {
    id,
    path: id,
    label,
    Component: () => <div data-testid={`subpage-${id}`}>{label}</div>,
  };
}

function renderShell(
  features: readonly FeatureModule[],
  options?: {
    initialEntries?: readonly string[];
    authContext?: AuthContext;
    router?: "browser" | "memory";
  },
) {
  return render(
    <WebAppShell
      features={features}
      router={options?.router ?? "memory"}
      {...(options?.initialEntries == null ? {} : { initialEntries: options.initialEntries })}
      {...(options?.authContext == null ? {} : { authContext: options.authContext })}
    />,
  );
}

describe("WebAppShell", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders shell chrome, navigation and runtime providers", () => {
    renderShell([createMockFeature()], { initialEntries: ["/mock"] });

    expect(screen.getByText("Automatic Agent Platform UI")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Mock Feature" })).toBeInTheDocument();
    expect(screen.getByTestId("system-status-bar")).toBeInTheDocument();
    expect(screen.getByTestId("platform-adapter-provider")).toBeInTheDocument();
    expect(screen.getByTestId("ui-runtime-provider")).toBeInTheDocument();
    expect(sharedPlatformMocks.createWebPlatformAdapter).toHaveBeenCalledTimes(1);
  });

  it("passes auth context into feature guard evaluation", () => {
    const authContext: AuthContext = {
      userId: "user-123",
      permissions: ["read", "write"],
      tenantId: "tenant-abc",
      roles: ["operator"],
    };

    renderShell([createMockFeature()], {
      initialEntries: ["/mock"],
      authContext,
    });

    expect(sharedDomainMocks.createFeatureGuardContext).toHaveBeenCalledWith(
      expect.objectContaining({
        authenticated: true,
        tenantId: "tenant-abc",
        permissions: ["read", "write"],
        roles: ["operator"],
      }),
    );
  });

  it("shows access denied when route guard rejects", () => {
    sharedDomainMocks.createRouteGuardChain.mockReturnValueOnce({
      evaluate: () => ({ allowed: false, reason: "Insufficient permissions" }),
    });

    renderShell(
      [
        createMockFeature({
          route: { ...createMockRoute("/admin"), permission: "admin" },
        }),
      ],
      {
        initialEntries: ["/admin"],
        authContext: { userId: "u1", permissions: [], tenantId: "t1", roles: [] },
      },
    );

    expect(screen.getByText("访问被拒绝")).toBeInTheDocument();
    expect(screen.getByText("Insufficient permissions")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "返回上一页" })).toBeInTheDocument();
  });

  it("renders an empty-state shell when no features are registered", () => {
    renderShell([], { initialEntries: ["/"] });

    expect(screen.getByText("当前没有可用功能")).toBeInTheDocument();
  });

  it("catches feature render errors in the error boundary", () => {
    const ErrorThrowingComponent = () => {
      throw new Error("Specific error message for testing");
    };

    renderShell(
      [
        createMockFeature({
          Component: ErrorThrowingComponent as never,
        }),
      ],
      { initialEntries: ["/mock"] },
    );

    expect(screen.getByText("页面渲染失败")).toBeInTheDocument();
    expect(screen.getByText("Specific error message for testing")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "重试" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "上报问题" })).toBeInTheDocument();
  });

  it("renders the retry affordance in the error boundary", () => {
    const ErrorThrowingComponent = () => {
      throw new Error("Temporary error");
    };

    renderShell(
      [
        createMockFeature({
          Component: ErrorThrowingComponent as never,
        }),
      ],
      { initialEntries: ["/mock"] },
    );

    expect(screen.getByRole("button", { name: "重试" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "上报问题" }));
  });

  it("renders declared feature sub-pages as nested routes", async () => {
    renderShell(
      [
        createMockFeature({
          manifest: {
            ...createMockFeature().manifest,
            id: "settings",
            title: "Settings",
            path: "/admin/settings",
          },
          route: { ...createMockRoute("/admin/settings"), featureId: "settings", title: "Settings" },
          subPages: [
            createMockSubPage("general", "General"),
            createMockSubPage("security", "Security"),
          ],
        }),
      ],
      { initialEntries: ["/admin/settings/general"] },
    );

    expect(screen.getByRole("navigation", { name: "Settings sections" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "General" })).toBeInTheDocument();
    expect(await screen.findByTestId("subpage-general")).toBeInTheDocument();
  });

  it("renders the first feature for unknown routes", () => {
    const firstFeature = createMockFeature({
      manifest: {
        ...createMockFeature().manifest,
        id: "first",
        title: "First Feature",
        path: "/first",
      },
      route: { ...createMockRoute("/first"), featureId: "first", title: "First Feature" },
      Component: () => <div data-testid="first-feature-body">First Feature</div>,
    });
    const secondFeature = createMockFeature({
      manifest: {
        ...createMockFeature().manifest,
        id: "second",
        title: "Second Feature",
        path: "/second",
      },
      route: { ...createMockRoute("/second"), featureId: "second", title: "Second Feature" },
      Component: () => <div>Second Feature</div>,
    });

    renderShell([firstFeature, secondFeature], { initialEntries: ["/unknown-route"] });
    expect(screen.getByTestId("first-feature-body")).toBeInTheDocument();
  });

  it("groups features by manifest group in the sidebar", () => {
    renderShell(
      [
        createMockFeature({
          manifest: { ...createMockFeature().manifest, id: "f1", title: "Alpha One", group: "Alpha", path: "/f1" },
          route: { ...createMockRoute("/f1"), featureId: "f1", title: "Alpha One", group: "Alpha" },
        }),
        createMockFeature({
          manifest: { ...createMockFeature().manifest, id: "f2", title: "Beta One", group: "Beta", path: "/f2" },
          route: { ...createMockRoute("/f2"), featureId: "f2", title: "Beta One", group: "Beta" },
        }),
      ],
      { initialEntries: ["/f1"] },
    );

    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Alpha One" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Beta One" })).toBeInTheDocument();
  });

  it("marks the active route link with aria-current", () => {
    renderShell([createMockFeature()], { initialEntries: ["/mock"] });
    expect(screen.getByRole("link", { name: "Mock Feature" })).toHaveAttribute("aria-current", "page");
  });

  it("renders main and aside layout regions", () => {
    renderShell([createMockFeature()], { initialEntries: ["/mock"] });

    expect(document.querySelector("main")).not.toBeNull();
    expect(document.querySelector("aside")).not.toBeNull();
  });
});
