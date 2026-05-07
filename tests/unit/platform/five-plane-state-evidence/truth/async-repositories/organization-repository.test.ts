import assert from "node:assert/strict";
import test from "node:test";

import type { AsyncSqlConnection, AsyncQueryResult } from "../../../../../../src/platform/five-plane-state-evidence/truth/async-sql-database.js";
import { AsyncOrganizationRepository } from "../../../../../../src/platform/five-plane-state-evidence/truth/async-repositories/organization-repository.js";

test("AsyncOrganizationRepository.listDeploymentBindings uses equality tenant filter for scoped queries", async () => {
  const seenQueries: string[] = [];
  const conn: AsyncSqlConnection = {
    async query<T>(sql: string, ..._params: unknown[]): Promise<AsyncQueryResult<T>> {
      seenQueries.push(sql);
      return { rows: [], rowCount: 0 };
    },
    async queryOne<T>(_sql: string, ..._params: unknown[]): Promise<T | undefined> {
      return undefined;
    },
    async execute(_sql: string, ..._params: unknown[]): Promise<number> {
      return 0;
    },
  };

  const repository = new AsyncOrganizationRepository(conn);
  await repository.listDeploymentBindings({ tenantId: "tenant-42", limit: 5 });

  assert.equal(seenQueries.length, 1);
  assert.match(seenQueries[0]!, /WHERE tenant_id = \$1/);
  assert.doesNotMatch(seenQueries[0]!, /WHERE tenant_id IS \$1/);
});
