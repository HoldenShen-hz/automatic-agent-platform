import test from "node:test";
import assert from "node:assert/strict";
import {
  GrpcAdapterService,
  GrpcRestConverter,
  HEALTH_SERVICE,
  GRPC_ERROR_CODES,
  type GrpcServiceDefinition,
  type GrpcServiceHandler,
} from "../../../../../src/platform/five-plane-interface/api/grpc-adapter-service.js";

test("GrpcAdapterService - is available", () => {
  const service = new GrpcAdapterService({
    host: "localhost",
    port: 50051,
    packageName: "test",
    serviceName: "TestService",
  });

  assert.equal(service.isAvailable(), true);
});

test("GrpcAdapterService - returns config", () => {
  const service = new GrpcAdapterService({
    host: "0.0.0.0",
    port: 50051,
    packageName: "test",
    serviceName: "TestService",
  });

  const config = service.getConfig();
  assert.equal(config.host, "0.0.0.0");
  assert.equal(config.port, 50051);
});

test("GrpcAdapterService - get server address", () => {
  const service = new GrpcAdapterService({
    host: "localhost",
    port: 50051,
    packageName: "test",
    serviceName: "TestService",
  });

  assert.equal(service.getServerAddress(), "localhost:50051");
});

test("GrpcAdapterService - create server", () => {
  const service = new GrpcAdapterService({
    host: "localhost",
    port: 50051,
    packageName: "test",
    serviceName: "TestService",
  });

  const server = service.createServer();
  assert.equal(server.isRunning, false);
});

test("GrpcAdapterService - start and stop server", async () => {
  const service = new GrpcAdapterService({
    host: "localhost",
    port: 50051,
    packageName: "test",
    serviceName: "TestService",
  });

  await service.start();
  assert.equal(service.isRunning(), true);

  await service.stop();
  assert.equal(service.isRunning(), false);
});

test("GrpcAdapterService - register and get services", () => {
  const service = new GrpcAdapterService({
    host: "localhost",
    port: 50051,
    packageName: "test",
    serviceName: "TestService",
  });

  const handler: GrpcServiceHandler = {
    TestMethod: (call, callback) => {
      callback(null, { result: "ok" });
    },
  };

  service.registerService(HEALTH_SERVICE, handler);
  const services = service.getRegisteredServices();
  assert.ok(services.length > 0);
});

test("GrpcAdapterService - call unregistered service", async () => {
  const service = new GrpcAdapterService({
    host: "localhost",
    port: 50051,
    packageName: "test",
    serviceName: "TestService",
  });

  const response = await service.call("unknown.service", "TestMethod", {});
  assert.equal(response.success, false);
  assert.ok(response.error !== undefined);
  assert.equal(response.error?.code, GRPC_ERROR_CODES.NOT_FOUND);
});

test("GrpcRestConverter - metadata to headers", () => {
  const metadata = new Map([["x-custom", "value"]]);
  const headers = GrpcRestConverter.metadataToHeaders(metadata);

  assert.equal(headers["x-custom"], "value");
});

test("GrpcRestConverter - to grpc request", () => {
  const restRequest = { user_id: "123", task_name: "test" };
  const grpcRequest = GrpcRestConverter.toGrpcRequest(restRequest);

  assert.deepEqual(grpcRequest, restRequest);
});

test("HEALTH_SERVICE - is valid service definition", () => {
  assert.equal(HEALTH_SERVICE.name, "Health");
  assert.equal(HEALTH_SERVICE.package, "grpc.health.v1");
  assert.ok(HEALTH_SERVICE.methods.length > 0);
});
