import { designTokens, type CoreDesignTokens } from "../design-tokens";

export const darkTheme: CoreDesignTokens = designTokens;

export const lightTheme: CoreDesignTokens = {
  ...designTokens,
  color: {
    ...designTokens.color,
    background: "#f8fafc",
    surface: "#ffffff",
    surfaceElevated: "#f1f5f9",
    border: "#cbd5e1",
    text: "#0f172a",
    subtle: "#475569",
  },
  shadows: {
    card: "0 10px 24px rgba(15, 23, 42, 0.08)",
    overlay: "0 16px 40px rgba(15, 23, 42, 0.12)",
    inset: "inset 0 1px 0 rgba(255,255,255,0.75)",
    focusRing: "0 0 0 3px rgba(37, 99, 235, 0.24)",
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
