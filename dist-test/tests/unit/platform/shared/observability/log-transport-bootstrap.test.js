import assert from "node:assert/strict";
import test from "node:test";
import { configureStructuredLogTransports } from "../../../../../src/platform/shared/observability/log-transport-bootstrap.js";
test("configureStructuredLogTransports returns empty array when nothing enabled", () => {
    const enabled = configureStructuredLogTransports({
        stdout: false,
        fluentd: null,
        datadog: null,
    });
    assert.deepStrictEqual(enabled, []);
});
test("configureStructuredLogTransports enables stdout transport", () => {
    const enabled = configureStructuredLogTransports({
        stdout: true,
        fluentd: null,
        datadog: null,
    });
    assert.deepStrictEqual(enabled, ["stdout"]);
});
test("configureStructuredLogTransports enables fluentd transport", () => {
    const enabled = configureStructuredLogTransports({
        stdout: false,
        fluentd: { host: "fluentd.example.com", port: 24224, tag: "my-service" },
        datadog: null,
    });
    assert.deepStrictEqual(enabled, ["fluentd"]);
});
test("configureStructuredLogTransports enables datadog transport", () => {
    const enabled = configureStructuredLogTransports({
        stdout: false,
        fluentd: null,
        datadog: { apiKey: "datadog-api-key", site: "datadoghq.com", service: "my-service" },
    });
    assert.deepStrictEqual(enabled, ["datadog"]);
});
test("configureStructuredLogTransports enables all three transports", () => {
    const config = {
        stdout: true,
        fluentd: { host: "fluentd.example.com", port: 24224, tag: "my-service" },
        datadog: { apiKey: "datadog-api-key", site: "datadoghq.com", service: "my-service" },
    };
    const enabled = configureStructuredLogTransports(config);
    assert.deepStrictEqual(enabled, ["stdout", "fluentd", "datadog"]);
});
test("configureStructuredLogTransports handles partial config", () => {
    const enabled = configureStructuredLogTransports({
        stdout: true,
        fluentd: { host: "fluentd.example.com", port: 24224, tag: "my-service" },
        datadog: null,
    });
    assert.deepStrictEqual(enabled, ["stdout", "fluentd"]);
});
//# sourceMappingURL=log-transport-bootstrap.test.js.map