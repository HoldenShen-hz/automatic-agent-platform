import {
  buildRecoveryCadence,
  type RecoveryCadence,
  type RecoveryReport,
  type RecoveryWorker,
} from "../../contracts/types/recovery-cadence.js";
import { nowIso } from "../../contracts/types/ids.js";
import type { ProjectionRebuildOptions, ProjectionRebuildResult, ProjectionRebuildService } from "../../state-evidence/projections/projection-rebuild-service.js";

export interface ProjectionRebuildWorkerOptions {
  readonly projectionRebuildService: Pick<ProjectionRebuildService, "rebuildAll">;
  readonly rebuildOptions?: ProjectionRebuildOptions;
  readonly workerId?: string;
  readonly cadence?: Partial<RecoveryCadence> & Pick<RecoveryCadence, "intervalMs">;
  readonly now?: () => string;
}

export class ProjectionRebuildWorker implements RecoveryWorker {
  private readonly cadence: RecoveryCadence;
  private readonly now: () => string;

  public constructor(private readonly options: ProjectionRebuildWorkerOptions) {
    this.cadence = buildRecoveryCadence({
      intervalMs: options.cadence?.intervalMs ?? 300_000,
      maxConcurrent: options.cadence?.maxConcurrent ?? 1,
      priority: options.cadence?.priority ?? "normal",
    });
    this.now = options.now ?? nowIso;
  }

  public getWorkerId(): string {
    return this.options.workerId ?? "projection-rebuild-worker";
  }

  public getRecoveryCadence(): RecoveryCadence {
    return this.cadence;
  }

  public async runRecoveryCycle(): Promise<RecoveryReport> {
    const startedAt = this.now();
    const startedMs = Date.now();

    try {
      // §R16-32: rebuildAll is now async and uses shadow-build pattern
      const results = await this.options.projectionRebuildService.rebuildAll(this.options.rebuildOptions);
      const entries = [...results.entries()];
      const totals = entries.reduce((accumulator, [, result]) => ({
        eventsProcessed: accumulator.eventsProcessed + result.eventsProcessed,
        projectionsUpdated: accumulator.projectionsUpdated + result.projectionsUpdated,
        errors: accumulator.errors.concat(result.errors),
      }), { eventsProcessed: 0, projectionsUpdated: 0, errors: [] as string[] });

      return {
        workerId: this.getWorkerId(),
        workerType: "projection_rebuild",
        startedAt,
        completedAt: this.now(),
        durationMs: Date.now() - startedMs,
        itemsProcessed: totals.eventsProcessed,
        itemsRecovered: totals.projectionsUpdated,
        errors: totals.errors.map((message) => ({
          code: "projection_rebuild.error",
          message,
        })),
        metadata: {
          projectionCount: entries.length,
          projections: Object.fromEntries(entries.map(([name, result]: [string, ProjectionRebuildResult]) => [
            name,
            {
              eventsProcessed: result.eventsProcessed,
              projectionsUpdated: result.projectionsUpdated,
              eventsSkipped: result.eventsSkipped,
            },
          ])),
        },
      };
    } catch (error) {
      return {
        workerId: this.getWorkerId(),
        workerType: "projection_rebuild",
        startedAt,
        completedAt: this.now(),
        durationMs: Date.now() - startedMs,
        itemsProcessed: 0,
        itemsRecovered: 0,
        errors: [{
          code: "projection_rebuild.cycle_failed",
          message: error instanceof Error ? error.message : String(error),
        }],
      };
    }
  }
}
