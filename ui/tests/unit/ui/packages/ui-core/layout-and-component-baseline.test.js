import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Accordion, Drawer, PieChart, SegmentedControl, Stepper, Tabs, Toast, Tooltip } from "../../../../../packages/ui-core/src/components/extended.tsx";
import { ThreePaneLayout } from "../../../../../packages/ui-core/src/layouts/index.ts";
describe("ui-core component and layout baselines", () => {
    it("exports interactive primitives beyond the original six-component baseline", () => {
        render(_jsxs("div", { children: [_jsx(Tabs, { tabs: [
                        { id: "overview", label: "Overview", panel: _jsx("div", { children: "Overview Panel" }) },
                        { id: "details", label: "Details", panel: _jsx("div", { children: "Details Panel" }) },
                    ] }), _jsx(Tooltip, { label: "More information", children: _jsx("button", { type: "button", children: "Hover target" }) }), _jsx(Toast, { message: "Saved", tone: "success" })] }));
        expect(screen.getByRole("tablist")).toBeInTheDocument();
        expect(screen.getByRole("tabpanel")).toBeInTheDocument();
        expect(screen.getByLabelText("More information")).toBeInTheDocument();
        expect(screen.getByLabelText("More information")).toHaveAttribute("tabindex", "0");
        expect(screen.getByRole("status")).toHaveTextContent("Saved");
    });
    it("supports keyboard navigation for tabs and segmented controls", () => {
        const Harness = () => {
            const [value, setValue] = React.useState("day");
            return (_jsxs("div", { children: [_jsx(Tabs, { tabs: [
                            { id: "overview", label: "Overview", panel: _jsx("div", { children: "Overview Panel" }) },
                            { id: "details", label: "Details", panel: _jsx("div", { children: "Details Panel" }) },
                        ] }), _jsx(SegmentedControl, { options: [
                            { value: "day", label: "Day" },
                            { value: "week", label: "Week" },
                        ], value: value, onChange: setValue })] }));
        };
        render(_jsx(Harness, {}));
        const overviewTab = screen.getByRole("tab", { name: "Overview" });
        fireEvent.keyDown(overviewTab, { key: "ArrowRight" });
        expect(screen.getByRole("tab", { name: "Details" })).toHaveAttribute("aria-selected", "true");
        const dayRadio = screen.getByRole("radio", { name: "Day" });
        fireEvent.keyDown(dayRadio, { key: "ArrowRight" });
        expect(screen.getByRole("radio", { name: "Week" })).toHaveAttribute("aria-checked", "true");
    });
    it("renders accessible accordion and drawer structure", () => {
        render(_jsxs("div", { children: [_jsx(Accordion, { items: [{ id: "policy", title: "Policy", content: _jsx("div", { children: "Rules" }) }] }), _jsx(Drawer, { open: true, title: "Operator drawer", onClose: () => undefined, children: _jsx("button", { type: "button", children: "Approve" }) })] }));
        expect(screen.getByRole("button", { name: "Policy" })).toHaveAttribute("aria-controls");
        expect(screen.getByRole("dialog", { name: "Operator drawer" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Operator drawer overlay" })).toBeInTheDocument();
    });
    it("keeps ThreePaneLayout responsive instead of hardcoding a fixed three-column grid", () => {
        const view = render(_jsx(ThreePaneLayout, { left: _jsx("div", { children: "Left" }), center: _jsx("div", { children: "Center" }), right: _jsx("div", { children: "Right" }) }));
        const container = view.container.firstElementChild;
        expect(container.style.gridTemplateColumns).toContain("auto-fit");
        expect(container.style.gridTemplateColumns).toContain("minmax(200px, 1fr)");
        expect(screen.getByRole("main", { name: "Main content" })).toBeInTheDocument();
        expect(screen.getByRole("complementary", { name: "Left panel" })).toBeInTheDocument();
        expect(screen.getByRole("complementary", { name: "Right panel" })).toBeInTheDocument();
    });
    it("renders stepper and pie chart with accessible semantics", () => {
        render(_jsxs("div", { children: [_jsx(Stepper, { steps: ["Queued", "Running", "Completed"], activeStep: 1 }), _jsx(PieChart, { slices: [{ label: "Success", value: 2 }, { label: "Failure", value: 1 }] })] }));
        expect(screen.getByRole("list", { name: "Progress steps" })).toBeInTheDocument();
        expect(screen.getAllByRole("listitem")).toHaveLength(3);
        expect(screen.getByRole("img", { name: "Pie chart" })).toHaveAccessibleDescription(/Success: 2/);
    });
});
