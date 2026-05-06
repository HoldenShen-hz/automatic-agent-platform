import { render, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";

import { TokenManager } from "@aa/shared-auth";
import { UiRuntimeProvider } from "@aa/shared-state";

describe("shared runtime websocket regression", () => {
  it("uses the provided wsUrl when bootstrapping the runtime websocket connection", async () => {
    const tokenManager = new TokenManager();
    tokenManager.setSession({
      accessToken: "session-access-token",
      refreshToken: "session-refresh-token",
      expiresAt: Date.now() + 60_000,
    });

    const wsClient = {
      connect: vi.fn(),
      disconnect: vi.fn(),
      subscribe: vi.fn(() => () => undefined),
      onStatusChange: vi.fn((handler: (status: "disconnected") => void) => {
        handler("disconnected");
        return () => undefined;
      }),
      publish: vi.fn(),
      useSseFallback: vi.fn(),
    };

    render(
      createElement(
        UiRuntimeProvider,
        {
          tokenManager,
          wsClient,
          wsUrl: "wss://platform.example.test/realtime",
          authContext: {
            userId: "user-123",
            tenantId: "tenant-abc",
            permissions: ["dashboard:read"],
            roles: ["operator"],
          },
        },
        createElement("div", undefined, "runtime with ws"),
      ),
    );

    await waitFor(() => {
      expect(wsClient.connect).toHaveBeenCalledWith(
        "wss://platform.example.test/realtime",
        "session-access-token",
      );
    });
  });
});
