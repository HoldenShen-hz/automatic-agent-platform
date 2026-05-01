import type { HarnessRunRuntimeState } from "../index.js";
import { DurableHarnessService } from "./durable-harness-service.js";

export class HarnessSleepScheduler {
  private timer: NodeJS.Timeout | null = null;

  public constructor(
    private readonly durableService: DurableHarnessService,
    private readonly onDueRun?: (run: HarnessRunRuntimeState) => void,
  ) {}

  public pollDueRuns(referenceTime?: string): HarnessRunRuntimeState[] {
    const leases = this.durableService.listDueSleepLeases(referenceTime);
    const dueRuns = leases
      .map((lease) => this.durableService.restore(lease.runId))
      .filter((run): run is HarnessRunRuntimeState =>
        run != null && run.status === "paused" && run.pauseReason === "sleep" && run.sleepLease != null,
      );

    for (const run of dueRuns) {
      this.onDueRun?.(run);
    }

    return dueRuns;
  }

  public start(intervalMs = 1_000): void {
    if (this.timer != null) {
      return;
    }
    this.timer = setInterval(() => {
      this.pollDueRuns();
    }, intervalMs);
    this.timer.unref?.();
  }

  public stop(): void {
    if (this.timer != null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
