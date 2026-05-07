import { createStore } from "zustand/vanilla";
import { persist } from "zustand/middleware";

export type ThemeMode = "light" | "dark" | "high-contrast" | "system";
export type ResolvedThemeName = "light" | "dark" | "high-contrast";

export interface ThemeStoreState {
  readonly themeMode: ThemeMode;
  readonly resolvedThemeName: ResolvedThemeName;
  readonly resolvedColorScheme: "light" | "dark";
  setThemeMode(mode: ThemeMode): void;
}

function resolveThemeName(mode: ThemeMode): ResolvedThemeName {
  if (mode === "high-contrast") {
    return "high-contrast";
  }
  if (mode === "system") {
    if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    return "light";
  }
  return mode;
}

function resolveColorScheme(mode: ThemeMode): "light" | "dark" {
  return resolveThemeName(mode) === "light" ? "light" : "dark";
}

export function createThemeStore() {
  return createStore<ThemeStoreState>()(
    persist(
      (set) => ({
        themeMode: "system",
        resolvedThemeName: resolveThemeName("system"),
        resolvedColorScheme: resolveColorScheme("system"),
        setThemeMode(themeMode) {
          set({
            themeMode,
            resolvedThemeName: resolveThemeName(themeMode),
            resolvedColorScheme: resolveColorScheme(themeMode),
          });
        },
      }),
      { name: "aa-theme-store" },
    ),
  );
}
