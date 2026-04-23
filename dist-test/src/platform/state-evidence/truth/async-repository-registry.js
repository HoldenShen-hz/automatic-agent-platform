import { AsyncApprovalRepository, AsyncArtifactRepository, AsyncBillingRepository, AsyncCostManagementRepository, AsyncDelegationRepository, AsyncDispatchRepository, AsyncDivisionRepository, AsyncEventRepository, AsyncEvolutionRepository, AsyncExecutionRepository, AsyncIntelligenceRepository, AsyncLeaseRepository, AsyncLockRepository, AsyncMarketplaceListingRepository, AsyncMarketplaceRepository, AsyncMemoryRepository, AsyncOperationsRepository, AsyncOrganizationRepository, AsyncPromptRepository, AsyncReleaseRepository, AsyncSecretRepository, AsyncSessionRepository, AsyncTaskRepository, AsyncTenantRepository, AsyncWorkerRepository, AsyncWorkflowRepository, } from "./async-repositories/index.js";
function resolveConnection(target) {
    return "asyncConnection" in target ? target.asyncConnection : target;
}
export function createAsyncRepositoryRegistry(target) {
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
//# sourceMappingURL=async-repository-registry.js.map