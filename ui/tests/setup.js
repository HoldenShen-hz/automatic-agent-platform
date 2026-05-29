import "@testing-library/jest-dom/vitest";
import { webcrypto } from "node:crypto";
import { afterAll, afterEach, vi } from "vitest";
const originalMatchMedia = typeof window !== "undefined" ? window.matchMedia : undefined;
const originalIntersectionObserver = globalThis.IntersectionObserver;
const originalResizeObserver = globalThis.ResizeObserver;
const originalFetch = globalThis.fetch;
if (typeof window !== "undefined" && typeof window.matchMedia !== "function") {
    window.matchMedia = ((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => false,
    }));
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
    class IntersectionObserverStub {
        root = null;
        rootMargin = "0px";
        thresholds = [0];
        disconnect() { }
        observe() { }
        takeRecords() {
            return [];
        }
        unobserve() { }
    }
    Object.defineProperty(globalThis, "IntersectionObserver", {
        configurable: true,
        value: IntersectionObserverStub,
    });
}
if (typeof globalThis.ResizeObserver === "undefined") {
    class ResizeObserverStub {
        disconnect() { }
        observe() { }
        unobserve() { }
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
            delete window.matchMedia;
        }
        else {
            window.matchMedia = originalMatchMedia;
        }
    }
    if (originalIntersectionObserver == null) {
        delete globalThis.IntersectionObserver;
    }
    else {
        Object.defineProperty(globalThis, "IntersectionObserver", {
            configurable: true,
            value: originalIntersectionObserver,
        });
    }
    if (originalResizeObserver == null) {
        delete globalThis.ResizeObserver;
    }
    else {
        Object.defineProperty(globalThis, "ResizeObserver", {
            configurable: true,
            value: originalResizeObserver,
        });
    }
});
