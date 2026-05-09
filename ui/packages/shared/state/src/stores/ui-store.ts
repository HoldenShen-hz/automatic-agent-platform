import { createStore } from "zustand/vanilla";
import { withPersistDevtoolsDraft } from "./middleware";

export interface UiStoreState {
  readonly activeRoute: string;
  readonly activeFeature: string;
  readonly sidebarCollapsed: boolean;
  readonly commandPaletteOpen: boolean;
  setActiveRoute(route: string): void;
  setActiveFeature(featureId: string): void;
  toggleSidebar(): void;
  setCommandPaletteOpen(open: boolean): void;
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
      }),
    ),
  );
}
