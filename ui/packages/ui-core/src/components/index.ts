import { createElement, useEffect, useMemo, useState, type ChangeEvent, type KeyboardEvent, type PropsWithChildren, type ReactElement, type ReactNode } from "react";
import { copyTextToClipboard } from "@aa/shared-platform";
import type { ImplementationStatus } from "@aa/shared-types";
import { createPanelStyle, designTokens } from "../design-tokens";
import { Inline, LayoutFrame, Stack, ThreePaneLayout } from "../layouts";
export { CodeBlock, DAGVisualization, FileAttachment, Timeline } from "./extended";
export { Inline, LayoutFrame, Stack, ThreePaneLayout } from "../layouts";

export function StatusPill({ status }: { status: ImplementationStatus }): ReactElement {
  const background = status === "Planned" ? designTokens.color.planned : designTokens.color.accent;
  const color = status === "Planned" ? designTokens.color.text : designTokens.color.text;
  return createElement(
    "span",
    {
      style: {
        background,
        borderRadius: 999,
        color,
        padding: "4px 10px",
        fontSize: 12,
        fontWeight: 700,
      },
    },
    status,
  );
}

export interface ListCardItem {
  readonly title: string;
  readonly description: string;
  readonly actionLabel?: string;
  readonly actionDisabled?: boolean;
  readonly onAction?: () => void | Promise<void>;
}

export function ListCard({ items }: { items: readonly ListCardItem[] }): ReactElement {
  return createElement(
    "div",
    { role: "list", style: { display: "grid", gap: 10 } },
    ...items.map((item, index) => createElement(
      "article",
      { key: `${item.title}-${index}`, role: "listitem", style: createPanelStyle() },
      createElement("div", { style: { color: designTokens.color.text, fontWeight: 600 } }, item.title),
      createElement("div", { style: { color: designTokens.color.subtle, marginTop: 6 } }, item.description),
      item.actionLabel == null || item.onAction == null
        ? null
        : createElement(
          "button",
          {
            type: "button",
            disabled: item.actionDisabled === true,
            onClick: () => {
              void item.onAction?.();
            },
            style: {
              marginTop: 10,
              justifySelf: "start",
              borderRadius: 10,
              border: `1px solid ${designTokens.color.border}`,
              background: item.actionDisabled === true ? "#f5f5f4" : "#ffffff",
              color: designTokens.color.text,
              cursor: item.actionDisabled === true ? "not-allowed" : "pointer",
              padding: "8px 12px",
              fontWeight: 600,
            },
          },
          item.actionLabel,
        ),
    )),
  );
}

export function KeyValueTable({ rows }: { rows: readonly { key: string; value: ReactNode }[] }): ReactElement {
  return createElement(
    "div",
    { style: { display: "grid", gap: 10 } },
    ...rows.map((row, index) => createElement(
      "div",
      {
        key: `${row.key}-${index}`,
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
  readonly disabled?: boolean | ((item: FeatureWorkbenchItem | null) => boolean);
  readonly buildActivity?: (item: FeatureWorkbenchItem | null) => { title: string; description: string };
  readonly onTrigger?: (item: FeatureWorkbenchItem | null) => void | Promise<void>;
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
  readonly disabled?: boolean | ((item: FeatureWorkbenchItem | null) => boolean);
  readonly activityDescription?: string;
  readonly onTrigger?: (item: FeatureWorkbenchItem | null) => void | Promise<void>;
}

function resolveActionDisabled(
  action: Pick<FeatureWorkbenchAction, "disabled" | "onTrigger">,
  selectedItem: FeatureWorkbenchItem | null,
): boolean {
  const disabled = typeof action.disabled === "function"
    ? action.disabled(selectedItem)
    : (action.disabled ?? false);
  return disabled || action.onTrigger == null;
}

export function buildWorkbenchActionHandler(
  scope: string,
  actionId: string,
  options: {
    readonly copySelection?: boolean;
    readonly deepLinkPath?: string | ((item: FeatureWorkbenchItem | null) => string | null);
  } = {},
): (item: FeatureWorkbenchItem | null) => Promise<void> {
  return async (item) => {
    if (options.copySelection && item != null) {
      const summary = `${item.title}\n${item.description}`;
      await copyTextToClipboard(summary);
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
        navigateToWorkbenchTarget(target);
      }
    }
  };
}

function navigateToWorkbenchTarget(target: string): void {
  if (typeof window === "undefined") {
    return;
  }
  const trimmed = target.trim();
  if (trimmed.length === 0) {
    return;
  }
  const normalized = trimmed.startsWith("#") ? trimmed.slice(1) : trimmed;
  if (normalized.startsWith("/")) {
    const nextUrl = new URL(normalized, window.location.origin);
    window.history.pushState({}, "", `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
    window.dispatchEvent(new PopStateEvent("popstate"));
    return;
  }
  window.location.hash = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
}

export interface FeatureWorkbenchLabels {
  readonly filterLabel: string;
  readonly filterPlaceholder: string;
  readonly emptyState: string;
  readonly activityLogTitle: string;
  readonly activityLogEmpty: string;
}

const defaultWorkbenchLabels: FeatureWorkbenchLabels = {
  filterLabel: "Filter workbench items",
  filterPlaceholder: "Filter current workbench items",
  emptyState: "No actionable items available",
  activityLogTitle: "Activity log",
  activityLogEmpty: "Recent actions will appear here after execution.",
};

export function FeatureWorkbench(
  {
    metrics,
    rows,
    items,
    actions,
    emptyState,
    labels,
    layoutMode = "default",
  }: {
    metrics?: readonly { label: string; value: string | number }[];
    rows?: readonly { key: string; value: ReactNode }[];
    items: readonly FeatureWorkbenchItem[];
    actions: readonly FeatureWorkbenchAction[];
    emptyState?: string;
    labels?: Partial<FeatureWorkbenchLabels>;
    layoutMode?: "default" | "metrics_only";
  },
): ReactElement {
  const resolvedLabels = {
    ...defaultWorkbenchLabels,
    ...labels,
    ...(emptyState == null ? {} : { emptyState }),
  };
  const [filter, setFilter] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(items[0]?.id ?? null);
  const [activities, setActivities] = useState<readonly { title: string; description: string }[]>([]);

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
      setSelectedId(filteredItems[0]!.id);
    }
  }, [filteredItems, selectedId]);

  const selectedItem = filteredItems.find((item) => item.id === selectedId) ?? null;
  const showActivityLog = actions.length > 0;

  async function triggerAction(action: FeatureWorkbenchAction): Promise<void> {
    if (resolveActionDisabled(action, selectedItem)) {
      return;
    }
    try {
      await action.onTrigger?.(selectedItem);
      const activity = action.buildActivity?.(selectedItem) ?? {
        title: `${action.label} completed`,
        description: selectedItem == null ? "A system-level action has been recorded." : `${selectedItem.title} has entered the ${action.label} flow.`,
      };
      setActivities((current) => [activity, ...current].slice(0, 6));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setActivities((current) => [{
        title: `${action.label} failed`,
        description: message,
      }, ...current].slice(0, 6));
    }
  }

  function moveSelection(delta: number): void {
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
    { role: "region", "aria-label": "Feature workbench", style: { display: "grid", gap: 16 } },
    metricsBlock,
    createElement(
      "div",
      { style: { display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" } },
      createElement("input", {
        "aria-label": resolvedLabels.filterLabel,
        onChange: (event: ChangeEvent<HTMLInputElement>) => {
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
      }),
      ...actions.map((action) => createElement("button", {
        "aria-disabled": resolveActionDisabled(action, selectedItem),
        disabled: resolveActionDisabled(action, selectedItem),
        key: action.id,
        onClick: () => {
          void triggerAction(action);
        },
        style: {
          background: action.tone === "danger" ? designTokens.color.danger : action.tone === "accent" ? designTokens.color.accent : designTokens.color.surfaceElevated,
          border: `1px solid ${action.tone === "neutral" ? designTokens.color.border : "transparent"}`,
          borderRadius: designTokens.radius.sm,
          color: action.tone === "neutral" ? designTokens.color.text : designTokens.primitive.color.ink950,
          cursor: resolveActionDisabled(action, selectedItem) ? "not-allowed" : "pointer",
          fontWeight: designTokens.typography.fontWeight.semibold,
          opacity: resolveActionDisabled(action, selectedItem) ? 0.45 : 1,
          padding: "8px 12px",
        },
        type: "button",
      }, action.label)),
    ),
    layoutMode === "metrics_only"
      ? (
        showActivityLog
          ? createElement(
            "div",
            { style: { display: "grid", gap: 12 } },
            createElement("div", { role: "log", "aria-live": "polite", "aria-relevant": "additions removals text", style: createPanelStyle(designTokens.color.border) },
              createElement("h3", { style: { marginTop: 0, color: designTokens.color.text } }, resolvedLabels.activityLogTitle),
              activities.length === 0
                ? createElement("p", { style: { color: designTokens.color.subtle, marginBottom: 0 } }, resolvedLabels.activityLogEmpty)
                : createElement(ListCard, { items: activities }),
            ),
          )
          : null
      )
      : createElement(ThreePaneLayout, {
        left: filteredItems.length === 0
          ? createElement("p", { style: { color: designTokens.color.subtle } }, resolvedLabels.emptyState)
          : createElement(
            "div",
            {
              role: "listbox",
              "aria-label": "Workbench items",
              "aria-activedescendant": selectedId == null ? undefined : `feature-workbench-option-${selectedId}`,
              onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => {
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
            },
            ...filteredItems.map((item) => createElement("div", {
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
            },
            createElement("strong", undefined, item.title),
            createElement("div", { style: { color: designTokens.color.subtle, marginTop: 8 } }, item.description))),
          ),
        center: selectedItem == null
          ? createElement("p", { style: { color: designTokens.color.subtle } }, resolvedLabels.emptyState)
          : createElement(
            "div",
            { role: "region", "aria-label": `${selectedItem.title} details`, style: { display: "grid", gap: 12 } },
            createElement("div", { style: createPanelStyle(designTokens.color.info) },
              createElement("h3", { style: { margin: 0, color: designTokens.color.text } }, selectedItem.title),
              createElement("p", { style: { color: designTokens.color.subtle, marginBottom: 0 } }, selectedItem.description),
            ),
            rows != null && rows.length > 0 ? createElement(KeyValueTable, { rows }) : null,
            selectedItem.detailRows != null && selectedItem.detailRows.length > 0
              ? createElement(KeyValueTable, { rows: selectedItem.detailRows })
              : null,
          ),
        right: showActivityLog
          ? createElement(
            "div",
            { style: { display: "grid", gap: 12 } },
            createElement("div", { role: "log", "aria-live": "polite", "aria-relevant": "additions removals text", style: createPanelStyle(designTokens.color.border) },
              createElement("h3", { style: { marginTop: 0, color: designTokens.color.text } }, resolvedLabels.activityLogTitle),
              activities.length === 0
                ? createElement("p", { style: { color: designTokens.color.subtle, marginBottom: 0 } }, resolvedLabels.activityLogEmpty)
                : createElement(ListCard, { items: activities }),
            ),
          )
          : null,
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
    labels,
  }: {
    metrics?: readonly { label: string; value: string | number }[];
    rows?: readonly { key: string; value: ReactNode }[];
    items?: readonly FeatureWorkbenchPanelItem[];
    actions: readonly FeatureWorkbenchPanelAction[];
    emptyState?: string;
    labels?: Partial<FeatureWorkbenchLabels>;
  },
): ReactElement {
  const rowsOnlyMode = items.length === 0 && rows != null && rows.length > 0;
  const metricsOnlyMode = items.length === 0 && !rowsOnlyMode && metrics != null && metrics.length > 0;
  const normalizedItems = useMemo<readonly FeatureWorkbenchItem[]>(() => {
    if (items.length > 0) {
      return items.map((item, index) => ({
        id: item.id ?? `${item.title}-${index}`,
        title: item.title,
        description: item.description,
        detailRows: item.detailRows ?? (rows != null && rows.length > 0
          ? []
          : [
            { key: "Item", value: item.title },
            { key: "Summary", value: item.description },
          ]),
      }));
    }

    if (rowsOnlyMode) {
      return [{
        id: "rows-overview",
        title: "Overview",
        description: `Review ${rows.length} current fields and their latest values.`,
        detailRows: rows,
      }];
    }

    if (metricsOnlyMode) {
      return [{
        id: "metrics-overview",
        title: "Overview",
        description: `Review ${metrics.length} live metrics and their latest values.`,
        detailRows: metrics.map((metric) => ({ key: metric.label, value: String(metric.value) })),
      }];
    }

    return [];
  }, [items, metrics, metricsOnlyMode, rows, rowsOnlyMode]);

  const normalizedActions = useMemo<readonly FeatureWorkbenchAction[]>(() => actions.map((action) => ({
    id: action.id,
    label: action.label,
    ...(action.tone == null ? {} : { tone: action.tone }),
    ...(action.disabled == null ? {} : { disabled: action.disabled }),
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
    ...(metricsOnlyMode ? { layoutMode: "metrics_only" as const } : {}),
    ...(!rowsOnlyMode && rows != null ? { rows } : {}),
    ...(emptyState == null ? {} : { emptyState }),
    ...(labels == null ? {} : { labels }),
  });
}
