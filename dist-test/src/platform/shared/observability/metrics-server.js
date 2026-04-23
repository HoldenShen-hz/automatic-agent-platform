import { createServer } from "node:http";
export function renderMetricsPayload(exporter, method, path) {
    if ((method ?? "GET") !== "GET") {
        return {
            statusCode: 405,
            headers: { allow: "GET", "content-type": "text/plain; charset=utf-8" },
            body: "Method Not Allowed",
        };
    }
    if (path !== "/metrics") {
        return {
            statusCode: 404,
            headers: { "content-type": "text/plain; charset=utf-8" },
            body: "Not Found",
        };
    }
    if (exporter == null) {
        return {
            statusCode: 503,
            headers: { "content-type": "text/plain; charset=utf-8" },
            body: "metrics exporter unavailable",
        };
    }
    return {
        statusCode: 200,
        headers: { "content-type": "text/plain; version=0.0.4; charset=utf-8" },
        body: exporter.export(),
    };
}
export function createMetricsServer(exporter) {
    return createServer((request, response) => {
        const payload = renderMetricsPayload(exporter, request.method, request.url);
        response.writeHead(payload.statusCode, payload.headers);
        response.end(payload.body);
    });
}
//# sourceMappingURL=metrics-server.js.map