import test from "node:test";
import assert from "node:assert/strict";

import { AstStructuralIndex } from "../../../../../src/platform/five-plane-state-evidence/knowledge/indexing/ast-index.js";

function tsSnippet(name: string, kind: "function" | "class" | "interface" | "type" | "enum" | "variable" = "function"): string {
  switch (kind) {
    case "function":
      return `export function ${name}() { return 42; }`;
    case "class":
      return `export class ${name} { }`;
    case "interface":
      return `export interface ${name} { prop: string; }`;
    case "type":
      return `export type ${name} = string | number;`;
    case "enum":
      return `export enum ${name} { A, B }`;
    case "variable":
      return `export const ${name} = 42;`;
  }
}

test("AstStructuralIndex.upsertDocument extracts functions", () => {
  const index = new AstStructuralIndex();
  const symbols = index.upsertDocument({
    documentId: "doc_1",
    sourceUri: "/src/utils.ts",
    namespace: "utils",
    content: tsSnippet("calculateScore", "function"),
  });

  assert.equal(symbols.length, 1);
  assert.equal(symbols[0]!.symbolName, "calculateScore");
  assert.equal(symbols[0]!.symbolKind, "function");
  assert.equal(symbols[0]!.namespace, "utils");
  assert.equal(symbols[0]!.documentId, "doc_1");
});

test("AstStructuralIndex.upsertDocument extracts classes", () => {
  const index = new AstStructuralIndex();
  const symbols = index.upsertDocument({
    documentId: "doc_1",
    sourceUri: "/src/model.ts",
    namespace: "model",
    content: tsSnippet("UserModel", "class"),
  });

  assert.equal(symbols.length, 1);
  assert.equal(symbols[0]!.symbolName, "UserModel");
  assert.equal(symbols[0]!.symbolKind, "class");
});

test("AstStructuralIndex.upsertDocument extracts interfaces", () => {
  const index = new AstStructuralIndex();
  const symbols = index.upsertDocument({
    documentId: "doc_1",
    sourceUri: "/src/types.ts",
    namespace: "types",
    content: tsSnippet("Config", "interface"),
  });

  assert.equal(symbols.length, 1);
  assert.equal(symbols[0]!.symbolKind, "interface");
});

test("AstStructuralIndex.upsertDocument extracts types", () => {
  const index = new AstStructuralIndex();
  const symbols = index.upsertDocument({
    documentId: "doc_1",
    sourceUri: "/src/types.ts",
    namespace: "types",
    content: tsSnippet("Result", "type"),
  });

  assert.equal(symbols.length, 1);
  assert.equal(symbols[0]!.symbolKind, "type");
});

test("AstStructuralIndex.upsertDocument extracts enums", () => {
  const index = new AstStructuralIndex();
  const symbols = index.upsertDocument({
    documentId: "doc_1",
    sourceUri: "/src/constants.ts",
    namespace: "constants",
    content: tsSnippet("Status", "enum"),
  });

  assert.equal(symbols.length, 1);
  assert.equal(symbols[0]!.symbolKind, "enum");
});

test("AstStructuralIndex.upsertDocument extracts variables", () => {
  const index = new AstStructuralIndex();
  const symbols = index.upsertDocument({
    documentId: "doc_1",
    sourceUri: "/src/constants.ts",
    namespace: "constants",
    content: tsSnippet("VERSION", "variable"),
  });

  assert.equal(symbols.length, 1);
  assert.equal(symbols[0]!.symbolKind, "variable");
});

test("AstStructuralIndex.upsertDocument extracts multiple symbols", () => {
  const index = new AstStructuralIndex();
  const symbols = index.upsertDocument({
    documentId: "doc_1",
    sourceUri: "/src/mixed.ts",
    namespace: "mixed",
    content: `export function foo() {}
export class Bar {}
export interface Baz {}
export type Qux = string;
export enum Quux { A }
export const FOO = 1;`,
  });

  assert.equal(symbols.length, 6);
  const kinds = symbols.map((s) => s.symbolKind).sort();
  assert.deepEqual(kinds, ["class", "enum", "function", "interface", "type", "variable"]);
});

test("AstStructuralIndex.upsertDocument replaces existing document symbols", () => {
  const index = new AstStructuralIndex();
  index.upsertDocument({
    documentId: "doc_1",
    sourceUri: "/src/v1.ts",
    namespace: "ns",
    content: tsSnippet("oldFunc", "function"),
  });

  index.upsertDocument({
    documentId: "doc_1",
    sourceUri: "/src/v2.ts",
    namespace: "ns",
    content: tsSnippet("newFunc", "function"),
  });

  const results = index.query({ query: "oldFunc" });
  assert.equal(results.length, 0);

  const newResults = index.query({ query: "newFunc" });
  assert.equal(newResults.length, 1);
  assert.equal(newResults[0]!.symbolName, "newFunc");
});

test("AstStructuralIndex.upsertDocument skips non-TypeScript files", () => {
  const index = new AstStructuralIndex();
  const symbols = index.upsertDocument({
    documentId: "doc_1",
    sourceUri: "/src/data.json",
    namespace: "data",
    content: '{"key": "value"}',
  });

  assert.equal(symbols.length, 0);
});

test("AstStructuralIndex.upsertDocument parses .ts files by extension", () => {
  const index = new AstStructuralIndex();
  const symbols = index.upsertDocument({
    documentId: "doc_1",
    sourceUri: "/src/script.ts",
    namespace: "ns",
    content: tsSnippet("typedFunc", "function"),
  });

  assert.equal(symbols.length, 1);
});

test("AstStructuralIndex.upsertDocument uses language hint to parse .txt as TypeScript", () => {
  const index = new AstStructuralIndex();
  const symbols = index.upsertDocument({
    documentId: "doc_1",
    sourceUri: "/src/script.txt",
    namespace: "ns",
    language: "typescript",
    content: tsSnippet("hintFunc", "function"),
  });

  assert.equal(symbols.length, 1);
});

test("AstStructuralIndex.query finds exact symbol name match with score 3", () => {
  const index = new AstStructuralIndex();
  index.upsertDocument({
    documentId: "doc_1",
    sourceUri: "/src/utils.ts",
    namespace: "utils",
    content: tsSnippet("helper", "function"),
  });

  const results = index.query({ query: "helper" });

  assert.equal(results.length, 1);
  assert.equal(results[0]!.symbolName, "helper");
});

test("AstStructuralIndex.query finds partial symbol name match with score 2", () => {
  const index = new AstStructuralIndex();
  index.upsertDocument({
    documentId: "doc_1",
    sourceUri: "/src/utils.ts",
    namespace: "utils",
    content: tsSnippet("calculateScore", "function"),
  });

  const results = index.query({ query: "calculate" });

  assert.equal(results.length, 1);
  assert.equal(results[0]!.symbolName, "calculateScore");
});

test("AstStructuralIndex.query finds snippet match with score 1", () => {
  const index = new AstStructuralIndex();
  index.upsertDocument({
    documentId: "doc_1",
    sourceUri: "/src/utils.ts",
    namespace: "utils",
    content: "export function namedFunc() {\n  return fetchData();\n}",
  });

  const results = index.query({ query: "fetchData" });

  assert.equal(results.length, 1);
  assert.equal(results[0]!.symbolName, "namedFunc");
});

test("AstStructuralIndex.query returns empty for no match", () => {
  const index = new AstStructuralIndex();
  index.upsertDocument({
    documentId: "doc_1",
    sourceUri: "/src/utils.ts",
    namespace: "utils",
    content: tsSnippet("target", "function"),
  });

  const results = index.query({ query: "nonexistent" });

  assert.equal(results.length, 0);
});

test("AstStructuralIndex.query filters by namespace when provided", () => {
  const index = new AstStructuralIndex();
  index.upsertDocument({
    documentId: "doc_1",
    sourceUri: "/src/a.ts",
    namespace: "utils",
    content: tsSnippet("sharedName", "function"),
  });
  index.upsertDocument({
    documentId: "doc_2",
    sourceUri: "/src/b.ts",
    namespace: "model",
    content: tsSnippet("sharedName", "class"),
  });

  const results = index.query({ query: "sharedName", namespace: "utils" });

  assert.equal(results.length, 1);
  assert.equal(results[0]!.namespace, "utils");
});

test("AstStructuralIndex.query respects limit", () => {
  const index = new AstStructuralIndex();
  for (let i = 0; i < 5; i++) {
    index.upsertDocument({
      documentId: `doc_${i}`,
      sourceUri: `/src/file${i}.ts`,
      namespace: "ns",
      content: tsSnippet(`func${i}`, "function"),
    });
  }

  const results = index.query({ query: "func", limit: 3 });

  assert.equal(results.length, 3);
});

test("AstStructuralIndex.query returns empty for blank query", () => {
  const index = new AstStructuralIndex();
  index.upsertDocument({
    documentId: "doc_1",
    sourceUri: "/src/utils.ts",
    namespace: "utils",
    content: tsSnippet("target", "function"),
  });

  const results = index.query({ query: "   " });

  assert.equal(results.length, 0);
});

test("AstStructuralIndex.list returns all symbols when no namespace provided", () => {
  const index = new AstStructuralIndex();
  index.upsertDocument({
    documentId: "doc_1",
    sourceUri: "/src/a.ts",
    namespace: "ns1",
    content: tsSnippet("funcA", "function"),
  });
  index.upsertDocument({
    documentId: "doc_2",
    sourceUri: "/src/b.ts",
    namespace: "ns2",
    content: tsSnippet("funcB", "function"),
  });

  const results = index.list();

  assert.equal(results.length, 2);
});

test("AstStructuralIndex.list filters by namespace", () => {
  const index = new AstStructuralIndex();
  index.upsertDocument({
    documentId: "doc_1",
    sourceUri: "/src/a.ts",
    namespace: "utils",
    content: tsSnippet("funcA", "function"),
  });
  index.upsertDocument({
    documentId: "doc_2",
    sourceUri: "/src/b.ts",
    namespace: "model",
    content: tsSnippet("funcB", "class"),
  });

  const results = index.list("utils");

  assert.equal(results.length, 1);
  assert.equal(results[0]!.namespace, "utils");
});

test("AstStructuralIndex handles multiple documents in same namespace", () => {
  const index = new AstStructuralIndex();
  index.upsertDocument({
    documentId: "doc_1",
    sourceUri: "/src/a.ts",
    namespace: "shared",
    content: tsSnippet("func1", "function"),
  });
  index.upsertDocument({
    documentId: "doc_2",
    sourceUri: "/src/b.ts",
    namespace: "shared",
    content: tsSnippet("func2", "function"),
  });

  const listResults = index.list("shared");
  assert.equal(listResults.length, 2);

  const queryResults = index.query({ query: "func", namespace: "shared" });
  assert.equal(queryResults.length, 2);
});
