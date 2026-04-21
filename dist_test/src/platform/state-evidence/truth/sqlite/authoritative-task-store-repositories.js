import { dirname, join } from "node:path";
import { SessionDualStorageService } from "../session-dual-storage.js";
import { ApprovalRepository } from "./repositories/approval-repository.js";
import { ArtifactRepository } from "./repositories/artifact-repository.js";
import { BillingRepository } from "./repositories/billing-repository.js";
import { DispatchRepository } from "./repositories/dispatch-repository.js";
import { DivisionRepository } from "./repositories/division-repository.js";
import { EventRepository } from "./repositories/event-repository.js";
import { EvolutionRepository } from "./repositories/evolution-repository.js";
import { ExecutionRepository } from "./repositories/execution-repository.js";
import { IntelligenceRepository } from "./repositories/intelligence-repository.js";
import { LeaseRepository } from "./repositories/lease-repository.js";
import { LockRepository } from "./repositories/lock-repository.js";
import { MarketplaceRepository } from "./repositories/marketplace-repository.js";
import { MemoryRepository } from "./repositories/memory-repository.js";
import { OperationsRepository } from "./repositories/operations-repository.js";
import { OrganizationRepository } from "./repositories/organization-repository.js";
import { ReleaseRepository } from "./repositories/release-repository.js";
import { SecretRepository } from "./repositories/secret-repository.js";
import { SessionRepository } from "./repositories/session-repository.js";
import { TaskRepository } from "./repositories/task-repository.js";
import { WorkerRepository } from "./repositories/worker-repository.js";
import { WorkflowRepository } from "./repositories/workflow-repository.js";
export function createAuthoritativeTaskStoreRepositories(db) {
    const conn = db.connection;
    const operations = new OperationsRepository(db);
    const sessionDualStorage = resolveSessionDualStorage(db);
    return {
        task: new TaskRepository(conn),
        workflow: new WorkflowRepository(conn),
        execution: new ExecutionRepository(conn),
        session: new SessionRepository(conn, sessionDualStorage),
        event: new EventRepository(conn),
        worker: new WorkerRepository(conn),
        approval: new ApprovalRepository(conn),
        billing: new BillingRepository(conn),
        lease: new LeaseRepository(conn),
        lock: new LockRepository(conn),
        memory: new MemoryRepository(conn),
        artifact: new ArtifactRepository(conn),
        dispatch: new DispatchRepository(conn),
        division: new DivisionRepository(conn),
        secret: new SecretRepository(db),
        marketplace: new MarketplaceRepository(db),
        release: new ReleaseRepository(db),
        organization: new OrganizationRepository(db),
        intelligence: new IntelligenceRepository(db),
        evolution: new EvolutionRepository(db),
        governance: operations,
        operations,
    };
}
function resolveSessionDualStorage(db) {
    if (db.filePath === ":memory:") {
        return null;
    }
    return new SessionDualStorageService({
        jsonlRootDir: join(dirname(db.filePath), "session-replay"),
    });
}
//# sourceMappingURL=authoritative-task-store-repositories.js.map