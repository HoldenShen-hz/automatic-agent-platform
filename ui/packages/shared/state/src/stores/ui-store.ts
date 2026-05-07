import { createStore } from "zustand/vanilla";
import { withPersistDevtoolsDraft } from "./middleware";

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
    withPersistDevtoolsDraft(
      "aa-ui-store",
      (set) => ({
        activeRoute: "/",
        activeFeature: "dashboard",
        theme: "dark",
        sidebarCollapsed: false,
        nlPanelOpen: false,
        commandPaletteOpen: false,
        setActiveRoute(activeRoute) {
          set((draft) => {
            draft.activeRoute = activeRoute;
          });
        },
        setActiveFeature(activeFeature) {
          set((draft) => {
            draft.activeFeature = activeFeature;
          });
        },
        setTheme(theme) {
          set((draft) => {
            draft.theme = theme;
          });
        },
        toggleSidebar() {
          set((draft) => {
            draft.sidebarCollapsed = !draft.sidebarCollapsed;
          });
        },
        setSidebarCollapsed(sidebarCollapsed) {
          set((draft) => {
            draft.sidebarCollapsed = sidebarCollapsed;
          });
        },
        setNlPanelOpen(nlPanelOpen) {
          set((draft) => {
            draft.nlPanelOpen = nlPanelOpen;
          });
        },
        setCommandPaletteOpen(commandPaletteOpen) {
          set((draft) => {
            draft.commandPaletteOpen = commandPaletteOpen;
          });
        },
      }),
    ),
  );
}
