export interface EvalSqlStatement {
  get(...params: unknown[]): Record<string, unknown> | undefined;
  all(...params: unknown[]): Record<string, unknown>[];
  run(...params: unknown[]): { changes?: number | bigint };
}

export interface EvalSqlDatabase {
  readonly connection: {
    prepare(sql: string): EvalSqlStatement;
  };
  transaction?<T>(work: () => T): T;
}
