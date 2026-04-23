import { createElement, type PropsWithChildren, type ReactElement, type ReactNode } from "react";
import type { ImplementationStatus } from "@aa/shared-types";
import { createPanelStyle, designTokens } from "../design-tokens";
import { LayoutFrame } from "../layouts";

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
