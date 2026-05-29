import { Server } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { createMockHttpServer, resolveMockRequest } from "../../../../tools/mock-server/src/index.js";
const serversToClose = new Set();
afterEach(async () => {
    await Promise.all([...serversToClose].map((server) => new Promise((resolve) => {
        server.close(() => resolve());
    })));
    serversToClose.clear();
});
describe("resolveMockRequest", () => {
    it("matches exact task routes without leaking into similarly prefixed paths", () => {
        const tasks = resolveMockRequest("/api/v1/tasks");
        const archived = resolveMockRequest("/api/v1/tasks-archive");
        expect(tasks).not.toEqual(archived);
        expect(archived).toEqual({
            ok: true,
            path: "/api/v1/tasks-archive",
        });
    });
    it("ignores query strings when resolving canonical routes", () => {
        const result = resolveMockRequest("/api/v1/meta/contract-version?verbose=true");
        expect(result).toEqual({
            accepted: true,
            apiVersion: "v1",
            platformVersion: "0.1.0",
            contractVersion: "2026-04-01",
            minServerVersion: "2026-04-01",
            supportedVersions: ["2026-04-01", "2026-01-01"],
        });
    });
    it("treats trailing slashes and case changes as distinct routes", () => {
        expect(resolveMockRequest("/api/v1/tasks/")).toEqual({
            ok: true,
            path: "/api/v1/tasks/",
        });
        expect(resolveMockRequest("/API/v1/tasks")).toEqual({
            ok: true,
            path: "/API/v1/tasks",
        });
    });
    it("rejects listen attempts when the port is already in use", async () => {
        const originalListen = Server.prototype.listen;
        Server.prototype.listen = function mockedListen() {
            queueMicrotask(() => {
                this.emit("error", new Error("listen-failed"));
            });
            return this;
        };
        try {
            await expect(createMockHttpServer(4321)).rejects.toThrow("listen-failed");
        }
        finally {
            Server.prototype.listen = originalListen;
        }
    });
});
