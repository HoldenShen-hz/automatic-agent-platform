import { nowIso } from "../contracts/types/ids.js";

export interface ExecutionBudgetSnapshot {
  readonly domainId: string;
  readonly dateKey: string;
  readonly triggerCount: number;
  readonly executionCount: number;
  readonly totalCostUsd: number;
}

export interface ExecutionBudgetDecision {
  readonly allowed: boolean;
  readonly reasonCode: string | null;
  readonly snapshot: ExecutionBudgetSnapshot;
}

interface DomainBudgetState {
  triggerCount: number;
  executionCount: number;
  totalCostUsd: number;
}

function toDateKey(occurredAt: string): string {
  return occurredAt.slice(0, 10);
}

export class ExecutionBudgetRegistry {
  private readonly stateByDomainDay = new Map<string, DomainBudgetState>();

  public evaluateDomainBudget(
    domainId: string,
    occurredAt: string = nowIso(),
    dailyBudget?: number | null,
  ): ExecutionBudgetDecision {
    const dateKey = toDateKey(occurredAt);
    const snapshot = this.buildSnapshot(domainId, dateKey);
    if (dailyBudget != null && snapshot.triggerCount + snapshot.executionCount >= dailyBudget) {
      return {
        allowed: false,
        reasonCode: "execution_budget_registry.domain_budget_exhausted",
        snapshot,
      };
    }
    return {
      allowed: true,
      reasonCode: null,
      snapshot,
    };
  }

  public recordTrigger(domainId: string, occurredAt: string = nowIso()): ExecutionBudgetSnapshot {
    const dateKey = toDateKey(occurredAt);
    const state = this.getOrCreateState(domainId, dateKey);
    state.triggerCount += 1;
    return this.buildSnapshot(domainId, dateKey);
  }

  public recordExecution(domainId: string, costUsd: number, occurredAt: string = nowIso()): ExecutionBudgetSnapshot {
    const dateKey = toDateKey(occurredAt);
    const state = this.getOrCreateState(domainId, dateKey);
    state.executionCount += 1;
    state.totalCostUsd = Number((state.totalCostUsd + Math.max(0, costUsd)).toFixed(6));
    return this.buildSnapshot(domainId, dateKey);
  }

  public getSnapshot(domainId: string, occurredAt: string = nowIso()): ExecutionBudgetSnapshot {
    return this.buildSnapshot(domainId, toDateKey(occurredAt));
  }

  private buildSnapshot(domainId: string, dateKey: string): ExecutionBudgetSnapshot {
    const key = this.buildKey(domainId, dateKey);
    const state = this.stateByDomainDay.get(key) ?? { triggerCount: 0, executionCount: 0, totalCostUsd: 0 };
    return {
      domainId,
      dateKey,
      triggerCount: state.triggerCount,
      executionCount: state.executionCount,
      totalCostUsd: state.totalCostUsd,
    };
  }

  private getOrCreateState(domainId: string, dateKey: string): DomainBudgetState {
    const key = this.buildKey(domainId, dateKey);
    let state = this.stateByDomainDay.get(key);
    if (state == null) {
      state = {
        triggerCount: 0,
        executionCount: 0,
        totalCostUsd: 0,
      };
      this.stateByDomainDay.set(key, state);
    }
    return state;
  }

  private buildKey(domainId: string, dateKey: string): string {
    return `${domainId}:${dateKey}`;
  }
}
