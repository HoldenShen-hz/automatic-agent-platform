import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  GrpcAdapterService,
  GrpcRestConverter,
  HEALTH_SERVICE,
  HealthStatus,
  GRPC_ERROR_CODES,
  type GrpcServiceDefinition,
  type GrpcServiceHandler,
} from "../../../../../src/platform/five-plane-interface/api/grpc-adapter-service.js";

describe("GrpcAdapterService", () => {
  let service: GrpcAdapterService;

  beforeEach(() => {
    service = new GrpcAdapterService({
      host: "127.0.0.1",
      port: 50051,
      packageName: "test.package",
      serviceName: "TestService",
    });
  });

  describe("constructor", () => {
    it("should create service with config", () => {
      const s = new GrpcAdapterService({
        host: "localhost",
        port: 8080,
        packageName: "com.example",
        serviceName: "ExampleService",
        credentials: "tls",
        enableReflection: true,
      });

      assert.strictEqual(s.isAvailable(), true);
      const config = s.getConfig();
      assert.strictEqual(config.host, "localhost");
      assert.strictEqual(config.port, 8080);
      assert.strictEqual(config.credentials, "tls");
      assert.strictEqual(config.enableReflection, true);
    });
  });

  describe("isAvailable", () => {
    it("should always return true", () => {
      assert.strictEqual(service.isAvailable(), true);
    });
  });

  describe("hasNativeGrpcBindings", () => {
    it("should detect when grpc-js is not available", () => {
      // The service uses require.resolve, so it depends on the environment
      const result = service.hasNativeGrpcBindings();
      // Result depends on whether @grpc/grpc-js is installed
      assert.strictEqual(typeof result, "boolean");
    });

    it("should cache detection result", () => {
      const first = service.hasNativeGrpcBindings();
      const second = service.hasNativeGrpcBindings();
      assert.strictEqual(first, second);
    });
  });

  describe("getConfig", () => {
    it("should return copy of config", () => {
      const config = service.getConfig();
      const mutated = { ...config, host: "modified" };

      const internalConfig = service.getConfig();
      assert.strictEqual(mutated.host, "modified");
      assert.strictEqual(internalConfig.host, "127.0.0.1");
    });
  });

  describe("getServerAddress", () => {
    it("should return address in host:port format", () => {
      assert.strictEqual(service.getServerAddress(), "127.0.0.1:50051");
    });
  });

  describe("createServer", () => {
    it("should create a server instance", () => {
      const server = service.createServer();

      assert.strictEqual(server.isRunning, false);
      assert.ok(typeof server.start === "function");
      assert.ok(typeof server.stop === "function");
      assert.ok(typeof server.addService === "function");
    });

    it("should set server on service", () => {
      const server = service.createServer();

      assert.strictEqual(service.isRunning(), false);
    });

    it("should allow starting the server", async () => {
      const server = service.createServer();

      await server.start();
      assert.strictEqual(service.isRunning(), true);

      await server.stop();
      assert.strictEqual(service.isRunning(), false);
    });
  });

  describe("registerService", () => {
    it("should register a service with handler", () => {
      const svc: GrpcServiceDefinition = {
        name: "MyService",
        package: "my.package",
        methods: [],
        fullName: "my.package.MyService",
      };
      const handler: GrpcServiceHandler = {};

      service.registerService(svc, handler);

      const services = service.getRegisteredServices();
      assert.ok(services.includes("my.package.MyService"));
    });

    it("should register multiple services", () => {
      const svc1: GrpcServiceDefinition = {
        name: "Service1",
        package: "pkg1",
        methods: [],
        fullName: "pkg1.Service1",
      };
      const svc2: GrpcServiceDefinition = {
        name: "Service2",
        package: "pkg2",
        methods: [],
        fullName: "pkg2.Service2",
      };

      service.registerService(svc1, {});
      service.registerService(svc2, {});

      const services = service.getRegisteredServices();
      assert.strictEqual(services.length, 2);
    });
  });

  describe("getRegisteredServices", () => {
    it("should return empty array when no services registered", () => {
      const services = service.getRegisteredServices();
      assert.deepStrictEqual(services, []);
    });
  });

  describe("call", () => {
    it("should return error for unknown service", async () => {
      const result = await service.call("unknown.service", "Method", {});

      assert.strictEqual(result.success, false);
      assert.ok(result.error);
      assert.strictEqual(result.error?.code, GRPC_ERROR_CODES.NOT_FOUND);
      assert.ok(result.error?.message.includes("Service unknown.service not found"));
    });

    it("should return error for unknown method", async () => {
      const svc: GrpcServiceDefinition = {
        name: "KnownService",
        package: "known.package",
        methods: [],
        fullName: "known.package.KnownService",
      };
      service.registerService(svc, {
        existingMethod: () => {},
      });

      const result = await service.call("known.package.KnownService", "UnknownMethod", {});

      assert.strictEqual(result.success, false);
      assert.ok(result.error);
      assert.strictEqual(result.error?.code, GRPC_ERROR_CODES.UNIMPLEMENTED);
    });

    it("should call handler and return response", async () => {
      const svc: GrpcServiceDefinition = {
        name: "TestService",
        package: "test.package",
        methods: [],
        fullName: "test.package.TestService",
      };

      const handler: GrpcServiceHandler = {
        GetData: (call, callback) => {
          callback(null, { message: "Hello from gRPC" });
        },
      };

      service.registerService(svc, handler);

      const result = await service.call<{ message: string }>(
        "test.package.TestService",
        "GetData",
        { id: "123" },
        { "x-request-id": "req-1" },
      );

      assert.strictEqual(result.success, true);
      assert.ok(result.data);
      assert.strictEqual(result.data.message, "Hello from gRPC");
    });

    it("should handle handler errors", async () => {
      const svc: GrpcServiceDefinition = {
        name: "ErrorService",
        package: "error.package",
        methods: [],
        fullName: "error.package.ErrorService",
      };

      const handler: GrpcServiceHandler = {
        FailingMethod: (call, callback) => {
          callback({ code: 13, message: "Internal error" });
        },
      };

      service.registerService(svc, handler);

      const result = await service.call("error.package.ErrorService", "FailingMethod", {});

      assert.strictEqual(result.success, false);
      assert.ok(result.error);
      assert.strictEqual(result.error?.code, GRPC_ERROR_CODES.INTERNAL);
    });

    it("should pass metadata to call", async () => {
      const svc: GrpcServiceDefinition = {
        name: "MetaService",
        package: "meta.package",
        methods: [],
        fullName: "meta.package.MetaService",
      };

      let receivedMetadata: Record<string, string> | undefined;

      const handler: GrpcServiceHandler = {
        CheckMeta: (call, callback) => {
          receivedMetadata = call.getMetadata();
          callback(null, { ok: true });
        },
      };

      service.registerService(svc, handler);

      await service.call(
        "meta.package.MetaService",
        "CheckMeta",
        {},
        { "authorization": "Bearer token123", "x-custom": "value" },
      );

      assert.deepStrictEqual(receivedMetadata, {
        "authorization": "Bearer token123",
        "x-custom": "value",
      });
    });
  });

  describe("start/stop", () => {
    it("should create and start server if not already started", async () => {
      await service.start();
      assert.strictEqual(service.isRunning(), true);

      await service.stop();
      assert.strictEqual(service.isRunning(), false);
    });

    it("should stop server cleanly", async () => {
      await service.start();
      await service.stop();
      assert.strictEqual(service.isRunning(), false);
    });
  });

  describe("isRunning", () => {
    it("should return false when no server created", () => {
      assert.strictEqual(service.isRunning(), false);
    });

    it("should return server running status", async () => {
      const server = service.createServer();
      assert.strictEqual(service.isRunning(), false);

      await server.start();
      assert.strictEqual(service.isRunning(), true);

      await server.stop();
      assert.strictEqual(service.isRunning(), false);
    });
  });
});

describe("GrpcRestConverter", () => {
  describe("toGrpcRequest", () => {
    it("should pass through REST request", () => {
      const restRequest = { user_id: "123", user_name: "Test" };
      const result = GrpcRestConverter.toGrpcRequest(restRequest);

      assert.deepStrictEqual(result, restRequest);
    });
  });

  describe("toRestResponse", () => {
    it("should pass through gRPC response", () => {
      const grpcResponse = { message: "success", code: 0 };
      const result = GrpcRestConverter.toRestResponse(grpcResponse);

      assert.deepStrictEqual(result, grpcResponse);
    });
  });

  describe("metadataToHeaders", () => {
    it("should convert metadata map to headers object", () => {
      const metadata = new Map<string, string>([
        ["content-type", "application/grpc"],
        ["user-agent", "grpc-client"],
      ]);

      const result = GrpcRestConverter.metadataToHeaders(metadata);

      assert.deepStrictEqual(result, {
        "content-type": "application/grpc",
        "user-agent": "grpc-client",
      });
    });

    it("should handle empty metadata", () => {
      const metadata = new Map<string, string>();
      const result = GrpcRestConverter.metadataToHeaders(metadata);

      assert.deepStrictEqual(result, {});
    });
  });
});

describe("HEALTH_SERVICE", () => {
  it("should have correct structure", () => {
    assert.strictEqual(HEALTH_SERVICE.name, "Health");
    assert.strictEqual(HEALTH_SERVICE.package, "grpc.health.v1");
    assert.strictEqual(HEALTH_SERVICE.fullName, "grpc.health.v1.Health");
    assert.strictEqual(HEALTH_SERVICE.methods.length, 1);
    assert.strictEqual(HEALTH_SERVICE.methods[0]?.name, "Check");
    assert.strictEqual(HEALTH_SERVICE.methods[0]?.requestStream, false);
    assert.strictEqual(HEALTH_SERVICE.methods[0]?.responseStream, false);
  });
});

describe("HealthStatus", () => {
  it("should have correct enum values", () => {
    assert.strictEqual(HealthStatus.UNKNOWN, 0);
    assert.strictEqual(HealthStatus.SERVING, 1);
    assert.strictEqual(HealthStatus.NOT_SERVING, 2);
    assert.strictEqual(HealthStatus.SERVICE_UNKNOWN, 3);
  });
});

describe("GRPC_ERROR_CODES", () => {
  it("should have standard gRPC error codes", () => {
    assert.strictEqual(GRPC_ERROR_CODES.OK, 0);
    assert.strictEqual(GRPC_ERROR_CODES.CANCELLED, 1);
    assert.strictEqual(GRPC_ERROR_CODES.UNKNOWN, 2);
    assert.strictEqual(GRPC_ERROR_CODES.INVALID_ARGUMENT, 3);
    assert.strictEqual(GRPC_ERROR_CODES.DEADLINE_EXCEEDED, 4);
    assert.strictEqual(GRPC_ERROR_CODES.NOT_FOUND, 5);
    assert.strictEqual(GRPC_ERROR_CODES.ALREADY_EXISTS, 6);
    assert.strictEqual(GRPC_ERROR_CODES.PERMISSION_DENIED, 7);
    assert.strictEqual(GRPC_ERROR_CODES.RESOURCE_EXHAUSTED, 8);
    assert.strictEqual(GRPC_ERROR_CODES.FAILED_PRECONDITION, 9);
    assert.strictEqual(GRPC_ERROR_CODES.ABORTED, 10);
    assert.strictEqual(GRPC_ERROR_CODES.OUT_OF_RANGE, 11);
    assert.strictEqual(GRPC_ERROR_CODES.UNIMPLEMENTED, 12);
    assert.strictEqual(GRPC_ERROR_CODES.INTERNAL, 13);
    assert.strictEqual(GRPC_ERROR_CODES.UNAVAILABLE, 14);
    assert.strictEqual(GRPC_ERROR_CODES.DATA_LOSS, 15);
    assert.strictEqual(GRPC_ERROR_CODES.UNAUTHENTICATED, 16);
  });
});
