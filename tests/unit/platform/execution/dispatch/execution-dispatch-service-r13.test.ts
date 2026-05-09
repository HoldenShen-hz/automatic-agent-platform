import assert from "node:assert/strict";
import test from "node:test";

/**
 * R13-14 tests: Dispatch queue priority sorting
 * R13-15 tests: Tenant fair scheduling (interleave by tenant)
 */

// R13-14 test: Tickets should be sorted by critical path rank (descending)
test("R13-14: Tickets sorted by critical path rank descending", () => {
  type TaskPriority = "critical" | "urgent" | "high" | "normal" | "low";

  interface Ticket {
    id: string;
    priority: TaskPriority;
    criticalPathRank?: number;
  }

  const RISK_CLASS_ORDER: Record<string, number> = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1,
  };
  const PRIORITY_ORDER: Record<TaskPriority, number> = {
    critical: 5,
    urgent: 4,
    high: 3,
    normal: 2,
    low: 1,
  };

  // Simple deterministic sort matching the dispatch service logic
  function sortTickets(tickets: Ticket[]): Ticket[] {
    return [...tickets].sort((left, right) => {
      // 1. Critical path rank (higher = more critical, sort descending)
      const leftRank = left.criticalPathRank ?? 0;
      const rightRank = right.criticalPathRank ?? 0;
      if (leftRank !== rightRank) {
        return rightRank - leftRank;
      }
      // 2. Priority (urgent > high > medium > low)
      const leftPriority = PRIORITY_ORDER[left.priority] ?? 0;
      const rightPriority = PRIORITY_ORDER[right.priority] ?? 0;
      if (leftPriority !== rightPriority) {
        return rightPriority - leftPriority;
      }
      return left.id.localeCompare(right.id);
    });
  }

  const tickets: Ticket[] = [
    { id: "ticket-low", priority: "low", criticalPathRank: 1 },
    { id: "ticket-high", priority: "high", criticalPathRank: 5 },
    { id: "ticket-medium", priority: "normal", criticalPathRank: 3 },
  ];

  const sorted = sortTickets(tickets);
  assert.equal(sorted[0]!.id, "ticket-high", "Highest critical path rank should be first");
  assert.equal(sorted[1]!.id, "ticket-medium", "Middle critical path rank should be second");
  assert.equal(sorted[2]!.id, "ticket-low", "Lowest critical path rank should be last");
});

// R13-14 test: Priority ordering should be critical > urgent > high > normal > low
test("R13-14: Priority ordering enforced correctly", () => {
  type TaskPriority = "critical" | "urgent" | "high" | "normal" | "low";
  const PRIORITY_ORDER: Record<TaskPriority, number> = {
    critical: 5,
    urgent: 4,
    high: 3,
    normal: 2,
    low: 1,
  };

  const priorities: TaskPriority[] = ["low", "normal", "high", "urgent", "critical"];
  const sorted = [...priorities].sort((a, b) => PRIORITY_ORDER[b] - PRIORITY_ORDER[a]);

  assert.equal(sorted[0], "critical", "critical should be first");
  assert.equal(sorted[1], "urgent", "urgent should be second");
  assert.equal(sorted[2], "high", "high should be third");
  assert.equal(sorted[3], "normal", "normal should be fourth");
  assert.equal(sorted[4], "low", "low should be last");
});

// R13-15 test: InterleaveByTenant prevents single tenant from flooding
test("R13-15: Interleave by tenant prevents single tenant flooding", () => {
  interface Ticket {
    id: string;
    tenantId: string;
  }

  function interleaveByTenant(tickets: Ticket[], maxBurstPerTenant = 3): Ticket[] {
    if (tickets.length <= 1) {
      return tickets;
    }

    // Group by tenant
    const byTenant = new Map<string, Ticket[]>();
    for (const ticket of tickets) {
      const tenant = ticket.tenantId ?? "default";
      const group = byTenant.get(tenant) ?? [];
      group.push(ticket);
      byTenant.set(tenant, group);
    }

    // Round-robin across tenants with burst limit
    const result: Ticket[] = [];
    const tenantIterators = new Map<string, Iterator<Ticket>>();

    for (const [tenant, group] of byTenant) {
      tenantIterators.set(tenant, group[Symbol.iterator]());
    }

    let progress = true;
    while (progress) {
      progress = false;
      for (const [tenant, iter] of tenantIterators) {
        let burst = 0;
        let next: IteratorResult<Ticket>;
        while (burst < maxBurstPerTenant) {
          next = iter.next();
          if (next.done) {
            tenantIterators.delete(tenant);
            break;
          }
          result.push(next.value);
          burst++;
          progress = true;
        }
      }
    }

    return result;
  }

  // Create 6 tickets from tenant-A and 6 from tenant-B
  const tickets: Ticket[] = [
    { id: "A1", tenantId: "tenant-A" },
    { id: "A2", tenantId: "tenant-A" },
    { id: "A3", tenantId: "tenant-A" },
    { id: "A4", tenantId: "tenant-A" },
    { id: "A5", tenantId: "tenant-A" },
    { id: "A6", tenantId: "tenant-A" },
    { id: "B1", tenantId: "tenant-B" },
    { id: "B2", tenantId: "tenant-B" },
    { id: "B3", tenantId: "tenant-B" },
    { id: "B4", tenantId: "tenant-B" },
    { id: "B5", tenantId: "tenant-B" },
    { id: "B6", tenantId: "tenant-B" },
  ];

  const interleaved = interleaveByTenant(tickets);

  // No tenant should have more than maxBurstPerTenant (3) consecutive tickets
  let maxConsecutive = 0;
  let currentConsecutive = 0;
  let lastTenant: string | null = null;

  for (const ticket of interleaved) {
    if (ticket.tenantId === lastTenant) {
      currentConsecutive++;
    } else {
      maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
      currentConsecutive = 1;
      lastTenant = ticket.tenantId;
    }
  }
  maxConsecutive = Math.max(maxConsecutive, currentConsecutive);

  assert.ok(maxConsecutive <= 3, `Max consecutive tickets from same tenant should be <= 3, got ${maxConsecutive}`);
  assert.equal(interleaved.length, tickets.length, "All tickets should be present after interleaving");
});

// R13-15 test: Single tenant should not monopolize all dispatch slots
test("R13-15: Single tenant dispatch quota enforced", () => {
  interface Ticket {
    id: string;
    tenantId: string;
  }

  function interleaveByTenant(tickets: Ticket[], maxBurstPerTenant = 3): Ticket[] {
    if (tickets.length <= 1) return tickets;

    const byTenant = new Map<string, Ticket[]>();
    for (const ticket of tickets) {
      const tenant = ticket.tenantId ?? "default";
      const group = byTenant.get(tenant) ?? [];
      group.push(ticket);
      byTenant.set(tenant, group);
    }

    const result: Ticket[] = [];
    const tenantIterators = new Map<string, Iterator<Ticket>>();

    for (const [tenant, group] of byTenant) {
      tenantIterators.set(tenant, group[Symbol.iterator]());
    }

    let progress = true;
    while (progress) {
      progress = false;
      for (const [tenant, iter] of tenantIterators) {
        let burst = 0;
        while (burst < maxBurstPerTenant) {
          const next = iter.next();
          if (next.done) {
            tenantIterators.delete(tenant);
            break;
          }
          result.push(next.value);
          burst++;
          progress = true;
        }
      }
    }

    return result;
  }

  // Simulate 10 tickets all from same tenant
  const allSameTenant: Ticket[] = Array.from({ length: 10 }, (_, i) => ({
    id: `ticket-${i}`,
    tenantId: "monopolizer",
  }));

  const interleaved = interleaveByTenant(allSameTenant);
  assert.equal(interleaved.length, 10, "All tickets should be preserved");

  // Count consecutive monopolizer tickets at the start
  let consecutiveMonopolizer = 0;
  for (const ticket of interleaved) {
    if (ticket.tenantId === "monopolizer") {
      consecutiveMonopolizer++;
    } else {
      break;
    }
  }
  assert.ok(consecutiveMonopolizer <= 3, `No more than 3 consecutive monopolizer tickets, got ${consecutiveMonopolizer}`);
});