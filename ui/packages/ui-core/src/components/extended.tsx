import React, { createElement, useState, type CSSProperties, type PropsWithChildren, type ReactElement, type ReactNode } from "react";
import { animation, designTokens } from "../design-tokens";

const baseSurfaceStyle: CSSProperties = {
  background: designTokens.semantic.color.surface,
  border: `1px solid ${designTokens.semantic.color.border}`,
  borderRadius: designTokens.semantic.radius.card,
  color: designTokens.semantic.color.text,
};

export function Card({ children, style }: PropsWithChildren<{ style?: CSSProperties }>): ReactElement {
  return createElement("section", { style: { ...baseSurfaceStyle, padding: 16, ...style } }, children);
}

export function Panel({ title, children }: PropsWithChildren<{ title: string }>): ReactElement {
  return createElement(Card, null,
    createElement("header", { style: { marginBottom: 12, fontWeight: 600 } }, title),
    children,
  );
}

export function SectionHeading({ eyebrow, title, description }: { eyebrow?: string; title: string; description?: string }): ReactElement {
  return createElement("header", { style: { display: "grid", gap: 4 } },
    eyebrow ? createElement("span", { style: { color: designTokens.semantic.color.textSubtle, fontSize: 12, textTransform: "uppercase" } }, eyebrow) : null,
    createElement("h2", { style: { margin: 0, fontSize: designTokens.primitive.typography.fontSize["2xl"] } }, title),
    description ? createElement("p", { style: { margin: 0, color: designTokens.semantic.color.textSubtle } }, description) : null,
  );
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>): ReactElement {
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

export function NumberInput(props: React.InputHTMLAttributes<HTMLInputElement>): ReactElement {
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

export function SearchInput(props: React.InputHTMLAttributes<HTMLInputElement>): ReactElement {
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

export function Divider(): ReactElement {
  return createElement("hr", { style: { border: 0, borderTop: `1px solid ${designTokens.semantic.color.border}`, margin: "16px 0" } });
}

export function Stack({ gap = 12, children }: PropsWithChildren<{ gap?: number }>): ReactElement {
  return createElement("div", { style: { display: "grid", gap } }, children);
}

export function Inline({ gap = 12, wrap = true, children }: PropsWithChildren<{ gap?: number; wrap?: boolean }>): ReactElement {
  return createElement("div", { style: { display: "flex", gap, flexWrap: wrap ? "wrap" : "nowrap", alignItems: "center" } }, children);
}

export function Grid({ min = 240, children }: PropsWithChildren<{ min?: number }>): ReactElement {
  return createElement("div", { style: { display: "grid", gap: 16, gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))` } }, children);
}

export function ProgressBar({ value, max = 100, label }: { value: number; max?: number; label?: string }): ReactElement {
  const ratio = Math.max(0, Math.min(1, value / max));
  return createElement("div", { role: "progressbar", "aria-valuenow": value, "aria-valuemin": 0, "aria-valuemax": max, "aria-label": label ?? "Progress" },
    createElement("div", {
      style: {
        width: "100%",
        height: 10,
        background: designTokens.semantic.color.surfaceElevated,
        borderRadius: 999,
        overflow: "hidden",
      },
    },
      createElement("div", {
        style: {
          width: `${ratio * 100}%`,
          height: "100%",
          background: designTokens.semantic.color.accent,
          transition: `width ${animation.duration.normal} ${animation.easing.standard}`,
        },
      }),
    ),
  );
}

export function Skeleton({ width = "100%", height = 16 }: { width?: number | string; height?: number | string }): ReactElement {
  return createElement("div", {
    "aria-hidden": true,
    style: {
      width,
      height,
      borderRadius: 8,
      background: `linear-gradient(90deg, ${designTokens.semantic.color.surfaceElevated}, ${designTokens.semantic.color.surfaceHover}, ${designTokens.semantic.color.surfaceElevated})`,
    },
  });
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }): ReactElement {
  return createElement(Card, { style: { textAlign: "center" } },
    createElement("h3", { style: { marginTop: 0 } }, title),
    createElement("p", { style: { color: designTokens.semantic.color.textSubtle } }, description),
    action,
  );
}

export function StatCard({ label, value, delta }: { label: string; value: ReactNode; delta?: string }): ReactElement {
  return createElement(Card, null,
    createElement("span", { style: { color: designTokens.semantic.color.textSubtle, fontSize: 12 } }, label),
    createElement("strong", { style: { display: "block", fontSize: 28, marginTop: 6 } }, value),
    delta ? createElement("span", { style: { color: designTokens.semantic.color.accent } }, delta) : null,
  );
}

export function Breadcrumbs({ items }: { items: readonly { label: string; href?: string }[] }): ReactElement {
  return createElement("nav", { "aria-label": "Breadcrumb" },
    createElement("ol", { style: { display: "flex", gap: 8, listStyle: "none", padding: 0, margin: 0 } },
      items.map((item, index) => createElement("li", { key: `${item.label}-${index}` },
        item.href ? createElement("a", { href: item.href }, item.label) : item.label,
      )),
    ),
  );
}

export function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange?: (page: number) => void;
}): ReactElement {
  return createElement("nav", { "aria-label": "Pagination" },
    createElement("div", { style: { display: "flex", gap: 8 } },
      Array.from({ length: totalPages }, (_, index) => createElement("button", {
        key: `page-${index + 1}`,
        type: "button",
        "aria-current": page === index + 1 ? "page" : undefined,
        onClick: () => onChange?.(index + 1),
      }, index + 1)),
    ),
  );
}

export function Tabs({
  tabs,
  initialTabId,
}: {
  tabs: readonly { id: string; label: string; panel: ReactNode }[];
  initialTabId?: string;
}): ReactElement {
  const [activeTab, setActiveTab] = useState(initialTabId ?? tabs[0]?.id ?? "");
  const current = tabs.find((tab) => tab.id === activeTab) ?? tabs[0];
  return createElement("div", null,
    createElement("div", { role: "tablist", "aria-label": "Tabs", style: { display: "flex", gap: 8 } },
      tabs.map((tab) => createElement("button", {
        key: tab.id,
        role: "tab",
        "aria-selected": current?.id === tab.id,
        onClick: () => setActiveTab(tab.id),
        type: "button",
      }, tab.label)),
    ),
    current ? createElement("div", { role: "tabpanel", style: { marginTop: 12 } }, current.panel) : null,
  );
}

export function Accordion({
  items,
}: {
  items: readonly { id: string; title: string; content: ReactNode }[];
}): ReactElement {
  const [openId, setOpenId] = useState<string | null>(items[0]?.id ?? null);
  return createElement("div", { style: { display: "grid", gap: 8 } },
    items.map((item) => createElement(Card, { key: item.id },
      createElement("button", {
        type: "button",
        "aria-expanded": openId === item.id,
        onClick: () => setOpenId(openId === item.id ? null : item.id),
      }, item.title),
      openId === item.id ? createElement("div", { style: { marginTop: 10 } }, item.content) : null,
    )),
  );
}

export function Tooltip({ label, children }: PropsWithChildren<{ label: string }>): ReactElement {
  return createElement("span", { title: label, "aria-label": label }, children);
}

export function Drawer({ open, title, children }: PropsWithChildren<{ open: boolean; title: string }>): ReactElement | null {
  if (!open) return null;
  return createElement("aside", {
    role: "dialog",
    "aria-modal": true,
    "aria-label": title,
    style: { position: "fixed", insetInlineEnd: 0, top: 0, bottom: 0, width: 360, padding: 20, ...baseSurfaceStyle },
  }, children);
}

export function Toast({ message, tone = "info" }: { message: string; tone?: "info" | "success" | "warning" | "danger" }): ReactElement {
  return createElement("div", {
    role: "status",
    "aria-live": tone === "danger" ? "assertive" : "polite",
    style: { ...baseSurfaceStyle, padding: 12 },
  }, message);
}

export function Kbd({ children }: PropsWithChildren): ReactElement {
  return createElement("kbd", {
    style: {
      border: `1px solid ${designTokens.semantic.color.border}`,
      borderRadius: 6,
      padding: "2px 6px",
      fontFamily: designTokens.primitive.typography.fontFamily.mono,
    },
  }, children);
}

export function CodeBlock({ code }: { code: string }): ReactElement {
  return createElement("pre", { style: { ...baseSurfaceStyle, padding: 16, overflowX: "auto" } },
    createElement("code", null, code),
  );
}

export function DescriptionList({ rows }: { rows: readonly { term: string; detail: ReactNode }[] }): ReactElement {
  return createElement("dl", { style: { display: "grid", gridTemplateColumns: "max-content 1fr", gap: 8 } },
    rows.flatMap((row) => [
      createElement("dt", { key: `${row.term}-term`, style: { fontWeight: 600 } }, row.term),
      createElement("dd", { key: `${row.term}-detail`, style: { margin: 0 } }, row.detail),
    ]),
  );
}

export function Stepper({ steps, activeStep }: { steps: readonly string[]; activeStep: number }): ReactElement {
  return createElement("ol", { style: { display: "flex", gap: 12, listStyle: "none", padding: 0, margin: 0 } },
    steps.map((step, index) => createElement("li", {
      key: `${step}-${index}`,
      "aria-current": activeStep === index ? "step" : undefined,
      style: { fontWeight: activeStep === index ? 700 : 400 },
    }, step)),
  );
}

export function Timeline({ items }: { items: readonly { id: string; title: string; description?: string }[] }): ReactElement {
  return createElement("ol", { style: { display: "grid", gap: 12 } },
    items.map((item) => createElement("li", { key: item.id },
      createElement("strong", null, item.title),
      item.description ? createElement("p", { style: { marginBottom: 0, color: designTokens.semantic.color.textSubtle } }, item.description) : null,
    )),
  );
}

export function IconButton({ label, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }): ReactElement {
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

export function Callout({ tone = "info", title, children }: PropsWithChildren<{ tone?: "info" | "success" | "warning" | "danger"; title: string }>): ReactElement {
  const toneColor = tone === "danger"
    ? designTokens.semantic.color.danger
    : tone === "warning"
      ? designTokens.semantic.color.warning
      : tone === "success"
        ? designTokens.semantic.color.success
        : designTokens.semantic.color.info;
  return createElement("div", { style: { ...baseSurfaceStyle, borderInlineStart: `4px solid ${toneColor}`, padding: 16 } },
    createElement("strong", null, title),
    createElement("div", { style: { marginTop: 8 } }, children),
  );
}

export function CommandInput(props: React.InputHTMLAttributes<HTMLInputElement>): ReactElement {
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

export function SegmentedControl({
  options,
  value,
  onChange,
}: {
  options: readonly { value: string; label: string }[];
  value: string;
  onChange?: (value: string) => void;
}): ReactElement {
  return createElement("div", { role: "radiogroup", style: { display: "inline-flex", gap: 6, padding: 4, ...baseSurfaceStyle } },
    options.map((option) => createElement("button", {
      key: option.value,
      role: "radio",
      type: "button",
      "aria-checked": value === option.value,
      onClick: () => onChange?.(option.value),
      style: {
        padding: "6px 12px",
        borderRadius: 999,
        border: "none",
        background: value === option.value ? designTokens.semantic.color.accent : "transparent",
      },
    }, option.label)),
  );
}

export function TimelineChart({
  points,
}: {
  points: readonly { label: string; value: number; tone?: "neutral" | "accent" | "danger" }[];
}): ReactElement {
  const max = Math.max(...points.map((point) => point.value), 1);
  return createElement("div", { style: { display: "grid", gap: 10 } },
    points.map((point) => {
      const color = point.tone === "danger"
        ? designTokens.semantic.color.danger
        : point.tone === "accent"
          ? designTokens.semantic.color.accent
          : designTokens.semantic.color.info;
      return createElement("div", { key: point.label, style: { display: "grid", gap: 4 } },
        createElement("div", { style: { display: "flex", justifyContent: "space-between", fontSize: 12 } },
          createElement("span", null, point.label),
          createElement("strong", null, point.value),
        ),
        createElement("div", { style: { height: 8, borderRadius: 999, background: designTokens.semantic.color.surfaceElevated, overflow: "hidden" } },
          createElement("div", {
            style: {
              width: `${Math.max(6, (point.value / max) * 100)}%`,
              height: "100%",
              background: color,
            },
          }),
        ),
      );
    }),
  );
}

export function PieChart({
  slices,
}: {
  slices: readonly { label: string; value: number; color?: string }[];
}): ReactElement {
  const total = slices.reduce((sum, slice) => sum + Math.max(slice.value, 0), 0);
  const palette = [
    designTokens.semantic.color.accent,
    designTokens.semantic.color.info,
    designTokens.semantic.color.warning,
    designTokens.semantic.color.success,
    designTokens.semantic.color.danger,
  ];
  let currentPercent = 0;
  const gradientStops = slices.map((slice, index) => {
    const safeValue = total === 0 ? 0 : (Math.max(slice.value, 0) / total) * 100;
    const start = currentPercent;
    const end = currentPercent + safeValue;
    currentPercent = end;
    const color = slice.color ?? palette[index % palette.length]!;
    return `${color} ${start}% ${end}%`;
  });

  return createElement("div", { style: { display: "grid", gap: 12, alignItems: "center", justifyItems: "center" } },
    createElement("div", {
      "aria-label": "Pie chart",
      style: {
        width: 144,
        height: 144,
        borderRadius: "50%",
        background: total === 0
          ? designTokens.semantic.color.surfaceElevated
          : `conic-gradient(${gradientStops.join(", ")})`,
        border: `1px solid ${designTokens.semantic.color.border}`,
      },
    }),
    createElement("div", { style: { display: "grid", gap: 6, width: "100%" } },
      slices.map((slice, index) => createElement("div", {
        key: `${slice.label}-${index}`,
        style: { display: "flex", justifyContent: "space-between", gap: 12, fontSize: 12 },
      },
      createElement("span", null, slice.label),
      createElement("strong", null, slice.value),
      )),
    ),
  );
}

function formatRemainingDuration(deadline: string, now: number): {
  readonly label: string;
  readonly tone: "danger" | "warning" | "success";
} {
  const diff = new Date(deadline).getTime() - now;
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

export function SLACountdown({
  deadline,
  now = Date.now(),
}: {
  deadline: string;
  now?: number;
}): ReactElement {
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

export function FileAttachment({
  files,
}: {
  files: readonly { id: string; name: string; sizeLabel?: string; kind?: string }[];
}): ReactElement {
  return createElement("div", { style: { display: "grid", gap: 8 } },
    files.map((file) => createElement("div", {
      key: file.id,
      style: {
        ...baseSurfaceStyle,
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        padding: 12,
      },
    },
    createElement("div", { style: { display: "grid", gap: 2 } },
      createElement("strong", null, file.name),
      createElement("span", { style: { color: designTokens.semantic.color.textSubtle, fontSize: 12 } }, file.kind ?? "attachment"),
    ),
    createElement("span", { style: { color: designTokens.semantic.color.textSubtle, fontSize: 12 } }, file.sizeLabel ?? ""),
    )),
  );
}

export function DAGVisualization({
  stages,
}: {
  stages: readonly { id: string; label: string; status: "pending" | "running" | "completed" | "failed"; items?: readonly string[] }[];
}): ReactElement {
  const statusColor = (status: "pending" | "running" | "completed" | "failed"): string => {
    switch (status) {
      case "completed": return designTokens.semantic.color.accent;
      case "running": return designTokens.semantic.color.info;
      case "failed": return designTokens.semantic.color.danger;
      default: return designTokens.semantic.color.textSubtle;
    }
  };

  return createElement("div", { style: { display: "grid", gap: 12 } },
    createElement("div", { style: { display: "grid", gridTemplateColumns: `repeat(${Math.max(stages.length, 1)}, minmax(0, 1fr))`, gap: 12 } },
      stages.map((stage) => createElement("div", {
        key: stage.id,
        style: {
          ...baseSurfaceStyle,
          padding: 12,
          borderTop: `3px solid ${statusColor(stage.status)}`,
        },
      },
      createElement("strong", null, stage.label),
      createElement("div", { style: { marginTop: 4, color: designTokens.semantic.color.textSubtle, fontSize: 12 } }, stage.status),
      stage.items != null && stage.items.length > 0
        ? createElement("ul", { style: { margin: "10px 0 0", paddingInlineStart: 18 } },
          stage.items.map((item) => createElement("li", { key: item, style: { fontSize: 12 } }, item)),
        )
        : null,
      )),
    ),
  );
}
