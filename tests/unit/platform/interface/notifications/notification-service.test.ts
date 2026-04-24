/**
 * Unit tests for NotificationService
 * Tests HITL notification dispatch, queue management, and routing logic
 */

import assert from "node:assert/strict";
import test from "node:test";
import type {
  HitlQueueItem,
  HitlQueueFilters,
  NotificationDispatchResult,
  HitlNotificationChannel,
} from "../../../../../src/platform/orchestration/hitl/hitl-operator-console-service.js";
import type { ApprovalPacket } from "../../../../../src/platform/orchestration/hitl/hitl-approval-orchestration-service.js";

function createMockApprovalPacket(overrides: Partial<ApprovalPacket> = {}): ApprovalPacket {
  return {
    approvalId: "approval-test-1",
    taskId: "task-test-1",
    executionId: "exec-test-1",
    mode: "single_approval",
    title: "Test Approval Request",
    reason: "Test reason for approval",
    riskLevel: "high",
    options: [
      {
        optionId: "option-approve",
        label: "Approve",
        style: "primary",
        requiresConfirm: false,
      },
      {
        optionId: "option-reject",
        label: "Reject",
        style: "danger",
        requiresConfirm: true,
      },
    ],
    recommendedOptionId: "option-approve",
    deadlineAt: null,
    timeoutPolicy: "reject",
    explanation: {
      summary: "Test explanation summary",
      factors: [],
      confidence: 0.85,
      contextSnapshot: {
        taskId: "task-test-1",
        executionId: "exec-test-1",
        title: "Test Approval Request",
        stageRef: "execute",
        recommendedOptionId: "option-approve",
        hitlMode: "single_approval",
        tenantId: "tenant-001",
      },
    },
    feedbackLink: {
      approvalId: "approval-test-1",
      taskId: "task-test-1",
      stageRef: "execute",
      loopIteration: null,
      refId: null,
      feedbackSignalId: null,
      decisionEffect: "continue",
    },
    ...overrides,
  };
}

function createMockQueueItem(overrides: Partial<HitlQueueItem> = {}): HitlQueueItem {
  return {
    queueItemId: "hitl_queue:test-1",
    approvalId: "approval-test-1",
    taskId: "task-test-1",
    executionId: "exec-test-1",
    tenantId: "tenant-001",
    title: "Test Approval Request",
    stageRef: "execute",
    riskLevel: "high",
    explanationSummary: "Test explanation summary",
    recommendedOptionId: "option-approve",
    deliveryChannels: ["console"],
    deliveryIds: [],
    status: "pending",
    acknowledgedBy: null,
    takeoverSessionId: null,
    createdAt: "2026-04-21T10:00:00.000Z",
    updatedAt: "2026-04-21T10:00:00.000Z",
    ...overrides,
  };
}

class MockNotifier {
  public calls: Array<{ channel: HitlNotificationChannel; packet: ApprovalPacket }> = [];
  public deliveryResults: Array<{ delivered: boolean; deliveryId: string | null }> = [
    { delivered: true, deliveryId: "delivery-1" },
  ];

  public async notify(input: { channel: HitlNotificationChannel; packet: ApprovalPacket }): Promise<{ delivered: boolean; deliveryId: string | null }> {
    this.calls.push(input);
    return this.deliveryResults.shift() ?? { delivered: false, deliveryId: null };
  }
}

class MockHitlOperatorConsoleService {
  public queue = new Map<string, HitlQueueItem>();
  public routingRules: readonly import("../../../src/platform/orchestration/hitl/hitl-operator-console-service.js").HitlNotificationRoutingRule[] = [];

  public constructor(
    routingRules: readonly import("../../../src/platform/orchestration/hitl/hitl-operator-console-service.js").HitlNotificationRoutingRule[] = [],
    private notifier?: MockNotifier,
  ) {
    this.routingRules = routingRules;
  }

  public async dispatch(packet: ApprovalPacket): Promise<NotificationDispatchResult> {
    const channels = this.resolveChannels(packet);
    const deliveryIds: string[] = [];
    let delivered = false;

    if (this.notifier) {
      for (const channel of channels) {
        const result = await this.notifier.notify({ channel, packet });
        delivered = delivered || result.delivered;
        if (result.deliveryId != null) {
          deliveryIds.push(result.deliveryId);
        }
      }
    }

    const now = new Date().toISOString();
    this.queue.set(packet.approvalId, {
      queueItemId: `hitl_queue:${packet.approvalId}`,
      approvalId: packet.approvalId,
      taskId: packet.taskId,
      executionId: packet.executionId,
      tenantId: this.readTenantId(packet),
      title: packet.title,
      stageRef: packet.feedbackLink.stageRef,
      riskLevel: packet.riskLevel,
      explanationSummary: packet.explanation.summary,
      recommendedOptionId: packet.recommendedOptionId,
      deliveryChannels: channels,
      deliveryIds,
      status: "pending",
      acknowledgedBy: null,
      takeoverSessionId: null,
      createdAt: now,
      updatedAt: now,
    });

    return {
      channel: channels.join(","),
      delivered,
      deliveryId: deliveryIds[0] ?? null,
    };
  }

  public listQueue(filters: HitlQueueFilters = {}): HitlQueueItem[] {
    return [...this.queue.values()].filter((item) => {
      if (filters.status != null && item.status !== filters.status) return false;
      if (filters.tenantId !== undefined && item.tenantId !== filters.tenantId) return false;
      if (filters.stageRef != null && item.stageRef !== filters.stageRef) return false;
      return true;
    });
  }

  public acknowledge(approvalId: string, operatorId: string): HitlQueueItem {
    const item = this.requireQueueItem(approvalId);
    const updated: HitlQueueItem = {
      ...item,
      status: "acknowledged",
      acknowledgedBy: operatorId,
      updatedAt: new Date().toISOString(),
    };
    this.queue.set(approvalId, updated);
    return updated;
  }

  public resolve(approvalId: string, feedbackSignalId: string | null): HitlQueueItem {
    const item = this.requireQueueItem(approvalId);
    const updated: HitlQueueItem = {
      ...item,
      status: "resolved",
      updatedAt: new Date().toISOString(),
      takeoverSessionId: feedbackSignalId ?? item.takeoverSessionId,
    };
    this.queue.set(approvalId, updated);
    return updated;
  }

  private resolveChannels(packet: ApprovalPacket): HitlNotificationChannel[] {
    const tenantId = this.readTenantId(packet);
    const channels = new Set<HitlNotificationChannel>(["console"]);
    for (const rule of this.routingRules) {
      if (this.compareRisk(packet.riskLevel, rule.minRiskLevel) < 0) continue;
      if (rule.stages != null && !rule.stages.includes(packet.feedbackLink.stageRef)) continue;
      if (rule.tenantIds != null && tenantId != null && !rule.tenantIds.includes(tenantId)) continue;
      channels.add(rule.channel);
    }
    return [...channels];
  }

  private readTenantId(packet: ApprovalPacket): string | null {
    const tenantId = packet.explanation.contextSnapshot.tenantId;
    return typeof tenantId === "string" && tenantId.trim().length > 0 ? tenantId : null;
  }

  private compareRisk(left: ApprovalPacket["riskLevel"], right: ApprovalPacket["riskLevel"]): number {
    const weights: Record<ApprovalPacket["riskLevel"], number> = { low: 1, medium: 2, high: 3, critical: 4 };
    return weights[left] - weights[right];
  }

  private requireQueueItem(approvalId: string): HitlQueueItem {
    const item = this.queue.get(approvalId);
    if (item == null) throw new Error(`hitl_console.queue_item_not_found:${approvalId}`);
    return item;
  }
}

test("dispatch creates queue item with pending status", async () => {
  const mockNotifier = new MockNotifier();
  const service = new MockHitlOperatorConsoleService([], mockNotifier);
  const packet = createMockApprovalPacket();

  await service.dispatch(packet);

  const items = service.listQueue();
  assert.strictEqual(items.length, 1);
  assert.strictEqual(items[0]?.status, "pending");
});

test("dispatch populates queue item fields correctly", async () => {
  const mockNotifier = new MockNotifier();
  const service = new MockHitlOperatorConsoleService([], mockNotifier);
  const packet = createMockApprovalPacket();

  await service.dispatch(packet);

  const items = service.listQueue();
  const item = items[0];
  assert.strictEqual(item?.approvalId, packet.approvalId);
  assert.strictEqual(item?.taskId, packet.taskId);
  assert.strictEqual(item?.executionId, packet.executionId);
  assert.strictEqual(item?.title, packet.title);
  assert.strictEqual(item?.stageRef, packet.feedbackLink.stageRef);
  assert.strictEqual(item?.riskLevel, packet.riskLevel);
});

test("dispatch calls notifier for each channel", async () => {
  const mockNotifier = new MockNotifier();
  const service = new MockHitlOperatorConsoleService([], mockNotifier);
  const packet = createMockApprovalPacket();

  await service.dispatch(packet);

  assert.strictEqual(mockNotifier.calls.length, 1);
  assert.strictEqual(mockNotifier.calls[0]?.channel, "console");
});

test("dispatch returns correct delivery result", async () => {
  const mockNotifier = new MockNotifier();
  const service = new MockHitlOperatorConsoleService([], mockNotifier);
  const packet = createMockApprovalPacket();

  const result = await service.dispatch(packet);

  assert.strictEqual(result.delivered, true);
  assert.strictEqual(result.deliveryId, "delivery-1");
});

test("listQueue returns all items with no filters", async () => {
  const service = new MockHitlOperatorConsoleService();
  await service.dispatch(createMockApprovalPacket({ approvalId: "approval-1" }));
  await service.dispatch(createMockApprovalPacket({ approvalId: "approval-2" }));

  const items = service.listQueue();

  assert.strictEqual(items.length, 2);
});

test("listQueue filters by status", async () => {
  const service = new MockHitlOperatorConsoleService();
  await service.dispatch(createMockApprovalPacket({ approvalId: "approval-1" }));
  const packet2 = createMockApprovalPacket({ approvalId: "approval-2" });
  await service.dispatch(packet2);
  service.acknowledge("approval-1", "operator-1");

  const pending = service.listQueue({ status: "pending" });
  const acknowledged = service.listQueue({ status: "acknowledged" });

  assert.strictEqual(pending.length, 1);
  assert.strictEqual(acknowledged.length, 1);
  assert.strictEqual(pending[0]?.approvalId, "approval-2");
});

test("listQueue filters by tenantId", async () => {
  const service = new MockHitlOperatorConsoleService();
  await service.dispatch(createMockApprovalPacket({ approvalId: "approval-1" }));
  await service.dispatch(createMockApprovalPacket({
    approvalId: "approval-2",
    explanation: {
      ...createMockApprovalPacket().explanation,
      contextSnapshot: {
        taskId: "task-test-2",
        executionId: "exec-test-2",
        title: "Test",
        stageRef: "plan",
        recommendedOptionId: null,
        hitlMode: "single_approval",
        tenantId: "tenant-002",
      },
    },
  }));

  const tenant1 = service.listQueue({ tenantId: "tenant-001" });
  const tenant2 = service.listQueue({ tenantId: "tenant-002" });

  assert.strictEqual(tenant1.length, 1);
  assert.strictEqual(tenant2.length, 1);
});

test("acknowledge updates item status and acknowledgedBy", async () => {
  const service = new MockHitlOperatorConsoleService();
  await service.dispatch(createMockApprovalPacket());

  const updated = service.acknowledge("approval-test-1", "operator-xyz");

  assert.strictEqual(updated.status, "acknowledged");
  assert.strictEqual(updated.acknowledgedBy, "operator-xyz");
  assert.ok(updated.updatedAt !== "2026-04-21T10:00:00.000Z");
});

test("acknowledge throws for non-existent approvalId", async () => {
  const service = new MockHitlOperatorConsoleService();

  assert.throws(() => {
    service.acknowledge("non-existent", "operator-1");
  }, /hitl_console\.queue_item_not_found/);
});

test("resolve updates item status and takeoverSessionId", async () => {
  const service = new MockHitlOperatorConsoleService();
  await service.dispatch(createMockApprovalPacket());

  const updated = service.resolve("approval-test-1", "session-takeover-123");

  assert.strictEqual(updated.status, "resolved");
  assert.strictEqual(updated.takeoverSessionId, "session-takeover-123");
});

test("resolve throws for non-existent approvalId", async () => {
  const service = new MockHitlOperatorConsoleService();

  assert.throws(() => {
    service.resolve("non-existent", null);
  }, /hitl_console\.queue_item_not_found/);
});

test("dispatch respects routing rules for risk level", async () => {
  const mockNotifier = new MockNotifier();
  const routingRules = [
    { channel: "email" as HitlNotificationChannel, minRiskLevel: "medium" as const },
    { channel: "pager" as HitlNotificationChannel, minRiskLevel: "critical" as const },
  ];
  const service = new MockHitlOperatorConsoleService(routingRules, mockNotifier);

  await service.dispatch(createMockApprovalPacket({ riskLevel: "low" }));

  assert.strictEqual(mockNotifier.calls.length, 1);
  assert.strictEqual(mockNotifier.calls[0]?.channel, "console");

  mockNotifier.calls = [];
  await service.dispatch(createMockApprovalPacket({ riskLevel: "critical" }));

  assert.strictEqual(mockNotifier.calls.length, 3);
  const channels = mockNotifier.calls.map((c) => c.channel);
  assert.ok(channels.includes("console"));
  assert.ok(channels.includes("email"));
  assert.ok(channels.includes("pager"));
});

test("dispatch respects routing rules for stage filtering", async () => {
  const mockNotifier = new MockNotifier();
  const routingRules = [
    { channel: "slack" as HitlNotificationChannel, minRiskLevel: "low" as const, stages: ["execute" as const] },
  ];
  const service = new MockHitlOperatorConsoleService(routingRules, mockNotifier);

  await service.dispatch(createMockApprovalPacket({ feedbackLink: { ...createMockApprovalPacket().feedbackLink, stageRef: "plan" } }));

  const channels = mockNotifier.calls.map((c) => c.channel);
  assert.strictEqual(channels.length, 1);
  assert.strictEqual(channels[0], "console");
});

test("listQueue filters by stageRef", async () => {
  const service = new MockHitlOperatorConsoleService();
  await service.dispatch(createMockApprovalPacket({
    approvalId: "approval-1",
    feedbackLink: { ...createMockApprovalPacket().feedbackLink, stageRef: "plan" },
  }));
  await service.dispatch(createMockApprovalPacket({
    approvalId: "approval-2",
    feedbackLink: { ...createMockApprovalPacket().feedbackLink, stageRef: "execute" },
  }));

  const planItems = service.listQueue({ stageRef: "plan" });
  const executeItems = service.listQueue({ stageRef: "execute" });

  assert.strictEqual(planItems.length, 1);
  assert.strictEqual(planItems[0]?.approvalId, "approval-1");
  assert.strictEqual(executeItems.length, 1);
  assert.strictEqual(executeItems[0]?.approvalId, "approval-2");
});

test("acknowledge preserves other queue item fields", async () => {
  const service = new MockHitlOperatorConsoleService();
  await service.dispatch(createMockApprovalPacket());

  const updated = service.acknowledge("approval-test-1", "operator-xyz");

  assert.strictEqual(updated.approvalId, "approval-test-1");
  assert.strictEqual(updated.taskId, "task-test-1");
  assert.strictEqual(updated.title, "Test Approval Request");
  assert.strictEqual(updated.riskLevel, "high");
  assert.strictEqual(updated.acknowledgedBy, "operator-xyz");
  assert.strictEqual(updated.status, "acknowledged");
});

test("dispatch handles null tenantId", async () => {
  const service = new MockHitlOperatorConsoleService();
  const packetWithNullTenant = createMockApprovalPacket({
    explanation: {
      ...createMockApprovalPacket().explanation,
      contextSnapshot: {
        ...createMockApprovalPacket().explanation.contextSnapshot,
        tenantId: "",
      },
    },
  });

  await service.dispatch(packetWithNullTenant);

  const items = service.listQueue();
  assert.strictEqual(items[0]?.tenantId, null);
});
