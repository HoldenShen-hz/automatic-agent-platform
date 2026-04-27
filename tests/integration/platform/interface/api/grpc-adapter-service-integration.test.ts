/**
 * Integration tests for gRPC Adapter Service
 *
 * Tests the gRPC adapter service server lifecycle, service registration,
 * and method invocation in a realistic scenario.
 *
 * @see docs_zh/reviews/architecture-design-vs-implementation-review.md §52
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  GrpcAdapterService,
  GrpcRestConverter,
  HEALTH_SERVICE,
  HealthStatus,
  GRPC_ERROR_CODES,
  type GrpcServiceDefinition,
  type GrpcCallResponse,
} from "../../../../../src/platform/interface/api/grpc-adapter-service.js";

test("integration: gRPC adapter service lifecycle", async () => {
  const adapter = new GrpcAdapterService({
    host: "0.0.0.0",
    port: 50051,
    packageName: "platform.v1",
    serviceName: "TaskService",
  });

  // Initial state
  assert.equal(adapter.isAvailable(), true);
  assert.equal(adapter.isRunning(), false);
  assert.equal(typeof adapter.hasNativeGrpcBindings(), "boolean");

  // Create and start server
  adapter.createServer();
  await adapter.start();
  assert.equal(adapter.isRunning(), true);

  // Stop server
  await adapter.stop();
  assert.equal(adapter.isRunning(), false);
});

test("integration: gRPC adapter service registration and method calls", async () => {
  const adapter = new GrpcAdapterService({
    host: "0.0.0.0",
    port: 50052,
    packageName: "platform.v1",
    serviceName: "TaskService",
  });

  // Define task service
  const taskService: GrpcServiceDefinition = {
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
      {
        name: "GetTask",
        requestStream: false,
        responseStream: false,
        requestType: "GetTaskRequest",
        responseType: "GetTaskResponse",
      },
      {
        name: "ListTasks",
        requestStream: false,
        responseStream: false,
        requestType: "ListTasksRequest",
        responseType: "ListTasksResponse",
      },
    ],
    fullName: "platform.v1.TaskService",
  };

  // In-memory task store
  const tasks = new Map<string, { id: string; title: string; status: string }>();

  adapter.registerService(taskService, {
    CreateTask: (call, callback) => {
      const id = `task-${Date.now()}`;
      const task = { id, title: call.request.title as string, status: "pending" };
      tasks.set(id, task);
      callback(null, { task: JSON.stringify(task) });
    },
    GetTask: (call, callback) => {
      const task = tasks.get(call.request.id as string);
      if (!task) {
        callback({ code: GRPC_ERROR_CODES.NOT_FOUND, message: "Task not found" });
      } else {
        callback(null, { task: JSON.stringify(task) });
      }
    },
    ListTasks: (_call, callback) => {
      const allTasks = Array.from(tasks.values());
      callback(null, { tasks: JSON.stringify(allTasks) });
    },
  });

  // Verify service is registered
  const services = adapter.getRegisteredServices();
  assert.ok(services.includes("platform.v1.TaskService"));

  // Create a task
  const createResponse = await adapter.call<{ task: string }>(
    "platform.v1.TaskService",
    "CreateTask",
    { title: "Integration Test Task" },
  );
  assert.equal(createResponse.success, true);
  assert.ok(createResponse.data?.task);

  // Get the task
  const taskData = JSON.parse(createResponse.data!.task);
  const getResponse = await adapter.call<{ task: string }>(
    "platform.v1.TaskService",
    "GetTask",
    { id: taskData.id },
  );
  assert.equal(getResponse.success, true);
  const retrievedTask = JSON.parse(getResponse.data!.task);
  assert.equal(retrievedTask.title, "Integration Test Task");

  // List all tasks
  const listResponse = await adapter.call<{ tasks: string }>(
    "platform.v1.TaskService",
    "ListTasks",
    {},
  );
  assert.equal(listResponse.success, true);
  const allTasks = JSON.parse(listResponse.data!.tasks);
  assert.ok(Array.isArray(allTasks));
  assert.ok(allTasks.some((t: { title: string }) => t.title === "Integration Test Task"));
});

test("integration: gRPC adapter handles unknown service and method errors", async () => {
  const adapter = new GrpcAdapterService({
    host: "0.0.0.0",
    port: 50053,
    packageName: "test",
    serviceName: "TestService",
  });

  // Call unknown service
  const unknownServiceResponse = await adapter.call("unknown.Service", "Method", {});
  assert.equal(unknownServiceResponse.success, false);
  assert.ok(unknownServiceResponse.error);
  assert.equal(unknownServiceResponse.error!.code, GRPC_ERROR_CODES.NOT_FOUND);
  assert.ok(unknownServiceResponse.error!.message.includes("Service"));

  // Register service but call unknown method
  adapter.registerService(
    {
      name: "KnownService",
      package: "test",
      methods: [{ name: "KnownMethod", requestStream: false, responseStream: false, requestType: "Req", responseType: "Res" }],
      fullName: "test.KnownService",
    },
    { KnownMethod: (_call, callback) => callback(null, { result: true }) },
  );

  const unknownMethodResponse = await adapter.call("test.KnownService", "UnknownMethod", {});
  assert.equal(unknownMethodResponse.success, false);
  assert.ok(unknownMethodResponse.error);
  assert.equal(unknownMethodResponse.error!.code, GRPC_ERROR_CODES.UNIMPLEMENTED);
  assert.ok(unknownMethodResponse.error!.message.includes("Method"));
});

test("integration: gRPC adapter handles handler errors", async () => {
  const adapter = new GrpcAdapterService({
    host: "0.0.0.0",
    port: 50054,
    packageName: "test",
    serviceName: "FailingService",
  });

  adapter.registerService(
    {
      name: "FailingService",
      package: "test",
      methods: [{ name: "FailingMethod", requestStream: false, responseStream: false, requestType: "Req", responseType: "Res" }],
      fullName: "test.FailingService",
    },
    {
      FailingMethod: () => {
        throw new Error("Handler intentionally failed");
      },
    },
  );

  const response = await adapter.call("test.FailingService", "FailingMethod", {});
  assert.equal(response.success, false);
  assert.ok(response.error);
  assert.equal(response.error!.code, GRPC_ERROR_CODES.INTERNAL);
  assert.ok(response.error!.message.includes("Handler intentionally failed"));
});

test("integration: gRPC adapter metadata handling", async () => {
  const adapter = new GrpcAdapterService({
    host: "0.0.0.0",
    port: 50055,
    packageName: "test",
    serviceName: "MetadataService",
  });

  let receivedMetadata: Record<string, string> = {};

  adapter.registerService(
    {
      name: "MetadataService",
      package: "test",
      methods: [{ name: "Echo", requestStream: false, responseStream: false, requestType: "Req", responseType: "Res" }],
      fullName: "test.MetadataService",
    },
    {
      Echo: (call, callback) => {
        receivedMetadata = call.getMetadata();
        callback(null, { received: call.request });
      },
    },
  );

  await adapter.call(
    "test.MetadataService",
    "Echo",
    { data: "test" },
    { "x-request-id": "req-123", "x-user-id": "user-456", "authorization": "Bearer token" },
  );

  assert.deepStrictEqual(receivedMetadata, {
    "x-request-id": "req-123",
    "x-user-id": "user-456",
    "authorization": "Bearer token",
  });
});

test("integration: GrpcRestConverter utility functions", () => {
  // toGrpcRequest
  const restRequest = {
    task_title: "Test Task",
    created_at: "2026-01-01T00:00:00Z",
    task_id: 123,
    is_active: true,
  };
  const grpcRequest = GrpcRestConverter.toGrpcRequest(restRequest);
  assert.deepStrictEqual(grpcRequest, restRequest);

  // toRestResponse
  const grpcResponse = {
    task_id: "task-456",
    status: "completed",
    result_data: { key: "value" },
  };
  const restResponse = GrpcRestConverter.toRestResponse(grpcResponse);
  assert.deepStrictEqual(restResponse, grpcResponse);

  // metadataToHeaders
  const metadata = new Map([
    ["content-type", "application/grpc"],
    ["x-grpc-timeout", "5000"],
    ["custom-header", "value"],
  ]);
  const headers = GrpcRestConverter.metadataToHeaders(metadata);
  assert.deepStrictEqual(headers, {
    "content-type": "application/grpc",
    "x-grpc-timeout": "5000",
    "custom-header": "value",
  });
});

test("integration: HEALTH_SERVICE and HealthStatus", () => {
  assert.equal(HEALTH_SERVICE.name, "Health");
  assert.equal(HEALTH_SERVICE.package, "grpc.health.v1");
  assert.equal(HEALTH_SERVICE.fullName, "grpc.health.v1.Health");
  assert.equal(HEALTH_SERVICE.methods.length, 1);
  assert.equal(HEALTH_SERVICE.methods[0]!.name, "Check");
  assert.equal(HEALTH_SERVICE.methods[0]!.requestType, "HealthCheckRequest");
  assert.equal(HEALTH_SERVICE.methods[0]!.responseType, "HealthCheckResponse");

  assert.equal(HealthStatus.UNKNOWN, 0);
  assert.equal(HealthStatus.SERVING, 1);
  assert.equal(HealthStatus.NOT_SERVING, 2);
  assert.equal(HealthStatus.SERVICE_UNKNOWN, 3);
});

test("integration: GRPC_ERROR_CODES are correct", () => {
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

test("integration: gRPC adapter getServerAddress and getConfig", () => {
  const adapter = new GrpcAdapterService({
    host: "192.168.1.100",
    port: 8080,
    packageName: "custom.package",
    serviceName: "CustomService",
    credentials: "tls",
    enableReflection: true,
  });

  const address = adapter.getServerAddress();
  assert.equal(address, "192.168.1.100:8080");

  const config = adapter.getConfig();
  assert.equal(config.host, "192.168.1.100");
  assert.equal(config.port, 8080);
  assert.equal(config.packageName, "custom.package");
  assert.equal(config.serviceName, "CustomService");
  assert.equal(config.credentials, "tls");
  assert.equal(config.enableReflection, true);
});

test("integration: gRPC adapter multiple service registrations", () => {
  const adapter = new GrpcAdapterService({
    host: "0.0.0.0",
    port: 50056,
    packageName: "platform",
    serviceName: "MainService",
  });

  const service1: GrpcServiceDefinition = {
    name: "UserService",
    package: "platform.users",
    methods: [],
    fullName: "platform.users.UserService",
  };

  const service2: GrpcServiceDefinition = {
    name: "OrderService",
    package: "platform.orders",
    methods: [],
    fullName: "platform.orders.OrderService",
  };

  adapter.registerService(service1, {});
  adapter.registerService(service2, {});

  const services = adapter.getRegisteredServices();
  assert.equal(services.length, 2);
  assert.ok(services.includes("platform.users.UserService"));
  assert.ok(services.includes("platform.orders.OrderService"));
});
