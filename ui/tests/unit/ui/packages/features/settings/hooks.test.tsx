import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockClient = { patch: vi.fn() };
const mockUpdatePreferences = vi.fn(async () => ({ ok: true }));
let preferencesData = {
  theme: "dark",
  locale: "zh-CN",
  etag: "etag-1",
  defaultDashboardLayout: ["overview"],
};

vi.mock("@aa/shared-state", () => ({
  useRestClient: () => mockClient,
  usePreferencesQuery: () => ({ data: preferencesData }),
  useRolesQuery: () => ({ data: [{ name: "admin", userCount: 2 }] }),
  useFeatureFlagsQuery: () => ({ data: [{ id: "flag-1", rolloutPercentage: 50 }] }),
  useModelsQuery: () => ({ data: [{ provider: "openai", model: "gpt-5", boundDomains: ["coding"], budgetUsd: 10 }] }),
  useDomainConfigsQuery: () => ({ data: [{ displayName: "Coding", owner: "platform", defaultDrillDepth: 3 }] }),
  useTenantsQuery: () => ({ data: [{ name: "Tenant A", status: "active", domains: ["coding"] }] }),
  useWebhooksQuery: () => ({ data: [{ targetUrl: "https://example.test/webhook", eventCount: 5, enabled: true }] }),
}));

vi.mock("@aa/shared-api-client", () => ({
  updatePreferences: (...args: unknown[]) => mockUpdatePreferences(...args),
}));

import { useSettingsVm } from "../../../../../../packages/features/settings/src/hooks";

describe("useSettingsVm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    preferencesData = {
      theme: "dark",
      locale: "zh-CN",
      etag: "etag-1",
      defaultDashboardLayout: ["overview"],
    };
  });

  it("keeps the saving state visible before flipping to saved and refreshes drafts from upstream preferences", async () => {
    const { result, rerender } = renderHook(() => useSettingsVm());
    mockUpdatePreferences.mockImplementationOnce(
      () => new Promise((resolve) => setTimeout(() => resolve({ ok: true }), 20)),
    );

    act(() => {
      result.current.setDraftTheme("light");
    });
    expect(result.current.draftTheme).toBe("light");

    await act(async () => {
      void result.current.save();
    });

    await waitFor(() => {
      expect(result.current.saveState).toBe("saving");
    });

    await waitFor(() => {
      expect(result.current.saveState).toBe("saved");
      expect(result.current.activityItems[0]?.title).toBe("Configuration saved");
    });

    preferencesData = {
      theme: "high-contrast",
      locale: "en-US",
      etag: "etag-2",
      defaultDashboardLayout: ["overview", "ops"],
    };
    rerender();

    await waitFor(() => {
      expect(result.current.draftTheme).toBe("high-contrast");
      expect(result.current.draftLocale).toBe("en-US");
    });
  });
});
