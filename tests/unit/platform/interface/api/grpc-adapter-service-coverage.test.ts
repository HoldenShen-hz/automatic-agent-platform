import test from "node:test";
import assert from "node:assert/strict";

import {
  GrpcAdapterService,
  GrpcRestConverter,
  HEALTH_SERVICE,
  HealthStatus,
  GRPC_ERROR_CODES,
  type GrpcAdapterConfig,
  type GrpcServiceDefinition,
  type GrpcMethodDefinition,
  type GrpcCallRequest,
  type GrpcServer,
} from "../../../../../src/platform/interface/api/grpc-adapter-service.js";

test("GrpcAdapterService isAvailable returns true", () => {
  const service = new GrpcAdapterService({
    host: "localhost",
    port: 50051,
    packageName: "test",
    serviceName: "TestService",
  });

  assert.equal(service.isAvailable(), true);
});

test("GrpcAdapterService getConfig returns config", () => {
  const config: GrpcAdapterConfig = {
    host: "localhost",
    port: 50051,
    packageName: "test",
    serviceName: "TestService",
  };

  const service = new GrpcAdapterService(config);

  const returnedConfig = service.getConfig();

  assert.equal(returnedConfig.host, "localhost");
  assert.equal(returnedConfig.port, 50051);
  assert.equal(returnedConfig.packageName, "test");
  assert.equal(returnedConfig.serviceName, "TestService");
});

test("GrpcAdapterService getServerAddress returns host:port", () => {
  const service = new GrpcAdapterService({
    host: "192.168.1.1",
    port: 8080,
    packageName: "test",
    serviceName: "TestService",
  });

  assert.equal(service.getServerAddress(), "192.168.1.1:8080");
});

test("GrpcAdapterService createServer creates a server instance", () => {
  const service = new GrpcAdapterService({
    host: "localhost",
    port: 50051,
    packageName: "test",
    serviceName: "TestService",
  });

  const server = service.createServer();

  assert.equal(server.isRunning, false);
});

test("GrpcAdapterService createServer and start server", async () => {
  const service = new GrpcAdapterService({
    host: "localhost",
    port: 50051,
    packageName: "test",
    serviceName: "TestService",
  });

  const server = service.createServer();
  await server.start();

  assert.equal(server.isRunning, true);

  await server.stop();
  assert.equal(server.isRunning, false);
});

test("GrpcAdapterService registerService stores service handler", () => {
  const service = new GrpcAdapterService({
    host: "localhost",
    port: 50051,
    packageName: "test",
    serviceName: "TestService",
  });

  const serviceDef: GrpcServiceDefinition = {
    name: "TestService",
    package: "test.package",
    methods: [
      {
        name: "TestMethod",
        requestStream: false,
        responseStream: false,
        requestType: "TestRequest",
        responseType: "TestResponse",
      },
    ],
    fullName: "test.package.TestService",
  };

  const handler = {
    TestMethod: (call, callback) => {
      callback(null, { message: "Response" });
    },
  };

  service.registerService(serviceDef, handler);

  const services = service.getRegisteredServices();
  assert.deepStrictEqual(services, ["test.package.TestService"]);
});

test("GrpcAdapterService getRegisteredServices returns all registered services", () => {
  const service = new GrpcAdapterService({
    host: "localhost",
    port: 50051,
    packageName: "test",
    serviceName: "TestService",
  });

  const serviceDef1: GrpcServiceDefinition = {
    name: "Service1",
    package: "test",
    methods: [],
    fullName: "test.Service1",
  };

  const serviceDef2: GrpcServiceDefinition = {
    name: "Service2",
    package: "test",
    methods: [],
    fullName: "test.Service2",
  };

  service.registerService(serviceDef1, {});
  service.registerService(serviceDef2, {});

  const services = service.getRegisteredServices();
  assert.equal(services.length, 2);
  assert.ok(services.includes("test.Service1"));
  assert.ok(services.includes("test.Service2"));
});

test("GrpcAdapterService call returns error for unknown service", async () => {
  const service = new GrpcAdapterService({
    host: "localhost",
    port: 50051,
    packageName: "test",
    serviceName: "TestService",
  });

  const response = await service.call("unknown.service", "TestMethod", { id: "123" });

  assert.equal(response.success, false);
  assert.ok(response.error != null);
  assert.equal(response.error.code, GRPC_ERROR_CODES.NOT_FOUND);
});

test("GrpcAdapterService call returns error for unknown method", async () => {
  const service = new GrpcAdapterService({
    host: "localhost",
    port: 50051,
    packageName: "test",
    serviceName: "TestService",
  });

  const serviceDef: GrpcServiceDefinition = {
    name: "TestService",
    package: "test",
    methods: [
      {
        name: "KnownMethod",
        requestStream: false,
        responseStream: false,
        requestType: "TestRequest",
        responseType: "TestResponse",
      },
    ],
    fullName: "test.TestService",
  };

  const handler = {
    KnownMethod: (call, callback) => {
      callback(null, { message: "Response" });
    },
  };

  service.registerService(serviceDef, handler);

  const response = await service.call("test.TestService", "UnknownMethod", { id: "123" });

  assert.equal(response.success, false);
  assert.ok(response.error != null);
  assert.equal(response.error.code, GRPC_ERROR_CODES.UNIMPLEMENTED);
});

test("GrpcAdapterService call executes handler and returns response", async () => {
  const service = new GrpcAdapterService({
    host: "localhost",
    port: 50051,
    packageName: "test",
    serviceName: "TestService",
  });

  const serviceDef: GrpcServiceDefinition = {
    name: "TestService",
    package: "test",
    methods: [
      {
        name: "TestMethod",
        requestStream: false,
        responseStream: false,
        requestType: "TestRequest",
        responseType: "TestResponse",
      },
    ],
    fullName: "test.TestService",
  };

  const handler = {
    TestMethod: (call, callback) => {
      callback(null, { received: call.request });
    },
  };

  service.registerService(serviceDef, handler);

  const response = await service.call<{ received: Record<string, unknown> }>(
    "test.TestService",
    "TestMethod",
    { id: "123", name: "Test" },
  );

  assert.equal(response.success, true);
  assert.ok(response.data != null);
  assert.deepStrictEqual(response.data.received, { id: "123", name: "Test" });
});

test("GrpcAdapterService call passes metadata to handler", async () => {
  const service = new GrpcAdapterService({
    host: "localhost",
    port: 50051,
    packageName: "test",
    serviceName: "TestService",
  });

  const serviceDef: GrpcServiceDefinition = {
    name: "TestService",
    package: "test",
    methods: [
      {
        name: "TestMethod",
        requestStream: false,
        responseStream: false,
        requestType: "TestRequest",
        responseType: "TestResponse",
      },
    ],
    fullName: "test.TestService",
  };

  let receivedMetadata: Record<string, string> = {};
  const handler = {
    TestMethod: (call, callback) => {
      receivedMetadata = call.getMetadata();
      callback(null, { success: true });
    },
  };

  service.registerService(serviceDef, handler);

  await service.call(
    "test.TestService",
    "TestMethod",
    { id: "123" },
    { "x-request-id": "req-456", "x-user-id": "user-789" },
  );

  assert.deepStrictEqual(receivedMetadata, { "x-request-id": "req-456", "x-user-id": "user-789" });
});

test("GrpcAdapterService start creates and starts server", async () => {
  const service = new GrpcAdapterService({
    host: "localhost",
    port: 50051,
    packageName: "test",
    serviceName: "TestService",
  });

  await service.start();

  assert.equal(service.isRunning(), true);

  await service.stop();
});

test("GrpcAdapterService stop stops the server", async () => {
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

test("GrpcAdapterService isRunning returns false initially", () => {
  const service = new GrpcAdapterService({
    host: "localhost",
    port: 50051,
    packageName: "test",
    serviceName: "TestService",
  });

  assert.equal(service.isRunning(), false);
});

test("GrpcRestConverter toGrpcRequest returns rest request", () => {
  const restRequest = { user_id: "123", user_name: "John" };

  const grpcRequest = GrpcRestConverter.toGrpcRequest(restRequest);

  assert.deepStrictEqual(grpcRequest, restRequest);
});

test("GrpcRestConverter toRestResponse returns grpc response", () => {
  const grpcResponse = { user_id: "123", user_name: "John" };

  const restResponse = GrpcRestConverter.toRestResponse(grpcResponse);

  assert.deepStrictEqual(restResponse, grpcResponse);
});

test("GrpcRestConverter metadataToHeaders converts Map to Record", () => {
  const metadata = new Map([
    ["x-request-id", "req-123"],
    ["x-user-id", "user-456"],
  ]);

  const headers = GrpcRestConverter.metadataToHeaders(metadata);

  assert.deepStrictEqual(headers, {
    "x-request-id": "req-123",
    "x-user-id": "user-456",
  });
});

test("HEALTH_SERVICE has correct structure", () => {
  assert.equal(HEALTH_SERVICE.name, "Health");
  assert.equal(HEALTH_SERVICE.package, "grpc.health.v1");
  assert.equal(HEALTH_SERVICE.fullName, "grpc.health.v1.Health");
  assert.equal(HEALTH_SERVICE.methods.length, 1);
  assert.equal(HEALTH_SERVICE.methods[0]!.name, "Check");
  assert.equal(HEALTH_SERVICE.methods[0]!.requestStream, false);
  assert.equal(HEALTH_SERVICE.methods[0]!.responseStream, false);
});

test("HealthStatus enum has correct values", () => {
  assert.equal(HealthStatus.UNKNOWN, 0);
  assert.equal(HealthStatus.SERVING, 1);
  assert.equal(HealthStatus.NOT_SERVING, 2);
  assert.equal(HealthStatus.SERVICE_UNKNOWN, 3);
});

test("GRPC_ERROR_CODES has all expected error codes", () => {
  assert.equal(GRPC_ERROR_CODES.OK, 0);
  assert.equal(GRPC_ERROR_CODES.CANCELLED, 1);
  assert.equal(GRPC_ERROR_CODES.UNKNOWN, 2);
  assert.equal(GRPC_ERROR_CODES.INVALID_ARGUMENT, 3);
  assert.equal(GRPC_ERROR_CODES.DEADLINE_EXCEEDED, 4);
  assert.equal(GRPC_ERROR_CODES.NOT_FOUND, 5);
  assert.equal(GRPC_ERROR_CODES.ALREADY_EXISTS, 6);
  assert.equal(GRPC_ERROR_CODES.PERMISSION_DENIED, 7);
  assert.equal(GRPC_ERROR_CODES.RESOURCE_EXHAUSTED, 8);
  assert.equal(GRPC_ERROR_CODES.FAILED_PRECONDITION, 9);
  assert.equal(GRPC_ERROR_CODES.ABORTED, 10);
  assert.equal(GRPC_ERROR_CODES.OUT_OF_RANGE, 11);
  assert.equal(GRPC_ERROR_CODES.UNIMPLEMENTED, 12);
  assert.equal(GRPC_ERROR_CODES.INTERNAL, 13);
  assert.equal(GRPC_ERROR_CODES.UNAVAILABLE, 14);
  assert.equal(GRPC_ERROR_CODES.DATA_LOSS, 15);
  assert.equal(GRPC_ERROR_CODES.UNAUTHENTICATED, 16);
});

test("GrpcAdapterService call handles handler error", async () => {
  const service = new GrpcAdapterService({
    host: "localhost",
    port: 50051,
    packageName: "test",
    serviceName: "TestService",
  });

  const serviceDef: GrpcServiceDefinition = {
    name: "TestService",
    package: "test",
    methods: [
      {
        name: "FailingMethod",
        requestStream: false,
        responseStream: false,
        requestType: "TestRequest",
        responseType: "TestResponse",
      },
    ],
    fullName: "test.TestService",
  };

  const handler = {
    FailingMethod: (_call, _callback) => {
      throw new Error("Handler error");
    },
  };

  service.registerService(serviceDef, handler);

  const response = await service.call("test.TestService", "FailingMethod", {});

  assert.equal(response.success, false);
  assert.ok(response.error != null);
  assert.equal(response.error.code, GRPC_ERROR_CODES.INTERNAL);
});

test("GrpcAdapterService server addService registers service", async () => {
  const service = new GrpcAdapterService({
    host: "localhost",
    port: 50051,
    packageName: "test",
    serviceName: "TestService",
  });

  const server = service.createServer();

  const serviceDef: GrpcServiceDefinition = {
    name: "TestService",
    package: "test",
    methods: [],
    fullName: "test.TestService",
  };

  server.addService(serviceDef, {});

  const services = service.getRegisteredServices();
  assert.ok(services.includes("test.TestService"));
});
