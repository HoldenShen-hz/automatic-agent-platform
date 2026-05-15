import assert from "node:assert/strict";
import test from "node:test";

import { AstStructuralIndex } from "../../../../../../src/platform/five-plane-state-evidence/knowledge/indexing/ast-index.js";

test("AstStructuralIndex.upsertDocument indexes function declarations", () => {
  const index = new AstStructuralIndex();

  const symbols = index.upsertDocument({
    documentId: "doc-1",
    sourceUri: "/path/to/file.ts",
    namespace: "test-namespace",
    content: `
      function helloWorld() {
        return "hello";
      }
    `,
    language: "typescript",
  });

  assert.ok(symbols.length > 0);
  const funcSymbol = symbols.find((s) => s.symbolName === "helloWorld");
  assert.ok(funcSymbol != null);
  assert.equal(funcSymbol.symbolKind, "function");
  assert.equal(funcSymbol.namespace, "test-namespace");
});

test("AstStructuralIndex.upsertDocument indexes class declarations", () => {
  const index = new AstStructuralIndex();

  const symbols = index.upsertDocument({
    documentId: "doc-1",
    sourceUri: "/path/to/file.ts",
    namespace: "test-namespace",
    content: `
      class MyClass {
        name: string;
      }
    `,
    language: "typescript",
  });

  assert.ok(symbols.length > 0);
  const classSymbol = symbols.find((s) => s.symbolName === "MyClass");
  assert.ok(classSymbol != null);
  assert.equal(classSymbol.symbolKind, "class");
});

test("AstStructuralIndex.upsertDocument indexes interface declarations", () => {
  const index = new AstStructuralIndex();

  const symbols = index.upsertDocument({
    documentId: "doc-1",
    sourceUri: "/path/to/file.ts",
    namespace: "test-namespace",
    content: `
      interface MyInterface {
        prop: string;
      }
    `,
    language: "typescript",
  });

  assert.ok(symbols.length > 0);
  const interfaceSymbol = symbols.find((s) => s.symbolName === "MyInterface");
  assert.ok(interfaceSymbol != null);
  assert.equal(interfaceSymbol.symbolKind, "interface");
});

test("AstStructuralIndex.upsertDocument indexes type aliases", () => {
  const index = new AstStructuralIndex();

  const symbols = index.upsertDocument({
    documentId: "doc-1",
    sourceUri: "/path/to/file.ts",
    namespace: "test-namespace",
    content: `
      type MyType = string | number;
    `,
    language: "typescript",
  });

  assert.ok(symbols.length > 0);
  const typeSymbol = symbols.find((s) => s.symbolName === "MyType");
  assert.ok(typeSymbol != null);
  assert.equal(typeSymbol.symbolKind, "type");
});

test("AstStructuralIndex.upsertDocument indexes enums", () => {
  const index = new AstStructuralIndex();

  const symbols = index.upsertDocument({
    documentId: "doc-1",
    sourceUri: "/path/to/file.ts",
    namespace: "test-namespace",
    content: `
      enum MyEnum {
        Value1,
        Value2,
      }
    `,
    language: "typescript",
  });

  assert.ok(symbols.length > 0);
  const enumSymbol = symbols.find((s) => s.symbolName === "MyEnum");
  assert.ok(enumSymbol != null);
  assert.equal(enumSymbol.symbolKind, "enum");
});

test("AstStructuralIndex.query finds symbols by exact name match", () => {
  const index = new AstStructuralIndex();

  index.upsertDocument({
    documentId: "doc-1",
    sourceUri: "/path/to/file.ts",
    namespace: "test-namespace",
    content: `
      function helloWorld() {}
      function helloOther() {}
    `,
    language: "typescript",
  });

  const results = index.query({ query: "helloWorld" });

  assert.ok(results.length > 0);
  assert.equal(results[0]!.symbolName, "helloWorld");
  // Exact match should have highest score
  assert.ok(results[0]!.symbolName === "helloWorld");
});

test("AstStructuralIndex.query finds symbols by partial name match", () => {
  const index = new AstStructuralIndex();

  index.upsertDocument({
    documentId: "doc-1",
    sourceUri: "/path/to/file.ts",
    namespace: "test-namespace",
    content: `
      function helloWorld() {}
      function helloOther() {}
    `,
    language: "typescript",
  });

  const results = index.query({ query: "hello" });

  assert.ok(results.length >= 2);
});

test("AstStructuralIndex.query respects limit parameter", () => {
  const index = new AstStructuralIndex();

  index.upsertDocument({
    documentId: "doc-1",
    sourceUri: "/path/to/file.ts",
    namespace: "test-namespace",
    content: `
      function func1() {}
      function func2() {}
      function func3() {}
      function func4() {}
    `,
    language: "typescript",
  });

  const results = index.query({ query: "func", limit: 2 });

  assert.equal(results.length, 2);
});

test("AstStructuralIndex.query filters by namespace", () => {
  const index = new AstStructuralIndex();

  index.upsertDocument({
    documentId: "doc-1",
    sourceUri: "/path/to/file.ts",
    namespace: "namespace-a",
    content: `function sharedName() {}`,
    language: "typescript",
  });
  index.upsertDocument({
    documentId: "doc-2",
    sourceUri: "/path/to/other.ts",
    namespace: "namespace-b",
    content: `function sharedName() {}`,
    language: "typescript",
  });

  const resultsA = index.query({ query: "sharedName", namespace: "namespace-a" });
  const resultsB = index.query({ query: "sharedName", namespace: "namespace-b" });

  assert.equal(resultsA.length, 1);
  assert.equal(resultsA[0]!.namespace, "namespace-a");
  assert.equal(resultsB.length, 1);
  assert.equal(resultsB[0]!.namespace, "namespace-b");
});

test("AstStructuralIndex.query returns empty for empty query", () => {
  const index = new AstStructuralIndex();

  index.upsertDocument({
    documentId: "doc-1",
    sourceUri: "/path/to/file.ts",
    namespace: "test-namespace",
    content: `function test() {}`,
    language: "typescript",
  });

  const results = index.query({ query: "" });

  assert.equal(results.length, 0);
});

test("AstStructuralIndex.query returns empty for whitespace query", () => {
  const index = new AstStructuralIndex();

  index.upsertDocument({
    documentId: "doc-1",
    sourceUri: "/path/to/file.ts",
    namespace: "test-namespace",
    content: `function test() {}`,
    language: "typescript",
  });

  const results = index.query({ query: "   " });

  assert.equal(results.length, 0);
});

test("AstStructuralIndex.list returns all symbols without namespace filter", () => {
  const index = new AstStructuralIndex();

  index.upsertDocument({
    documentId: "doc-1",
    sourceUri: "/path/to/file.ts",
    namespace: "namespace-a",
    content: `function func1() {}`,
    language: "typescript",
  });
  index.upsertDocument({
    documentId: "doc-2",
    sourceUri: "/path/to/other.ts",
    namespace: "namespace-b",
    content: `function func2() {}`,
    language: "typescript",
  });

  const allSymbols = index.list();

  assert.equal(allSymbols.length, 2);
});

test("AstStructuralIndex.list filters by namespace", () => {
  const index = new AstStructuralIndex();

  index.upsertDocument({
    documentId: "doc-1",
    sourceUri: "/path/to/file.ts",
    namespace: "namespace-a",
    content: `function func1() {}`,
    language: "typescript",
  });
  index.upsertDocument({
    documentId: "doc-2",
    sourceUri: "/path/to/other.ts",
    namespace: "namespace-b",
    content: `function func2() {}`,
    language: "typescript",
  });

  const nsSymbols = index.list("namespace-a");

  assert.equal(nsSymbols.length, 1);
  assert.equal(nsSymbols[0]!.namespace, "namespace-a");
});

test("AstStructuralIndex.upsertDocument replaces existing document symbols", () => {
  const index = new AstStructuralIndex();

  index.upsertDocument({
    documentId: "doc-1",
    sourceUri: "/path/to/file.ts",
    namespace: "test-namespace",
    content: `function oldFunc() {}`,
    language: "typescript",
  });
  index.upsertDocument({
    documentId: "doc-1",
    sourceUri: "/path/to/file.ts",
    namespace: "test-namespace",
    content: `function newFunc() {}`,
    language: "typescript",
  });

  const results = index.query({ query: "oldFunc" });
  const newResults = index.query({ query: "newFunc" });

  assert.equal(results.length, 0);
  assert.equal(newResults.length, 1);
});

test("AstStructuralIndex.upsertDocument removes old document on re-index", () => {
  const index = new AstStructuralIndex();

  index.upsertDocument({
    documentId: "doc-1",
    sourceUri: "/path/to/file.ts",
    namespace: "test-namespace",
    content: `function func1() {}`,
    language: "typescript",
  });
  index.upsertDocument({
    documentId: "doc-1",
    sourceUri: "/path/to/file.ts",
    namespace: "test-namespace",
    content: `function func2() {}`,
    language: "typescript",
  });

  const allSymbols = index.list();

  // Should only have func2, not func1
  assert.ok(allSymbols.length >= 1);
  const symbolNames = allSymbols.map((s) => s.symbolName);
  assert.ok(!symbolNames.includes("func1") || allSymbols.length === 1);
});

test("AstStructuralIndex infers .ts as TypeScript", () => {
  const index = new AstStructuralIndex();

  const symbols = index.upsertDocument({
    documentId: "doc-1",
    sourceUri: "/path/to/file.ts",
    namespace: "test-namespace",
    content: `function testFunc() {}`,
  });

  assert.ok(symbols.length > 0);
});

test("AstStructuralIndex infers .js as JavaScript", () => {
  const index = new AstStructuralIndex();

  const symbols = index.upsertDocument({
    documentId: "doc-1",
    sourceUri: "/path/to/file.js",
    namespace: "test-namespace",
    content: `function testFunc() {}`,
  });

  assert.ok(symbols.length > 0);
});

test("AstStructuralIndex skips non-TypeScript/JavaScript files by default", () => {
  const index = new AstStructuralIndex();

  const symbols = index.upsertDocument({
    documentId: "doc-1",
    sourceUri: "/path/to/file.txt",
    namespace: "test-namespace",
    content: `function testFunc() {}`,
  });

  assert.equal(symbols.length, 0);
});

test("AstStructuralIndex respects explicit language setting", () => {
  const index = new AstStructuralIndex();

  const symbols = index.upsertDocument({
    documentId: "doc-1",
    sourceUri: "/path/to/file.txt",
    namespace: "test-namespace",
    content: `function testFunc() {}`,
    language: "typescript",
  });

  assert.ok(symbols.length > 0);
});

test("AstStructuralIndex.query scores exact matches higher than partial matches", () => {
  const index = new AstStructuralIndex();

  index.upsertDocument({
    documentId: "doc-1",
    sourceUri: "/path/to/file.ts",
    namespace: "test-namespace",
    content: `
      function myFunction() {}
      function myFunctionHelper() {}
    `,
    language: "typescript",
  });

  const results = index.query({ query: "myFunction" });

  // Should return both, but exact match first
  assert.ok(results.length >= 2);
  assert.equal(results[0]!.symbolName, "myFunction");
});

test("AstStructuralIndex stores line and character information", () => {
  const index = new AstStructuralIndex();

  const symbols = index.upsertDocument({
    documentId: "doc-1",
    sourceUri: "/path/to/file.ts",
    namespace: "test-namespace",
    content: "\n\nfunction testFunc() {}",
    language: "typescript",
  });

  assert.ok(symbols.length > 0);
  assert.ok(symbols[0]!.line >= 1);
  assert.ok(symbols[0]!.character >= 1);
});
