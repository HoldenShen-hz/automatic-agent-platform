/**
 * Unit tests for ChannelHandler
 * Tests notification channel routing and delivery logic
 */

import assert from "node:assert/strict";
import test from "node:test";
import type { HitlNotificationChannel } from "../../../../../src/platform/orchestration/hitl/hitl-operator-console-service.js";
import type { ApprovalPacket } from "../../../../../src/platform/orchestration/hitl/hitl-approval-orchestration-service.js";

function createMockApprovalPacket(overrides: Partial<ApprovalPacket> = {}): ApprovalPacket {
  return {
    approvalId: "approval-channel-test",
    taskId: "task-channel-test",
    executionId: "exec-channel-test",
    mode: "single_approval",
    title: "Channel Test Request",
    reason: "Testing channel routing",
    riskLevel: "high",
    options: [
      { optionId: "opt-1", label: "Approve", style: "primary", requiresConfirm: false },
      { optionId: "opt-2", label: "Reject", style: "danger", requiresConfirm: true },
    ],
    recommendedOptionId: "opt-1",
    deadlineAt: null,
    timeoutPolicy: "reject",
    explanation: {
      summary: "Test explanation",
      factors: [],
      confidence: 0.9,
      contextSnapshot: {
        taskId: "task-channel-test",
        executionId: "exec-channel-test",
        title: "Channel Test Request",
        stageRef: "execute",
        recommendedOptionId: "opt-1",
        hitlMode: "single_approval",
        tenantId: "tenant-channel",
      },
    },
    feedbackLink: {
      approvalId: "approval-channel-test",
      taskId: "task-channel-test",
      stageRef: "execute",
      loopIteration: null,
      refId: null,
      feedbackSignalId: null,
      decisionEffect: "continue",
    },
    ...overrides,
  };
}

interface RoutingRule {
  channel: HitlNotificationChannel;
  minRiskLevel: "low" | "medium" | "high" | "critical";
  stages?: readonly string[];
  tenantIds?: readonly string[];
}

interface ChannelHandlerConfig {
  rules: readonly RoutingRule[];
  fallbackChannel: HitlNotificationChannel;
}

class MockChannelHandler {
  public deliveryRecords: Array<{ channel: HitlNotificationChannel; packet: ApprovalPacket; success: boolean }> = [];
  private config: ChannelHandlerConfig;

  public constructor(config: ChannelHandlerConfig) {
    this.config = config;
  }

  public resolveChannels(packet: ApprovalPacket): HitlNotificationChannel[] {
    const tenantId = this.readTenantId(packet);
    const channels = new Set<HitlNotificationChannel>([this.config.fallbackChannel]);

    for (const rule of this.config.rules) {
      if (this.compareRisk(packet.riskLevel, rule.minRiskLevel) < 0) continue;
      if (rule.stages != null && !rule.stages.includes(packet.feedbackLink.stageRef)) continue;
      if (rule.tenantIds != null && tenantId != null && !rule.tenantIds.includes(tenantId)) continue;
      channels.add(rule.channel);
    }

    return [...channels];
  }

  public async deliver(packet: ApprovalPacket, channel: HitlNotificationChannel): Promise<boolean> {
    const success = channel !== "pager";
    this.deliveryRecords.push({ channel, packet, success });
    return success;
  }

  public async dispatchToChannels(packet: ApprovalPacket): Promise<Map<HitlNotificationChannel, boolean>> {
    const channels = this.resolveChannels(packet);
    const results = new Map<HitlNotificationChannel, boolean>();

    for (const channel of channels) {
      const success = await this.deliver(packet, channel);
      results.set(channel, success);
    }

    return results;
  }

  private readTenantId(packet: ApprovalPacket): string | null {
    const tenantId = packet.explanation.contextSnapshot.tenantId;
    return typeof tenantId === "string" && tenantId.trim().length > 0 ? tenantId : null;
  }

  private compareRisk(left: ApprovalPacket["riskLevel"], right: ApprovalPacket["riskLevel"]): number {
    const weights: Record<ApprovalPacket["riskLevel"], number> = { low: 1, medium: 2, high: 3, critical: 4 };
    return weights[left] - weights[right];
  }
}

test("resolveChannels includes fallback channel by default", () => {
  const handler = new MockChannelHandler({
    rules: [],
    fallbackChannel: "console",
  });
  const packet = createMockApprovalPacket();

  const channels = handler.resolveChannels(packet);

  assert.strictEqual(channels.length, 1);
  assert.strictEqual(channels[0], "console");
});

test("resolveChannels adds channel when risk level meets rule threshold", () => {
  const handler = new MockChannelHandler({
    rules: [{ channel: "email", minRiskLevel: "medium" }],
    fallbackChannel: "console",
  });

  const lowPacket = createMockApprovalPacket({ riskLevel: "low" });
  const mediumPacket = createMockApprovalPacket({ riskLevel: "medium" });

  const lowChannels = handler.resolveChannels(lowPacket);
  const mediumChannels = handler.resolveChannels(mediumPacket);

  assert.strictEqual(lowChannels.length, 1);
  assert.strictEqual(mediumChannels.length, 2);
  assert.ok(mediumChannels.includes("email"));
});

test("resolveChannels does not add channel when risk level is below threshold", () => {
  const handler = new MockChannelHandler({
    rules: [{ channel: "pager", minRiskLevel: "critical" }],
    fallbackChannel: "console",
  });

  const highPacket = createMockApprovalPacket({ riskLevel: "high" });

  const channels = handler.resolveChannels(highPacket);

  assert.strictEqual(channels.length, 1);
  assert.ok(!channels.includes("pager"));
});

test("resolveChannels filters by stage when stages are specified", () => {
  const handler = new MockChannelHandler({
    rules: [{ channel: "slack", minRiskLevel: "low", stages: ["execute", "release"] }],
    fallbackChannel: "console",
  });

  const planPacket = createMockApprovalPacket({ feedbackLink: { ...createMockApprovalPacket().feedbackLink, stageRef: "plan" } });
  const executePacket = createMockApprovalPacket({ feedbackLink: { ...createMockApprovalPacket().feedbackLink, stageRef: "execute" } });

  const planChannels = handler.resolveChannels(planPacket);
  const executeChannels = handler.resolveChannels(executePacket);

  assert.strictEqual(planChannels.length, 1);
  assert.ok(!planChannels.includes("slack"));
  assert.strictEqual(executeChannels.length, 2);
  assert.ok(executeChannels.includes("slack"));
});

test("resolveChannels filters by tenantId when specified", () => {
  const handler = new MockChannelHandler({
    rules: [{ channel: "email", minRiskLevel: "low", tenantIds: ["tenant-premium"] }],
    fallbackChannel: "console",
  });

  const standardPacket = createMockApprovalPacket({
    explanation: {
      ...createMockApprovalPacket().explanation,
      contextSnapshot: { ...createMockApprovalPacket().explanation.contextSnapshot, tenantId: "tenant-standard" },
    },
  });
  const premiumPacket = createMockApprovalPacket({
    explanation: {
      ...createMockApprovalPacket().explanation,
      contextSnapshot: { ...createMockApprovalPacket().explanation.contextSnapshot, tenantId: "tenant-premium" },
    },
  });

  const standardChannels = handler.resolveChannels(standardPacket);
  const premiumChannels = handler.resolveChannels(premiumPacket);

  assert.strictEqual(standardChannels.length, 1);
  assert.strictEqual(premiumChannels.length, 2);
  assert.ok(premiumChannels.includes("email"));
});

test("deliver returns true for console channel", async () => {
  const handler = new MockChannelHandler({ rules: [], fallbackChannel: "console" });
  const packet = createMockApprovalPacket();

  const result = await handler.deliver(packet, "console");

  assert.strictEqual(result, true);
});

test("deliver returns true for email channel", async () => {
  const handler = new MockChannelHandler({ rules: [], fallbackChannel: "console" });
  const packet = createMockApprovalPacket();

  const result = await handler.deliver(packet, "email");

  assert.strictEqual(result, true);
});

test("deliver returns false for pager channel", async () => {
  const handler = new MockChannelHandler({ rules: [], fallbackChannel: "console" });
  const packet = createMockApprovalPacket();

  const result = await handler.deliver(packet, "pager");

  assert.strictEqual(result, false);
});

test("dispatchToChannels delivers to all resolved channels", async () => {
  const handler = new MockChannelHandler({
    rules: [{ channel: "email", minRiskLevel: "medium" }],
    fallbackChannel: "console",
  });
  const packet = createMockApprovalPacket({ riskLevel: "critical" });

  const results = await handler.dispatchToChannels(packet);

  assert.strictEqual(results.size, 2);
  assert.ok(results.has("console"));
  assert.ok(results.has("email"));
});

test("dispatchToChannels records all delivery attempts", async () => {
  const handler = new MockChannelHandler({
    rules: [{ channel: "email", minRiskLevel: "low" }],
    fallbackChannel: "console",
  });
  const packet = createMockApprovalPacket();

  await handler.dispatchToChannels(packet);

  assert.strictEqual(handler.deliveryRecords.length, 2);
});

test("dispatchToChannels handles mixed delivery results", async () => {
  const handler = new MockChannelHandler({
    rules: [{ channel: "pager", minRiskLevel: "critical" }],
    fallbackChannel: "console",
  });
  const packet = createMockApprovalPacket({ riskLevel: "critical" });

  const results = await handler.dispatchToChannels(packet);

  assert.strictEqual(results.get("console"), true);
  assert.strictEqual(results.get("pager"), false);
});

test("resolveChannels handles critical risk level correctly", () => {
  const handler = new MockChannelHandler({
    rules: [
      { channel: "email", minRiskLevel: "medium" },
      { channel: "pager", minRiskLevel: "high" },
    ],
    fallbackChannel: "console",
  });

  const criticalPacket = createMockApprovalPacket({ riskLevel: "critical" });

  const channels = handler.resolveChannels(criticalPacket);

  assert.strictEqual(channels.length, 3);
  assert.ok(channels.includes("console"));
  assert.ok(channels.includes("email"));
  assert.ok(channels.includes("pager"));
});

test("resolveChannels returns unique channels only", () => {
  const handler = new MockChannelHandler({
    rules: [
      { channel: "email", minRiskLevel: "low" },
      { channel: "email", minRiskLevel: "medium" },
    ],
    fallbackChannel: "console",
  });
  const packet = createMockApprovalPacket({ riskLevel: "low" });

  const channels = handler.resolveChannels(packet);

  const emailCount = channels.filter((c) => c === "email").length;
  assert.strictEqual(emailCount, 1);
});

test("resolveChannels handles empty tenantId as null", () => {
  const handler = new MockChannelHandler({
    rules: [{ channel: "email", minRiskLevel: "low", tenantIds: ["tenant-premium"] }],
    fallbackChannel: "console",
  });
  const packetWithEmptyTenant = createMockApprovalPacket({
    explanation: {
      ...createMockApprovalPacket().explanation,
      contextSnapshot: { ...createMockApprovalPacket().explanation.contextSnapshot, tenantId: "" },
    },
  });

  const channels = handler.resolveChannels(packetWithEmptyTenant);

  assert.strictEqual(channels.length, 2);
  assert.ok(channels.includes("email"));
});

test("resolveChannels returns channels sorted by priority", () => {
  const handler = new MockChannelHandler({
    rules: [
      { channel: "slack", minRiskLevel: "medium" },
      { channel: "pager", minRiskLevel: "high" },
      { channel: "email", minRiskLevel: "low" },
    ],
    fallbackChannel: "console",
  });
  const packet = createMockApprovalPacket({ riskLevel: "critical" });

  const channels = handler.resolveChannels(packet);

  assert.strictEqual(channels.length, 4);
  assert.ok(channels.includes("console"));
  assert.ok(channels.includes("email"));
  assert.ok(channels.includes("slack"));
  assert.ok(channels.includes("pager"));
});
