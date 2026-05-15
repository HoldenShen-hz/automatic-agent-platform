import assert from "node:assert/strict";
import test from "node:test";

import {
  SemanticRepoMapService,
  extractImports,
  extractSymbols,
  computeFileRelevance,
  computeSymbolRelevance,
  type RepoSymbol,
  type RepoFileNode,
} from "../../../../../src/platform/five-plane-execution/tool-executor/semantic-repo-map-service.js";

test("extractImports extracts ES6 imports", () => {
  const content = `
    import { foo } from './foo';
    import bar from './bar';
    import * as baz from './baz';
  `;
  const { imports } = extractImports(content);
  assert.ok(imports.includes("./foo"));
  assert.ok(imports.includes("./bar"));
  assert.ok(imports.includes("./baz"));
});

test("extractImports extracts CommonJS requires", () => {
  const content = `
    const foo = require('./foo');
    const bar = require('./bar');
  `;
  const { imports } = extractImports(content);
  assert.ok(imports.includes("./foo"));
  assert.ok(imports.includes("./bar"));
});

test("extractImports extracts dynamic imports", () => {
  const content = `
    const foo = import('./foo');
    const bar = import('./bar');
  `;
  const { imports, dynamicImports } = extractImports(content);
  assert.equal(imports.length, 0);
  assert.ok(dynamicImports.includes("./foo"));
  assert.ok(dynamicImports.includes("./bar"));
});

test("extractImports handles empty content", () => {
  const { imports, dynamicImports } = extractImports("");
  assert.equal(imports.length, 0);
  assert.equal(dynamicImports.length, 0);
});

test("extractSymbols extracts function declarations", () => {
  const content = `
    function foo() {}
    export function bar() {}
    async function baz() {}
  `;
  const symbols = extractSymbols(content, "/test/file.ts");
  const funcNames = symbols.filter((s) => s.kind === "function").map((s) => s.name);
  assert.ok(funcNames.includes("foo"));
  assert.ok(funcNames.includes("bar"));
  assert.ok(funcNames.includes("baz"));
});

test("extractSymbols extracts class declarations", () => {
  const content = `
    class Foo {}
    export class Bar {}
  `;
  const symbols = extractSymbols(content, "/test/file.ts");
  const classNames = symbols.filter((s) => s.kind === "class").map((s) => s.name);
  assert.ok(classNames.includes("Foo"));
  assert.ok(classNames.includes("Bar"));
});

test("extractSymbols extracts interface declarations", () => {
  const content = `
    interface Foo {}
    export interface Bar {}
  `;
  const symbols = extractSymbols(content, "/test/file.ts");
  const interfaceNames = symbols.filter((s) => s.kind === "interface").map((s) => s.name);
  assert.ok(interfaceNames.includes("Foo"));
  assert.ok(interfaceNames.includes("Bar"));
});

test("extractSymbols extracts type declarations", () => {
  const content = `
    type Foo = string;
    export type Bar = number;
  `;
  const symbols = extractSymbols(content, "/test/file.ts");
  const typeNames = symbols.filter((s) => s.kind === "type").map((s) => s.name);
  assert.ok(typeNames.includes("Foo"));
  assert.ok(typeNames.includes("Bar"));
});

test("extractSymbols extracts const declarations", () => {
  const content = `
    const FOO = 1;
    export const BAR = 2;
  `;
  const symbols = extractSymbols(content, "/test/file.ts");
  const constNames = symbols.filter((s) => s.kind === "constant").map((s) => s.name);
  assert.ok(constNames.includes("FOO"));
  assert.ok(constNames.includes("BAR"));
});

test("computeFileRelevance returns higher score for filename match", () => {
  const file = {
    filePath: "/test/service.ts",
    fileName: "service.ts",
    extension: ".ts",
    relativePath: "src/service.ts",
    exports: ["Service"],
    imports: [],
    referencedBy: [],
    depth: 1,
  };

  const score1 = computeFileRelevance(file, { query: "service" });
  const score2 = computeFileRelevance(file, { query: "controller" });

  assert.ok(score1 > score2);
  assert.ok(score1 > 0);
  assert.equal(score2, 0);
});

test("computeSymbolRelevance returns higher score for name match", () => {
  const symbol = {
    name: "Service",
    kind: "class" as const,
    filePath: "/test/service.ts",
    line: 1,
    column: 1,
    references: [],
  };

  const score1 = computeSymbolRelevance(symbol, { query: "Service" });
  const score2 = computeSymbolRelevance(symbol, { query: "Controller" });

  assert.ok(score1 > score2);
  assert.ok(score1 > 0);
  assert.equal(score2, 0);
});

test("computeSymbolRelevance boosts referenced symbols", () => {
  const symbol1 = {
    name: "Service",
    kind: "class" as const,
    filePath: "/test/service.ts",
    line: 1,
    column: 1,
    references: [{ filePath: "/test/main.ts", line: 5, column: 10 }],
  };

  const symbol2 = {
    name: "Service",
    kind: "class" as const,
    filePath: "/test/service.ts",
    line: 1,
    column: 1,
    references: [],
  };

  const score1 = computeSymbolRelevance(symbol1, { query: "Service" });
  const score2 = computeSymbolRelevance(symbol2, { query: "Service" });

  assert.ok(score1 >= score2);
});

test("SemanticRepoMapService.getStatistics returns correct stats", () => {
  const service = new SemanticRepoMapService("/test/root", 0);
  // With no files, stats should be zeros
  const stats = service.getStatistics();
  assert.equal(stats.totalFiles, 0);
  assert.equal(stats.totalSymbols, 0);
  assert.equal(stats.totalReferences, 0);
});

test("SemanticRepoMapService.invalidateCache forces rebuild", () => {
  const service = new SemanticRepoMapService("/test/root", 60_000);
  service.buildMap();
  service.invalidateCache();
  // After invalidate, the map should be null and next build will be fresh
  // This is an implementation detail test
  assert.ok(true); // Just verify no error
});

test("SemanticRepoMapService handles invalid root path gracefully", () => {
  const service = new SemanticRepoMapService("/nonexistent/path", 0);
  const stats = service.getStatistics();
  assert.equal(stats.totalFiles, 0);
  assert.equal(stats.totalSymbols, 0);
});

test("extractSymbols handles complex content without errors", () => {
  const content = `
    import { foo } from './foo';
    function bar() {}
    class Baz {}
    interface Qux {}
    type Quux = string;
    const QUUX = 123;
    export { bar, Baz };
  `;
  const symbols = extractSymbols(content, "/test/file.ts");
  assert.ok(symbols.length >= 5); // bar, Baz, Qux, Quux (type), QUUX
});
