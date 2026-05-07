import { describe, expect, it, vi } from "vitest";

import { WSEventRouter, mapEventToQuery } from "@aa/shared-api-client";

describe("WSEventRouter clarification mapping", () => {
  it("maps nl.clarification_needed to task query invalidation", async () => {
    const invalidateQueries = vi.fn(async () => undefined);
    const subscribe = vi.fn(() => () => undefined);
    const router = new WSEventRouter(
      {
        connect: vi.fn(),
        disconnect: vi.fn(),
        subscribe,
        onStatusChange: vi.fn(() => () => undefined),
        publish: vi.fn(),
        useSseFallback: vi.fn(),
      },
      {
        invalidateQueries,
      } as never,
    );

    const routed = router.route({
      channel: "nl",
      type: "nl.clarification_needed",
      payload: { sessionId: "conv_123" },
    });

    expect(routed).toEqual({ scope: "query", queryKey: ["tasks"] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["tasks"] });
    expect(subscribe).not.toHaveBeenCalled();
  });

  it("keeps the pure mapping table aligned for nl.clarification_needed", () => {
    expect(mapEventToQuery({
      channel: "nl",
      type: "nl.clarification_needed",
      payload: {},
    })).toEqual({ scope: "query", queryKey: ["tasks"] });
  });
});
