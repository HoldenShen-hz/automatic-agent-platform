import "@testing-library/jest-dom/vitest";
import { webcrypto } from "node:crypto";
import { afterAll, afterEach, vi } from "vitest";

const originalMatchMedia = typeof window !== "undefined" ? window.matchMedia : undefined;
const originalIntersectionObserver = globalThis.IntersectionObserver;
const originalResizeObserver = globalThis.ResizeObserver;
const originalFetch = globalThis.fetch;

if (typeof window !== "undefined" && typeof window.matchMedia !== "function") {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
}

if (globalThis.crypto == null) {
  Object.defineProperty(globalThis, "crypto", {
    configurable: true,
    value: webcrypto,
  });
}

if (typeof globalThis.crypto.subtle === "undefined") {
  Object.defineProperty(globalThis.crypto, "subtle", {
    configurable: true,
    value: webcrypto.subtle,
  });
}

if (typeof globalThis.crypto.randomUUID !== "function") {
  Object.defineProperty(globalThis.crypto, "randomUUID", {
    configurable: true,
    value: () => `test-${Math.random().toString(16).slice(2)}`,
  });
}

if (typeof globalThis.IntersectionObserver === "undefined") {
  class IntersectionObserverStub implements IntersectionObserver {
    public readonly root = null;
    public readonly rootMargin = "0px";
    public readonly thresholds = [0];
    public disconnect(): void {}
    public observe(): void {}
    public takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
    public unobserve(): void {}
  }
  Object.defineProperty(globalThis, "IntersectionObserver", {
    configurable: true,
    value: IntersectionObserverStub,
  });
}

if (typeof globalThis.ResizeObserver === "undefined") {
  class ResizeObserverStub implements ResizeObserver {
    public disconnect(): void {}
    public observe(): void {}
    public unobserve(): void {}
  }
  Object.defineProperty(globalThis, "ResizeObserver", {
    configurable: true,
    value: ResizeObserverStub,
  });
}

afterEach(() => {
  document.body.innerHTML = "";
  window.localStorage.clear();
  window.sessionStorage.clear();
  if (globalThis.fetch !== originalFetch) {
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      value: originalFetch,
    });
  }
  vi.restoreAllMocks();
});

afterAll(() => {
  if (typeof window !== "undefined") {
    if (originalMatchMedia == null) {
      delete (window as { matchMedia?: typeof window.matchMedia; }).matchMedia;
    } else {
      window.matchMedia = originalMatchMedia;
    }
  }

  if (originalIntersectionObserver == null) {
    delete (globalThis as { IntersectionObserver?: typeof IntersectionObserver; }).IntersectionObserver;
  } else {
    Object.defineProperty(globalThis, "IntersectionObserver", {
      configurable: true,
      value: originalIntersectionObserver,
    });
  }

  if (originalResizeObserver == null) {
    delete (globalThis as { ResizeObserver?: typeof ResizeObserver; }).ResizeObserver;
  } else {
    Object.defineProperty(globalThis, "ResizeObserver", {
      configurable: true,
      value: originalResizeObserver,
    });
  }
});
