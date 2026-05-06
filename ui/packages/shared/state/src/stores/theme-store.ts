import { createStore } from "zustand/vanilla";
import { persist } from "zustand/middleware";

export type ThemeMode = "light" | "dark" | "system";
export type ColorScheme = "light" | "dark";

export interface ThemeStoreState {
  readonly themeMode: ThemeMode;
  readonly resolvedColorScheme: ColorScheme;
  setThemeMode(mode: ThemeMode): void;
}

function resolveColorScheme(mode: ThemeMode): ColorScheme {
  if (mode === "system") {
    if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    return "light";
  }
  return mode;
}

export function createThemeStore() {
  return createStore<ThemeStoreState>()(
    persist(
      (set) => ({
        themeMode: "system",
        resolvedColorScheme: resolveColorScheme("system"),
        setThemeMode(themeMode) {
          set({ themeMode, resolvedColorScheme: resolveColorScheme(themeMode) });
        },
      }),
      { name: "aa-theme-store" },
    ),
  );
}
