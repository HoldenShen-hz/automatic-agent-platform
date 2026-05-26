import type { FencingTokenService } from "../../../scale-ecosystem/multi-region/fencing-token-service.js";
import type { ExecutionLeaseLeadershipDecision, ExecutionLeaseLeadershipGuard } from "./types.js";

export interface MultiRegionExecutionLeaseLeadershipGuardOptions {
  readonly fencingTokenService: FencingTokenService;
  readonly workerRegionResolver: (workerId: string, executionId: string) => string | null;
  readonly leadershipEntityId?: string | null;
}

export class MultiRegionExecutionLeaseLeadershipGuard implements ExecutionLeaseLeadershipGuard {
  private readonly leadershipEntityId: string | null;

  public constructor(private readonly options: MultiRegionExecutionLeaseLeadershipGuardOptions) {
    this.leadershipEntityId = options.leadershipEntityId ?? "global";
  }

  public validateLeaseAcquisition(input: {
    executionId: string;
    workerId: string;
    occurredAt: string;
  }): ExecutionLeaseLeadershipDecision {
    return this.evaluate(input.executionId, input.workerId);
  }

  public validateWriteAccess(input: {
    executionId: string;
    workerId: string;
    occurredAt: string;
  }): ExecutionLeaseLeadershipDecision {
    return this.evaluate(input.executionId, input.workerId);
  }

  private evaluate(executionId: string, workerId: string): ExecutionLeaseLeadershipDecision {
    const leader = this.options.fencingTokenService.getLeadership(this.leadershipEntityId);
    if (leader == null || !leader.isActive) {
      return { allowed: true, reasonCode: null };
    }
    const workerRegionId = this.options.workerRegionResolver(workerId, executionId);
    if (workerRegionId == null || workerRegionId === leader.regionId) {
      return { allowed: true, reasonCode: null };
    }
    return {
      allowed: false,
      reasonCode: "leader_region_mismatch",
    };
  }
}
