import type { Plan } from "../oapeflir/types/index.js";

export class PlanRepository {
  private readonly plansByTask = new Map<string, Plan[]>();

  public save(plan: Plan): void {
    const existing = this.plansByTask.get(plan.taskId) ?? [];
    // R29-10 fix: Deduplicate by version to prevent saving the same plan version twice.
    const versionExists = existing.some((p) => p.version === plan.version);
    if (versionExists) {
      return;
    }
    existing.push(plan);
    existing.sort((left, right) => left.version - right.version);
    this.plansByTask.set(plan.taskId, existing);
  }

  public listByTask(taskId: string): Plan[] {
    return [...(this.plansByTask.get(taskId) ?? [])];
  }

  public latest(taskId: string): Plan | null {
    const plans = this.plansByTask.get(taskId) ?? [];
    return plans.at(-1) ?? null;
  }
}
