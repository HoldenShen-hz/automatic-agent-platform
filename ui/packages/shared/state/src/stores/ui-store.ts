import { createStore } from "zustand/vanilla";
import { persist } from "zustand/middleware";

/**
 * UIStore state per §5.1.1 - complete UI state including theme, sidebar, and NL panel.
 */
export type ThemeMode = "light" | "dark" | "high-contrast";
export type SidebarState = "expanded" | "collapsed" | "hidden";

export interface UiStoreState {
  readonly activeRoute: string;
  readonly activeFeature: string;
  readonly theme: ThemeMode;
  readonly sidebarCollapsed: boolean;
  readonly nlPanelOpen: boolean;
  readonly commandPaletteOpen: boolean;
  setActiveRoute(route: string): void;
  setActiveFeature(featureId: string): void;
  setTheme(theme: ThemeMode): void;
  toggleSidebar(): void;
  setSidebarCollapsed(collapsed: boolean): void;
  setNlPanelOpen(open: boolean): void;
  setCommandPaletteOpen(open: boolean): void;
}

export function createUiStore() {
  return createStore<UiStoreState>()(
    persist(
      (set) => ({
        activeRoute: "/",
        activeFeature: "dashboard",
        theme: "dark",
        sidebarCollapsed: false,
        nlPanelOpen: false,
        commandPaletteOpen: false,
        setActiveRoute(activeRoute) {
          set({ activeRoute });
        },
        setActiveFeature(activeFeature) {
          set({ activeFeature });
        },
        setTheme(theme) {
          set({ theme });
        },
        toggleSidebar() {
          set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed }));
        },
        setSidebarCollapsed(sidebarCollapsed) {
          set({ sidebarCollapsed });
        },
        setNlPanelOpen(nlPanelOpen) {
          set({ nlPanelOpen });
        },
        setCommandPaletteOpen(commandPaletteOpen) {
          set({ commandPaletteOpen });
        },
      }),
      { name: "aa-ui-store" },
    ),
  );
}
