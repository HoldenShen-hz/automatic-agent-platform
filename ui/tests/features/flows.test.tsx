import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { UiRuntimeProvider } from "@aa/shared-state";
import { ApprovalWebView } from "../../packages/features/approval/src/web";
import { ConversationWebView } from "../../packages/features/conversation/src/web";
import { SettingsWebView } from "../../packages/features/settings/src/web";
import { TaskCockpitWebView } from "../../packages/features/task-cockpit/src/web";
import { WorkflowCockpitWebView } from "../../packages/features/workflow-cockpit/src/web";

function renderWithRuntime(element: React.ReactElement) {
  return render(<UiRuntimeProvider>{element}</UiRuntimeProvider>);
}

describe("feature flows", () => {
  it("processes approval decisions end-to-end", async () => {
    renderWithRuntime(<ApprovalWebView />);
    fireEvent.click(await screen.findByRole("button", { name: /task-2/i }));
    fireEvent.click(await screen.findByRole("button", { name: "Approve" }));
    expect(screen.getByText(/Approved/)).toBeInTheDocument();
  });

  it("supports takeover and escalation in task cockpit", async () => {
    renderWithRuntime(<TaskCockpitWebView />);
    fireEvent.click(await screen.findByRole("button", { name: /春季营销活动/i }));
    fireEvent.click(await screen.findByRole("button", { name: "Escalate" }));
    expect(screen.getByText(/Escalated/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Take Over" }));
    expect(screen.getByText(/Takeover/)).toBeInTheDocument();
  });

  it("supports pause and recover actions in workflow cockpit", async () => {
    renderWithRuntime(<WorkflowCockpitWebView />);
    fireEvent.click(await screen.findByRole("button", { name: /Campaign Launch/i }));
    fireEvent.click(await screen.findByRole("button", { name: "Recover" }));
    expect(screen.getByText(/Recovered/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Release" }));
    expect(screen.getByText(/Released/)).toBeInTheDocument();
  });

  it("supports conversation planning and execution flow", async () => {
    renderWithRuntime(<ConversationWebView />);
    fireEvent.click(screen.getByRole("button", { name: "Send Prompt" }));
    fireEvent.click(screen.getByRole("button", { name: "Build Plan" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    fireEvent.click(screen.getByRole("button", { name: "Execute" }));
    expect(screen.getByText("reporting")).toBeInTheDocument();
  });

  it("saves settings changes", async () => {
    renderWithRuntime(<SettingsWebView />);
    expect(await screen.findByText("Settings")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Save Settings" })).toBeInTheDocument();
    expect(await screen.findByDisplayValue("zh-CN")).toBeInTheDocument();
    fireEvent.change(screen.getByDisplayValue("zh-CN"), { target: { value: "en-US" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Settings" }));
    expect(screen.getByText(/Save State: saved/)).toBeInTheDocument();
    expect(screen.getByText(/Configuration saved/)).toBeInTheDocument();
  });
});
