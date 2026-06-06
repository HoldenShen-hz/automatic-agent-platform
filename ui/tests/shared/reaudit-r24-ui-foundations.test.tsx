// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FeatureWorkbenchPanel } from "../../packages/ui-core/src/components";
import { designTokens } from "../../packages/ui-core/src/design-tokens";
import { ThreePaneLayout } from "../../packages/ui-core/src/layouts";
import { createDefaultTranslationService } from "../../packages/shared/i18n/src";

describe("R24 UI foundations", () => {
  it("lazy loads locale bundles, emits locale changes, and applies rtl document direction", async () => {
    const service = createDefaultTranslationService();
    const listener = vi.fn();
    const documentRef = { documentElement: { lang: "", dir: "" } } as Pick<Document, "documentElement">;
    service.subscribe(listener);

    expect(service.translate("ui.notifications.pending", "zh-CN", "en-US", { count: 0 })).toBe("没有待处理项");
    expect(service.translate("ui.app.title", "ar-SA", "en-US")).toBe("Automatic Agent Platform UI");

    await service.loadLocale("ar-SA");
    service.setLocale("ar-SA", documentRef);

    expect(service.translate("ui.app.title", "ar-SA", "en-US")).toBe("منصة الوكيل الآلي");
    expect(documentRef.documentElement.lang).toBe("ar-SA");
    expect(documentRef.documentElement.dir).toBe("rtl");
    expect(listener).toHaveBeenCalledWith("ar-SA", "rtl");
    expect(service.listSupportedLocales().find((item) => item.locale === "ar-SA")?.direction).toBe("rtl");
  });

  it("exposes primitive-to-semantic tokens and canonical breakpoints", () => {
    expect(designTokens.primitive.color.slate050).toBe("#f8fafc");
    expect(designTokens.semantic.color.background).toBe(designTokens.primitive.color.slate050);
    expect(designTokens.semantic.color.surfaceSelected).toBeTruthy();
    expect(designTokens.breakpoints).toEqual({ mobile: 768, tablet: 1024, desktop: 1440 });
  });

  it("renders accessible workbench controls and responsive pane layout", () => {
    const { container } = render(
      <div>
        <FeatureWorkbenchPanel
          items={[
            { title: "Queue Review", description: "Triage incoming backlog" },
            { title: "Policy Export", description: "Publish the governance digest" },
          ]}
          actions={[{ id: "run", label: "Run", tone: "accent" }]}
          labels={{
            filterLabel: "Filter items",
            filterPlaceholder: "Filter queue",
            activityLogTitle: "Recent activity",
            activityLogEmpty: "No actions yet.",
          }}
        />
        <ThreePaneLayout
          left={<div>Left</div>}
          center={<div>Center</div>}
          right={<div>Right</div>}
        />
      </div>,
    );

    expect(screen.queryByRole("searchbox", { name: "Filter items" })).not.toBeNull();
    expect(screen.queryByRole("listbox", { name: "Workbench items" })).not.toBeNull();
    expect(screen.queryByRole("log")).not.toBeNull();
    expect(screen.queryByText("Recent activity")).not.toBeNull();
    const responsivePane = [...container.querySelectorAll("div")].find((element) =>
      element.textContent?.includes("LeftCenterRight") && element.getAttribute("style")?.includes("align-items: start"),
    );
    expect(responsivePane?.getAttribute("style")).toContain("grid-template-columns: repeat(auto-fit, minmax(200px, 1fr))");
  });

  it("supports item-aware action disabling in the workbench", () => {
    render(
      <FeatureWorkbenchPanel
        items={[
          {
            id: "resolved",
            title: "Resolved incident",
            description: "No further action allowed",
            detailRows: [{ key: "Status", value: "resolved" }],
          },
          {
            id: "open",
            title: "Open incident",
            description: "Can be acknowledged",
            detailRows: [{ key: "Status", value: "open" }],
          },
        ]}
        actions={[
          {
            id: "ack",
            label: "Acknowledge",
            disabled: (item) => item?.detailRows?.find((row) => row.key === "Status")?.value !== "open",
            onTrigger: vi.fn(),
          },
        ]}
      />,
    );

    expect(screen.getByRole("button", { name: "Acknowledge" }).hasAttribute("disabled")).toBe(true);
    fireEvent.click(screen.getByText("Open incident"));
    expect(screen.getByRole("button", { name: "Acknowledge" }).hasAttribute("disabled")).toBe(false);
  });

  it("hides the activity log when a workbench is read-only", () => {
    render(
      <FeatureWorkbenchPanel
        items={[
          { id: "flag", title: "Feature inventory", description: "Read-only backend inventory" },
        ]}
        actions={[]}
      />,
    );

    expect(screen.queryByRole("log")).toBeNull();
    expect(screen.queryByText("Activity log")).toBeNull();
  });

  it("avoids duplicating row-only workbench data across list and detail panes", () => {
    render(
      <FeatureWorkbenchPanel
        rows={[
          { key: "Data Source", value: "backend /health" },
          { key: "Overall Status", value: "overloaded" },
        ]}
        actions={[
          { id: "refresh", label: "Refresh", tone: "accent" },
        ]}
      />,
    );

    expect(screen.getAllByText("Overview").length).toBeGreaterThan(0);
    expect(screen.getAllByText("backend /health")).toHaveLength(1);
    expect(screen.getAllByText("overloaded")).toHaveLength(1);
  });

  it("does not inject fallback item-summary rows when explicit shared rows are provided", () => {
    render(
      <FeatureWorkbenchPanel
        rows={[
          { key: "Mode", value: "policy-a / policy-b" },
        ]}
        items={[
          { id: "compliance-feed", title: "Compliance feed", description: "Live registry summary" },
        ]}
        actions={[
          { id: "refresh", label: "Refresh", tone: "accent" },
        ]}
      />,
    );

    expect(screen.getAllByText("Mode")).toHaveLength(1);
    expect(screen.queryByText("Item")).toBeNull();
    expect(screen.queryByText("Summary")).toBeNull();
  });

  it("collapses metrics-only workbenches into a summary-only surface without duplicate list/detail panes", () => {
    render(
      <FeatureWorkbenchPanel
        metrics={[
          { label: "Active Workers", value: 0 },
          { label: "Offline", value: 1 },
        ]}
        actions={[
          { id: "refresh", label: "Refresh", tone: "accent" },
        ]}
      />,
    );

    expect(screen.getByText("Active Workers")).toBeInTheDocument();
    expect(screen.getByText("Offline")).toBeInTheDocument();
    expect(screen.queryByRole("listbox", { name: "Workbench items" })).toBeNull();
    expect(screen.queryByText("当前值 0")).toBeNull();
    expect(screen.queryByText("Review 2 live metrics and their latest values.")).toBeNull();
  });
});
