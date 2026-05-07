import { designTokens, domainTokens, primitiveTokens, semanticTokens, type CoreDesignTokens } from "../design-tokens";

export const lightTheme: CoreDesignTokens = {
  primitive: primitiveTokens,
  semantic: semanticTokens,
  domain: domainTokens,
  color: semanticTokens.color,
  radius: semanticTokens.radius,
  typography: primitiveTokens.typography,
  motion: semanticTokens.motion,
  spacing: semanticTokens.spacing,
  shadows: semanticTokens.shadows,
  iconSizes: semanticTokens.iconSizes,
  breakpoints: semanticTokens.breakpoints,
  subtle: semanticTokens.color.textSubtle,
};

export const darkTheme: CoreDesignTokens = {
  ...designTokens,
  color: {
    ...designTokens.color,
    background: "#0f172a",
    surface: "#111827",
    surfaceElevated: "#162034",
    border: "#334155",
    text: "#e5e7eb",
    subtle: "#94a3b8",
    // P2 FIX: Add missing WCAG AAA color overrides for dark theme.
    // Root cause: darkTheme was missing accent/danger/success/warning
    // which caused fallback to light theme values, failing contrast requirements.
    accent: "#38d9a9",
    danger: "#ff6b6b",
    success: "#22c55e",
    warning: "#fbbf24",
    info: "#38bdf8",
  },
  shadows: {
    card: "0 10px 30px rgba(0, 0, 0, 0.18)",
    overlay: "0 18px 42px rgba(0, 0, 0, 0.24)",
    inset: "inset 0 1px 0 rgba(255, 255, 255, 0.04)",
    focusRing: "0 0 0 3px rgba(56, 189, 248, 0.35)",
  },
};

export const highContrastTheme: CoreDesignTokens = {
  ...designTokens,
  color: {
    ...designTokens.color,
    background: "#000000",
    surface: "#000000",
    surfaceElevated: "#111111",
    border: "#ffffff",
    accent: "#00ff95",
    text: "#ffffff",
    subtle: "#d1d5db",
    planned: "#ffd400",
    danger: "#ff6b6b",
  },
  shadows: {
    card: "0 0 0 2px rgba(255,255,255,0.7)",
    overlay: "0 0 0 3px rgba(0,255,149,0.6)",
    inset: "inset 0 0 0 1px rgba(255,255,255,0.65)",
    focusRing: "0 0 0 4px rgba(0,255,149,0.7)",
  },
};

export function resolveTheme(name: "light" | "dark" | "high-contrast"): CoreDesignTokens {
  if (name === "light") return lightTheme;
  if (name === "high-contrast") return highContrastTheme;
  return darkTheme;
}

function applyThemeCssVariables(target: HTMLElement, theme: CoreDesignTokens): void {
  const rootStyle = target.style;
  rootStyle.setProperty("--aa-color-background", theme.color.background);
  rootStyle.setProperty("--aa-color-surface", theme.color.surface);
  rootStyle.setProperty("--aa-color-surface-elevated", theme.color.surfaceElevated);
  rootStyle.setProperty("--aa-color-surface-hover", theme.color.surfaceHover);
  rootStyle.setProperty("--aa-color-border", theme.color.border);
  rootStyle.setProperty("--aa-color-border-strong", theme.color.borderStrong);
  rootStyle.setProperty("--aa-color-accent", theme.color.accent);
  rootStyle.setProperty("--aa-color-accent-hover", theme.color.accentHover);
  rootStyle.setProperty("--aa-color-text", theme.color.text);
  rootStyle.setProperty("--aa-color-text-secondary", theme.color.textSecondary);
  rootStyle.setProperty("--aa-color-text-subtle", theme.color.textSubtle);
  rootStyle.setProperty("--aa-color-planned", theme.color.planned);
  rootStyle.setProperty("--aa-color-danger", theme.color.danger);
  rootStyle.setProperty("--aa-color-danger-hover", theme.color.dangerHover);
  rootStyle.setProperty("--aa-color-success", theme.color.success);
  rootStyle.setProperty("--aa-color-success-hover", theme.color.successHover);
  rootStyle.setProperty("--aa-color-warning", theme.color.warning);
  rootStyle.setProperty("--aa-color-warning-hover", theme.color.warningHover);
  rootStyle.setProperty("--aa-color-info", theme.color.info);
  rootStyle.setProperty("--aa-color-focus-ring", theme.color.focusRing);
  rootStyle.setProperty("--aa-color-risk-low", theme.color.riskLow);
  rootStyle.setProperty("--aa-color-risk-medium", theme.color.riskMedium);
  rootStyle.setProperty("--aa-color-risk-high", theme.color.riskHigh);
  rootStyle.setProperty("--aa-color-risk-critical", theme.color.riskCritical);
  rootStyle.setProperty("--aa-color-autonomy-manual", theme.color.autonomyManual);
  rootStyle.setProperty("--aa-color-autonomy-assisted", theme.color.autonomyAssisted);
  rootStyle.setProperty("--aa-color-autonomy-autonomous", theme.color.autonomyAutonomous);
  rootStyle.setProperty("--aa-color-autonomy-full", theme.color.autonomyFull);
  rootStyle.setProperty("--aa-shadow-card", theme.shadows.card);
  rootStyle.setProperty("--aa-shadow-overlay", theme.shadows.overlay);
  rootStyle.setProperty("--aa-shadow-inset", theme.shadows.inset);
  rootStyle.setProperty("--aa-shadow-focus-ring", theme.shadows.focusRing);

  // Legacy aliases still used by a few feature-local inline styles.
  rootStyle.setProperty("--text-subtle", theme.color.textSubtle);
  rootStyle.setProperty("--border", theme.color.border);
  rootStyle.setProperty("--surface", theme.color.surface);
}

export function applyResolvedTheme(name: "light" | "dark" | "high-contrast", target?: HTMLElement): void {
  const resolvedTarget = target ?? (typeof document === "undefined" ? undefined : document.documentElement);
  if (resolvedTarget == null) {
    return;
  }
  resolvedTarget.dataset.aaTheme = name;
  applyThemeCssVariables(resolvedTarget, resolveTheme(name));
}
