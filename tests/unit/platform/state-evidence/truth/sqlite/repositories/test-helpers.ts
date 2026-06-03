import type { AuthoritativeSqlDatabase } from "../../../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";

interface MockSqlStatement {
  run: (...args: unknown[]) => { changes: number };
  get: () => unknown;
  all: () => unknown[];
}

interface CreateMockAuthoritativeSqlDatabaseOptions {
  readonly statementFactory?: () => MockSqlStatement;
  readonly getResult?: unknown;
  readonly allResult?: unknown[];
}

export interface MockAuthoritativeSqlDatabaseHandle {
  readonly db: AuthoritativeSqlDatabase;
  readonly runCalls: unknown[][];
  readonly preparedSql: string[];
}

export function createMockAuthoritativeSqlDatabase(
  options: CreateMockAuthoritativeSqlDatabaseOptions = {},
): MockAuthoritativeSqlDatabaseHandle {
  const runCalls: unknown[][] = [];
  const preparedSql: string[] = [];
  const statementFactory =
    options.statementFactory ??
    (() => ({
      run: (...args: unknown[]) => {
        runCalls.push(args);
        return { changes: 1 };
      },
      get: () => options.getResult,
      all: () => options.allResult ?? [],
    }));

  const db: AuthoritativeSqlDatabase = {
    filePath: ":memory:",
    backendType: "sqlite",
    connection: {
      exec: () => undefined,
      prepare: ((sql: string) => {
        preparedSql.push(sql);
        return statementFactory() as never;
      }) as AuthoritativeSqlDatabase["connection"]["prepare"],
    },
    migrate: () => undefined,
    getSchemaStatus: () => ({
      currentVersion: 0,
      expectedVersion: 0,
      upToDate: true,
      pendingVersions: [],
      checksumMismatches: [],
    }),
    assertSchemaCurrent: () => undefined,
    integrityCheck: () => [],
    healthCheck: () => true,
    close: () => undefined,
    transaction: <T>(work: () => T) => work(),
    readTransaction: <T>(work: () => T) => work(),
  };

  return { db, runCalls, preparedSql };
}
