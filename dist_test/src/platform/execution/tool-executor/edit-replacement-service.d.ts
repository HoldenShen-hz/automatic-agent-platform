import { AuthoritativeTaskStore } from "../../state-evidence/truth/authoritative-task-store.js";
import type { AuthoritativeSqlDatabase } from "../../state-evidence/truth/authoritative-sql-database.js";
import { CodeDiagnosticsService } from "./code-diagnostics-service.js";
import type { EditBatchRequest, EditBatchResult, EditReplacementRequest, EditReplacementResult } from "./edit-replacement/edit-replacement-types.js";
export type { EditBatchData, EditBatchItemResult, EditBatchMetadata, EditBatchRequest, EditBatchResult, EditInstruction, EditReplacementAttempt, EditReplacementAttemptLevel, EditReplacementData, EditReplacementMetadata, EditReplacementRequest, EditReplacementResult, } from "./edit-replacement/edit-replacement-types.js";
export declare class EditReplacementService {
    private readonly db;
    private readonly store;
    private readonly diagnosticsService;
    /**
     * Creates a new EditReplacementService.
     *
     * @param db - SQLite database for transaction support and lock management
     * @param store - AuthoritativeTaskStore for file lock CRUD operations
     */
    constructor(db: AuthoritativeSqlDatabase, store: AuthoritativeTaskStore, diagnosticsService?: CodeDiagnosticsService);
    /**
     * Executes an edit replacement operation on a file.
     *
     * @param request - Edit replacement request with file path and string specifications
     * @returns EditReplacementResult with status, attempts, and diagnostics
     */
    execute(request: EditReplacementRequest): EditReplacementResult;
    executeBatch(request: EditBatchRequest): EditBatchResult;
    private prepareEdit;
    /**
     * Evaluates all matching stages in sequence, stopping at the first unique match
     * or when a stage produces multiple candidates (ambiguous).
     *
     * @param content - Current file content
     * @param request - Original edit request
     * @returns StageEvaluation with all attempts and final outcome
     */
    private blocked;
    private timedOut;
    /**
     * Creates a failed result with error details.
     */
    private failed;
    private blockedBatch;
    private timedOutBatch;
    private failedBatch;
    private hasTimedOut;
    private collectDiagnostics;
}
