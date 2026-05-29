import { createElement, useEffect, useMemo, useState } from "react";
import { createPanelStyle, designTokens } from "../design-tokens";
import { LayoutFrame, ThreePaneLayout } from "../layouts";
export { CodeBlock, DAGVisualization, FileAttachment, Timeline } from "./extended";
export { Inline, LayoutFrame, Stack, ThreePaneLayout } from "../layouts";
export function StatusPill({ status }) {
    const background = status === "Planned" ? designTokens.color.planned : designTokens.color.accent;
    const color = status === "Planned" ? designTokens.color.text : designTokens.color.text;
    return createElement("span", {
        style: {
            background,
            borderRadius: 999,
            color,
            padding: "4px 10px",
            fontSize: 12,
            fontWeight: 700,
        },
    }, status);
}
export function ListCard({ items }) {
    return createElement("div", { role: "list", style: { display: "grid", gap: 10 } }, ...items.map((item) => createElement("article", { key: item.title, role: "listitem", style: createPanelStyle() }, createElement("div", { style: { color: designTokens.color.text, fontWeight: 600 } }, item.title), createElement("div", { style: { color: designTokens.color.subtle, marginTop: 6 } }, item.description))));
}
export function KeyValueTable({ rows }) {
    return createElement("div", { style: { display: "grid", gap: 10 } }, ...rows.map((row, index) => createElement("div", {
        key: `${row.key}-${index}`,
        style: { display: "grid", gridTemplateColumns: "120px 1fr", gap: 12, borderBottom: `1px solid ${designTokens.color.border}`, paddingBottom: 8 },
    }, createElement("strong", { style: { color: designTokens.color.subtle } }, row.key), createElement("div", { style: { color: designTokens.color.text } }, row.value))));
}
export function FeatureScaffold({ title, summary, status, children }) {
    return createElement(LayoutFrame, { title, subtitle: summary, aside: createElement(StatusPill, { status }) }, children);
}
export function buildWorkbenchActionHandler(scope, actionId, options = {}) {
    return async (item) => {
        if (options.copySelection && item != null) {
            const summary = `${item.title}\n${item.description}`;
            await globalThis.navigator?.clipboard?.writeText?.(summary);
        }
        if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("aa:feature-workbench-action", {
                detail: {
                    scope,
                    actionId,
                    itemId: item?.id ?? null,
                    occurredAt: new Date().toISOString(),
                },
            }));
            const target = typeof options.deepLinkPath === "function"
                ? options.deepLinkPath(item)
                : options.deepLinkPath ?? null;
            if (target != null && target.trim().length > 0) {
                window.location.hash = target.startsWith("#") ? target : `#${target.replace(/^\/+/, "/")}`;
            }
        }
    };
}
const defaultWorkbenchLabels = {
    filterLabel: "Filter workbench items",
    filterPlaceholder: "Filter current workbench items",
    emptyState: "No actionable items available",
    activityLogTitle: "Activity log",
    activityLogEmpty: "Recent actions will appear here after execution.",
};
export function FeatureWorkbench({ metrics, rows, items, actions, emptyState, labels, }) {
    const resolvedLabels = {
        ...defaultWorkbenchLabels,
        ...labels,
        ...(emptyState == null ? {} : { emptyState }),
    };
    const [filter, setFilter] = useState("");
    const [selectedId, setSelectedId] = useState(items[0]?.id ?? null);
    const [activities, setActivities] = useState([]);
    const filteredItems = useMemo(() => items.filter((item) => {
        const normalizedFilter = filter.trim().toLocaleLowerCase();
        if (normalizedFilter.length === 0) {
            return true;
        }
        return item.title.toLocaleLowerCase().includes(normalizedFilter) || item.description.toLocaleLowerCase().includes(normalizedFilter);
    }), [filter, items]);
    useEffect(() => {
        if (filteredItems.length === 0) {
            setSelectedId(null);
            return;
        }
        if (selectedId == null || !filteredItems.some((item) => item.id === selectedId)) {
            setSelectedId(filteredItems[0].id);
        }
    }, [filteredItems, selectedId]);
    const selectedItem = filteredItems.find((item) => item.id === selectedId) ?? null;
    async function triggerAction(action) {
        try {
            await action.onTrigger?.(selectedItem);
            const activity = action.buildActivity?.(selectedItem) ?? {
                title: `${action.label} completed`,
                description: selectedItem == null ? "A system-level action has been recorded." : `${selectedItem.title} has entered the ${action.label} flow.`,
            };
            setActivities((current) => [activity, ...current].slice(0, 6));
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            setActivities((current) => [{
                    title: `${action.label} failed`,
                    description: message,
                }, ...current].slice(0, 6));
        }
    }
    function moveSelection(delta) {
        if (filteredItems.length === 0) {
            return;
        }
        const currentIndex = filteredItems.findIndex((item) => item.id === selectedId);
        const nextIndex = currentIndex < 0
            ? 0
            : (currentIndex + delta + filteredItems.length) % filteredItems.length;
        setSelectedId(filteredItems[nextIndex]?.id ?? null);
    }
    const metricsBlock = metrics != null && metrics.length > 0
        ? createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 16 } }, ...metrics.map((metric) => createElement("div", { key: metric.label, style: createPanelStyle(designTokens.color.border) }, createElement("div", { style: { color: designTokens.color.subtle, fontSize: 12 } }, metric.label), createElement("strong", { style: { color: designTokens.color.text, display: "block", marginTop: 8 } }, String(metric.value)))))
        : null;
    return createElement("div", { role: "region", "aria-label": "Feature workbench", style: { display: "grid", gap: 16 } }, metricsBlock, createElement("div", { style: { display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" } }, createElement("input", {
        "aria-label": resolvedLabels.filterLabel,
        onChange: (event) => {
            setFilter(event.target.value);
        },
        placeholder: resolvedLabels.filterPlaceholder,
        style: {
            background: designTokens.color.surfaceElevated,
            border: `1px solid ${designTokens.color.border}`,
            borderRadius: designTokens.radius.sm,
            color: designTokens.color.text,
            minWidth: 240,
            padding: "8px 12px",
        },
        type: "search",
        value: filter,
    }), ...actions.map((action) => createElement("button", {
        key: action.id,
        onClick: () => {
            void triggerAction(action);
        },
        style: {
            background: action.tone === "danger" ? designTokens.color.danger : action.tone === "accent" ? designTokens.color.accent : designTokens.color.surfaceElevated,
            border: `1px solid ${action.tone === "neutral" ? designTokens.color.border : "transparent"}`,
            borderRadius: designTokens.radius.sm,
            color: action.tone === "neutral" ? designTokens.color.text : "#04130a",
            cursor: "pointer",
            fontWeight: designTokens.typography.fontWeight.semibold,
            padding: "8px 12px",
        },
        type: "button",
    }, action.label))), createElement(ThreePaneLayout, {
        left: filteredItems.length === 0
            ? createElement("p", { style: { color: designTokens.color.subtle } }, resolvedLabels.emptyState)
            : createElement("div", {
                role: "listbox",
                "aria-label": "Workbench items",
                "aria-activedescendant": selectedId == null ? undefined : `feature-workbench-option-${selectedId}`,
                onKeyDown: (event) => {
                    if (event.key === "ArrowDown") {
                        event.preventDefault();
                        moveSelection(1);
                    }
                    if (event.key === "ArrowUp") {
                        event.preventDefault();
                        moveSelection(-1);
                    }
                    if (event.key === "Home") {
                        event.preventDefault();
                        setSelectedId(filteredItems[0]?.id ?? null);
                    }
                    if (event.key === "End") {
                        event.preventDefault();
                        setSelectedId(filteredItems.at(-1)?.id ?? null);
                    }
                },
                style: { display: "grid", gap: 10 },
                tabIndex: 0,
            }, ...filteredItems.map((item) => createElement("div", {
                key: item.id,
                id: `feature-workbench-option-${item.id}`,
                onClick: () => {
                    setSelectedId(item.id);
                },
                role: "option",
                "aria-selected": item.id === selectedId,
                style: {
                    ...createPanelStyle(item.id === selectedId ? designTokens.color.accent : designTokens.color.border),
                    background: item.id === selectedId ? designTokens.semantic.color.surfaceSelected : designTokens.color.surface,
                    boxShadow: item.id === selectedId ? designTokens.shadows.focusRing : "none",
                    color: designTokens.color.text,
                    cursor: "pointer",
                    textAlign: "left",
                },
            }, createElement("strong", undefined, item.title), createElement("div", { style: { color: designTokens.color.subtle, marginTop: 8 } }, item.description)))),
        center: selectedItem == null
            ? createElement("p", { style: { color: designTokens.color.subtle } }, resolvedLabels.emptyState)
            : createElement("div", { role: "region", "aria-label": `${selectedItem.title} details`, style: { display: "grid", gap: 12 } }, createElement("div", { style: createPanelStyle(designTokens.color.info) }, createElement("h3", { style: { margin: 0, color: designTokens.color.text } }, selectedItem.title), createElement("p", { style: { color: designTokens.color.subtle, marginBottom: 0 } }, selectedItem.description)), rows != null && rows.length > 0 ? createElement(KeyValueTable, { rows }) : null, selectedItem.detailRows != null && selectedItem.detailRows.length > 0
                ? createElement(KeyValueTable, { rows: selectedItem.detailRows })
                : null),
        right: createElement("div", { style: { display: "grid", gap: 12 } }, createElement("div", { role: "log", "aria-live": "polite", "aria-relevant": "additions removals text", style: createPanelStyle(designTokens.color.border) }, createElement("h3", { style: { marginTop: 0, color: designTokens.color.text } }, resolvedLabels.activityLogTitle), activities.length === 0
            ? createElement("p", { style: { color: designTokens.color.subtle, marginBottom: 0 } }, resolvedLabels.activityLogEmpty)
            : createElement(ListCard, { items: activities }))),
    }));
}
export function FeatureWorkbenchPanel({ metrics, rows, items = [], actions, emptyState, labels, }) {
    const normalizedItems = useMemo(() => {
        if (items.length > 0) {
            return items.map((item, index) => ({
                id: item.id ?? `${item.title}-${index}`,
                title: item.title,
                description: item.description,
                detailRows: item.detailRows ?? [
                    { key: "Item", value: item.title },
                    { key: "Summary", value: item.description },
                ],
            }));
        }
        if (rows != null && rows.length > 0) {
            return rows.map((row, index) => ({
                id: `row-${index}`,
                title: row.key,
                description: typeof row.value === "string" ? row.value : `查看 ${row.key} 的当前状态与上下文。`,
                detailRows: [row],
            }));
        }
        if (metrics != null && metrics.length > 0) {
            return metrics.map((metric, index) => ({
                id: `metric-${index}`,
                title: metric.label,
                description: `当前值 ${String(metric.value)}`,
                detailRows: [{ key: metric.label, value: String(metric.value) }],
            }));
        }
        return [];
    }, [items, metrics, rows]);
    const normalizedActions = useMemo(() => actions.map((action) => ({
        id: action.id,
        label: action.label,
        ...(action.tone == null ? {} : { tone: action.tone }),
        ...(action.onTrigger == null ? {} : { onTrigger: action.onTrigger }),
        buildActivity: (item) => ({
            title: item == null ? action.label : `${action.label} · ${item.title}`,
            description: action.activityDescription
                ?? (item == null ? "A system-level action has been recorded." : `${item.title} has entered the ${action.label} flow.`),
        }),
    })), [actions]);
    return createElement(FeatureWorkbench, {
        items: normalizedItems,
        actions: normalizedActions,
        ...(metrics == null ? {} : { metrics }),
        ...(rows == null ? {} : { rows }),
        ...(emptyState == null ? {} : { emptyState }),
        ...(labels == null ? {} : { labels }),
    });
}
