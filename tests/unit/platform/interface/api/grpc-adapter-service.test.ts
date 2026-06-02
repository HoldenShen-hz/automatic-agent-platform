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
} from "../../../../../src/platform/five-plane-interface/api/grpc-adapter-service.js";

test("GrpcAdapterService creates with config", () => {
  const config: GrpcAdapterConfig = {
    host: "localhost",
    port: 50051,
    packageName: "platform.v1",
    serviceName: "TaskService",
  };

  const adapter = new GrpcAdapterService(config);

  assert.equal(adapter.isAvailable(), true);
  assert.equal(typeof adapter.hasNativeGrpcBindings(), "boolean");
  assert.equal(adapter.getServerAddress(), "localhost:50051");
});

test("GrpcAdapterService returns correct config", () => {
  const config: GrpcAdapterConfig = {
    host: "localhost",
    port: 50051,
    packageName: "platform.v1",
    serviceName: "TaskService",
  };

  const adapter = new GrpcAdapterService(config);
  const retrieved = adapter.getConfig();

  assert.equal(retrieved.host, "localhost");
  assert.equal(retrieved.port, 50051);
  assert.equal(retrieved.packageName, "platform.v1");
  assert.equal(retrieved.serviceName, "TaskService");
});

test("GrpcAdapterService createServer", () => {
  const adapter = new GrpcAdapterService({
    host: "localhost",
    port: 50051,
    packageName: "platform.v1",
    serviceName: "TaskService",
  });

  const server = adapter.createServer();

  assert.equal(server.isRunning, false);
});

test("GrpcAdapterService registers and retrieves services", () => {
  const adapter = new GrpcAdapterService({
    host: "localhost",
    port: 50051,
    packageName: "platform.v1",
    serviceName: "TaskService",
  });

  const service: GrpcServiceDefinition = {
    name: "TaskService",
    package: "platform.v1",
    methods: [
      {
        name: "CreateTask",
        requestStream: false,
        responseStream: false,
        requestType: "CreateTaskRequest",
        responseType: "CreateTaskResponse",
      },
    ],
    fullName: "platform.v1.TaskService",
  };

  adapter.registerService(service, {
    CreateTask: (call, callback) => {
      callback(null, { taskId: "task_123" });
    },
  });

  const services = adapter.getRegisteredServices();
  assert.equal(services.length, 1);
  assert.ok(services.includes("platform.v1.TaskService"));
});

test("GrpcAdapterService makes unary call", async () => {
  const adapter = new GrpcAdapterService({
    host: "localhost",
    port: 50051,
    packageName: "platform.v1",
    serviceName: "TaskService",
  });

  const service: GrpcServiceDefinition = {
    name: "TaskService",
    package: "platform.v1",
    methods: [
      {
        name: "CreateTask",
        requestStream: false,
        responseStream: false,
        requestType: "CreateTaskRequest",
        responseType: "CreateTaskResponse",
      },
    ],
    fullName: "platform.v1.TaskService",
  };

  adapter.registerService(service, {
    CreateTask: (call, callback) => {
      callback(null, { taskId: "task_123" });
    },
  });

  const response = await adapter.call("platform.v1.TaskService", "CreateTask", {
    title: "Test Task",
  });

  assert.equal(response.success, true);
});

test("GrpcAdapterService returns error for unknown service", async () => {
  const adapter = new GrpcAdapterService({
    host: "localhost",
    port: 50051,
    packageName: "platform.v1",
    serviceName: "TaskService",
  });

  const response = await adapter.call("unknown.Service", "Method", {});

  assert.equal(response.success, false);
  assert.equal(response.error?.code, GRPC_ERROR_CODES.NOT_FOUND);
});

test("GrpcAdapterService returns error for unimplemented method", async () => {
  const adapter = new GrpcAdapterService({
    host: "localhost",
    port: 50051,
    packageName: "platform.v1",
    serviceName: "TaskService",
  });

  const service: GrpcServiceDefinition = {
    name: "TaskService",
    package: "platform.v1",
    methods: [],
    fullName: "platform.v1.TaskService",
  };

  adapter.registerService(service, {});

  const response = await adapter.call("platform.v1.TaskService", "UnimplementedMethod", {});

  assert.equal(response.success, false);
  assert.equal(response.error?.code, GRPC_ERROR_CODES.UNIMPLEMENTED);
});

test("GrpcRestConverter toGrpcRequest", () => {
  const restRequest = {
    task_title: "Test Task",
    created_at: "2024-01-01T00:00:00Z",
  };

  const grpcRequest = GrpcRestConverter.toGrpcRequest(restRequest);

  assert.equal(grpcRequest.task_title, "Test Task");
  assert.equal(grpcRequest.created_at, "2024-01-01T00:00:00Z");
});

test("GrpcRestConverter toRestResponse", () => {
  const grpcResponse = {
    taskId: "task_123",
    status: "created",
  };

  const restResponse = GrpcRestConverter.toRestResponse(grpcResponse);

  assert.equal(restResponse.taskId, "task_123");
  assert.equal(restResponse.status, "created");
});

test("GrpcRestConverter metadataToHeaders", () => {
  const metadata = new Map([
    ["x-request-id", "req_123"],
    ["x-trace-id", "trace_456"],
  ]);

  const headers = GrpcRestConverter.metadataToHeaders(metadata);

  assert.equal(headers["x-request-id"], "req_123");
  assert.equal(headers["x-trace-id"], "trace_456");
});

test("HEALTH_SERVICE definition", () => {
  assert.equal(HEALTH_SERVICE.name, "Health");
  assert.equal(HEALTH_SERVICE.package, "grpc.health.v1");
  assert.ok(HEALTH_SERVICE.methods.length > 0);
  assert.ok(HEALTH_SERVICE.methods.some((m) => m.name === "Check"));
});

test("GRPC_ERROR_CODES", () => {
  assert.equal(GRPC_ERROR_CODES.OK, 0);
  assert.equal(GRPC_ERROR_CODES.INVALID_ARGUMENT, 3);
  assert.equal(GRPC_ERROR_CODES.NOT_FOUND, 5);
  assert.equal(GRPC_ERROR_CODES.UNIMPLEMENTED, 12);
  assert.equal(GRPC_ERROR_CODES.INTERNAL, 13);
  assert.equal(GRPC_ERROR_CODES.UNAVAILABLE, 14);
});

test("HealthStatus enum", () => {
  assert.equal(HealthStatus.UNKNOWN, 0);
  assert.equal(HealthStatus.SERVING, 1);
  assert.equal(HealthStatus.NOT_SERVING, 2);
  assert.equal(HealthStatus.SERVICE_UNKNOWN, 3);
});

test("GrpcAdapterService start/stop lifecycle", async () => {
  const adapter = new GrpcAdapterService({
    host: "localhost",
    port: 50051,
    packageName: "platform.v1",
    serviceName: "TaskService",
  });

  assert.equal(adapter.isRunning(), false);

  await adapter.start();
  assert.equal(adapter.isRunning(), true);

  await adapter.stop();
  assert.equal(adapter.isRunning(), false);
});
