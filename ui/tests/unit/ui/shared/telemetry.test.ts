import { describe, expect, it, vi } from "vitest";

const webVitalsHandlers: Partial<Record<"LCP" | "FCP" | "CLS" | "INP", (metric: {
  name: string;
  value: number;
  rating: "good" | "needs-improvement" | "poor";
  delta: number;
  id: string;
  entries: unknown[];
}) => void>> = {};

vi.mock("web-vitals", () => ({
  onLCP: (callback: typeof webVitalsHandlers.LCP) => {
    webVitalsHandlers.LCP = callback;
  },
  onFCP: (callback: typeof webVitalsHandlers.FCP) => {
    webVitalsHandlers.FCP = callback;
  },
  onCLS: (callback: typeof webVitalsHandlers.CLS) => {
    webVitalsHandlers.CLS = callback;
  },
  onINP: (callback: typeof webVitalsHandlers.INP) => {
    webVitalsHandlers.INP = callback;
  },
}));
import {
  startWebVitalsCollection,
  TelemetrySink,
  InMemoryTelemetryExporter,
  OtlpHttpTelemetryExporter,
  createTelemetrySink,
} from "@aa/shared-telemetry";

describe("TelemetrySink", () => {
  describe("core operations", () => {
    it("record adds event to internal buffer", () => {
      const sink = new TelemetrySink([]);

      sink.record("test.event", { key: "value" });
      sink.record("another.event", { num: 42 });

      const events = sink.list();
      expect(events.length).toBe(2);
      expect(events[0]!.name).toBe("test.event");
      expect(events[0]!.attributes).toEqual({ key: "value" });
    });

    it("record respects consent checker", () => {
      let consented = false;
      const consentChecker = () => consented;
      const sink = new TelemetrySink([], { consentChecker });

      sink.record("should.be.dropped", { when: "no-consent" });
      expect(sink.list().length).toBe(0);

      consented = true;
      sink.record("should.be.recorded", { when: "consented" });
      expect(sink.list().length).toBe(1);
    });

    it("record triggers flush when buffer is full", async () => {
      const exporter = new InMemoryTelemetryExporter();
      const sink = new TelemetrySink([exporter], { maxBufferSize: 3 });

      sink.record("event.1", {});
      sink.record("event.2", {});
      expect(sink.list().length).toBe(2);

      sink.record("event.3", {});

      expect(sink.list().length).toBe(0);
      expect(exporter.list().length).toBe(3);
    });

    it("list returns readonly copy of events", () => {
      const sink = new TelemetrySink([]);
      sink.record("event", {});

      const events = sink.list();
      expect(events.length).toBe(1);

      (events as any).length = 0;
      expect(sink.list().length).toBe(1);
    });

    it("scoped creates scoped recorder", () => {
      const sink = new TelemetrySink([]);
      const scoped = sink.scoped({ name: "auth", attributes: { version: "1.0" } });

      scoped.record("login", { method: "sso" });

      const events = sink.list();
      expect(events.length).toBe(1);
      expect(events[0]!.name).toBe("auth.login");
      expect(events[0]!.attributes.version).toBe("1.0");
      expect(events[0]!.attributes.method).toBe("sso");
    });
  });

  describe("flush behavior", () => {
    it("flush sends events to all exporters", async () => {
      const exporter1 = new InMemoryTelemetryExporter();
      const exporter2 = new InMemoryTelemetryExporter();
      const sink = new TelemetrySink([exporter1, exporter2]);

      sink.record("test.event", { key: "value" });
      await sink.flush();

      expect(exporter1.list().length).toBe(1);
      expect(exporter2.list().length).toBe(1);
      expect(sink.list().length).toBe(0);
    });

    it("flush does nothing when buffer is empty", async () => {
      const exporter = new InMemoryTelemetryExporter();
      const sink = new TelemetrySink([exporter]);

      await sink.flush();

      expect(exporter.list().length).toBe(0);
    });

    it("flush re-queues events on export failure", async () => {
      let failFirst = true;
      const failingExporter = {
        async export(_events: any) {
          if (failFirst) {
            failFirst = false;
            throw new Error("Export failed");
          }
        },
      };

      const sink = new TelemetrySink([failingExporter as any]);
      sink.record("event.1", {});
      sink.record("event.2", {});

      await sink.flush();

      expect(sink.list().length).toBe(2);

      await sink.flush();
      expect(sink.list().length).toBe(0);
    });

    it("flush retries only failed exporters and avoids duplicate delivery to successful exporters", async () => {
      const exporter1Batches: string[][] = [];
      const exporter2Batches: string[][] = [];
      let failFirst = true;

      const exporter1 = {
        async export(events: any[]) {
          exporter1Batches.push(events.map((event) => event.name));
        },
      };
      const exporter2 = {
        async export(events: any[]) {
          exporter2Batches.push(events.map((event) => event.name));
          if (failFirst) {
            failFirst = false;
            throw new Error("temporary exporter failure");
          }
        },
      };

      const sink = new TelemetrySink([exporter1 as any, exporter2 as any], { maxRetryAttempts: 2 });
      sink.record("event.1", {});

      await sink.flush();
      expect(exporter1Batches).toEqual([["event.1"]]);
      expect(exporter2Batches).toEqual([["event.1"]]);
      expect(sink.list().length).toBe(1);

      await sink.flush();
      expect(exporter1Batches).toEqual([["event.1"]]);
      expect(exporter2Batches).toEqual([["event.1"], ["event.1"]]);
      expect(sink.list().length).toBe(0);
    });

    it("moves events to dead letters after retry budget is exhausted", async () => {
      const failingExporter = {
        async export(_events: any[]) {
          throw new Error("permanent exporter failure");
        },
      };

      const sink = new TelemetrySink([failingExporter as any], { maxRetryAttempts: 1 });
      sink.record("event.1", { important: true });

      await sink.flush();
      expect(sink.list().length).toBe(1);
      expect(sink.listDeadLetters().length).toBe(0);

      await sink.flush();
      expect(sink.list().length).toBe(0);
      expect(sink.listDeadLetters()).toHaveLength(1);
      expect(sink.listDeadLetters()[0]!.event.name).toBe("event.1");
      expect(sink.listDeadLetters()[0]!.reason).toContain("permanent exporter failure");
    });
  });

  describe("Unbounded Events Array (Issue #2076)", () => {
    it("force flush at max buffer size does not exceed maxBufferSize", async () => {
      const exporter = new InMemoryTelemetryExporter();
      const sink = new TelemetrySink([exporter], { maxBufferSize: 100 });

      for (let i = 0; i < 100; i++) {
        sink.record(`event.${i}`, { index: i });
      }

      expect(sink.list().length).toBe(0);
      expect(exporter.list().length).toBe(100);
    });

    it("events array is bounded by maxBufferSize with auto-flush", async () => {
      const exporter = new InMemoryTelemetryExporter();
      const sink = new TelemetrySink([exporter], { maxBufferSize: 50, flushIntervalMs: 60000 });

      for (let i = 0; i < 75; i++) {
        sink.record(`event.${i}`, {});
      }

      expect(exporter.list().length).toBeGreaterThanOrEqual(50);
      expect(sink.list().length).toBeLessThan(50);
    });

    it("dispose clears timer and flushes remaining events", async () => {
      const exporter = new InMemoryTelemetryExporter();
      const sink = new TelemetrySink([exporter], { flushIntervalMs: 100000 });

      sink.record("event.before.dispose", {});

      sink.dispose();

      expect(exporter.list().length).toBe(1);
      expect(sink.list().length).toBe(0);
    });

    it("multiple rapid flushes handle edge cases", async () => {
      const exporter = new InMemoryTelemetryExporter();
      const sink = new TelemetrySink([exporter], { maxBufferSize: 10 });

      for (let i = 0; i < 35; i++) {
        sink.record(`event.${i}`, {});
      }

      await sink.flush();

      expect(exporter.list().length).toBe(35);
    });
  });
});

describe("startWebVitalsCollection", () => {
  it("records FCP/LCP/CLS/INP into telemetry once the web-vitals hooks fire", async () => {
    const sink = new TelemetrySink([]);
    startWebVitalsCollection(sink);
    await vi.dynamicImportSettled();

    webVitalsHandlers.FCP?.({ name: "FCP", value: 1200, rating: "good", delta: 1200, id: "fcp-1", entries: [] });
    webVitalsHandlers.LCP?.({ name: "LCP", value: 2100, rating: "good", delta: 2100, id: "lcp-1", entries: [] });
    webVitalsHandlers.CLS?.({ name: "CLS", value: 0.03, rating: "good", delta: 0.03, id: "cls-1", entries: [] });
    webVitalsHandlers.INP?.({ name: "INP", value: 110, rating: "good", delta: 110, id: "inp-1", entries: [] });

    expect(sink.list().map((event) => event.name)).toEqual([
      "web_vitals.FCP",
      "web_vitals.LCP",
      "web_vitals.CLS",
      "web_vitals.INP",
    ]);
  });
});

describe("InMemoryTelemetryExporter", () => {
  it("collects exported events", async () => {
    const exporter = new InMemoryTelemetryExporter();

    await exporter.export([
      { name: "event.1", attributes: {}, recordedAt: "2026-05-01T00:00:00.000Z" },
      { name: "event.2", attributes: { key: "value" }, recordedAt: "2026-05-01T00:00:01.000Z" },
    ]);

    const list = exporter.list();
    expect(list.length).toBe(2);
    expect(list[1]!.name).toBe("event.2");
  });
});

describe("OtlpHttpTelemetryExporter", () => {
  it("formats events correctly", async () => {
    let capturedBody: any = null;
    const mockFetch = async (_url: string, init: RequestInit) => {
      capturedBody = JSON.parse(init.body as string);
      return new Response("{}", { status: 200 });
    };

    const exporter = new OtlpHttpTelemetryExporter(
      "https://otel.example.com/v1/logs",
      mockFetch,
      { authorization: "Bearer test-token" },
    );

    await exporter.export([
      {
        name: "test.event",
        attributes: { key: "value", count: 42 },
        recordedAt: "2026-05-01T12:00:00.000Z",
      },
    ]);

    expect(capturedBody).not.toBeNull();
    expect(Array.isArray(capturedBody.resourceLogs)).toBe(true);
    expect(capturedBody.resourceLogs[0]!.resource.attributes[0]!.key).toBe("service.name");
    expect(capturedBody.resourceLogs[0]!.resource.attributes[0]!.value.stringValue).toBe("automatic-agent-platform-ui");
  });

  it("skip export when events array is empty", async () => {
    let fetchCalled = false;
    const mockFetch = async () => {
      fetchCalled = true;
      return new Response("{}", { status: 200 });
    };

    const exporter = new OtlpHttpTelemetryExporter(
      "https://otel.example.com",
      mockFetch,
      { authorization: "Bearer test-token" },
    );

    await exporter.export([]);

    expect(fetchCalled).toBe(false);
  });

  it("requires authorization for multi-tenant export", () => {
    expect(() => new OtlpHttpTelemetryExporter("https://otel.example.com")).toThrow(/authorization/i);
  });
});

describe("createTelemetrySink", () => {
  it("creates sink with correct defaults", () => {
    const sink = createTelemetrySink();

    sink.record("event", {});

    const events = sink.list();
    expect(events.length).toBe(1);
    expect(events[0]!.recordedAt).toBeDefined();
  });
});

describe("TelemetrySink disposal", () => {
  it("can be disposed multiple times safely", () => {
    const exporter = new InMemoryTelemetryExporter();
    const sink = new TelemetrySink([exporter]);

    sink.record("event", {});
    sink.dispose();
    sink.dispose();

    expect(true).toBe(true);
  });
});
