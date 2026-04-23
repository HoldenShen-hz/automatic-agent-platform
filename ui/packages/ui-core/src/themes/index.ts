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
};

export function resolveTheme(name: "light" | "dark" | "high-contrast"): CoreDesignTokens {
  if (name === "light") return lightTheme;
  if (name === "high-contrast") return highContrastTheme;
  return darkTheme;
}
