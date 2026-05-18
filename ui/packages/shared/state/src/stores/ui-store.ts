import { createStore } from "zustand/vanilla";
import { withPersistDevtoolsDraft } from "./middleware";
import type { ThemeMode } from "./theme-store";

type UiStoreDraft = {
  -readonly [K in keyof UiStoreState]:
    UiStoreState[K] extends readonly (infer U)[] ? U[]
      : UiStoreState[K];
};

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
          set((draft: UiStoreDraft) => {
            draft.activeRoute = activeRoute;
          });
        },
        setActiveFeature(activeFeature) {
          set((draft: UiStoreDraft) => {
            draft.activeFeature = activeFeature;
          });
        },
        toggleSidebar() {
          set((draft: UiStoreDraft) => {
            draft.sidebarCollapsed = !draft.sidebarCollapsed;
          });
        },
        setCommandPaletteOpen(commandPaletteOpen) {
          set((draft: UiStoreDraft) => {
            draft.commandPaletteOpen = commandPaletteOpen;
          });
        },
        setNlPanelOpen(nlPanelOpen) {
          set((draft: UiStoreDraft) => {
            draft.nlPanelOpen = nlPanelOpen;
          });
        },
        setThemeMode(themeMode) {
          set((draft: UiStoreDraft) => {
            draft.themeMode = themeMode;
          });
        },
      }),
    ),
  );
}
