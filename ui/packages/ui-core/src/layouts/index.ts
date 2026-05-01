import { createElement, type PropsWithChildren, type ReactElement, type ReactNode } from "react";
import { createPanelStyle, designTokens } from "../design-tokens";

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
  { left, center, right }: { left: ReactNode; center: ReactNode; right: ReactNode },
): ReactElement {
  // P2 FIX: Use CSS grid with responsive columns instead of fixed minmax.
  // Previously used minmax(220px, 1fr) minmax(260px, 1.2fr) minmax(240px, 1fr)
  // which requires at least 720px total width. On mobile this caused overflow.
  // Now collapses to single column on narrow viewports.
  return createElement(
    "div",
    {
      style: {
        display: "grid",
        gap: 12,
        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
      },
    },
    createElement("div", undefined, left),
    createElement("div", undefined, center),
    createElement("div", undefined, right),
  );
}
