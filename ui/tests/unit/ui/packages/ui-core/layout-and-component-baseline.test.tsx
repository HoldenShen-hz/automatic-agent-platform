import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Tabs, Toast, Tooltip } from "../../../../../packages/ui-core/src/components/extended.tsx";
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
    expect(screen.getByRole("status")).toHaveTextContent("Saved");
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
  });
});
