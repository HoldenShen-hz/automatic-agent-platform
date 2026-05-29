import { createStore } from "zustand/vanilla";
import { withPersistDevtoolsDraft } from "./middleware";
function resolveThemeName(mode) {
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
function resolveColorScheme(mode) {
    return resolveThemeName(mode) === "light" ? "light" : "dark";
}
export function createThemeStore() {
    const store = createStore()(withPersistDevtoolsDraft("aa-theme-store", (set) => ({
        themeMode: "system",
        resolvedThemeName: resolveThemeName("system"),
        resolvedColorScheme: resolveColorScheme("system"),
        setThemeMode(themeMode) {
            set((draft) => {
                draft.themeMode = themeMode;
                draft.resolvedThemeName = resolveThemeName(themeMode);
                draft.resolvedColorScheme = resolveColorScheme(themeMode);
            });
        },
    })));
    subscribeToSystemTheme(store);
    return store;
}
function subscribeToSystemTheme(store) {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
        return;
    }
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const applySystemTheme = () => {
        const current = store.getState();
        if (current.themeMode !== "system") {
            return;
        }
        current.setThemeMode("system");
    };
    if (typeof mediaQuery.addEventListener === "function") {
        mediaQuery.addEventListener("change", applySystemTheme);
        return;
    }
    mediaQuery.addListener(applySystemTheme);
}
