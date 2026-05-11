import { createStore } from "zustand/vanilla";
import { withPersistDevtoolsDraft } from "./middleware";
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

export function createUiStore() {
  return createStore<UiStoreState>()(
    withPersistDevtoolsDraft(
      "aa-ui-store",
      (set) => ({
        activeRoute: "/",
        activeFeature: "dashboard",
        sidebarCollapsed: false,
        commandPaletteOpen: false,
        nlPanelOpen: false,
        themeMode: "system",
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
        toggleSidebar() {
          set((draft) => {
            draft.sidebarCollapsed = !draft.sidebarCollapsed;
          });
        },
        setCommandPaletteOpen(commandPaletteOpen) {
          set((draft) => {
            draft.commandPaletteOpen = commandPaletteOpen;
          });
        },
        setNlPanelOpen(nlPanelOpen) {
          set((draft) => {
            draft.nlPanelOpen = nlPanelOpen;
          });
        },
        setThemeMode(themeMode) {
          set((draft) => {
            draft.themeMode = themeMode;
          });
        },
      }),
    ),
  );
}
