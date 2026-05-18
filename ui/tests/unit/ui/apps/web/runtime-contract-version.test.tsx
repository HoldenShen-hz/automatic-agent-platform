import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WebAppShell } from "../../../../../apps/web/src/app-shell";
import { checkWebContractVersion } from "../../../../../apps/web/src/runtime";

const mocks = vi.hoisted(() => ({
  fetchContractVersion: vi.fn(),
}));

vi.mock("@aa/ui-core", () => ({
  applyResolvedTheme: vi.fn(),
  SystemStatusBar: () => <div data-testid="system-status-bar">status</div>,
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
  UiRuntimeProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
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
  createAuthInterceptor: vi.fn(() => (request: unknown) => request),
  createContractVersionInterceptor: vi.fn(() => (request: unknown) => request),
  createCsrfInterceptor: vi.fn(() => (request: unknown) => request),
  createIdempotencyKeyInterceptor: vi.fn(() => (request: unknown) => request),
  createOfflineQueueInterceptor: vi.fn(() => (request: unknown) => request),
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
  PlatformAdapterProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe("runtime contract version bootstrap", () => {
  it("returns a warning banner when server and client contract versions drift", async () => {
    mocks.fetchContractVersion.mockResolvedValueOnce({
      contractVersion: "2027-01-01",
      minServerVersion: "2027-01-01",
      supportedVersions: ["2027-01-01"],
    });

    await expect(checkWebContractVersion({} as never)).resolves.toEqual({
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
          message: "Server contract 2027-01-01 is outside the client-supported set 2026-04-01, 2026-01-01.",
        }}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Contract version mismatch");
    expect(screen.getByRole("alert")).toHaveTextContent("Server contract 2027-01-01 is outside the client-supported set 2026-04-01, 2026-01-01.");
  });
});
