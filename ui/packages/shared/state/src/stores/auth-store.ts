import { createStore } from "zustand/vanilla";

export interface AuthStoreState {
  readonly authenticated: boolean;
  readonly locale: string;
  setAuthenticated(authenticated: boolean): void;
  setLocale(locale: string): void;
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
