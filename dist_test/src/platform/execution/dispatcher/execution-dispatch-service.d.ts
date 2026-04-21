import { AuthoritativeTaskStore } from "../../state-evidence/truth/authoritative-task-store.js";
import type { AuthoritativeSqlDatabase } from "../../state-evidence/truth/authoritative-sql-database.js";
import type { AdmissionBackpressureSnapshot } from "./admission-controller.js";
import { type CreateExecutionTicketInput, type DispatchExecutionDecision, type DispatchExecutionOptions, type DispatchQueueAvailabilitySnapshot, type ExecutionTicketDecision } from "./execution-dispatch-support.js";
export type { CreateExecutionTicketInput, DispatchExecutionDecision, DispatchExecutionOptions, DispatchQueueAvailabilitySnapshot, ExecutionTicketDecision, } from "./execution-dispatch-support.js";
export declare class ExecutionDispatchService {
    private readonly db;
    private readonly store;
    private readonly backpressureSnapshot;
    private readonly queueAvailabilitySnapshot;
    private readonly leases;
    private readonly preemption;
    private readonly workers;
    constructor(db: AuthoritativeSqlDatabase, store: AuthoritativeTaskStore, backpressureSnapshot?: (() => AdmissionBackpressureSnapshot | null) | null, queueAvailabilitySnapshot?: (() => DispatchQueueAvailabilitySnapshot | null) | null);
    createTicket(input: CreateExecutionTicketInput): ExecutionTicketDecision;
    dispatchNext(options: DispatchExecutionOptions): DispatchExecutionDecision;
    private evaluateWorkersForTicket;
    private rankWorkerEvaluations;
    private selectWorkersForDispatch;
    private toWorkerEvaluation;
    private recordDecisionEvent;
    private upsertAgentExecutionRecord;
}
