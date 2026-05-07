import { describe, expect, it, vi } from "vitest";

import { createWebRuntimeConfig, startWebRuntimeTelemetry } from "../../../../../apps/web/src/runtime";

describe("web runtime telemetry bootstrap", () => {
  it("captures OTLP telemetry configuration from environment variables", () => {
    const config = createWebRuntimeConfig({
      VITE_OTLP_ENDPOINT: "https://otel.example.com/v1/logs",
      VITE_OTLP_AUTH_TOKEN: "Bearer ui-token",
    });

    expect(config.telemetryEndpoint).toBe("https://otel.example.com/v1/logs");
    expect(config.telemetryAuthToken).toBe("Bearer ui-token");
  });

  it("returns null when OTLP runtime configuration is incomplete", () => {
    expect(startWebRuntimeTelemetry({ telemetryEndpoint: "https://otel.example.com/v1/logs" })).toBeNull();
    expect(startWebRuntimeTelemetry({ telemetryAuthToken: "Bearer test-token" })).toBeNull();
  });

  it("starts Core Web Vitals collection when OTLP runtime configuration is present", () => {
    const originalFetch = globalThis.fetch;
    const originalPerformanceObserver = globalThis.PerformanceObserver;
    const observers = new Map<string, (entries: unknown[]) => void>();

    class FakePerformanceObserver {
      public static supportedEntryTypes = ["paint"];

      public constructor(private readonly callback: { (list: { getEntries(): unknown[] }): void }) {}

      public observe(options: { type: string }): void {
        observers.set(options.type, (entries) => {
          this.callback({ getEntries: () => entries });
        });
      }

      public disconnect(): void {
        return;
      }
    }

    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      value: vi.fn(async () => new Response("{}", { status: 200 })),
    });
    Object.defineProperty(globalThis, "PerformanceObserver", {
      configurable: true,
      value: FakePerformanceObserver,
    });

    try {
      const telemetry = startWebRuntimeTelemetry({
        telemetryEndpoint: "https://otel.example.com/v1/logs",
        telemetryAuthToken: "Bearer ui-token",
      });

      expect(telemetry).not.toBeNull();
      observers.get("paint")?.([{ name: "first-contentful-paint", startTime: 1200 }]);
      expect(telemetry?.sink.list().map((event) => event.name)).toContain("web_vitals.FCP");
      telemetry?.stop();
    } finally {
      Object.defineProperty(globalThis, "fetch", {
        configurable: true,
        value: originalFetch,
      });
      Object.defineProperty(globalThis, "PerformanceObserver", {
        configurable: true,
        value: originalPerformanceObserver,
      });
    }
  });
});
