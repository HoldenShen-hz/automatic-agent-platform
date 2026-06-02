import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mockApprove = vi.fn(async () => undefined);
const mockReject = vi.fn(async () => undefined);
const mockResume = vi.fn(async () => undefined);
const mockPatch = vi.fn(async () => undefined);
const mockOverride = vi.fn(async () => undefined);
const mockBulkApprove = vi.fn(async () => undefined);
const mockBulkReject = vi.fn(async () => undefined);

vi.mock("@aa/ui-core", () => ({
  designTokens: {
    color: { border: "#d0d7de" },
  },
  FeatureScaffold: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Stack: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Inline: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ListCard: ({ items }: { items: Array<{ title: string; description: string }> }) => (
    <div>
      {items.map((item) => (
        <div key={item.title}>{item.title}</div>
      ))}
    </div>
  ),
}));

vi.mock("../../../../../../packages/features/hitl/src/hooks", () => ({
  useHitlVm: () => ({
    items: [
      { id: "approval-1", type: "approval", title: "Inspect", description: "Inspect current plan" },
      { id: "resume-1", type: "resume", title: "Resume", description: "Resume workflow" },
    ],
    isLoading: false,
    approve: mockApprove,
    reject: mockReject,
    resume: mockResume,
    patch: mockPatch,
    override: mockOverride,
    bulkApprove: mockBulkApprove,
    bulkReject: mockBulkReject,
  }),
}));

import { HitlWebView } from "../../../../../../packages/features/hitl/src/web";

describe("HitlWebView", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  vi.stubGlobal("confirm", vi.fn(() => true));

  it("renders interactive actions instead of a static list", async () => {
    render(<HitlWebView />);

    const approveButton = screen.getAllByRole("button", { name: "批准" })[0]!;
    const rejectButton = screen.getAllByRole("button", { name: "拒绝" })[0]!;
    const resumeButton = screen.getByRole("button", { name: "恢复" });
    fireEvent.pointerDown(approveButton);
    fireEvent.click(approveButton);
    fireEvent.pointerDown(rejectButton);
    fireEvent.click(rejectButton);
    fireEvent.pointerDown(resumeButton);
    fireEvent.click(resumeButton);

    expect(mockApprove).toHaveBeenCalledWith("approval-1");
    expect(mockReject).toHaveBeenCalledWith("approval-1");
    expect(mockResume).toHaveBeenCalledWith("resume-1", "normal");
  });

  it("opens patch and override editors and applies JSON payloads", async () => {
    render(<HitlWebView />);
    const textbox = () => screen.getByRole("textbox");
    const applyButton = () => screen.getByRole("button", { name: "应用" });

    await act(async () => {
      const patchButton = screen.getAllByRole("button", { name: "补丁" })[0]!;
      fireEvent.pointerDown(patchButton);
      fireEvent.click(patchButton);
    });
    await act(async () => {
      fireEvent.change(textbox(), { target: { value: "{\"field\":\"value\"}" } });
      fireEvent.pointerDown(applyButton());
      fireEvent.click(applyButton());
    });

    expect(mockPatch).toHaveBeenCalledWith("approval-1", { field: "value" });

    await act(async () => {
      const overrideButton = screen.getAllByRole("button", { name: "覆盖" })[0]!;
      fireEvent.pointerDown(overrideButton);
      fireEvent.click(overrideButton);
    });
    await act(async () => {
      fireEvent.change(textbox(), { target: { value: "{\"mode\":\"full\"}" } });
      fireEvent.pointerDown(applyButton());
      fireEvent.click(applyButton());
    });

    expect(mockOverride).toHaveBeenCalledWith("approval-1", { mode: "full" });
  });
});
