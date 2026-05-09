import { createElement, useEffect, useState, type PropsWithChildren, type ReactElement, type ReactNode } from "react";
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
  { left, center, right, viewportWidth }: { left: ReactNode; center: ReactNode; right: ReactNode; viewportWidth?: number },
): ReactElement {
  const [measuredWidth, setMeasuredWidth] = useState<number>(
    viewportWidth ?? (typeof window === "undefined" ? designTokens.breakpoints.desktop : window.innerWidth),
  );

  useEffect(() => {
    if (viewportWidth != null || typeof window === "undefined") {
      return;
    }
    const updateWidth = () => {
      setMeasuredWidth(window.innerWidth);
    };
    window.addEventListener("resize", updateWidth);
    return () => {
      window.removeEventListener("resize", updateWidth);
    };
  }, [viewportWidth]);

  const effectiveWidth = viewportWidth ?? measuredWidth;
  const gridTemplateColumns =
    effectiveWidth < designTokens.breakpoints.mobile
      ? "1fr"
      : effectiveWidth < designTokens.breakpoints.tablet
        ? "minmax(0, 1fr) minmax(0, 1fr)"
        : "minmax(220px, 1fr) minmax(260px, 1.2fr) minmax(240px, 1fr)";

  return createElement(
    "div",
    {
      style: {
        display: "grid",
        gap: 12,
        gridTemplateColumns,
        alignItems: "start",
      },
    },
    createElement("div", undefined, left),
    createElement("div", undefined, center),
    createElement("div", undefined, right),
  );
}
