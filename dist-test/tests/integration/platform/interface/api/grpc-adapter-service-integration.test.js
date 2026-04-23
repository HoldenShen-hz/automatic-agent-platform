import assert from "node:assert/strict";
import test from "node:test";
import { GrpcAdapterService, GrpcRestConverter, HEALTH_SERVICE, GRPC_ERROR_CODES } from "../../../../../src/platform/interface/api/grpc-adapter-service.js";
test("GrpcAdapterService isAvailable returns true", () => {
    const adapter = new GrpcAdapterService({
        host: "localhost",
        port: 50051,
        packageName: "test",
        serviceName: "TestService",
    });
    assert.equal(adapter.isAvailable(), true);
});
test("GrpcAdapterService getConfig returns config copy", () => {
    const adapter = new GrpcAdapterService({
        host: "127.0.0.1",
        port: 50051,
        packageName: "mypackage",
        serviceName: "MyService",
        credentials: "tls",
    });
    const config = adapter.getConfig();
    assert.equal(config.host, "127.0.0.1");
    assert.equal(config.port, 50051);
    assert.equal(config.packageName, "mypackage");
    assert.equal(config.credentials, "tls");
});
test("GrpcAdapterService getServerAddress returns host:port", () => {
    const adapter = new GrpcAdapterService({
        host: "192.168.1.1",
        port: 8080,
        packageName: "pkg",
        serviceName: "svc",
    });
    assert.equal(adapter.getServerAddress(), "192.168.1.1:8080");
});
test("GrpcAdapterService createServer creates server instance", () => {
    const adapter = new GrpcAdapterService({
        host: "localhost",
        port: 50051,
        packageName: "pkg",
        serviceName: "svc",
    });
    const server = adapter.createServer();
    assert.equal(server.isRunning, false);
});
test("GrpcAdapterService start/stop controls server lifecycle", async () => {
    const adapter = new GrpcAdapterService({
        host: "localhost",
        port: 50051,
        packageName: "pkg",
        serviceName: "svc",
    });
    const server = adapter.createServer();
    await server.start();
    assert.equal(server.isRunning, true);
    await server.stop();
    assert.equal(server.isRunning, false);
});
test("GrpcAdapterService registerService tracks registered services", () => {
    const adapter = new GrpcAdapterService({
        host: "localhost",
        port: 50051,
        packageName: "pkg",
        serviceName: "svc",
    });
    const service = {
        name: "Test",
        package: "test.pkg",
        methods: [],
        fullName: "test.pkg.Test",
    };
    const handler = {};
    adapter.registerService(service, handler);
    const services = adapter.getRegisteredServices();
    assert.equal(services.length, 1);
    assert.equal(services[0], "test.pkg.Test");
});
test("GrpcAdapterService call returns NOT_FOUND for unregistered service", async () => {
    const adapter = new GrpcAdapterService({
        host: "localhost",
        port: 50051,
        packageName: "pkg",
        serviceName: "svc",
    });
    const result = await adapter.call("nonexistent.Service", "Method", {});
    assert.equal(result.success, false);
    assert.equal(result.error?.code, GRPC_ERROR_CODES.NOT_FOUND);
});
test("GrpcAdapterService call returns UNIMPLEMENTED for unregistered method", async () => {
    const adapter = new GrpcAdapterService({
        host: "localhost",
        port: 50051,
        packageName: "pkg",
        serviceName: "svc",
    });
    const service = {
        name: "Test",
        package: "test.pkg",
        methods: [],
        fullName: "test.pkg.Test",
    };
    adapter.registerService(service, {});
    const result = await adapter.call("test.pkg.Test", "UnknownMethod", {});
    assert.equal(result.success, false);
    assert.equal(result.error?.code, GRPC_ERROR_CODES.UNIMPLEMENTED);
});
test("GrpcAdapterService isRunning returns false when server not created", () => {
    const adapter = new GrpcAdapterService({
        host: "localhost",
        port: 50051,
        packageName: "pkg",
        serviceName: "svc",
    });
    assert.equal(adapter.isRunning(), false);
});
test("GrpcAdapterService isRunning reflects server state", async () => {
    const adapter = new GrpcAdapterService({
        host: "localhost",
        port: 50051,
        packageName: "pkg",
        serviceName: "svc",
    });
    adapter.createServer();
    assert.equal(adapter.isRunning(), false);
    await adapter.start();
    assert.equal(adapter.isRunning(), true);
    await adapter.stop();
    assert.equal(adapter.isRunning(), false);
});
test("GrpcRestConverter toGrpcRequest passes through fields", () => {
    const input = { user_id: "user-1", task_count: 5 };
    const result = GrpcRestConverter.toGrpcRequest(input);
    assert.deepEqual(result, input);
});
test("GrpcRestConverter toRestResponse passes through fields", () => {
    const input = { userId: "user-1", taskCount: 5 };
    const result = GrpcRestConverter.toRestResponse(input);
    assert.deepEqual(result, input);
});
test("GrpcRestConverter metadataToHeaders converts Map to Record", () => {
    const metadata = new Map([["authorization", "Bearer token"], ["content-type", "application/json"]]);
    const headers = GrpcRestConverter.metadataToHeaders(metadata);
    assert.equal(headers.authorization, "Bearer token");
    assert.equal(headers["content-type"], "application/json");
});
test("HEALTH_SERVICE has correct structure", () => {
    assert.equal(HEALTH_SERVICE.name, "Health");
    assert.equal(HEALTH_SERVICE.package, "grpc.health.v1");
    assert.equal(HEALTH_SERVICE.methods.length, 1);
    assert.equal(HEALTH_SERVICE.methods[0].name, "Check");
    assert.equal(HEALTH_SERVICE.fullName, "grpc.health.v1.Health");
});
test("GRPC_ERROR_CODES contains standard codes", () => {
    assert.equal(GRPC_ERROR_CODES.OK, 0);
    assert.equal(GRPC_ERROR_CODES.CANCELLED, 1);
    assert.equal(GRPC_ERROR_CODES.INVALID_ARGUMENT, 3);
    assert.equal(GRPC_ERROR_CODES.NOT_FOUND, 5);
    assert.equal(GRPC_ERROR_CODES.UNIMPLEMENTED, 12);
    assert.equal(GRPC_ERROR_CODES.INTERNAL, 13);
});
//# sourceMappingURL=grpc-adapter-service-integration.test.js.map