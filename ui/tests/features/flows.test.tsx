import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { UiRuntimeProvider } from "@aa/shared-state";
import { ApprovalWebView } from "../../packages/features/approval/src/web";
import { ConversationWebView } from "../../packages/features/conversation/src/web";
import { DomainWizardWebView } from "../../packages/features/domain-wizard/src/web";
import { GovernanceComplianceWebView } from "../../packages/features/governance-compliance/src/web";
import { SettingsWebView } from "../../packages/features/settings/src/web";
import { TaskCockpitWebView } from "../../packages/features/task-cockpit/src/web";
import { WorkflowCockpitWebView } from "../../packages/features/workflow-cockpit/src/web";

function renderWithRuntime(element: React.ReactElement) {
  return render(<UiRuntimeProvider>{element}</UiRuntimeProvider>);
}

afterEach(() => {
  cleanup();
});

describe("feature flows", () => {
  it("processes approval decisions end-to-end", async () => {
    renderWithRuntime(<ApprovalWebView />);
    fireEvent.click(await screen.findByRole("button", { name: /task-2/i }));
    fireEvent.click(await screen.findByRole("button", { name: "批准" }));
    expect(screen.getByText(/Approved/)).toBeInTheDocument();
  });

  it("supports takeover and escalation in task cockpit", async () => {
    renderWithRuntime(<TaskCockpitWebView />);
    fireEvent.click(await screen.findByRole("button", { name: /春季营销活动/i }));
    fireEvent.click(await screen.findByRole("button", { name: "升级" }));
    fireEvent.click(screen.getByRole("button", { name: "L5 时间线" }));
    expect(await screen.findByText(/Escalated · 春季营销活动/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "接管" }));
    expect(await screen.findByText(/Take Over · 春季营销活动/)).toBeInTheDocument();
  });

  it("supports pause and recover actions in workflow cockpit", async () => {
    renderWithRuntime(<WorkflowCockpitWebView />);
    fireEvent.click(await screen.findByRole("button", { name: /Campaign Launch/i }));
    fireEvent.click(await screen.findByRole("button", { name: "恢复链路" }));
    expect(await screen.findByText(/Recovered · Campaign Launch/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "发布" }));
    expect(await screen.findByText(/Released · Campaign Launch/)).toBeInTheDocument();
  });

  it("supports conversation planning and execution flow", async () => {
    renderWithRuntime(<ConversationWebView />);
    fireEvent.click(screen.getByRole("button", { name: "Send Prompt" }));
    fireEvent.click(screen.getByRole("button", { name: "Build Plan" }));
    expect(await screen.findByText(/已生成执行计划/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Execute" }));
    expect(await screen.findByText(/预算上限和投放时区还不清楚，请确认。/)).toBeInTheDocument();
    expect(screen.getByText("clarifying")).toBeInTheDocument();
  });

  it("saves settings changes", async () => {
    renderWithRuntime(<SettingsWebView />);
    expect(await screen.findByText("设置中心")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "保存设置" })).toBeInTheDocument();
    const localeSelect = screen.getAllByRole("combobox")[1]!;
    expect(localeSelect).toHaveValue("zh-CN");
    fireEvent.change(localeSelect, { target: { value: "en-US" } });
    fireEvent.click(screen.getByRole("button", { name: "保存设置" }));
    expect(await screen.findByText(/Configuration saved/)).toBeInTheDocument();
  });

  it("advances the domain wizard only after required fields are complete", async () => {
    renderWithRuntime(<DomainWizardWebView />);

    expect(await screen.findByText("Select a domain before continuing.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    fireEvent.click(await screen.findByRole("button", { name: /Marketing/i }));
    expect(screen.getByText("Domain: marketing")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(screen.getByText("Risk Profile")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Risk level"), { target: { value: "high" } });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Capability Config")).toBeInTheDocument();
  });

  it("creates and resolves governance exceptions from the governance overview", async () => {
    renderWithRuntime(<GovernanceComplianceWebView />);

    fireEvent.click(await screen.findByRole("button", { name: "管理异常" }));
    expect(await screen.findByText("manual_exception_review_requested")).toBeInTheDocument();
    expect(screen.getByText("pending")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    expect(await screen.findByText("approved")).toBeInTheDocument();
  });
});
