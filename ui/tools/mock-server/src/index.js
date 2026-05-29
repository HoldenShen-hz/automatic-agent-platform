import { createServer } from "node:http";
import { DEFAULT_ACCEPT_VERSIONS, defaultMockApiShape } from "@aa/shared-api-client";
import testTarget from "../../../test-target.json";
const LOOPBACK_HOST = testTarget.host;
const PRIMARY_CONTRACT_VERSION = DEFAULT_ACCEPT_VERSIONS[0];
export function createMockServerSnapshot() {
    return defaultMockApiShape;
}
export function describePlannedEndpoint(id) {
    return {
        id,
        enabled: false,
        reason: "planned-endpoint-seam",
    };
}
export function resolveMockRequest(path) {
    const requestUrl = new URL(path, "http://mock.local");
    const pathname = requestUrl.pathname;
    if (pathname === "/api/v1/meta/contract-version") {
        return {
            accepted: true,
            apiVersion: "v1",
            platformVersion: "0.1.0",
            contractVersion: PRIMARY_CONTRACT_VERSION,
            minServerVersion: PRIMARY_CONTRACT_VERSION,
            supportedVersions: [...DEFAULT_ACCEPT_VERSIONS],
        };
    }
    if (pathname === "/api/v1/dashboard/snapshot") {
        return defaultMockApiShape.dashboard;
    }
    if (pathname === "/api/v1/tasks") {
        return defaultMockApiShape.tasks;
    }
    if (pathname === "/api/v1/workflows") {
        return defaultMockApiShape.workflows;
    }
    if (pathname === "/api/v1/approvals") {
        return defaultMockApiShape.approvals;
    }
    return {
        ok: true,
        path: pathname,
    };
}
function writeJson(response, statusCode, payload) {
    response.statusCode = statusCode;
    response.setHeader("content-type", "application/json; charset=utf-8");
    response.end(JSON.stringify(payload));
}
function resolveRequestPath(request) {
    return request.url ?? "/";
}
export function createMockRequestHandler() {
    return (request, response) => {
        const path = resolveRequestPath(request);
        if (request.method === "POST" || request.method === "PUT" || request.method === "PATCH") {
            request.resume();
        }
        if (path === "/healthz") {
            writeJson(response, 200, { ok: true });
            return;
        }
        if (path.startsWith("/api/")) {
            writeJson(response, 200, resolveMockRequest(path));
            return;
        }
        writeJson(response, 404, { ok: false, path, reason: "not_found" });
    };
}
export async function createMockHttpServer(port = 0) {
    const server = createServer(createMockRequestHandler());
    await new Promise((resolve, reject) => {
        const handleError = (error) => {
            server.off("listening", handleListening);
            reject(error);
        };
        const handleListening = () => {
            server.off("error", handleError);
            resolve();
        };
        server.once("error", handleError);
        server.once("listening", handleListening);
        server.listen(port, LOOPBACK_HOST);
    });
    const address = server.address();
    const resolvedPort = typeof address === "object" && address != null ? address.port : port;
    return {
        server,
        port: resolvedPort,
        url: `http://${LOOPBACK_HOST}:${resolvedPort}`,
        close: () => new Promise((resolve, reject) => {
            server.close((error) => {
                if (error != null) {
                    reject(error);
                    return;
                }
                resolve();
            });
        }),
    };
}
