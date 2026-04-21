import { createAuthoritativeTaskStoreRepositories, } from "./authoritative-task-store-repositories.js";
import { AuthoritativeTaskStoreLegacyCompat, } from "./authoritative-task-store-legacy-compat.js";
export class AuthoritativeTaskStoreDelegatingBase extends AuthoritativeTaskStoreLegacyCompat {
    db;
    repositorySet;
    constructor(db) {
        super();
        this.db = db;
        this.repositorySet = createAuthoritativeTaskStoreRepositories(db);
    }
    repositories() {
        return this.repositorySet;
    }
    get task() {
        return this.repositorySet.task;
    }
    get workflow() {
        return this.repositorySet.workflow;
    }
    get execution() {
        return this.repositorySet.execution;
    }
    get session() {
        return this.repositorySet.session;
    }
    get event() {
        return this.repositorySet.event;
    }
    get worker() {
        return this.repositorySet.worker;
    }
    get approval() {
        return this.repositorySet.approval;
    }
    get billing() {
        return this.repositorySet.billing;
    }
    get lease() {
        return this.repositorySet.lease;
    }
    get lock() {
        return this.repositorySet.lock;
    }
    get memory() {
        return this.repositorySet.memory;
    }
    get artifact() {
        return this.repositorySet.artifact;
    }
    get dispatch() {
        return this.repositorySet.dispatch;
    }
    get division() {
        return this.repositorySet.division;
    }
    get secret() {
        return this.repositorySet.secret;
    }
    get marketplace() {
        return this.repositorySet.marketplace;
    }
    get release() {
        return this.repositorySet.release;
    }
    get organization() {
        return this.repositorySet.organization;
    }
    get intelligence() {
        return this.repositorySet.intelligence;
    }
    get evolution() {
        return this.repositorySet.evolution;
    }
    get governance() {
        return this.repositorySet.governance;
    }
    get operations() {
        return this.repositorySet.operations;
    }
    get runtimeRecovery() {
        return this.repositorySet.operations;
    }
    get views() {
        return this.repositorySet.operations;
    }
    withConnection(work) {
        return work(this.db.connection);
    }
    callRepo(repoName, methodName, ...args) {
        const repository = this.repositorySet[repoName];
        const method = repository[methodName];
        if (typeof method !== "function") {
            throw new TypeError(`Repository method ${String(repoName)}.${String(methodName)} is not callable.`);
        }
        return method.call(repository, ...args);
    }
    delegateLegacy(legacyMethod, repoName, methodName, ...args) {
        return this.callRepo(repoName, methodName, ...args);
    }
    delegateLegacyNullable(legacyMethod, repoName, methodName, ...args) {
        const result = this.callRepo(repoName, methodName, ...args);
        return (result ?? null);
    }
    delegateLegacyUndefinedable(legacyMethod, repoName, methodName, ...args) {
        const result = this.callRepo(repoName, methodName, ...args);
        return (result ?? undefined);
    }
    delegateRepo(repoName, methodName, ...args) {
        return this.callRepo(repoName, methodName, ...args);
    }
}
/* c8 ignore stop */
//# sourceMappingURL=authoritative-task-store-delegating-base.js.map