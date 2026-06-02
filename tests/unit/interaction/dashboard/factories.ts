/**
 * Dashboard Test Factories
 *
 * Provides typed factory functions for creating test objects for dashboard testing.
 * Uses the pattern from tests/helpers/typed-factories.ts
 */

import type { TaskBoardItem } from "../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import type { SystemSituation } from "../../../../src/platform/shared/observability/system-situation-model.js";
import type { DashboardDelta, DashboardChange } from "../../../../src/interaction/dashboard/dashboard-projection-service.js";
import type { AttentionItem } from "../../../../src/interaction/dashboard/index.js";
import type { DashboardProjectionService } from "../../../../src/interaction/dashboard/index.js";
import type { DashboardChannelSubscription } from "../../../../src/interaction/dashboard/dashboard-websocket-server.js";

// ── TaskBoardItem Factory ─────────────────────────────────────────────────────

export function createTaskBoardItem(overrides: Partial<TaskBoardItem> = {}): TaskBoardItem {
  return {
    taskId: "task-" + Math.random().toString(36).slice(2, 8),
    title: "Test Task",
    taskStatus: "pending",
    priority: "normal",
    workflowStatus: null,
    currentStepIndex: null,
    sessionStatus: null,
    latestEventAt: null,
    updatedAt: new Date().toISOString(),
    divisionId: "general-ops",
    ...overrides,
  };
}

// ── SystemSituation Factory ──────────────────────────────────────────────────

export function createSystemSituation(overrides: Partial<SystemSituation> = {}): SystemSituation {
  return {
    healthStatus: "ok",
    providerHealth: {
      status: "healthy",
      successRate: 1.0,
      recentCalls: 0,
    },
    resourceUtilization: {
      memoryRssMb: 512,
      cpuPercent: 50,
      activeProcesses: 4,
    },
    queueBacklog: {
      size: 0,
      degraded: false,
    },
    eventBusBacklog: {
      tier1PendingAcks: 0,
    },
    findings: [],
    observedAt: Date.now(),
    ...overrides,
  };
}

// ── DashboardDelta Factory ───────────────────────────────────────────────────

export function createDashboardDelta(overrides: Partial<DashboardDelta> = {}): DashboardDelta {
  return {
    deltaId: "delta-" + Math.random().toString(36).slice(2, 8),
    timestamp: new Date().toISOString(),
    tenantId: null,
    visibilityScope: "tenant",
    changes: [],
    affectedMetrics: ["totalTasks"],
    ...overrides,
  };
}

export function createDashboardChange(overrides: Partial<DashboardChange> = {}): DashboardChange {
  return {
    changeType: "task_updated",
    entityId: "task-1",
    previousValue: undefined,
    newValue: {},
    ...overrides,
  };
}

// ── AttentionItem Factory ────────────────────────────────────────────────────

export function createAttentionItem(overrides: Partial<AttentionItem> = {}): AttentionItem {
  return {
    id: "attention-" + Math.random().toString(36).slice(2, 8),
    itemType: "incident",
    priority: "high",
    title: "Test Attention Item",
    description: "Test description",
    actionOptions: ["inspect", "retry"],
    createdAt: new Date().toISOString(),
    domainId: "general-ops",
    ...overrides,
  };
}

// ── Mock Sources ─────────────────────────────────────────────────────────────

export function createMockTaskSource(tasks: TaskBoardItem[] = []) {
  return {
    list: (limit?: number, _tenantId?: string | null) => {
      if (limit !== undefined) {
        return tasks.slice(0, limit);
      }
      return [...tasks];
    },
  };
}

export function createMockProjectionService(deltas: DashboardDelta[] = []): DashboardProjectionService {
  return {
    processProjectionUpdate: () => null,
    consumePendingDeltas: () => [...deltas],
  } as unknown as DashboardProjectionService;
}

export function createMockSystemSource(system: SystemSituation = createSystemSituation()) {
  return {
    build: () => system,
  };
}

// ── Channel Subscription Factory ────────────────────────────────────────────

export function createChannelSubscription(
  channel: "global" | "task" | "approvals" | "admin" = "global",
  filterId?: string,
): DashboardChannelSubscription {
  return {
    channel,
    ...(filterId !== undefined ? { filterId } : {}),
  };
}
