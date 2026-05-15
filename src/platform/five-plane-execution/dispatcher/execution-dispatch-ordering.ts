import type { ExecutionTicketRecord, TaskPriority } from "../../contracts/types/domain.js";

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

export function sortTicketsForDeterministicDispatch(
  tickets: ExecutionTicketRecord[],
): ExecutionTicketRecord[] {
  return [...tickets].sort((left, right) => {
    const leftRank = left.criticalPathRank ?? 0;
    const rightRank = right.criticalPathRank ?? 0;
    if (leftRank !== rightRank) {
      return rightRank - leftRank;
    }

    const leftPriority = PRIORITY_ORDER[left.priority] ?? 0;
    const rightPriority = PRIORITY_ORDER[right.priority] ?? 0;
    if (leftPriority !== rightPriority) {
      return rightPriority - leftPriority;
    }

    const leftRisk = RISK_CLASS_ORDER[left.riskClass ?? "low"] ?? 0;
    const rightRisk = RISK_CLASS_ORDER[right.riskClass ?? "low"] ?? 0;
    if (leftRisk !== rightRisk) {
      return rightRisk - leftRisk;
    }

    const leftSeed = left.schedulerSeed ?? "";
    const rightSeed = right.schedulerSeed ?? "";
    return leftSeed.localeCompare(rightSeed);
  });
}

export function interleaveTicketsByTenant(
  tickets: ExecutionTicketRecord[],
  maxBurstPerTenant = 3,
): ExecutionTicketRecord[] {
  if (tickets.length <= 1) {
    return tickets;
  }

  const byTenant = new Map<string, ExecutionTicketRecord[]>();
  for (const ticket of tickets) {
    const tenant = ticket.tenantId ?? "default";
    const group = byTenant.get(tenant) ?? [];
    group.push(ticket);
    byTenant.set(tenant, group);
  }

  const result: ExecutionTicketRecord[] = [];
  const tenantIterators = new Map<string, Iterator<ExecutionTicketRecord>>();
  for (const [tenant, group] of byTenant) {
    tenantIterators.set(tenant, group[Symbol.iterator]());
  }

  let progress = true;
  while (progress) {
    progress = false;
    for (const [tenant, iter] of tenantIterators) {
      let burst = 0;
      let next: IteratorResult<ExecutionTicketRecord>;
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

export function hashDispatchSeed(seed: string): number {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = ((hash * 31) + seed.charCodeAt(index)) >>> 0;
  }
  return hash;
}
