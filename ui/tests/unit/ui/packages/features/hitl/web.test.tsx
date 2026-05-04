import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mockApprove = vi.fn(async () => undefined);
const mockReject = vi.fn(async () => undefined);
const mockResume = vi.fn(async () => undefined);
const mockPatch = vi.fn(async () => undefined);
const mockOverride = vi.fn(async () => undefined);

vi.mock("@aa/ui-core", () => ({
  FeatureScaffold: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
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
  }),
}));

import { HitlWebView } from "../../../../../../packages/features/hitl/src/web";

describe("HitlWebView", () => {
  it("renders interactive actions instead of a static list", async () => {
    render(<HitlWebView />);

    fireEvent.click(screen.getAllByRole("button", { name: "Approve" })[0]!);
    fireEvent.click(screen.getAllByRole("button", { name: "Reject" })[0]!);
    fireEvent.click(screen.getByRole("button", { name: "Resume" }));

    expect(mockApprove).toHaveBeenCalledWith("approval-1");
    expect(mockReject).toHaveBeenCalledWith("approval-1");
    expect(mockResume).toHaveBeenCalledWith("resume-1", "normal");
  });

  it("opens patch and override editors and applies JSON payloads", async () => {
    render(<HitlWebView />);

    await act(async () => {
      fireEvent.click(screen.getAllByRole("button", { name: "Patch" })[0]!);
    });
    await act(async () => {
      fireEvent.change(screen.getByRole("textbox"), { target: { value: "{\"field\":\"value\"}" } });
      fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    });

    expect(mockPatch).toHaveBeenCalledWith("approval-1", { field: "value" });

    await act(async () => {
      fireEvent.click(screen.getAllByRole("button", { name: "Override" })[0]!);
    });
    await act(async () => {
      fireEvent.change(screen.getByRole("textbox"), { target: { value: "{\"mode\":\"full\"}" } });
      fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    });

    expect(mockOverride).toHaveBeenCalledWith("approval-1", { mode: "full" });
  });
});
