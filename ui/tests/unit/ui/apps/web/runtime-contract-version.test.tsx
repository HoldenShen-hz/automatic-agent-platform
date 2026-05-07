import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WebAppShell } from "../../../../../apps/web/src/app-shell";
import { checkWebContractVersion } from "../../../../../apps/web/src/runtime";

vi.mock("@aa/ui-core", () => ({
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

const fetchContractVersion = vi.fn();

vi.mock("@aa/shared-api-client", () => ({
  BrowserWSClient: vi.fn(),
  DefaultRESTClient: vi.fn(),
  HttpTransport: vi.fn(),
  InMemoryWSClient: vi.fn(),
  fetchContractVersion: (...args: unknown[]) => fetchContractVersion(...args),
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
    fetchContractVersion.mockResolvedValueOnce({
      contractVersion: "v2",
      minServerVersion: "v2",
      supportedVersions: ["v2"],
    });

    await expect(checkWebContractVersion({} as never)).resolves.toEqual({
      tone: "warning",
      title: "Contract version mismatch",
      message: "Server contract v2 is outside the client-supported set v1.",
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
          message: "Server contract v2 is outside the client-supported set v1.",
        }}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Contract version mismatch");
    expect(screen.getByRole("alert")).toHaveTextContent("Server contract v2 is outside the client-supported set v1.");
  });
});
