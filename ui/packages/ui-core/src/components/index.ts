import { createElement, useEffect, useMemo, useState, type PropsWithChildren, type ReactElement, type ReactNode } from "react";
import type { ImplementationStatus } from "@aa/shared-types";
import { createPanelStyle, designTokens } from "../design-tokens";
import { LayoutFrame, ThreePaneLayout } from "../layouts";

export function StatusPill({ status }: { status: ImplementationStatus }): ReactElement {
  const background = status === "Planned" ? designTokens.color.planned : designTokens.color.accent;
  return createElement(
    "span",
    {
      style: {
        background,
        borderRadius: 999,
        color: "#04130a",
        padding: "4px 10px",
        fontSize: 12,
        fontWeight: 700,
      },
    },
    status,
  );
}

export function ListCard({ items }: { items: readonly { title: string; description: string }[] }): ReactElement {
  return createElement(
    "div",
    { style: { display: "grid", gap: 10 } },
    ...items.map((item) => createElement(
      "article",
      { key: item.title, style: createPanelStyle() },
      createElement("div", { style: { color: designTokens.color.text, fontWeight: 600 } }, item.title),
      createElement("div", { style: { color: designTokens.color.subtle, marginTop: 6 } }, item.description),
    )),
  );
}

export function KeyValueTable({ rows }: { rows: readonly { key: string; value: ReactNode }[] }): ReactElement {
  return createElement(
    "div",
    { style: { display: "grid", gap: 10 } },
    ...rows.map((row) => createElement(
      "div",
      {
        key: row.key,
        style: { display: "grid", gridTemplateColumns: "120px 1fr", gap: 12, borderBottom: `1px solid ${designTokens.color.border}`, paddingBottom: 8 },
      },
      createElement("strong", { style: { color: designTokens.color.subtle } }, row.key),
      createElement("div", { style: { color: designTokens.color.text } }, row.value),
    )),
  );
}

export function FeatureScaffold(
  { title, summary, status, children }: PropsWithChildren<{ title: string; summary: string; status: ImplementationStatus }>,
): ReactElement {
  return createElement(LayoutFrame, { title, subtitle: summary, aside: createElement(StatusPill, { status }) }, children);
}

export interface FeatureWorkbenchItem {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly detailRows?: readonly { key: string; value: ReactNode }[];
}

export interface FeatureWorkbenchAction {
  readonly id: string;
  readonly label: string;
  readonly tone?: "accent" | "danger" | "neutral";
  readonly buildActivity?: (item: FeatureWorkbenchItem | null) => { title: string; description: string };
}

export interface FeatureWorkbenchPanelItem {
  readonly id?: string;
  readonly title: string;
  readonly description: string;
  readonly detailRows?: readonly { key: string; value: ReactNode }[];
}

export interface FeatureWorkbenchPanelAction {
  readonly id: string;
  readonly label: string;
  readonly tone?: "accent" | "danger" | "neutral";
  readonly activityDescription?: string;
}

export function FeatureWorkbench(
  {
    metrics,
    rows,
    items,
    actions,
    emptyState = "暂无可操作项",
  }: {
    metrics?: readonly { label: string; value: string | number }[];
    rows?: readonly { key: string; value: ReactNode }[];
    items: readonly FeatureWorkbenchItem[];
    actions: readonly FeatureWorkbenchAction[];
    emptyState?: string;
  },
): ReactElement {
  const [filter, setFilter] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(items[0]?.id ?? null);
  const [activities, setActivities] = useState<readonly { title: string; description: string }[]>([]);

  const filteredItems = useMemo(() => items.filter((item) => {
    const normalizedFilter = filter.trim().toLowerCase();
    if (normalizedFilter.length === 0) {
      return true;
    }
    return item.title.toLowerCase().includes(normalizedFilter) || item.description.toLowerCase().includes(normalizedFilter);
  }), [filter, items]);

  useEffect(() => {
    if (filteredItems.length === 0) {
      setSelectedId(null);
      return;
    }
    if (selectedId == null || !filteredItems.some((item) => item.id === selectedId)) {
      setSelectedId(filteredItems[0]!.id);
    }
  }, [filteredItems, selectedId]);

  const selectedItem = filteredItems.find((item) => item.id === selectedId) ?? null;

  function triggerAction(action: FeatureWorkbenchAction): void {
    const activity = action.buildActivity?.(selectedItem) ?? {
      title: `${action.label} 已执行`,
      description: selectedItem == null ? "系统级动作已记录。" : `${selectedItem.title} 已进入 ${action.label} 流程。`,
    };
    setActivities((current) => [activity, ...current].slice(0, 6));
  }

  const metricsBlock = metrics != null && metrics.length > 0
    ? createElement(
      "div",
      { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 16 } },
      ...metrics.map((metric) => createElement(
        "div",
        { key: metric.label, style: createPanelStyle(designTokens.color.border) },
        createElement("div", { style: { color: designTokens.color.subtle, fontSize: 12 } }, metric.label),
        createElement("strong", { style: { color: designTokens.color.text, display: "block", marginTop: 8 } }, String(metric.value)),
      )),
    )
    : null;

  return createElement(
    "div",
    { style: { display: "grid", gap: 16 } },
    metricsBlock,
    createElement(
      "div",
      { style: { display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" } },
      createElement("input", {
        "aria-label": "Filter workbench items",
        onChange: (event: Event) => {
          setFilter((event.target as HTMLInputElement).value);
        },
        placeholder: "筛选当前工作台项",
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
      }),
      ...actions.map((action) => createElement("button", {
        key: action.id,
        onClick: () => {
          triggerAction(action);
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
      }, action.label)),
    ),
    createElement(ThreePaneLayout, {
      left: filteredItems.length === 0
        ? createElement("p", { style: { color: designTokens.color.subtle } }, emptyState)
        : createElement(
          "div",
          { style: { display: "grid", gap: 10 } },
          ...filteredItems.map((item) => createElement("button", {
            key: item.id,
            onClick: () => {
              setSelectedId(item.id);
            },
            style: {
              ...createPanelStyle(item.id === selectedId ? designTokens.color.accent : designTokens.color.border),
              background: item.id === selectedId ? "#12201a" : designTokens.color.surface,
              color: designTokens.color.text,
              cursor: "pointer",
              textAlign: "left",
            },
            type: "button",
          },
          createElement("strong", undefined, item.title),
          createElement("div", { style: { color: designTokens.color.subtle, marginTop: 8 } }, item.description))),
        ),
      center: selectedItem == null
        ? createElement("p", { style: { color: designTokens.color.subtle } }, emptyState)
        : createElement(
          "div",
          { style: { display: "grid", gap: 12 } },
          createElement("div", { style: createPanelStyle(designTokens.color.info) },
            createElement("h3", { style: { margin: 0, color: designTokens.color.text } }, selectedItem.title),
            createElement("p", { style: { color: designTokens.color.subtle, marginBottom: 0 } }, selectedItem.description),
          ),
          rows != null && rows.length > 0 ? createElement(KeyValueTable, { rows }) : null,
          selectedItem.detailRows != null && selectedItem.detailRows.length > 0
            ? createElement(KeyValueTable, { rows: selectedItem.detailRows })
            : null,
        ),
      right: createElement(
        "div",
        { style: { display: "grid", gap: 12 } },
        createElement("div", { style: createPanelStyle(designTokens.color.border) },
          createElement("h3", { style: { marginTop: 0, color: designTokens.color.text } }, "操作日志"),
          activities.length === 0
            ? createElement("p", { style: { color: designTokens.color.subtle, marginBottom: 0 } }, "执行动作后会在这里记录最近轨迹。")
            : createElement(ListCard, { items: activities }),
        ),
      ),
    }),
  );
}

export function FeatureWorkbenchPanel(
  {
    metrics,
    rows,
    items = [],
    actions,
    emptyState,
  }: {
    metrics?: readonly { label: string; value: string | number }[];
    rows?: readonly { key: string; value: ReactNode }[];
    items?: readonly FeatureWorkbenchPanelItem[];
    actions: readonly FeatureWorkbenchPanelAction[];
    emptyState?: string;
  },
): ReactElement {
  const normalizedItems = useMemo<readonly FeatureWorkbenchItem[]>(() => {
    if (items.length > 0) {
      return items.map((item, index) => ({
        id: item.id ?? `${item.title}-${index}`,
        title: item.title,
        description: item.description,
        detailRows: item.detailRows ?? [
          { key: "条目", value: item.title },
          { key: "摘要", value: item.description },
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

  const normalizedActions = useMemo<readonly FeatureWorkbenchAction[]>(() => actions.map((action) => ({
    id: action.id,
    label: action.label,
    ...(action.tone == null ? {} : { tone: action.tone }),
    buildActivity: (item) => ({
      title: item == null ? action.label : `${action.label} · ${item.title}`,
      description: action.activityDescription
        ?? (item == null ? "系统级动作已记录。" : `${item.title} 已进入 ${action.label} 流程。`),
    }),
  })), [actions]);

  return createElement(FeatureWorkbench, {
    items: normalizedItems,
    actions: normalizedActions,
    ...(metrics == null ? {} : { metrics }),
    ...(rows == null ? {} : { rows }),
    ...(emptyState == null ? {} : { emptyState }),
  });
}
