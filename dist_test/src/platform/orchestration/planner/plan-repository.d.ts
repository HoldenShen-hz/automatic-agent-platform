import type { Plan } from "../oapeflir/types/index.js";
export declare class PlanRepository {
    private readonly plansByTask;
    save(plan: Plan): void;
    listByTask(taskId: string): Plan[];
    latest(taskId: string): Plan | null;
}
