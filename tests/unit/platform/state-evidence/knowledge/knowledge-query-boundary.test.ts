import assert from "node:assert/strict";
import test from "node:test";

import { ValidationError } from "../../../../../src/platform/contracts/errors.js";
import { KnowledgeQueryService } from "../../../../../src/platform/five-plane-state-evidence/knowledge/knowledge-query-service.js";
import type { KnowledgeAccessPrincipal } from "../../../../../src/platform/five-plane-state-evidence/knowledge/governance/access-control.js";
import type { KnowledgeRetrievalService } from "../../../../../src/platform/five-plane-state-evidence/knowledge/retrieval/knowledge-retrieval.js";

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

const SAME_DOMAIN_PRINCIPAL: KnowledgeAccessPrincipal = {
  principalId: "principal-1",
  domainId: "finance-accounting",
  roles: ["reader"],
  permittedNamespaces: ["tenant/finance"],
};

test("KnowledgeQueryService rejects scoped queries without an access principal", () => {
  const service = new KnowledgeQueryService(createRetrievalService());

  assert.throws(
    () => service.query("budget report", { domainId: "finance-accounting" }),
    (error) =>
      error instanceof ValidationError
      && error.code === "knowledge_query.principal_required",
  );
});

test("KnowledgeQueryService rejects domain queries that do not match the caller principal", () => {
  const service = new KnowledgeQueryService(createRetrievalService());

  assert.throws(
    () =>
      service.query("budget report", {
        domainId: "legal",
        accessPrincipal: SAME_DOMAIN_PRINCIPAL,
      }),
    (error) =>
      error instanceof ValidationError
      && error.code === "knowledge_query.domain_principal_mismatch",
  );
});

test("KnowledgeQueryService allows matching domain-principal queries", () => {
  const service = new KnowledgeQueryService(createRetrievalService());

  const result = service.query("budget report", {
    domainId: "finance-accounting",
    namespace: "tenant/finance",
    accessPrincipal: SAME_DOMAIN_PRINCIPAL,
  });

  assert.deepEqual(result, []);
});
