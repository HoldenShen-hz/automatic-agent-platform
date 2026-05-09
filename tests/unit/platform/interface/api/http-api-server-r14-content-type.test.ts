import assert from "node:assert/strict";
import test from "node:test";

import { HttpApiServer } from "../../../../../src/platform/interface/api/http-api-server.js";
import type { ApprovalService } from "../../../../../src/platform/control-plane/approval-center/approval-service.js";
import type { MissionControlService } from "../../../../../src/platform/interface/api/mission-control-service.js";
import type { InspectService } from "../../../../../src/platform/shared/observability/inspect-service.js";

class NoOpMissionControlService implements MissionControlService {
  getSnapshot() {
    return {
      generatedAt: new Date().toISOString(),
      health: {
        status: "ok",
        uptimeSeconds: 1,
        dbWritable: true,
        providerHealth: "healthy" as const,
        providerSuccessRate: 1,
        providerRecentCalls: 0,
        activeExecutions: 0,
        queuedTasks: 0,
        eventLoopLagMs: null,
        memoryRssMb: 0,
        tier1AckBacklog: 0,
        degradationMode: "none" as const,
        backpressure: { severity: "none", activeBreakers: [] },
        queueGovernance: { mode: "normal" as const, queueDepth: 0 },
        workerHealth: { totalWorkers: 0, healthyWorkers: 0, unhealthyWorkers: 0 },
        findings: [],
      },
      metrics: {
        generatedAt: new Date().toISOString(),
        taskMetrics: { total: 0, pending: 0, inProgress: 0, completed: 0, failedCount: 0 },
        stepMetrics: { total: 0, pending: 0, completed: 0, failedCount: 0, averageDurationMs: null },
        runtimeMetrics: { activeExecutions: 0, queuedTasks: 0 },
      },
      taskBoard: [],
      pendingApprovals: [],
      divisions: [],
      productSignals: { latestPmfReport: null, billingAccounts: [], perceptionBriefs: [] },
      gatewayTargets: [],
      activeAgents: 0,
      queueDepth: 0,
      errorRate: 0,
      avgDurationMs: null,
      p50LatencyMs: null,
      p99LatencyMs: null,
      budgetUtilizationPercent: null,
      uptimePercent: 100,
    };
  }

  getHealthReportAsync() {
    return Promise.resolve(this.getSnapshot().health);
  }

  getStableTasks() {
    return [];
  }

  getWorkers() {
    return [];
  }
}

class NoOpInspectService implements InspectService {
  async taskInspect() {
    return { id: "", status: "", createdAt: "", updatedAt: "" };
  }

  async workflowInspect() {
    return { summary: { taskId: "" }, timeline: { entries: [] } };
  }
}

class NoOpApprovalService implements ApprovalService {
  async listApprovals() {
    return { approvals: [] };
  }

  async createApproval() {
    return { approvalId: "", status: "", decisionId: "" };
  }

  async submitDecision() {
    return { id: "", status: "" };
  }
}

function createMinimalServer(): HttpApiServer {
  return new HttpApiServer({
    approvalService: new NoOpApprovalService(),
    inspectService: new NoOpInspectService(),
    missionControlService: new NoOpMissionControlService(),
  });
}

test("HttpApiServer returns 415 for write request with unsupported content type", async () => {
  const server = createMinimalServer();
  await server.start();

  try {
    const response = await server.inject({
      url: "/v1/auth/token",
      method: "POST",
      headers: {
        "content-type": "text/plain",
      },
      body: JSON.stringify({ apiKey: "test-key" }),
    });

    assert.equal(response.statusCode, 415);
    assert.equal(response.json<{ error: { code: string } }>().error.code, "api.unsupported_media_type");
  } finally {
    await server.stop();
  }
});

test("HttpApiServer accepts application/json content type and reaches route handler", async () => {
  const server = createMinimalServer();
  await server.start();

  try {
    const response = await server.inject({
      url: "/v1/auth/token",
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ apiKey: "test-key" }),
    });

    assert.equal(response.statusCode, 503);
    assert.equal(response.json<{ error: { code: string } }>().error.code, "api.auth_unavailable");
  } finally {
    await server.stop();
  }
});
