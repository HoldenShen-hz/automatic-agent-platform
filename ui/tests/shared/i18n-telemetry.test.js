import { describe, expect, it } from "vitest";
import { createDefaultTranslationService } from "@aa/shared-i18n";
import { InMemoryTelemetryExporter, OtlpHttpTelemetryExporter, createTelemetrySink } from "@aa/shared-telemetry";
describe("shared i18n and telemetry", () => {
    it("formats ICU plural messages through intl-messageformat", () => {
        const service = createDefaultTranslationService();
        expect(service.translate("ui.notifications.pending", "zh-CN", "en-US", { count: 0 })).toBe("没有待处理项");
        expect(service.translate("ui.notifications.pending", "en-US", "en-US", { count: 2 })).toBe("2 pending items");
    });
    it("exports telemetry to memory and otlp http sinks", async () => {
        const inMemory = new InMemoryTelemetryExporter();
        const requests = [];
        const otlp = new OtlpHttpTelemetryExporter("https://otel.example.test/v1/logs", async (input, init) => {
            requests.push({
                url: String(input),
                body: typeof init?.body === "string" ? init.body : null,
            });
            return new Response(null, { status: 202 });
        }, { authorization: "Bearer token" });
        const sink = createTelemetrySink([inMemory, otlp]);
        sink.record("ui.loaded", { feature: "dashboard" });
        await Promise.resolve();
        expect(inMemory.list()).toHaveLength(1);
        expect(requests).toHaveLength(1);
        expect(requests[0]?.url).toBe("https://otel.example.test/v1/logs");
        expect(requests[0]?.body).toContain("\"service.name\":\"automatic-agent-platform-ui\"");
        expect(requests[0]?.body).toContain("\"stringValue\":\"ui.loaded\"");
    });
});
