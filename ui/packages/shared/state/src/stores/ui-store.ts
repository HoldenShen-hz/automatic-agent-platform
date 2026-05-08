import { createStore } from "zustand/vanilla";

export interface UiStoreState {
  readonly activeRoute: string;
  readonly activeFeature: string;
  setActiveRoute(route: string): void;
  setActiveFeature(featureId: string): void;
}

export function createUiStore() {
  return createStore<UiStoreState>((set) => ({
    activeRoute: "/",
    activeFeature: "dashboard",
    setActiveRoute(activeRoute) {
      set({ activeRoute });
    },
    setActiveFeature(activeFeature) {
      set({ activeFeature });
    },
  }));
}
