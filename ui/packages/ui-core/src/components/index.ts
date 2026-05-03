import React, { createElement, useEffect, useMemo, useRef, useState, type ChangeEvent, type CSSProperties, type ForwardedRef, type InputHTMLAttributes, type PropsWithChildren, type ReactElement, type ReactNode, type SelectHTMLAttributes, forwardRef } from "react";
import type { ImplementationStatus } from "@aa/shared-types";
import { animation, createPanelStyle, designTokens } from "../design-tokens";
import { LayoutFrame, ThreePaneLayout } from "../layouts";

// =============================================================================
// ANIMATION UTILITY
// =============================================================================

const focusRingStyle: CSSProperties = {
  outline: `2px solid ${designTokens.primitive.color.focusRingBlue}`,
  outlineOffset: "2px",
};

// =============================================================================
// BASE COMPONENTS
// =============================================================================

/**
 * Button component with keyboard focus support
 */
export interface ButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "type"> {
  readonly tone?: "accent" | "danger" | "neutral" | "ghost";
  readonly size?: "sm" | "md" | "lg";
  readonly loading?: boolean;
}

export const Button = forwardRef(function Button(
  { tone = "neutral", size = "md", loading = false, disabled, children, style, ...props }: ButtonProps,
  ref: ForwardedRef<HTMLButtonElement>,
): ReactElement {
  const baseStyle: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    border: "none",
    borderRadius: designTokens.semantic.radius.button,
    cursor: disabled || loading ? "not-allowed" : "pointer",
    fontFamily: designTokens.semantic.typography.fontFamily,
    fontWeight: designTokens.semantic.typography.fontWeight.semibold,
    opacity: disabled || loading ? 0.6 : 1,
    transition: `background-color ${animation.duration.fast}, color ${animation.duration.fast}`,
  };

  const sizeStyles: Record<string, CSSProperties> = {
    sm: { padding: "6px 12px", fontSize: designTokens.primitive.typography.fontSize.sm },
    md: { padding: `${designTokens.semantic.spacing.buttonPaddingY}px ${designTokens.semantic.spacing.buttonPaddingX}px`, fontSize: designTokens.primitive.typography.fontSize.base },
    lg: { padding: "12px 20px", fontSize: designTokens.primitive.typography.fontSize.lg },
  };

  const toneStyles: Record<string, CSSProperties> = {
    accent: { background: designTokens.semantic.color.accent, color: "#04130a" },
    danger: { background: designTokens.semantic.color.danger, color: "#ffffff" },
    neutral: { background: designTokens.semantic.color.surfaceElevated, color: designTokens.semantic.color.text, border: `1px solid ${designTokens.semantic.color.border}` },
    ghost: { background: "transparent", color: designTokens.semantic.color.text },
  };

  const combinedStyle: CSSProperties = {
    ...baseStyle,
    ...sizeStyles[size],
    ...toneStyles[tone],
    ...style,
  };

  return createElement("button", {
    ref,
    disabled: disabled || loading,
    ...props,
    style: combinedStyle,
  }, loading ? createElement(Spinner, { size: size === "sm" ? 14 : 18 }) : children);
});

/**
 * Spinner for loading states
 */
export function Spinner({ size = 18, color = "currentColor" }: { size?: number; color?: string }): ReactElement {
  return createElement("svg", {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    style: { animation: `spin ${animation.duration.normal} linear infinite` },
  },
    createElement("circle", { cx: 12, cy: 12, r: 10, stroke: color, strokeWidth: 3, opacity: 0.25 }),
    createElement("path", { d: "M12 2a10 10 0 0 1 10 10", stroke: color, strokeWidth: 3, strokeLinecap: "round" }),
  );
}

// =============================================================================
// FORM COMPONENTS
// =============================================================================

/**
 * Input component with proper ARIA labeling
 */
export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  readonly label?: string;
  readonly error?: string;
  readonly hint?: string;
  readonly size?: "sm" | "md" | "lg";
}

export const Input = forwardRef(function Input(
  { label, error, hint, id, size = "md", style, ...props }: InputProps,
  ref: ForwardedRef<HTMLInputElement>,
): ReactElement {
  const inputId = id ?? `input-${Math.random().toString(36).slice(2, 9)}`;
  const errorId = error ? `${inputId}-error` : undefined;
  const hintId = hint ? `${inputId}-hint` : undefined;

  const sizeStyles: Record<string, CSSProperties> = {
    sm: { padding: "6px 10px", fontSize: designTokens.primitive.typography.fontSize.sm },
    md: { padding: `${designTokens.semantic.spacing.inputPaddingY}px ${designTokens.semantic.spacing.inputPaddingX}px`, fontSize: designTokens.primitive.typography.fontSize.base },
    lg: { padding: "12px 16px", fontSize: designTokens.primitive.typography.fontSize.lg },
  };

  const baseStyle: CSSProperties = {
    width: "100%",
    background: designTokens.semantic.color.surface,
    border: `1px solid ${error ? designTokens.semantic.color.danger : designTokens.semantic.color.border}`,
    borderRadius: designTokens.semantic.radius.input,
    color: designTokens.semantic.color.text,
    fontFamily: designTokens.semantic.typography.fontFamily,
    transition: `border-color ${animation.duration.fast}, box-shadow ${animation.duration.fast}`,
    ...sizeStyles[size],
    ...style,
  };

  return createElement("div", { style: { display: "flex", flexDirection: "column", gap: 4 } },
    label ? createElement("label", { htmlFor: inputId, style: { fontWeight: designTokens.semantic.typography.fontWeight.medium, color: designTokens.semantic.color.text } }, label) : null,
    createElement("input", {
      ref,
      id: inputId,
      "aria-invalid": error ? true : undefined,
      "aria-describedby": [errorId, hintId].filter(Boolean).join(" ") || undefined,
      style: baseStyle,
      ...props,
    }),
    error ? createElement("span", { id: errorId, role: "alert", style: { color: designTokens.semantic.color.danger, fontSize: designTokens.primitive.typography.fontSize.sm } }, error) : null,
    hint && !error ? createElement("span", { id: hintId, style: { color: designTokens.semantic.color.textSubtle, fontSize: designTokens.primitive.typography.fontSize.sm } }, hint) : null,
  );
});

/**
 * Select component
 */
export interface SelectOption {
  readonly value: string;
  readonly label: string;
  readonly disabled?: boolean;
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "size"> {
  readonly label?: string;
  readonly error?: string;
  readonly hint?: string;
  readonly options: readonly SelectOption[];
  readonly size?: "sm" | "md" | "lg";
  readonly placeholder?: string;
}

export const Select = forwardRef(function Select(
  { label, error, hint, id, options, size = "md", placeholder, style, ...props }: SelectProps,
  ref: ForwardedRef<HTMLSelectElement>,
): ReactElement {
  const selectId = id ?? `select-${Math.random().toString(36).slice(2, 9)}`;
  const errorId = error ? `${selectId}-error` : undefined;

  const sizeStyles: Record<string, CSSProperties> = {
    sm: { padding: "6px 10px", fontSize: designTokens.primitive.typography.fontSize.sm },
    md: { padding: `${designTokens.semantic.spacing.inputPaddingY}px ${designTokens.semantic.spacing.inputPaddingX}px`, fontSize: designTokens.primitive.typography.fontSize.base },
    lg: { padding: "12px 16px", fontSize: designTokens.primitive.typography.fontSize.lg },
  };

  return createElement("div", { style: { display: "flex", flexDirection: "column", gap: 4 } },
    label ? createElement("label", { htmlFor: selectId, style: { fontWeight: designTokens.semantic.typography.fontWeight.medium, color: designTokens.semantic.color.text } }, label) : null,
    createElement("select", {
      ref,
      id: selectId,
      "aria-invalid": error ? true : undefined,
      "aria-describedby": errorId,
      style: {
        width: "100%",
        background: designTokens.semantic.color.surface,
        border: `1px solid ${error ? designTokens.semantic.color.danger : designTokens.semantic.color.border}`,
        borderRadius: designTokens.semantic.radius.input,
        color: designTokens.semantic.color.text,
        fontFamily: designTokens.semantic.typography.fontFamily,
        cursor: "pointer",
        ...sizeStyles[size],
        ...style,
      },
      ...props,
    },
      placeholder ? createElement("option", { value: "", disabled: true }, placeholder) : null,
      options.map((opt) => createElement("option", { key: opt.value, value: opt.value, disabled: opt.disabled }, opt.label)),
    ),
    error ? createElement("span", { id: errorId, role: "alert", style: { color: designTokens.semantic.color.danger, fontSize: designTokens.primitive.typography.fontSize.sm } }, error) : null,
  );
});

/**
 * Checkbox component
 */
export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  readonly label: string;
  readonly description?: string;
}

export const Checkbox = forwardRef(function Checkbox(
  { label, description, id, style, ...props }: CheckboxProps,
  ref: ForwardedRef<HTMLInputElement>,
): ReactElement {
  const checkboxId = id ?? `checkbox-${Math.random().toString(36).slice(2, 9)}`;

  return createElement("div", { style: { display: "flex", alignItems: "flex-start", gap: 10, ...style } },
    createElement("input", {
      ref,
      type: "checkbox",
      id: checkboxId,
      style: {
        width: 18,
        height: 18,
        marginTop: 2,
        accentColor: designTokens.semantic.color.accent,
        cursor: "pointer",
      },
      ...props,
    }),
    createElement("div", { style: { display: "flex", flexDirection: "column" } },
      createElement("label", { htmlFor: checkboxId, style: { cursor: "pointer", color: designTokens.semantic.color.text, fontWeight: 500 } }, label),
      description ? createElement("span", { style: { color: designTokens.semantic.color.textSubtle, fontSize: designTokens.primitive.typography.fontSize.sm } }, description) : null,
    ),
  );
});

/**
 * Radio component
 */
export interface RadioProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  readonly label: string;
  readonly description?: string;
}

export const Radio = forwardRef(function Radio(
  { label, description, id, style, ...props }: RadioProps,
  ref: ForwardedRef<HTMLInputElement>,
): ReactElement {
  const radioId = id ?? `radio-${Math.random().toString(36).slice(2, 9)}`;

  return createElement("div", { style: { display: "flex", alignItems: "flex-start", gap: 10, ...style } },
    createElement("input", {
      ref,
      type: "radio",
      id: radioId,
      style: {
        width: 18,
        height: 18,
        marginTop: 2,
        accentColor: designTokens.semantic.color.accent,
        cursor: "pointer",
      },
      ...props,
    }),
    createElement("div", { style: { display: "flex", flexDirection: "column" } },
      createElement("label", { htmlFor: radioId, style: { cursor: "pointer", color: designTokens.semantic.color.text, fontWeight: 500 } }, label),
      description ? createElement("span", { style: { color: designTokens.semantic.color.textSubtle, fontSize: designTokens.primitive.typography.fontSize.sm } }, description) : null,
    ),
  );
});

/**
 * Switch component
 */
export interface SwitchProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  readonly label: string;
  readonly description?: string;
}

export const Switch = forwardRef(function Switch(
  { label, description, id, style, ...props }: SwitchProps,
  ref: ForwardedRef<HTMLInputElement>,
): ReactElement {
  const switchId = id ?? `switch-${Math.random().toString(36).slice(2, 9)}`;

  return createElement("div", { style: { display: "flex", alignItems: "flex-start", gap: 10, ...style } },
    createElement("div", { style: { position: "relative" } },
      createElement("input", {
        ref,
        type: "checkbox",
        role: "switch",
        id: switchId,
        "aria-checked": props.checked ?? props.defaultChecked ?? false,
        style: {
          position: "absolute",
          opacity: 0,
          width: 44,
          height: 24,
          cursor: "pointer",
        },
        ...props,
      }),
      createElement("div", {
        "aria-hidden": true,
        style: {
          width: 44,
          height: 24,
          borderRadius: 12,
          background: props.checked ? designTokens.semantic.color.accent : designTokens.semantic.color.border,
          position: "relative",
          transition: `background-color ${animation.duration.fast}`,
          cursor: "pointer",
        },
      },
        createElement("div", {
          style: {
            position: "absolute",
            top: 2,
            left: props.checked ? 22 : 2,
            width: 20,
            height: 20,
            borderRadius: "50%",
            background: "#ffffff",
            transition: `left ${animation.duration.fast}`,
            boxShadow: designTokens.primitive.shadows.sm,
          },
        }),
      ),
    ),
    createElement("div", { style: { display: "flex", flexDirection: "column" } },
      createElement("label", { htmlFor: switchId, style: { cursor: "pointer", color: designTokens.semantic.color.text, fontWeight: 500 } }, label),
      description ? createElement("span", { style: { color: designTokens.semantic.color.textSubtle, fontSize: designTokens.primitive.typography.fontSize.sm } }, description) : null,
    ),
  );
});

// =============================================================================
// FEEDBACK COMPONENTS
// =============================================================================

/**
 * Alert component with accessible role and aria-live
 */
export interface AlertProps {
  readonly tone?: "info" | "success" | "warning" | "danger";
  readonly title?: string;
  readonly children: ReactNode;
  readonly dismissible?: boolean;
  readonly onDismiss?: () => void;
}

export function Alert({ tone = "info", title, children, dismissible = false, onDismiss }: AlertProps): ReactElement {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) {
    return createElement("div", { "aria-live": "polite" }, "Alert dismissed");
  }

  const toneStyles = {
    info: { background: designTokens.primitive.color.blue50, border: `1px solid ${designTokens.primitive.color.blue500}`, color: designTokens.primitive.color.blue600 },
    success: { background: designTokens.primitive.color.green50, border: `1px solid ${designTokens.primitive.color.green500}`, color: designTokens.primitive.color.green600 },
    warning: { background: designTokens.primitive.color.amber50, border: `1px solid ${designTokens.primitive.color.amber500}`, color: designTokens.primitive.color.amber600 },
    danger: { background: designTokens.primitive.color.red50, border: `1px solid ${designTokens.primitive.color.red500}`, color: designTokens.primitive.color.red600 },
  };

  return createElement("div", {
    role: "alert",
    "aria-live": tone === "danger" ? "assertive" : "polite",
    style: {
      padding: "12px 16px",
      borderRadius: designTokens.semantic.radius.card,
      ...toneStyles[tone],
    },
  },
    createElement("div", { style: { display: "flex", gap: 12, alignItems: title ? "flex-start" : "center" } },
      createElement("div", { style: { flex: 1 } },
        title ? createElement("strong", { style: { display: "block", marginBottom: 4, fontWeight: 600 } }, title) : null,
        createElement("div", undefined, children),
      ),
      dismissible
        ? createElement("button", {
          "aria-label": "Dismiss",
          onClick: () => {
            setDismissed(true);
            onDismiss?.();
          },
          style: {
            background: "transparent",
            border: "none",
            cursor: "pointer",
            padding: 4,
            color: "inherit",
            fontSize: 20,
            lineHeight: 1,
          },
        }, "×")
        : null,
    ),
  );
}

// =============================================================================
// LAYOUT COMPONENTS
// =============================================================================

/**
 * Modal component with focus trap and aria
 */
export interface ModalProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly title: string;
  readonly children: ReactNode;
  readonly footer?: ReactNode;
}

export function Modal({ open, onClose, title, children, footer }: ModalProps): ReactElement | null {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
      if (e.key === "Tab" && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return createElement("div", {
    "aria-modal": true,
    "aria-labelledby": "modal-title",
    role: "dialog",
    style: {
      position: "fixed",
      inset: 0,
      zIndex: 300,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
    },
  },
    createElement("div", {
      style: {
        position: "absolute",
        inset: 0,
        background: "rgba(15, 23, 42, 0.6)",
      },
      onClick: onClose,
      "aria-hidden": true,
    }),
    createElement("div", {
      ref: modalRef,
      style: {
        position: "relative",
        background: designTokens.semantic.color.surface,
        borderRadius: designTokens.semantic.radius.lg,
        boxShadow: designTokens.primitive.shadows.overlay,
        maxWidth: 560,
        width: "100%",
        maxHeight: "calc(100vh - 48px)",
        overflow: "auto",
      },
    },
      createElement("div", {
        style: {
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 20px",
          borderBottom: `1px solid ${designTokens.semantic.color.border}`,
        },
      },
        createElement("h2", { id: "modal-title", style: { margin: 0, fontSize: designTokens.primitive.typography.fontSize.xl, fontWeight: 600, color: designTokens.semantic.color.text } }, title),
        createElement("button", {
          "aria-label": "Close modal",
          onClick: onClose,
          style: {
            background: "transparent",
            border: "none",
            cursor: "pointer",
            padding: 4,
            color: designTokens.semantic.color.textSecondary,
            fontSize: 24,
            lineHeight: 1,
          },
        }, "×"),
      ),
      createElement("div", { style: { padding: "20px" } }, children),
      footer ? createElement("div", {
        style: {
          display: "flex",
          gap: 12,
          justifyContent: "flex-end",
          padding: "16px 20px",
          borderTop: `1px solid ${designTokens.semantic.color.border}`,
        },
      }, footer) : null,
    ),
  );
}

/**
 * Badge component
 */
export interface BadgeProps {
  readonly tone?: "neutral" | "accent" | "danger" | "warning" | "success" | "info";
  readonly size?: "sm" | "md";
  readonly children: ReactNode;
}

export function Badge({ tone = "neutral", size = "md", children }: BadgeProps): ReactElement {
  const toneColors = {
    neutral: { bg: designTokens.semantic.color.surfaceElevated, text: designTokens.semantic.color.textSecondary },
    accent: { bg: designTokens.semantic.color.accent, text: "#04130a" },
    danger: { bg: designTokens.semantic.color.danger, text: "#ffffff" },
    warning: { bg: designTokens.semantic.color.warning, text: "#04130a" },
    success: { bg: designTokens.semantic.color.success, text: "#04130a" },
    info: { bg: designTokens.semantic.color.info, text: "#04130a" },
  };

  return createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      padding: size === "sm" ? "2px 6px" : "4px 10px",
      borderRadius: designTokens.semantic.radius.badge,
      background: toneColors[tone].bg,
      color: toneColors[tone].text,
      fontSize: size === "sm" ? designTokens.primitive.typography.fontSize.xs : designTokens.primitive.typography.fontSize.sm,
      fontWeight: 600,
    },
  }, children);
}

/**
 * Tag component - dismissible label
 */
export interface TagProps {
  readonly children: ReactNode;
  readonly onDismiss?: () => void;
  readonly tone?: "neutral" | "accent" | "danger" | "warning";
}

export function Tag({ children, onDismiss, tone = "neutral" }: TagProps): ReactElement {
  const toneColors = {
    neutral: { bg: designTokens.semantic.color.surfaceElevated, text: designTokens.semantic.color.text },
    accent: { bg: designTokens.semantic.color.accent, text: "#04130a" },
    danger: { bg: designTokens.semantic.color.danger, text: "#ffffff" },
    warning: { bg: designTokens.semantic.color.warning, text: "#04130a" },
  };

  return createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      padding: "4px 10px",
      borderRadius: designTokens.semantic.radius.sm,
      background: toneColors[tone].bg,
      color: toneColors[tone].text,
      fontSize: designTokens.primitive.typography.fontSize.sm,
    },
  },
    children,
    onDismiss ? createElement("button", {
      "aria-label": "Remove tag",
      onClick: onDismiss,
      style: {
        background: "transparent",
        border: "none",
        cursor: "pointer",
        padding: 0,
        color: "inherit",
        fontSize: 14,
        lineHeight: 1,
        marginLeft: 2,
      },
    }, "×") : null,
  );
}

/**
 * Avatar component
 */
export interface AvatarProps {
  readonly src?: string;
  readonly name?: string;
  readonly size?: "sm" | "md" | "lg";
}

export function Avatar({ src, name, size = "md" }: AvatarProps): ReactElement {
  const sizeMap = { sm: 28, md: 36, lg: 48 };
  const px = sizeMap[size];
  const initials = name
    ? name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "?";

  const style: CSSProperties = {
    width: px,
    height: px,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: px * 0.4,
    fontWeight: 600,
    background: designTokens.semantic.color.accent,
    color: "#04130a",
    flexShrink: 0,
  };

  if (src) {
    return createElement("img", { src, alt: name ?? "Avatar", style: { ...style, objectFit: "cover" } });
  }

  return createElement("div", { style, "aria-label": name }, initials);
}

// =============================================================================
// TABLE COMPONENTS
// =============================================================================

/**
 * Table component with proper semantics
 */
export interface TableColumn<T> {
  readonly key: string;
  readonly header: string;
  readonly render?: (row: T) => ReactNode;
  readonly width?: string;
}

export interface TableProps<T> {
  readonly columns: readonly TableColumn<T>[];
  readonly data: readonly T[];
  readonly rowKey: (row: T) => string;
  readonly onRowClick?: (row: T) => void;
  readonly caption?: string;
  readonly emptyMessage?: string;
}

export function Table<T>({ columns, data, rowKey, onRowClick, caption, emptyMessage = "No data" }: TableProps<T>): ReactElement {
  return createElement("div", { style: { overflowX: "auto" } },
    createElement("table", {
      style: {
        width: "100%",
        borderCollapse: "collapse",
        fontFamily: designTokens.semantic.typography.fontFamily,
      },
    },
      caption ? createElement("caption", { style: { textAlign: "left", padding: "8px 0", fontSize: designTokens.primitive.typography.fontSize.sm, color: designTokens.semantic.color.textSecondary } }, caption) : null,
      createElement("thead", undefined,
        createElement("tr", { style: { borderBottom: `2px solid ${designTokens.semantic.color.border}` } },
          columns.map((col) => createElement("th", {
            key: col.key,
            style: {
              padding: "10px 12px",
              textAlign: "left",
              fontWeight: 600,
              fontSize: designTokens.primitive.typography.fontSize.sm,
              color: designTokens.semantic.color.text,
              width: col.width,
            },
          }, col.header)),
        ),
      ),
      createElement("tbody", undefined,
        data.length === 0
          ? createElement("tr", undefined,
            createElement("td", {
              colSpan: columns.length,
              style: { padding: "24px", textAlign: "center", color: designTokens.semantic.color.textSubtle },
            }, emptyMessage),
          )
          : data.map((row) => {
            const key = rowKey(row);
            return createElement("tr", {
              key,
              onClick: onRowClick ? () => onRowClick(row) : undefined,
              style: onRowClick ? { cursor: "pointer" } : undefined,
            },
              columns.map((col) => createElement("td", {
                key: col.key,
                style: {
                  padding: "10px 12px",
                  borderBottom: `1px solid ${designTokens.semantic.color.border}`,
                  color: designTokens.semantic.color.text,
                },
              }, col.render ? col.render(row) : (row as Record<string, unknown>)[col.key] as ReactNode)),
            );
          }),
      ),
    ),
  );
}

// =============================================================================
// LEGACY / EXISTING COMPONENTS (with ARIA fixes)
// =============================================================================

export function StatusPill({ status }: { status: ImplementationStatus }): ReactElement {
  const background = status === "Planned" ? designTokens.semantic.color.planned : designTokens.semantic.color.accent;
  return createElement(
    "span",
    {
      style: {
        background,
        borderRadius: designTokens.semantic.radius.badge,
        color: "#04130a",
        padding: "4px 10px",
        fontSize: designTokens.primitive.typography.fontSize.sm,
        fontWeight: 700,
      },
    },
    status,
  );
}

/**
 * ListCard with ARIA role="list" for accessibility
 */
export function ListCard({ items }: { items: readonly { title: string; description: string }[] }): ReactElement {
  return createElement(
    "div",
    { role: "list", style: { display: "grid", gap: 10 } },
    ...items.map((item) => createElement(
      "article",
      { key: item.title, role: "listitem", "aria-label": `${item.title}: ${item.description}` },
      createElement("div", { style: createPanelStyle() },
        createElement("div", { style: { color: designTokens.semantic.color.text, fontWeight: 600 } }, item.title),
        createElement("div", { style: { color: designTokens.semantic.color.textSubtle, marginTop: 6 } }, item.description),
      ),
    )),
  );
}

/**
 * KeyValueTable with proper semantic table markup and aria-label
 */
export function KeyValueTable({ rows, ariaLabel }: { rows: readonly { key: string; value: ReactNode }[]; ariaLabel?: string }): ReactElement {
  return createElement(
    "table",
    {
      role: "grid",
      "aria-label": ariaLabel ?? "Key-value details",
      style: { width: "100%", borderCollapse: "collapse" },
    },
    createElement("tbody", undefined,
      ...rows.map((row) => createElement(
        "tr",
        { key: row.key },
        createElement("th", {
          scope: "row",
          style: {
            textAlign: "left",
            fontWeight: 500,
            color: designTokens.semantic.color.textSubtle,
            padding: "8px 12px 8px 0",
            borderBottom: `1px solid ${designTokens.semantic.color.border}`,
            width: "120px",
            verticalAlign: "top",
          },
        }, row.key),
        createElement("td", {
          style: {
            color: designTokens.semantic.color.text,
            padding: "8px 0",
            borderBottom: `1px solid ${designTokens.semantic.color.border}`,
          },
        }, row.value),
      )),
    ),
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
        { key: metric.label, style: createPanelStyle(designTokens.semantic.color.border) },
        createElement("div", { style: { color: designTokens.semantic.color.textSubtle, fontSize: designTokens.primitive.typography.fontSize.sm } }, metric.label),
        createElement("strong", { style: { color: designTokens.semantic.color.text, display: "block", marginTop: 8 } }, String(metric.value)),
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
      createElement(Input, {
        "aria-label": "Filter workbench items",
        onChange: (event: ChangeEvent<HTMLInputElement>) => {
          setFilter(event.target.value);
        },
        placeholder: "筛选当前工作台项",
        type: "search",
        value: filter,
      }),
      ...actions.map((action) => createElement(Button, {
        key: action.id,
        onClick: () => {
          triggerAction(action);
        },
        tone: action.tone === "danger" ? "danger" : action.tone === "accent" ? "accent" : "neutral",
      }, action.label)),
    ),
    createElement(ThreePaneLayout, {
      left: filteredItems.length === 0
        ? createElement("p", { style: { color: designTokens.semantic.color.textSubtle } }, emptyState)
        : createElement(
          "div",
          { role: "listbox", "aria-label": "Workbench items" },
          ...filteredItems.map((item) => createElement(Button, {
            key: item.id,
            onClick: () => {
              setSelectedId(item.id);
            },
            tone: item.id === selectedId ? "accent" : "neutral",
            style: {
              width: "100%",
              justifyContent: "flex-start",
              textAlign: "left",
            },
          },
            createElement("strong", undefined, item.title),
            createElement("div", { style: { color: "inherit", marginTop: 8, fontWeight: "normal" } }, item.description))),
        ),
      center: selectedItem == null
        ? createElement("p", { style: { color: designTokens.semantic.color.textSubtle } }, emptyState)
        : createElement(
          "div",
          { style: { display: "grid", gap: 12 } },
          createElement("div", { style: createPanelStyle(designTokens.semantic.color.info) },
            createElement("h3", { style: { margin: 0, color: designTokens.semantic.color.text } }, selectedItem.title),
            createElement("p", { style: { color: designTokens.semantic.color.textSubtle, marginBottom: 0 } }, selectedItem.description),
          ),
          rows != null && rows.length > 0 ? createElement(KeyValueTable, { rows, ariaLabel: "Details" }) : null,
          selectedItem.detailRows != null && selectedItem.detailRows.length > 0
            ? createElement(KeyValueTable, { rows: selectedItem.detailRows, ariaLabel: selectedItem.title })
            : null,
        ),
      right: createElement(
        "div",
        { style: { display: "grid", gap: 12 } },
        createElement("div", { style: createPanelStyle(designTokens.semantic.color.border) },
          createElement("h3", { style: { marginTop: 0, color: designTokens.semantic.color.text } }, "操作日志"),
          activities.length === 0
            ? createElement("p", { style: { color: designTokens.semantic.color.textSubtle, marginBottom: 0 } }, "执行动作后会在这里记录最近轨迹。")
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

// §R8-58: React error boundary for feature component rendering
// Classifies errors as P0-P3, shows appropriate fallback UI, reports to error tracking service
export class ComponentErrorBoundary extends React.Component<{
  fallback?: (error: Error, errorInfo: unknown) => ReactElement;
  onError?: (error: Error, errorInfo: unknown) => void;
  children?: ReactNode;
}> {
  state: { hasError: boolean; error: Error | null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  private classifyError(error: Error): "P0" | "P1" | "P2" | "P3" {
    const message = error.message.toLowerCase();
    if (message.includes("critical") || message.includes("crash")) return "P0";
    if (message.includes("auth") || message.includes("unauthorized")) return "P1";
    if (message.includes("render") || message.includes("update")) return "P2";
    return "P3";
  }

  componentDidCatch(error: Error, errorInfo: unknown) {
    const severity = this.classifyError(error);
    // §R8-58: Report to error tracking service with P0-P3 classification
    if (typeof reportError === "function") {
      reportError(error, { severity, componentStack: errorInfo });
    }
    this.props.onError?.(error, errorInfo);
  }

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, null);
      }
      return createElement("div", {
        "data-severity": this.classifyError(this.state.error),
        style: { padding: 20, textAlign: "center" },
      },
        createElement("h2", { style: { color: "#04130a" } }, "组件渲染失败"),
        createElement("p", { style: { color: "#666" } }, `错误等级: ${this.classifyError(this.state.error)}`),
        createElement("p", { style: { color: "#888", fontSize: 12 } }, this.state.error.message),
      );
    }
    return this.props.children;
  }
}