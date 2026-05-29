import type { ThemeMode } from "./theme-store";
export interface UiStoreState {
    readonly activeRoute: string;
    readonly activeFeature: string;
    readonly sidebarCollapsed: boolean;
    readonly commandPaletteOpen: boolean;
    readonly nlPanelOpen: boolean;
    readonly themeMode: ThemeMode;
    setActiveRoute(route: string): void;
    setActiveFeature(featureId: string): void;
    toggleSidebar(): void;
    setCommandPaletteOpen(open: boolean): void;
    setNlPanelOpen(open: boolean): void;
    setThemeMode(mode: ThemeMode): void;
}
export declare function createUiStore(): import("zustand").StoreApi<UiStoreState>;
