import type { AsyncSqlConnection, AsyncSqlDatabase } from "./async-sql-database.js";
import {
  AsyncApprovalRepository,
  AsyncArtifactRepository,
  AsyncBillingRepository,
  AsyncDispatchRepository,
  AsyncDivisionRepository,
  AsyncEventRepository,
  AsyncEvolutionRepository,
  AsyncExecutionRepository,
  AsyncIntelligenceRepository,
  AsyncLeaseRepository,
  AsyncLockRepository,
  AsyncMarketplaceRepository,
  AsyncMemoryRepository,
  AsyncOperationsRepository,
  AsyncOrganizationRepository,
  AsyncReleaseRepository,
  AsyncSecretRepository,
  AsyncSessionRepository,
  AsyncTaskRepository,
  AsyncWorkerRepository,
  AsyncWorkflowRepository,
} from "./async-repositories/index.js";

export interface AsyncRepositoryRegistry {
  readonly approval: AsyncApprovalRepository;
  readonly artifact: AsyncArtifactRepository;
  readonly billing: AsyncBillingRepository;
  readonly dispatch: AsyncDispatchRepository;
  readonly division: AsyncDivisionRepository;
  readonly event: AsyncEventRepository;
  readonly evolution: AsyncEvolutionRepository;
  readonly execution: AsyncExecutionRepository;
  readonly intelligence: AsyncIntelligenceRepository;
  readonly lease: AsyncLeaseRepository;
  readonly lock: AsyncLockRepository;
  readonly marketplace: AsyncMarketplaceRepository;
  readonly memory: AsyncMemoryRepository;
  readonly operations: AsyncOperationsRepository;
  readonly organization: AsyncOrganizationRepository;
  readonly release: AsyncReleaseRepository;
  readonly secret: AsyncSecretRepository;
  readonly session: AsyncSessionRepository;
  readonly task: AsyncTaskRepository;
  readonly worker: AsyncWorkerRepository;
  readonly workflow: AsyncWorkflowRepository;
}

function resolveConnection(target: AsyncSqlDatabase | AsyncSqlConnection): AsyncSqlConnection {
  return "asyncConnection" in target ? target.asyncConnection : target;
}

export function createAsyncRepositoryRegistry(target: AsyncSqlDatabase | AsyncSqlConnection): AsyncRepositoryRegistry {
  const conn = resolveConnection(target);
  return {
    approval: new AsyncApprovalRepository(conn),
    artifact: new AsyncArtifactRepository(conn),
    billing: new AsyncBillingRepository(conn),
    dispatch: new AsyncDispatchRepository(conn),
    division: new AsyncDivisionRepository(conn),
    event: new AsyncEventRepository(conn),
    evolution: new AsyncEvolutionRepository(conn),
    execution: new AsyncExecutionRepository(conn),
    intelligence: new AsyncIntelligenceRepository(conn),
    lease: new AsyncLeaseRepository(conn),
    lock: new AsyncLockRepository(conn),
    marketplace: new AsyncMarketplaceRepository(conn),
    memory: new AsyncMemoryRepository(conn),
    operations: new AsyncOperationsRepository(conn),
    organization: new AsyncOrganizationRepository(conn),
    release: new AsyncReleaseRepository(conn),
    secret: new AsyncSecretRepository(conn),
    session: new AsyncSessionRepository(conn),
    task: new AsyncTaskRepository(conn),
    worker: new AsyncWorkerRepository(conn),
    workflow: new AsyncWorkflowRepository(conn),
  };
}
