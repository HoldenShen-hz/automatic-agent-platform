import { designTokens, type CoreDesignTokens } from "../design-tokens";

export const lightTheme: CoreDesignTokens = designTokens;

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
