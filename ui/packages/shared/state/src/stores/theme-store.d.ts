export type ThemeMode = "light" | "dark" | "high-contrast" | "system";
export type ResolvedThemeName = "light" | "dark" | "high-contrast";
export interface ThemeStoreState {
    readonly themeMode: ThemeMode;
    readonly resolvedThemeName: ResolvedThemeName;
    readonly resolvedColorScheme: "light" | "dark";
    setThemeMode(mode: ThemeMode): void;
}
export declare function createThemeStore(): import("zustand").StoreApi<ThemeStoreState>;
