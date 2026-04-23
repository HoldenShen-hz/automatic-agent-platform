import { QueryClient } from "@tanstack/react-query";
import { createStore } from "zustand/vanilla";

export interface AuthStoreState {
  readonly authenticated: boolean;
  readonly locale: string;
  setAuthenticated(authenticated: boolean): void;
  setLocale(locale: string): void;
}

export interface UiStoreState {
  readonly activeRoute: string;
  readonly activeFeature: string;
  setActiveRoute(route: string): void;
  setActiveFeature(featureId: string): void;
}

export interface RealtimeStoreState {
  readonly wsStatus: string;
  readonly panicActivated: boolean;
  setWsStatus(status: string): void;
  triggerPanic(): void;
}

export function createAuthStore() {
  return createStore<AuthStoreState>((set) => ({
    authenticated: false,
    locale: "zh-CN",
    setAuthenticated(authenticated) {
      set({ authenticated });
    },
    setLocale(locale) {
      set({ locale });
    },
  }));
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

export function createRealtimeStore() {
  return createStore<RealtimeStoreState>((set) => ({
    wsStatus: "disconnected",
    panicActivated: false,
    setWsStatus(wsStatus) {
      set({ wsStatus });
    },
    triggerPanic() {
      set({ panicActivated: true });
    },
  }));
}

export function createQueryClientFactory() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: 1,
      },
    },
  });
}
