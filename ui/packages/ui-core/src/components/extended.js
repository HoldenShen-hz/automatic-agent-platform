import React, { createElement, useEffect, useId, useRef, useState } from "react";
import { animation, designTokens } from "../design-tokens";
const baseSurfaceStyle = {
    background: designTokens.semantic.color.surface,
    border: `1px solid ${designTokens.semantic.color.border}`,
    borderRadius: designTokens.semantic.radius.card,
    color: designTokens.semantic.color.text,
};
const hiddenAccessibleTextStyle = {
    position: "absolute",
    width: 1,
    height: 1,
    padding: 0,
    margin: -1,
    overflow: "hidden",
    clip: "rect(0, 0, 0, 0)",
    whiteSpace: "nowrap",
    border: 0,
};
export function Card({ children, style }) {
    return createElement("section", { style: { ...baseSurfaceStyle, padding: 16, ...style } }, children);
}
export function Panel({ title, children }) {
    return createElement(Card, null, createElement("header", { style: { marginBottom: 12, fontWeight: 600 } }, title), children);
}
export function SectionHeading({ eyebrow, title, description }) {
    return createElement("header", { style: { display: "grid", gap: 4 } }, eyebrow ? createElement("span", { style: { color: designTokens.semantic.color.textSubtle, fontSize: 12, textTransform: "uppercase" } }, eyebrow) : null, createElement("h2", { style: { margin: 0, fontSize: designTokens.primitive.typography.fontSize["2xl"] } }, title), description ? createElement("p", { style: { margin: 0, color: designTokens.semantic.color.textSubtle } }, description) : null);
}
export function TextArea(props) {
    return createElement("textarea", {
        ...props,
        style: {
            width: "100%",
            minHeight: 120,
            padding: 12,
            borderRadius: designTokens.semantic.radius.input,
            border: `1px solid ${designTokens.semantic.color.border}`,
            background: designTokens.semantic.color.surface,
            color: designTokens.semantic.color.text,
            fontFamily: designTokens.semantic.typography.fontFamily,
            ...(props.style ?? {}),
        },
    });
}
export function NumberInput(props) {
    return createElement("input", {
        ...props,
        type: "number",
        style: {
            padding: 10,
            borderRadius: designTokens.semantic.radius.input,
            border: `1px solid ${designTokens.semantic.color.border}`,
            background: designTokens.semantic.color.surface,
            color: designTokens.semantic.color.text,
            ...(props.style ?? {}),
        },
    });
}
export function SearchInput(props) {
    return createElement("input", {
        ...props,
        type: "search",
        "aria-label": props["aria-label"] ?? "Search",
        style: {
            width: "100%",
            padding: 10,
            borderRadius: designTokens.semantic.radius.input,
            border: `1px solid ${designTokens.semantic.color.border}`,
            ...(props.style ?? {}),
        },
    });
}
export function Divider() {
    return createElement("hr", { style: { border: 0, borderTop: `1px solid ${designTokens.semantic.color.border}`, margin: "16px 0" } });
}
export function Stack({ gap = 12, children }) {
    return createElement("div", { style: { display: "grid", gap } }, children);
}
export function Inline({ gap = 12, wrap = true, children }) {
    return createElement("div", { style: { display: "flex", gap, flexWrap: wrap ? "wrap" : "nowrap", alignItems: "center" } }, children);
}
export function Grid({ min = 240, children }) {
    return createElement("div", { style: { display: "grid", gap: 16, gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))` } }, children);
}
export function ProgressBar({ value, max = 100, label }) {
    const ratio = Math.max(0, Math.min(1, value / max));
    return createElement("div", { role: "progressbar", "aria-valuenow": value, "aria-valuemin": 0, "aria-valuemax": max, "aria-label": label ?? "Progress" }, createElement("div", {
        style: {
            width: "100%",
            height: 10,
            background: designTokens.semantic.color.surfaceElevated,
            borderRadius: 999,
            overflow: "hidden",
        },
    }, createElement("div", {
        style: {
            width: `${ratio * 100}%`,
            height: "100%",
            background: designTokens.semantic.color.accent,
            transition: `width ${animation.duration.normal} ${animation.easing.standard}`,
        },
    })));
}
export function Skeleton({ width = "100%", height = 16 }) {
    return createElement(React.Fragment, null, createElement("style", null, "@keyframes aa-ui-core-skeleton-pulse { 0% { opacity: 0.72; background-position: 0% 50%; } 50% { opacity: 1; } 100% { opacity: 0.72; background-position: 100% 50%; } }"), createElement("div", {
        "aria-hidden": true,
        style: {
            width,
            height,
            borderRadius: 8,
            background: `linear-gradient(90deg, ${designTokens.semantic.color.surfaceElevated}, ${designTokens.semantic.color.surfaceHover}, ${designTokens.semantic.color.surfaceElevated})`,
            backgroundSize: "200% 100%",
            animation: "aa-ui-core-skeleton-pulse 1.4s ease-in-out infinite",
        },
    }));
}
export function EmptyState({ title, description, action }) {
    return createElement(Card, { style: { textAlign: "center" } }, createElement("h3", { style: { marginTop: 0 } }, title), createElement("p", { style: { color: designTokens.semantic.color.textSubtle } }, description), action);
}
export function StatCard({ label, value, delta }) {
    return createElement(Card, null, createElement("span", { style: { color: designTokens.semantic.color.textSubtle, fontSize: 12 } }, label), createElement("strong", { style: { display: "block", fontSize: 28, marginTop: 6 } }, value), delta ? createElement("span", { style: { color: designTokens.semantic.color.accent } }, delta) : null);
}
export function Breadcrumbs({ items }) {
    return createElement("nav", { "aria-label": "Breadcrumb" }, createElement("ol", { style: { display: "flex", gap: 8, listStyle: "none", padding: 0, margin: 0 } }, items.map((item, index) => createElement("li", { key: `${item.label}-${index}` }, item.href ? createElement("a", { href: item.href }, item.label) : item.label))));
}
export function Pagination({ page, totalPages, onChange, }) {
    const pageItems = buildPaginationItems(page, totalPages);
    return createElement("nav", { "aria-label": "Pagination" }, createElement("div", { style: { display: "flex", gap: 8 } }, pageItems.map((item, index) => item === "ellipsis"
        ? createElement("span", { key: `ellipsis-${index}`, "aria-hidden": true, style: { alignSelf: "center" } }, "…")
        : createElement("button", {
            key: `page-${item}`,
            type: "button",
            "aria-current": page === item ? "page" : undefined,
            onClick: () => onChange?.(item),
        }, item))));
}
function buildPaginationItems(page, totalPages) {
    if (totalPages <= 7) {
        return Array.from({ length: totalPages }, (_, index) => index + 1);
    }
    const current = Math.min(Math.max(page, 1), totalPages);
    const windowStart = Math.max(2, current - 1);
    const windowEnd = Math.min(totalPages - 1, current + 1);
    const items = [1];
    if (windowStart > 2) {
        items.push("ellipsis");
    }
    for (let next = windowStart; next <= windowEnd; next += 1) {
        items.push(next);
    }
    if (windowEnd < totalPages - 1) {
        items.push("ellipsis");
    }
    items.push(totalPages);
    return items;
}
export function Tabs({ tabs, initialTabId, }) {
    const tabListId = useId();
    const [activeTab, setActiveTab] = useState(initialTabId ?? tabs[0]?.id ?? "");
    const current = tabs.find((tab) => tab.id === activeTab) ?? tabs[0];
    const currentIndex = tabs.findIndex((tab) => tab.id === current?.id);
    function selectRelativeTab(delta) {
        if (tabs.length === 0) {
            return;
        }
        const nextIndex = currentIndex < 0
            ? 0
            : (currentIndex + delta + tabs.length) % tabs.length;
        setActiveTab(tabs[nextIndex]?.id ?? "");
    }
    return createElement("div", null, createElement("div", { role: "tablist", "aria-label": "Tabs", style: { display: "flex", gap: 8 } }, tabs.map((tab) => createElement("button", {
        key: tab.id,
        id: `${tabListId}-${tab.id}-tab`,
        role: "tab",
        tabIndex: current?.id === tab.id ? 0 : -1,
        "aria-selected": current?.id === tab.id,
        "aria-controls": `${tabListId}-${tab.id}-panel`,
        onClick: () => setActiveTab(tab.id),
        onKeyDown: (event) => {
            if (event.key === "ArrowRight") {
                event.preventDefault();
                selectRelativeTab(1);
            }
            if (event.key === "ArrowLeft") {
                event.preventDefault();
                selectRelativeTab(-1);
            }
            if (event.key === "Home") {
                event.preventDefault();
                setActiveTab(tabs[0]?.id ?? "");
            }
            if (event.key === "End") {
                event.preventDefault();
                setActiveTab(tabs.at(-1)?.id ?? "");
            }
        },
        type: "button",
    }, tab.label))), current ? createElement("div", {
        id: `${tabListId}-${current.id}-panel`,
        role: "tabpanel",
        "aria-labelledby": `${tabListId}-${current.id}-tab`,
        style: { marginTop: 12 },
    }, current.panel) : null);
}
export function Accordion({ items, }) {
    const accordionId = useId();
    const [openId, setOpenId] = useState(items[0]?.id ?? null);
    return createElement("div", { style: { display: "grid", gap: 8 } }, items.map((item) => createElement(Card, { key: item.id }, (() => {
        const panelId = `${accordionId}-${item.id}-panel`;
        const buttonId = `${accordionId}-${item.id}-button`;
        return createElement(React.Fragment, null, createElement("button", {
            id: buttonId,
            type: "button",
            "aria-expanded": openId === item.id,
            "aria-controls": panelId,
            onClick: () => setOpenId(openId === item.id ? null : item.id),
        }, item.title), openId === item.id ? createElement("div", {
            id: panelId,
            role: "region",
            "aria-labelledby": buttonId,
            style: { marginTop: 10 },
        }, item.content) : null);
    })())));
}
export function Tooltip({ label, children }) {
    return createElement("span", { title: label, "aria-label": label, tabIndex: 0, style: { display: "inline-flex" } }, children);
}
function listFocusableElements(container) {
    return Array.from(container.querySelectorAll("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])")).filter((element) => !element.hasAttribute("disabled"));
}
export function Drawer({ open, title, onClose, children, }) {
    const drawerRef = useRef(null);
    const previousFocusRef = useRef(null);
    useEffect(() => {
        if (!open) {
            return;
        }
        previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        const drawer = drawerRef.current;
        const focusable = drawer == null ? [] : listFocusableElements(drawer);
        (focusable[0] ?? drawer)?.focus();
        const handleKeyDown = (event) => {
            if (event.key === "Escape") {
                event.preventDefault();
                onClose?.();
                return;
            }
            if (event.key !== "Tab" || drawer == null) {
                return;
            }
            const ordered = listFocusableElements(drawer);
            if (ordered.length === 0) {
                event.preventDefault();
                drawer.focus();
                return;
            }
            const first = ordered[0];
            const last = ordered[ordered.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            }
            if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        };
        document.addEventListener("keydown", handleKeyDown);
        return () => {
            document.removeEventListener("keydown", handleKeyDown);
            previousFocusRef.current?.focus();
        };
    }, [onClose, open]);
    if (!open)
        return null;
    return createElement("div", {
        style: { position: "fixed", inset: 0, display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", zIndex: 20 },
    }, createElement("button", {
        "aria-label": `${title} overlay`,
        onClick: () => onClose?.(),
        style: { border: "none", background: "rgba(15, 23, 42, 0.24)", cursor: onClose == null ? "default" : "pointer" },
        type: "button",
    }), createElement("aside", {
        ref: drawerRef,
        role: "dialog",
        tabIndex: -1,
        "aria-modal": true,
        "aria-label": title,
        style: { position: "relative", insetInlineEnd: 0, top: 0, bottom: 0, width: 360, padding: 20, overflowY: "auto", boxShadow: designTokens.semantic.shadows.overlay, ...baseSurfaceStyle },
    }, children));
}
export function Toast({ message, tone = "info" }) {
    return createElement("div", {
        role: tone === "danger" ? "alert" : "status",
        "aria-live": tone === "danger" ? undefined : "polite",
        style: { ...baseSurfaceStyle, padding: 12 },
    }, message);
}
export function Kbd({ children }) {
    return createElement("kbd", {
        style: {
            border: `1px solid ${designTokens.semantic.color.border}`,
            borderRadius: 6,
            padding: "2px 6px",
            fontFamily: designTokens.primitive.typography.fontFamily.mono,
        },
    }, children);
}
export function CodeBlock({ code }) {
    return createElement("pre", { style: { ...baseSurfaceStyle, padding: 16, overflowX: "auto" } }, createElement("code", null, code));
}
export function DescriptionList({ rows }) {
    return createElement("dl", { style: { display: "grid", gridTemplateColumns: "max-content 1fr", gap: 8 } }, rows.flatMap((row) => [
        createElement("dt", { key: `${row.term}-term`, style: { fontWeight: 600 } }, row.term),
        createElement("dd", { key: `${row.term}-detail`, style: { margin: 0 } }, row.detail),
    ]));
}
export function Stepper({ steps, activeStep }) {
    return createElement("ol", { "aria-label": "Progress steps", role: "list", style: { display: "flex", gap: 12, listStyle: "none", padding: 0, margin: 0 } }, steps.map((step, index) => createElement("li", {
        key: `${step}-${index}`,
        role: "listitem",
        style: { fontWeight: activeStep === index ? 700 : 400 },
    }, createElement("button", {
        type: "button",
        disabled: index > activeStep,
        "aria-current": activeStep === index ? "step" : "false",
        "aria-disabled": index > activeStep,
        tabIndex: activeStep >= index ? 0 : -1,
        style: {
            border: "none",
            background: "transparent",
            color: "inherit",
            cursor: index > activeStep ? "not-allowed" : "default",
            font: "inherit",
            padding: 0,
        },
    }, step))));
}
export function Timeline({ items }) {
    return createElement("ol", { style: { display: "grid", gap: 12 } }, items.map((item) => createElement("li", { key: item.id }, createElement("strong", null, item.title), item.description ? createElement("p", { style: { marginBottom: 0, color: designTokens.semantic.color.textSubtle } }, item.description) : null)));
}
export function IconButton({ label, children, ...props }) {
    return createElement("button", {
        ...props,
        type: props.type ?? "button",
        "aria-label": label,
        style: {
            width: 36,
            height: 36,
            borderRadius: 999,
            border: `1px solid ${designTokens.semantic.color.border}`,
            background: designTokens.semantic.color.surface,
            ...(props.style ?? {}),
        },
    }, children);
}
export function Callout({ tone = "info", title, children }) {
    const toneColor = tone === "danger"
        ? designTokens.semantic.color.danger
        : tone === "warning"
            ? designTokens.semantic.color.warning
            : tone === "success"
                ? designTokens.semantic.color.success
                : designTokens.semantic.color.info;
    return createElement("div", { style: { ...baseSurfaceStyle, borderInlineStart: `4px solid ${toneColor}`, padding: 16 } }, createElement("strong", null, title), createElement("div", { style: { marginTop: 8 } }, children));
}
export function CommandInput(props) {
    return createElement("input", {
        ...props,
        "aria-label": props["aria-label"] ?? "Command input",
        placeholder: props.placeholder ?? "Type a command",
        style: {
            width: "100%",
            padding: 12,
            borderRadius: 999,
            border: `1px solid ${designTokens.semantic.color.borderStrong}`,
            ...(props.style ?? {}),
        },
    });
}
export function SegmentedControl({ options, value, onChange, }) {
    const activeIndex = Math.max(0, options.findIndex((option) => option.value === value));
    const optionCount = Math.max(options.length, 1);
    function handleKeyDown(event, index) {
        if (event.key === "ArrowRight" || event.key === "ArrowDown") {
            event.preventDefault();
            onChange?.(options[(index + 1) % optionCount]?.value ?? value);
        }
        if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
            event.preventDefault();
            onChange?.(options[(index - 1 + optionCount) % optionCount]?.value ?? value);
        }
        if (event.key === "Home") {
            event.preventDefault();
            onChange?.(options[0]?.value ?? value);
        }
        if (event.key === "End") {
            event.preventDefault();
            onChange?.(options.at(-1)?.value ?? value);
        }
    }
    return createElement("div", { role: "radiogroup", style: { display: "inline-flex", gap: 6, padding: 4, ...baseSurfaceStyle } }, options.map((option, index) => createElement("button", {
        key: option.value,
        role: "radio",
        type: "button",
        tabIndex: activeIndex === index ? 0 : -1,
        "aria-checked": value === option.value,
        onClick: () => onChange?.(option.value),
        onKeyDown: (event) => handleKeyDown(event, index),
        style: {
            padding: "6px 12px",
            borderRadius: 999,
            border: "none",
            background: value === option.value ? designTokens.semantic.color.accent : "transparent",
        },
    }, option.label)));
}
export function TimelineChart({ points, }) {
    const max = Math.max(...points.map((point) => point.value), 1);
    return createElement("div", { style: { display: "grid", gap: 10 } }, points.map((point) => {
        const color = point.tone === "danger"
            ? designTokens.semantic.color.danger
            : point.tone === "accent"
                ? designTokens.semantic.color.accent
                : designTokens.semantic.color.info;
        return createElement("div", { key: point.label, style: { display: "grid", gap: 4 } }, createElement("div", { style: { display: "flex", justifyContent: "space-between", fontSize: 12 } }, createElement("span", null, point.label), createElement("strong", null, point.value)), createElement("div", { style: { height: 8, borderRadius: 999, background: designTokens.semantic.color.surfaceElevated, overflow: "hidden" } }, createElement("div", {
            style: {
                width: `${Math.max(6, (point.value / max) * 100)}%`,
                height: "100%",
                background: color,
            },
        })));
    }));
}
export function PieChart({ slices, }) {
    const chartId = useId();
    const total = slices.reduce((sum, slice) => sum + Math.max(slice.value, 0), 0);
    const palette = [
        designTokens.semantic.color.accent,
        designTokens.semantic.color.info,
        designTokens.semantic.color.warning,
        designTokens.semantic.color.success,
        designTokens.semantic.color.danger,
    ];
    let accumulatedPercent = 0;
    const gradientStops = slices.map((slice, index) => {
        const ratio = total === 0 ? 0 : Math.max(slice.value, 0) / total;
        const start = accumulatedPercent;
        const end = index === slices.length - 1
            ? 100
            : Math.min(100, accumulatedPercent + ratio * 100);
        accumulatedPercent = end;
        const color = slice.color ?? palette[index % palette.length];
        return `${color} ${start.toFixed(4)}% ${end.toFixed(4)}%`;
    });
    const sliceSummary = slices.map((slice) => {
        const share = total === 0 ? 0 : (Math.max(slice.value, 0) / total) * 100;
        return `${slice.label}: ${slice.value} (${share.toFixed(1)}%)`;
    }).join(", ");
    return createElement("div", { style: { display: "grid", gap: 12, alignItems: "center", justifyItems: "center" } }, createElement("div", {
        role: "img",
        "aria-labelledby": `${chartId}-title`,
        "aria-describedby": `${chartId}-summary`,
        style: {
            width: 144,
            height: 144,
            borderRadius: "50%",
            background: total === 0
                ? designTokens.semantic.color.surfaceElevated
                : `conic-gradient(${gradientStops.join(", ")})`,
            border: `1px solid ${designTokens.semantic.color.border}`,
        },
    }), createElement("span", { id: `${chartId}-title`, style: hiddenAccessibleTextStyle }, "Pie chart"), createElement("span", { id: `${chartId}-summary`, style: hiddenAccessibleTextStyle }, sliceSummary), createElement("div", { style: { display: "grid", gap: 6, width: "100%" } }, slices.map((slice, index) => createElement("div", {
        key: `${slice.label}-${index}`,
        style: { display: "flex", justifyContent: "space-between", gap: 12, fontSize: 12 },
    }, createElement("span", null, slice.label), createElement("strong", null, slice.value)))));
}
function formatRemainingDuration(deadline, now) {
    const parsedDeadline = new Date(deadline).getTime();
    if (!Number.isFinite(parsedDeadline)) {
        return { label: "Unknown deadline", tone: "warning" };
    }
    const diff = parsedDeadline - now;
    if (diff <= 0) {
        return { label: "Expired", tone: "danger" };
    }
    const minutes = Math.floor(diff / 60_000);
    const hours = Math.floor(minutes / 60);
    const remainderMinutes = minutes % 60;
    const label = hours > 0 ? `${hours}h ${remainderMinutes}m remaining` : `${minutes}m remaining`;
    if (minutes <= 15) {
        return { label, tone: "danger" };
    }
    if (minutes <= 60) {
        return { label, tone: "warning" };
    }
    return { label, tone: "success" };
}
export function SLACountdown({ deadline, now = Date.now(), }) {
    const remaining = formatRemainingDuration(deadline, now);
    const color = remaining.tone === "danger"
        ? designTokens.semantic.color.danger
        : remaining.tone === "warning"
            ? designTokens.semantic.color.warning
            : designTokens.semantic.color.success;
    return createElement("time", {
        dateTime: deadline,
        style: {
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "4px 10px",
            borderRadius: 999,
            background: designTokens.semantic.color.surfaceElevated,
            color,
            fontWeight: 600,
        },
    }, remaining.label);
}
export function FileAttachment({ files, }) {
    return createElement("div", { style: { display: "grid", gap: 8 } }, files.map((file) => createElement("div", {
        key: file.id,
        style: {
            ...baseSurfaceStyle,
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            padding: 12,
        },
    }, createElement("div", { style: { display: "grid", gap: 2 } }, createElement("strong", null, file.name), createElement("span", { style: { color: designTokens.semantic.color.textSubtle, fontSize: 12 } }, file.kind ?? "attachment")), createElement("span", { style: { color: designTokens.semantic.color.textSubtle, fontSize: 12 } }, file.sizeLabel ?? ""))));
}
export function DAGVisualization({ stages, }) {
    const statusColor = (status) => {
        switch (status) {
            case "completed": return designTokens.semantic.color.accent;
            case "running": return designTokens.semantic.color.info;
            case "failed": return designTokens.semantic.color.danger;
            default: return designTokens.semantic.color.textSubtle;
        }
    };
    return createElement("div", { style: { display: "grid", gap: 12 } }, createElement("div", {
        style: {
            display: "grid",
            gridAutoFlow: "column",
            gridAutoColumns: `minmax(${Math.min(Math.max(220, stages.length * 12), 320)}px, 1fr)`,
            gap: 12,
            overflowX: "auto",
            paddingBottom: 4,
        },
    }, stages.map((stage) => createElement("div", {
        key: stage.id,
        style: {
            ...baseSurfaceStyle,
            padding: 12,
            borderTop: `3px solid ${statusColor(stage.status)}`,
        },
    }, createElement("strong", null, stage.label), createElement("div", { style: { marginTop: 4, color: designTokens.semantic.color.textSubtle, fontSize: 12 } }, stage.status), stage.items != null && stage.items.length > 0
        ? createElement("ul", { style: { margin: "10px 0 0", paddingInlineStart: 18 } }, stage.items.map((item) => createElement("li", { key: item, style: { fontSize: 12 } }, item)))
        : null))));
}
