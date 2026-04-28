import type { Plan } from "../oapeflir/types/index.js";

export class PlanRepository {
  private readonly plansByTask = new Map<string, Plan[]>();

  public save(plan: Plan): void {
    const existing = this.plansByTask.get(plan.taskId) ?? [];
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
