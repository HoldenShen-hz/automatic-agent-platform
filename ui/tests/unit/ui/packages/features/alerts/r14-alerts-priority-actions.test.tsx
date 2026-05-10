/**
 * R14-33: Priority sort queue - §4.7 requires priority-sorted alert queue
 * R14-34: Dismiss action - §4.7 requires acknowledge/dismiss/escalate three core actions
 *
 * These tests verify the alerts feature implements the contract requirements.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import React from "react";

// Mock the dependencies before importing the module under test
vi.mock("@aa/shared-state", () => ({
  useIncidentsQuery: vi.fn(),
  useMutation: vi.fn(() => ({
    mutate: vi.fn(),
    status: "idle",
  })),
  useWsClient: vi.fn(),
}));

vi.mock("@aa/shared-api-client", () => ({
  createRESTClient: vi.fn(() => ({})),
}));

// Import after mocks are set up
import { buildAlertsVm } from "../../../../../packages/features/alerts/src/hooks/index";
import type { IncidentDTO } from "@aa/shared-types";

const mockActions = {
  onAcknowledge: vi.fn(),
  onDismiss: vi.fn(),
  onEscalate: vi.fn(),
  onSnooze: vi.fn(),
};

const mockFilters = {
  severity: "all",
  domain: "all",
  timeRange: "all",
};

describe("R14-33: Priority sorted queue", () => {
  it("sorts incidents by severity (critical → low) as primary key", () => {
    const incidents: IncidentDTO[] = [
      { id: "low", severity: "low", title: "Low Alert", summary: "desc", createdAt: "2026-05-09T10:00:00.000Z" },
      { id: "critical", severity: "critical", title: "Critical Alert", summary: "desc", createdAt: "2026-05-09T09:00:00.000Z" },
      { id: "high", severity: "high", title: "High Alert", summary: "desc", createdAt: "2026-05-09T08:00:00.000Z" },
      { id: "medium", severity: "medium", title: "Medium Alert", summary: "desc", createdAt: "2026-05-09T07:00:00.000Z" },
    ];

    const vm = buildAlertsVm(incidents, mockFilters, [], "idle", 0, mockActions);

    // R14-33: critical comes first, then high, medium, low
    expect(vm.incidents.map((i) => i.severity)).toEqual(["critical", "high", "medium", "low"]);
  });

  it("sorts incidents by creation time (newest first) as secondary key within same severity", () => {
    const incidents: IncidentDTO[] = [
      { id: "old-high", severity: "high", title: "Old High", summary: "desc", createdAt: "2026-05-09T06:00:00.000Z" },
      { id: "new-high", severity: "high", title: "New High", summary: "desc", createdAt: "2026-05-09T08:00:00.000Z" },
      { id: "critical", severity: "critical", title: "Critical", summary: "desc", createdAt: "2026-05-09T07:00:00.000Z" },
    ];

    const vm = buildAlertsVm(incidents, mockFilters, [], "idle", 0, mockActions);

    // R14-33: critical first (highest severity), then high incidents sorted newest-first
    expect(vm.incidents[0].id).toBe("critical");
    expect(vm.incidents[1].id).toBe("new-high");
    expect(vm.incidents[2].id).toBe("old-high");
  });

  it("items array reflects the same sorted order as incidents", () => {
    const incidents: IncidentDTO[] = [
      { id: "low", severity: "low", title: "Low", summary: "desc", createdAt: "2026-05-09T10:00:00.000Z" },
      { id: "critical", severity: "critical", title: "Critical", summary: "desc", createdAt: "2026-05-09T09:00:00.000Z" },
    ];

    const vm = buildAlertsVm(incidents, mockFilters, [], "idle", 0, mockActions);

    expect(vm.items[0].id).toBe("critical");
    expect(vm.items[1].id).toBe("low");
  });

  it("handles unknown severity values by placing them last", () => {
    const incidents: IncidentDTO[] = [
      { id: "unknown", severity: "unknown-severity" as any, title: "Unknown", summary: "desc", createdAt: "2026-05-09T09:00:00.000Z" },
      { id: "critical", severity: "critical", title: "Critical", summary: "desc", createdAt: "2026-05-09T08:00:00.000Z" },
    ];

    const vm = buildAlertsVm(incidents, mockFilters, [], "idle", 0, mockActions);

    expect(vm.incidents[0].id).toBe("critical");
    expect(vm.incidents[1].id).toBe("unknown");
  });
});

describe("R14-34: Three core actions (acknowledge/dismiss/escalate)", () => {
  it("vm exposes onAcknowledge as the acknowledge action", () => {
    const vm = buildAlertsVm([], mockFilters, [], "idle", 0, mockActions);

    expect(typeof vm.onAcknowledge).toBe("function");
  });

  it("vm exposes onDismiss as the dismiss action", () => {
    const vm = buildAlertsVm([], mockFilters, [], "idle", 0, mockActions);

    expect(typeof vm.onDismiss).toBe("function");
  });

  it("vm exposes onEscalate as the escalate action", () => {
    const vm = buildAlertsVm([], mockFilters, [], "idle", 0, mockActions);

    expect(typeof vm.onEscalate).toBe("function");
  });

  it("vm exposes acknowledgeAlert as legacy alias for onAcknowledge", () => {
    const vm = buildAlertsVm([], mockFilters, [], "idle", 0, mockActions);

    expect(typeof vm.acknowledgeAlert).toBe("function");
    // R14-34: acknowledgeAlert should reference the same action as onAcknowledge
    expect(vm.acknowledgeAlert).toBe(vm.onAcknowledge);
  });

  it("vm exposes dismissAlert as legacy alias for onDismiss", () => {
    const vm = buildAlertsVm([], mockFilters, [], "idle", 0, mockActions);

    expect(typeof vm.dismissAlert).toBe("function");
    // R14-34: dismissAlert should reference the same action as onDismiss
    expect(vm.dismissAlert).toBe(vm.onDismiss);
  });

  it("all three core actions are present in the vm interface", () => {
    const vm = buildAlertsVm([], mockFilters, [], "idle", 0, mockActions);

    // R14-34: §4.7 requires acknowledge/dismiss/escalate as three core actions
    expect("onAcknowledge" in vm).toBe(true);
    expect("onDismiss" in vm).toBe(true);
    expect("onEscalate" in vm).toBe(true);
  });

  it("onEscalate is a distinct action from onAcknowledge and onDismiss", () => {
    const vm = buildAlertsVm([], mockFilters, [], "idle", 0, mockActions);

    // Each action should be a separate function reference
    expect(vm.onAcknowledge).not.toBe(vm.onDismiss);
    expect(vm.onAcknowledge).not.toBe(vm.onEscalate);
    expect(vm.onDismiss).not.toBe(vm.onEscalate);
  });
});
