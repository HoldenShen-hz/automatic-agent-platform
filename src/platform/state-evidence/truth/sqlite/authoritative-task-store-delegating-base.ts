/* c8 ignore start */
import type { AuthoritativeSqlDatabase } from "./sqlite-database.js";
import {
  createAuthoritativeTaskStoreRepositories,
  type AuthoritativeTaskStoreRepositories,
} from "./authoritative-task-store-repositories.js";
import {
  AuthoritativeTaskStoreLegacyCompat,
} from "./authoritative-task-store-legacy-compat.js";

type RepositoryMethod<
  RepoKey extends keyof AuthoritativeTaskStoreRepositories,
  MethodKey extends keyof AuthoritativeTaskStoreRepositories[RepoKey],
> = AuthoritativeTaskStoreRepositories[RepoKey][MethodKey] extends (
  ...args: infer Args
) => infer Result
  ? {
      args: Args;
      result: Result;
    }
  : never;

type LegacyMethod<
  MethodKey extends keyof AuthoritativeTaskStoreLegacyCompat,
> = AuthoritativeTaskStoreLegacyCompat[MethodKey] extends (...args: infer Args) => infer Result
  ? {
      args: Args;
      result: Result;
    }
  : never;

export abstract class AuthoritativeTaskStoreDelegatingBase extends AuthoritativeTaskStoreLegacyCompat {
  protected readonly repositorySet: AuthoritativeTaskStoreRepositories;

  public constructor(public readonly db: AuthoritativeSqlDatabase) {
    super();
    this.repositorySet = createAuthoritativeTaskStoreRepositories(db);
  }

  public repositories(): AuthoritativeTaskStoreRepositories {
    return this.repositorySet;
  }

  public get task(): AuthoritativeTaskStoreRepositories["task"] {
    return this.repositorySet.task;
  }

  public get workflow(): AuthoritativeTaskStoreRepositories["workflow"] {
    return this.repositorySet.workflow;
  }

  public get execution(): AuthoritativeTaskStoreRepositories["execution"] {
    return this.repositorySet.execution;
  }

  public get session(): AuthoritativeTaskStoreRepositories["session"] {
    return this.repositorySet.session;
  }

  public get event(): AuthoritativeTaskStoreRepositories["event"] {
    return this.repositorySet.event;
  }

  public get worker(): AuthoritativeTaskStoreRepositories["worker"] {
    return this.repositorySet.worker;
  }

  public get approval(): AuthoritativeTaskStoreRepositories["approval"] {
    return this.repositorySet.approval;
  }

  public get billing(): AuthoritativeTaskStoreRepositories["billing"] {
    return this.repositorySet.billing;
  }

  public get lease(): AuthoritativeTaskStoreRepositories["lease"] {
    return this.repositorySet.lease;
  }

  public get lock(): AuthoritativeTaskStoreRepositories["lock"] {
    return this.repositorySet.lock;
  }

  public get memory(): AuthoritativeTaskStoreRepositories["memory"] {
    return this.repositorySet.memory;
  }

  public get artifact(): AuthoritativeTaskStoreRepositories["artifact"] {
    return this.repositorySet.artifact;
  }

  public get dispatch(): AuthoritativeTaskStoreRepositories["dispatch"] {
    return this.repositorySet.dispatch;
  }

  public get division(): AuthoritativeTaskStoreRepositories["division"] {
    return this.repositorySet.division;
  }

  public get secret(): AuthoritativeTaskStoreRepositories["secret"] {
    return this.repositorySet.secret;
  }

  public get marketplace(): AuthoritativeTaskStoreRepositories["marketplace"] {
    return this.repositorySet.marketplace;
  }

  public get release(): AuthoritativeTaskStoreRepositories["release"] {
    return this.repositorySet.release;
  }

  public get organization(): AuthoritativeTaskStoreRepositories["organization"] {
    return this.repositorySet.organization;
  }

  public get intelligence(): AuthoritativeTaskStoreRepositories["intelligence"] {
    return this.repositorySet.intelligence;
  }

  public get evolution(): AuthoritativeTaskStoreRepositories["evolution"] {
    return this.repositorySet.evolution;
  }

  public get governance(): AuthoritativeTaskStoreRepositories["governance"] {
    return this.repositorySet.governance;
  }

  public get operations(): AuthoritativeTaskStoreRepositories["operations"] {
    return this.repositorySet.operations;
  }

  public get runtimeRecovery(): AuthoritativeTaskStoreRepositories["operations"] {
    return this.repositorySet.operations;
  }

  public get views(): AuthoritativeTaskStoreRepositories["operations"] {
    return this.repositorySet.operations;
  }

  public override withConnection<T>(work: (connection: AuthoritativeSqlDatabase["connection"]) => T): T {
    return work(this.db.connection);
  }

  protected callRepo<
    RepoKey extends keyof AuthoritativeTaskStoreRepositories,
    MethodKey extends keyof AuthoritativeTaskStoreRepositories[RepoKey],
  >(
    repoName: RepoKey,
    methodName: MethodKey,
    ...args: RepositoryMethod<RepoKey, MethodKey>["args"]
  ): RepositoryMethod<RepoKey, MethodKey>["result"] {
    const repository = this.repositorySet[repoName] as unknown as Record<string, (...methodArgs: unknown[]) => unknown>;
    const method = repository[methodName as string];
    if (typeof method !== "function") {
      throw new TypeError(`Repository method ${String(repoName)}.${String(methodName)} is not callable.`);
    }
    return method.call(repository, ...args) as RepositoryMethod<RepoKey, MethodKey>["result"];
  }

  protected delegateLegacy<
    LegacyKey extends keyof AuthoritativeTaskStoreLegacyCompat,
    RepoKey extends keyof AuthoritativeTaskStoreRepositories,
    MethodKey extends keyof AuthoritativeTaskStoreRepositories[RepoKey],
  >(
    legacyMethod: LegacyKey,
    repoName: RepoKey,
    methodName: MethodKey,
    ...args: LegacyMethod<LegacyKey>["args"]
  ): LegacyMethod<LegacyKey>["result"] {
    return this.callRepo(
      repoName,
      methodName,
      ...args as unknown as RepositoryMethod<RepoKey, MethodKey>["args"],
    ) as LegacyMethod<LegacyKey>["result"];
  }

  protected delegateLegacyNullable<
    LegacyKey extends keyof AuthoritativeTaskStoreLegacyCompat,
    RepoKey extends keyof AuthoritativeTaskStoreRepositories,
    MethodKey extends keyof AuthoritativeTaskStoreRepositories[RepoKey],
  >(
    legacyMethod: LegacyKey,
    repoName: RepoKey,
    methodName: MethodKey,
    ...args: LegacyMethod<LegacyKey>["args"]
  ): LegacyMethod<LegacyKey>["result"] {
    const result = this.callRepo(
      repoName,
      methodName,
      ...args as unknown as RepositoryMethod<RepoKey, MethodKey>["args"],
    );
    return (result ?? null) as LegacyMethod<LegacyKey>["result"];
  }

  protected delegateLegacyUndefinedable<
    LegacyKey extends keyof AuthoritativeTaskStoreLegacyCompat,
    RepoKey extends keyof AuthoritativeTaskStoreRepositories,
    MethodKey extends keyof AuthoritativeTaskStoreRepositories[RepoKey],
  >(
    legacyMethod: LegacyKey,
    repoName: RepoKey,
    methodName: MethodKey,
    ...args: LegacyMethod<LegacyKey>["args"]
  ): LegacyMethod<LegacyKey>["result"] {
    const result = this.callRepo(
      repoName,
      methodName,
      ...args as unknown as RepositoryMethod<RepoKey, MethodKey>["args"],
    );
    return (result ?? undefined) as LegacyMethod<LegacyKey>["result"];
  }

  protected delegateRepo<
    RepoKey extends keyof AuthoritativeTaskStoreRepositories,
    MethodKey extends keyof AuthoritativeTaskStoreRepositories[RepoKey],
  >(
    repoName: RepoKey,
    methodName: MethodKey,
    ...args: RepositoryMethod<RepoKey, MethodKey>["args"]
  ): RepositoryMethod<RepoKey, MethodKey>["result"] {
    return this.callRepo(repoName, methodName, ...args);
  }
}
/* c8 ignore stop */
