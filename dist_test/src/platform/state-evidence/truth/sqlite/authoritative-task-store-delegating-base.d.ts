import type { AuthoritativeSqlDatabase } from "./sqlite-database.js";
import { type AuthoritativeTaskStoreRepositories } from "./authoritative-task-store-repositories.js";
import { AuthoritativeTaskStoreLegacyCompat } from "./authoritative-task-store-legacy-compat.js";
type RepositoryMethod<RepoKey extends keyof AuthoritativeTaskStoreRepositories, MethodKey extends keyof AuthoritativeTaskStoreRepositories[RepoKey]> = AuthoritativeTaskStoreRepositories[RepoKey][MethodKey] extends (...args: infer Args) => infer Result ? {
    args: Args;
    result: Result;
} : never;
type LegacyMethod<MethodKey extends keyof AuthoritativeTaskStoreLegacyCompat> = AuthoritativeTaskStoreLegacyCompat[MethodKey] extends (...args: infer Args) => infer Result ? {
    args: Args;
    result: Result;
} : never;
export declare abstract class AuthoritativeTaskStoreDelegatingBase extends AuthoritativeTaskStoreLegacyCompat {
    readonly db: AuthoritativeSqlDatabase;
    protected readonly repositorySet: AuthoritativeTaskStoreRepositories;
    constructor(db: AuthoritativeSqlDatabase);
    repositories(): AuthoritativeTaskStoreRepositories;
    get task(): AuthoritativeTaskStoreRepositories["task"];
    get workflow(): AuthoritativeTaskStoreRepositories["workflow"];
    get execution(): AuthoritativeTaskStoreRepositories["execution"];
    get session(): AuthoritativeTaskStoreRepositories["session"];
    get event(): AuthoritativeTaskStoreRepositories["event"];
    get worker(): AuthoritativeTaskStoreRepositories["worker"];
    get approval(): AuthoritativeTaskStoreRepositories["approval"];
    get billing(): AuthoritativeTaskStoreRepositories["billing"];
    get lease(): AuthoritativeTaskStoreRepositories["lease"];
    get lock(): AuthoritativeTaskStoreRepositories["lock"];
    get memory(): AuthoritativeTaskStoreRepositories["memory"];
    get artifact(): AuthoritativeTaskStoreRepositories["artifact"];
    get dispatch(): AuthoritativeTaskStoreRepositories["dispatch"];
    get division(): AuthoritativeTaskStoreRepositories["division"];
    get secret(): AuthoritativeTaskStoreRepositories["secret"];
    get marketplace(): AuthoritativeTaskStoreRepositories["marketplace"];
    get release(): AuthoritativeTaskStoreRepositories["release"];
    get organization(): AuthoritativeTaskStoreRepositories["organization"];
    get intelligence(): AuthoritativeTaskStoreRepositories["intelligence"];
    get evolution(): AuthoritativeTaskStoreRepositories["evolution"];
    get governance(): AuthoritativeTaskStoreRepositories["governance"];
    get operations(): AuthoritativeTaskStoreRepositories["operations"];
    get runtimeRecovery(): AuthoritativeTaskStoreRepositories["operations"];
    get views(): AuthoritativeTaskStoreRepositories["operations"];
    withConnection<T>(work: (connection: AuthoritativeSqlDatabase["connection"]) => T): T;
    protected callRepo<RepoKey extends keyof AuthoritativeTaskStoreRepositories, MethodKey extends keyof AuthoritativeTaskStoreRepositories[RepoKey]>(repoName: RepoKey, methodName: MethodKey, ...args: RepositoryMethod<RepoKey, MethodKey>["args"]): RepositoryMethod<RepoKey, MethodKey>["result"];
    protected delegateLegacy<LegacyKey extends keyof AuthoritativeTaskStoreLegacyCompat, RepoKey extends keyof AuthoritativeTaskStoreRepositories, MethodKey extends keyof AuthoritativeTaskStoreRepositories[RepoKey]>(legacyMethod: LegacyKey, repoName: RepoKey, methodName: MethodKey, ...args: LegacyMethod<LegacyKey>["args"]): LegacyMethod<LegacyKey>["result"];
    protected delegateLegacyNullable<LegacyKey extends keyof AuthoritativeTaskStoreLegacyCompat, RepoKey extends keyof AuthoritativeTaskStoreRepositories, MethodKey extends keyof AuthoritativeTaskStoreRepositories[RepoKey]>(legacyMethod: LegacyKey, repoName: RepoKey, methodName: MethodKey, ...args: LegacyMethod<LegacyKey>["args"]): LegacyMethod<LegacyKey>["result"];
    protected delegateLegacyUndefinedable<LegacyKey extends keyof AuthoritativeTaskStoreLegacyCompat, RepoKey extends keyof AuthoritativeTaskStoreRepositories, MethodKey extends keyof AuthoritativeTaskStoreRepositories[RepoKey]>(legacyMethod: LegacyKey, repoName: RepoKey, methodName: MethodKey, ...args: LegacyMethod<LegacyKey>["args"]): LegacyMethod<LegacyKey>["result"];
    protected delegateRepo<RepoKey extends keyof AuthoritativeTaskStoreRepositories, MethodKey extends keyof AuthoritativeTaskStoreRepositories[RepoKey]>(repoName: RepoKey, methodName: MethodKey, ...args: RepositoryMethod<RepoKey, MethodKey>["args"]): RepositoryMethod<RepoKey, MethodKey>["result"];
}
export {};
