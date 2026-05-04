import assert from "node:assert/strict";
import test from "node:test";

import { ValidationError } from "../../../../../src/platform/contracts/errors.js";
import {
  KnowledgeQueryService,
  QueryLevel,
} from "../../../../../src/platform/state-evidence/knowledge/knowledge-query-service.js";
import type { KnowledgeRetrievalService } from "../../../../../src/platform/state-evidence/knowledge/retrieval/knowledge-retrieval.js";

function createRetrievalService(): KnowledgeRetrievalService {
  return {
    query() {
      return [];
    },
    queryAsync() {
      return Promise.resolve([]);
    },
  } as unknown as KnowledgeRetrievalService;
}

test("KnowledgeQueryService rejects synchronous deep queries instead of falling back to standard", () => {
  const service = new KnowledgeQueryService(createRetrievalService());

  assert.throws(
    () => (service as unknown as { queryWithLevel: (keyword: string, options: Record<string, unknown>, level: QueryLevel) => unknown })
      .queryWithLevel("test", {
        namespace: "tenant-a.docs",
        domainId: "domain-a",
        accessPrincipal: {
          principalId: "reader-1",
          domainId: "domain-a",
          roles: ["reader"],
          permittedNamespaces: ["tenant-a.docs"],
        },
      }, QueryLevel.Deep),
    (error: unknown) => error instanceof ValidationError && error.code === "knowledge_query.deep_requires_async",
  );
});
