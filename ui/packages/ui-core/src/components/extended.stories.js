import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Accordion, Card, Drawer, Pagination, PieChart, SegmentedControl, Skeleton, Stepper, Tabs, Toast, Tooltip } from "./extended";
const meta = {
    title: "Core/Extended",
};
export default meta;
export const NavigationAndFeedback = {
    render: () => (_jsxs("div", { style: { display: "grid", gap: 16 }, children: [_jsx(Card, { children: _jsx(Tabs, { tabs: [
                        { id: "overview", label: "Overview", panel: _jsx("div", { children: "Overview content" }) },
                        { id: "details", label: "Details", panel: _jsx("div", { children: "Details content" }) },
                    ] }) }), _jsx(Card, { children: _jsx(Pagination, { page: 12, totalPages: 48 }) }), _jsx(Card, { children: _jsx(Stepper, { steps: ["Draft", "Review", "Release"], activeStep: 1 }) }), _jsx(Card, { children: _jsx(Accordion, { items: [
                        { id: "policy", title: "Policy", content: _jsx("div", { children: "Policy controls" }) },
                        { id: "evidence", title: "Evidence", content: _jsx("div", { children: "Evidence bundle" }) },
                    ] }) }), _jsx(Card, { children: _jsx(SegmentedControl, { options: [
                        { value: "day", label: "Day" },
                        { value: "week", label: "Week" },
                        { value: "month", label: "Month" },
                    ], value: "week" }) }), _jsx(Card, { children: _jsx(Tooltip, { label: "Evidence freshness indicator", children: _jsx("span", { children: "Hover or focus me" }) }) }), _jsx(Toast, { message: "Release evidence exported", tone: "success" }), _jsx(Skeleton, { width: "100%", height: 24 })] })),
};
export const DrawerAndCharts = {
    render: () => (_jsxs("div", { style: { display: "grid", gap: 16 }, children: [_jsx(Drawer, { open: true, title: "Operator actions", children: _jsx("button", { type: "button", children: "Approve" }) }), _jsx(Card, { children: _jsx(PieChart, { slices: [
                        { label: "Stable", value: 62 },
                        { label: "Canary", value: 24 },
                        { label: "Blocked", value: 14 },
                    ] }) })] })),
};
