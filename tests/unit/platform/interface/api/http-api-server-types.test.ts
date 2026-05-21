import assert from "node:assert/strict";
import test from "node:test";

import type {
  HttpApiServerOptions,
  StartServerOptions,
  StartedServerAddress,
  InjectRequestOptions,
  InjectResponse,
  HttpApiRouteDependencies,
} from "../../../../../src/platform/five-plane-interface/api/http-api-server-types.js";

test("HttpApiServerOptions interface structure", () => {
  const options: HttpApiServerOptions = {
    approvalService: {} as any,
    inspectService: {} as any,
    missionControlService: {} as any,
  };
  assert.ok(options !== null);
  assert.ok(options !== undefined);
});

test("HttpApiServerOptions allows optional properties", () => {
  const options: HttpApiServerOptions = {
    approvalService: {} as any,
    inspectService: {} as any,
    missionControlService: {} as any,
    gatewayTargetDirectoryService: null,
    divisionRegistry: null,
    authService: null,
    channelGatewayService: null,
    channelGatewayDeliveryService: null,
    webhookIngressService: null,
    webhookOutboxDispatchService: null,
    webhookSecret: null,
    coordinatorLoadBalancingService: null,
    prometheusMetricsExporter: null,
    billingService: null,
    incidentService: null,
    packCatalogService: null,
    costReportService: null,
    configRolloutService: null,
    tenantRegistryService: null,
    adminConfigService: null,
    adminRuntimeDirectiveService: null,
    promptRegistryService: null,
    missionRepository: null,
    knowledgePlaneService: null,
    artifactPlaneService: null,
    domainRegistryService: null,
    pluginRegistry: null,
    taskStore: null,
    intakeAdmissionService: null,
    rateLimiter: null,
    enableWebSocket: true,
    cors: {},
    apiDefaultTimeoutMs: 30000,
    apiMaxTimeoutMs: 120000,
    workerHeartbeatSweepIntervalMs: 60000,
    workerHeartbeatTtlMs: 300000,
  };
  assert.equal(options.enableWebSocket, true);
  assert.equal(options.apiDefaultTimeoutMs, 30000);
});

test("StartServerOptions interface structure", () => {
  const options: StartServerOptions = {
    host: "localhost",
    port: 3000,
  };
  assert.equal(options.host, "localhost");
  assert.equal(options.port, 3000);
});

test("StartServerOptions allows optional properties", () => {
  const options: StartServerOptions = {};
  assert.equal(options.host, undefined);
  assert.equal(options.port, undefined);
});

test("StartedServerAddress interface structure", () => {
  const address: StartedServerAddress = {
    host: "localhost",
    port: 3000,
    baseUrl: "http://localhost:3000",
  };
  assert.equal(address.host, "localhost");
  assert.equal(address.port, 3000);
  assert.equal(address.baseUrl, "http://localhost:3000");
});

test("InjectRequestOptions interface structure", () => {
  const options: InjectRequestOptions = {
    method: "GET",
    url: "/api/tasks",
    headers: { "content-type": "application/json" },
    body: null,
  };
  assert.equal(options.method, "GET");
  assert.equal(options.url, "/api/tasks");
});

test("InjectRequestOptions url is required", () => {
  const options: InjectRequestOptions = {
    url: "/api/tasks",
  };
  assert.equal(options.url, "/api/tasks");
});

test("InjectResponse interface structure", () => {
  const response: InjectResponse = {
    statusCode: 200,
    headers: { "content-type": "application/json" },
    body: '{"success":true}',
    json: () => ({ success: true }),
    text: () => '{"success":true}',
  };
  assert.equal(response.statusCode, 200);
});

test("HttpApiRouteDependencies interface structure", () => {
  const deps: HttpApiRouteDependencies = {
    divisionRegistry: null,
    incidentService: {} as any,
    packCatalogService: {} as any,
    costReportService: {} as any,
    configRolloutService: {} as any,
    tenantRegistryService: null,
    adminConfigService: {} as any,
    adminRuntimeDirectiveService: {} as any,
    promptRegistryService: null,
    routeTable: [],
  };
  assert.ok(Array.isArray(deps.routeTable));
});