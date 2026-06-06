import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Accordion, Drawer, PieChart, SegmentedControl, Stepper, Tabs, Toast, Tooltip } from "../../../../../packages/ui-core/src/components/extended.tsx";
import { buildWorkbenchActionHandler, ListCard } from "../../../../../packages/ui-core/src/components/index.ts";
import { ThreePaneLayout } from "../../../../../packages/ui-core/src/layouts/index.ts";

describe("ui-core component and layout baselines", () => {
  it("exports interactive primitives beyond the original six-component baseline", () => {
    render(
      <div>
        <Tabs
          tabs={[
            { id: "overview", label: "Overview", panel: <div>Overview Panel</div> },
            { id: "details", label: "Details", panel: <div>Details Panel</div> },
          ]}
        />
        <Tooltip label="More information">
          <button type="button">Hover target</button>
        </Tooltip>
        <Toast message="Saved" tone="success" />
      </div>,
    );

    expect(screen.getByRole("tablist")).toBeInTheDocument();
    expect(screen.getByRole("tabpanel")).toBeInTheDocument();
    expect(screen.getByLabelText("More information")).toBeInTheDocument();
    expect(screen.getByLabelText("More information")).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("status")).toHaveTextContent("Saved");
  });

  it("supports keyboard navigation for tabs and segmented controls", () => {
    const Harness = () => {
      const [value, setValue] = React.useState("day");
      return (
        <div>
          <Tabs
            tabs={[
              { id: "overview", label: "Overview", panel: <div>Overview Panel</div> },
              { id: "details", label: "Details", panel: <div>Details Panel</div> },
            ]}
          />
          <SegmentedControl
            options={[
              { value: "day", label: "Day" },
              { value: "week", label: "Week" },
            ]}
            value={value}
            onChange={setValue}
          />
        </div>
      );
    };

    render(<Harness />);

    const overviewTab = screen.getByRole("tab", { name: "Overview" });
    fireEvent.keyDown(overviewTab, { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: "Details" })).toHaveAttribute("aria-selected", "true");

    const dayRadio = screen.getByRole("radio", { name: "Day" });
    fireEvent.keyDown(dayRadio, { key: "ArrowRight" });
    expect(screen.getByRole("radio", { name: "Week" })).toHaveAttribute("aria-checked", "true");
  });

  it("renders accessible accordion and drawer structure", () => {
    render(
      <div>
        <Accordion items={[{ id: "policy", title: "Policy", content: <div>Rules</div> }]} />
        <Drawer open title="Operator drawer" onClose={() => undefined}>
          <button type="button">Approve</button>
        </Drawer>
      </div>,
    );

    expect(screen.getByRole("button", { name: "Policy" })).toHaveAttribute("aria-controls");
    expect(screen.getByRole("dialog", { name: "Operator drawer" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Operator drawer overlay" })).toBeInTheDocument();
  });

  it("keeps ThreePaneLayout responsive instead of hardcoding a fixed three-column grid", () => {
    const view = render(
      <ThreePaneLayout
        left={<div>Left</div>}
        center={<div>Center</div>}
        right={<div>Right</div>}
      />,
    );

    const container = view.container.firstElementChild as HTMLElement;
    expect(container.style.gridTemplateColumns).toContain("auto-fit");
    expect(container.style.gridTemplateColumns).toContain("minmax(200px, 1fr)");
    expect(screen.getByRole("main", { name: "Main content" })).toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "Left panel" })).toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "Right panel" })).toBeInTheDocument();
  });

  it("renders stepper and pie chart with accessible semantics", () => {
    render(
      <div>
        <Stepper steps={["Queued", "Running", "Completed"]} activeStep={1} />
        <PieChart slices={[{ label: "Success", value: 2 }, { label: "Failure", value: 1 }]} />
      </div>,
    );

    expect(screen.getByRole("list", { name: "Progress steps" })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getByRole("img", { name: "Pie chart" })).toHaveAccessibleDescription(/Success: 2/);
  });

  it("renders actionable list cards as real buttons instead of static copy", () => {
    const onAction = vi.fn();
    render(
      <ListCard
        items={[
          {
            title: "Activate mission",
            description: "Move from draft into executable state after final review.",
            actionLabel: "Activate mission",
            onAction,
          },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Activate mission" }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it("falls back to execCommand when the browser clipboard API rejects", async () => {
    const originalClipboard = navigator.clipboard;
    const writeText = vi.fn().mockRejectedValue(new Error("Document is not focused"));
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    const execCommand = vi.fn().mockReturnValue(true);
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: execCommand,
    });

    const eventListener = vi.fn();
    window.addEventListener("aa:feature-workbench-action", eventListener as EventListener);

    const action = buildWorkbenchActionHandler("workers", "copy", { copySelection: true });
    await expect(action({ id: "worker-1", title: "Worker", description: "offline" })).resolves.toBeUndefined();

    expect(writeText).toHaveBeenCalledWith("Worker\noffline");
    expect(execCommand).toHaveBeenCalledWith("copy");
    expect(eventListener).toHaveBeenCalledTimes(1);

    window.removeEventListener("aa:feature-workbench-action", eventListener as EventListener);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: originalClipboard,
    });
  });

  it("surfaces copy failures when both clipboard paths fail", async () => {
    const originalClipboard = navigator.clipboard;
    const originalExecCommand = document.execCommand;
    const writeText = vi.fn().mockRejectedValue(new Error("Document is not focused"));
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: vi.fn().mockReturnValue(false),
    });

    const eventListener = vi.fn();
    window.addEventListener("aa:feature-workbench-action", eventListener as EventListener);

    const action = buildWorkbenchActionHandler("workers", "copy", { copySelection: true });
    await expect(action({ id: "worker-1", title: "Worker", description: "offline" })).rejects.toThrow("Unable to copy to clipboard");

    expect(eventListener).not.toHaveBeenCalled();

    window.removeEventListener("aa:feature-workbench-action", eventListener as EventListener);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: originalClipboard,
    });
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: originalExecCommand,
    });
  });
});
