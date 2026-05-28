import { createElement, type PropsWithChildren, type ReactElement, type ReactNode } from "react";
import { createPanelStyle, designTokens } from "../design-tokens";

export function Stack(
  {
    gap = 12,
    children,
    align = "stretch",
  }: PropsWithChildren<{ gap?: number; align?: "stretch" | "start" | "center" | "end" }>,
): ReactElement {
  return createElement(
    "div",
    {
      style: {
        display: "grid",
        gap,
        alignItems: align,
      },
    },
    children,
  );
}

export function Inline(
  {
    gap = 8,
    children,
    align = "center",
    wrap = true,
  }: PropsWithChildren<{ gap?: number; align?: "stretch" | "start" | "center" | "end"; wrap?: boolean }>,
): ReactElement {
  return createElement(
    "div",
    {
      style: {
        display: "flex",
        gap,
        flexWrap: wrap ? "wrap" : "nowrap",
        alignItems: align,
      },
    },
    children,
  );
}

export function LayoutFrame(
  { title, subtitle, children, aside }: PropsWithChildren<{ title: string; subtitle: string; aside?: ReactNode }>,
): ReactElement {
  return createElement(
    "section",
    { style: createPanelStyle() },
    createElement(
      "header",
      { style: { display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", marginBottom: 16 } },
      createElement(
        "div",
        undefined,
        createElement("h2", { style: { margin: 0, color: designTokens.color.text } }, title),
        createElement("p", { style: { margin: "8px 0 0", color: designTokens.color.subtle } }, subtitle),
      ),
      aside ?? null,
    ),
    children,
  );
}

export function ThreePaneLayout(
  { left, center, right: rightPane }: { left: ReactNode; center: ReactNode; right: ReactNode },
): ReactElement {
  return createElement(
    "div",
    {
      style: {
        display: "grid",
        gap: 12,
        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
        alignItems: "start",
      },
    },
    createElement("aside", { "aria-label": "Left panel" }, left),
    createElement("main", { "aria-label": "Main content" }, center),
    createElement("aside", { "aria-label": "Right panel" }, rightPane),
  );
}
