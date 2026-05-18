import { createStore } from "zustand/vanilla";
import { withPersistDevtoolsDraft } from "./middleware";

type ThemeStoreDraft = {
  -readonly [K in keyof ThemeStoreState]:
    ThemeStoreState[K] extends readonly (infer U)[] ? U[]
      : ThemeStoreState[K];
};

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
    withPersistDevtoolsDraft(
      "aa-theme-store",
      (set) => ({
        themeMode: "system",
        resolvedThemeName: resolveThemeName("system"),
        resolvedColorScheme: resolveColorScheme("system"),
        setThemeMode(themeMode) {
          set((draft: ThemeStoreDraft) => {
            draft.themeMode = themeMode;
            draft.resolvedThemeName = resolveThemeName(themeMode);
            draft.resolvedColorScheme = resolveColorScheme(themeMode);
          });
        },
      }),
    ),
  );
}
