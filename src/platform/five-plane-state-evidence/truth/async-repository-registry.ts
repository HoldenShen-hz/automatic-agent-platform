import type { AsyncSqlConnection, AsyncSqlDatabase } from "./async-sql-database.js";
import {
  AsyncApprovalRepository,
  AsyncArtifactRepository,
  AsyncBillingRepository,
  AsyncCostManagementRepository,
  AsyncDelegationRepository,
  AsyncDispatchRepository,
  AsyncDivisionRepository,
  AsyncEventRepository,
  AsyncEvolutionRepository,
  AsyncExecutionRepository,
  AsyncIntelligenceRepository,
  AsyncLeaseRepository,
  AsyncLockRepository,
  AsyncMarketplaceListingRepository,
  AsyncMarketplaceRepository,
  AsyncMemoryRepository,
  AsyncOperationsRepository,
  AsyncOrganizationRepository,
  AsyncPromptRepository,
  AsyncReleaseRepository,
  AsyncSecretRepository,
  AsyncSessionRepository,
  AsyncTaskRepository,
  AsyncTenantRepository,
  AsyncWorkerRepository,
  AsyncWorkflowRepository,
} from "./async-repositories/index.js";

export interface AsyncRepositoryRegistry {
  readonly approval: AsyncApprovalRepository;
  readonly artifact: AsyncArtifactRepository;
  readonly billing: AsyncBillingRepository;
  readonly costManagement: AsyncCostManagementRepository;
  readonly delegation: AsyncDelegationRepository;
  readonly dispatch: AsyncDispatchRepository;
  readonly division: AsyncDivisionRepository;
  readonly event: AsyncEventRepository;
  readonly evolution: AsyncEvolutionRepository;
  readonly execution: AsyncExecutionRepository;
  readonly intelligence: AsyncIntelligenceRepository;
  readonly lease: AsyncLeaseRepository;
  readonly lock: AsyncLockRepository;
  readonly marketplace: AsyncMarketplaceRepository;
  readonly marketplaceListing: AsyncMarketplaceListingRepository;
  readonly memory: AsyncMemoryRepository;
  readonly operations: AsyncOperationsRepository;
  readonly organization: AsyncOrganizationRepository;
  readonly prompt: AsyncPromptRepository;
  readonly release: AsyncReleaseRepository;
  readonly secret: AsyncSecretRepository;
  readonly session: AsyncSessionRepository;
  readonly task: AsyncTaskRepository;
  readonly tenant: AsyncTenantRepository;
  readonly worker: AsyncWorkerRepository;
  readonly workflow: AsyncWorkflowRepository;
}

function isAsyncSqlDatabase(target: AsyncSqlDatabase | AsyncSqlConnection): target is AsyncSqlDatabase {
  const candidate = target as Partial<AsyncSqlDatabase>;
  return typeof candidate.transaction === "function"
    && typeof candidate.readTransaction === "function"
    && typeof candidate.migrate === "function"
    && candidate.asyncConnection != null;
}

function resolveConnection(target: AsyncSqlDatabase | AsyncSqlConnection): AsyncSqlConnection {
  return isAsyncSqlDatabase(target) ? target.asyncConnection : target;
}

export function createAsyncRepositoryRegistry(target: AsyncSqlDatabase | AsyncSqlConnection): AsyncRepositoryRegistry {
  const conn = resolveConnection(target);
  return {
    approval: new AsyncApprovalRepository(conn),
    artifact: new AsyncArtifactRepository(conn),
    billing: new AsyncBillingRepository(conn),
    costManagement: new AsyncCostManagementRepository(conn),
    delegation: new AsyncDelegationRepository(conn),
    dispatch: new AsyncDispatchRepository(conn),
    division: new AsyncDivisionRepository(conn),
    event: new AsyncEventRepository(conn),
    evolution: new AsyncEvolutionRepository(conn),
    execution: new AsyncExecutionRepository(conn),
    intelligence: new AsyncIntelligenceRepository(conn),
    lease: new AsyncLeaseRepository(conn),
    lock: new AsyncLockRepository(conn),
    marketplace: new AsyncMarketplaceRepository(conn),
    marketplaceListing: new AsyncMarketplaceListingRepository(conn),
    memory: new AsyncMemoryRepository(conn),
    operations: new AsyncOperationsRepository(conn),
    organization: new AsyncOrganizationRepository(conn),
    prompt: new AsyncPromptRepository(conn),
    release: new AsyncReleaseRepository(conn),
    secret: new AsyncSecretRepository(conn),
    session: new AsyncSessionRepository(conn),
    task: new AsyncTaskRepository(conn),
    tenant: new AsyncTenantRepository(conn),
    worker: new AsyncWorkerRepository(conn),
    workflow: new AsyncWorkflowRepository(conn),
  };
}
