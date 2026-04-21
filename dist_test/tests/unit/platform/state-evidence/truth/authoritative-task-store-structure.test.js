import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
const LEGACY_COMPAT_PATH = join(process.cwd(), "src", "core", "storage", "sqlite", "authoritative-task-store-legacy-compat.ts");
const DELEGATING_CORE_PATH = join(process.cwd(), "src", "core", "storage", "sqlite", "authoritative-task-store-delegating-core.ts");
const DELEGATING_BASE_PATH = join(process.cwd(), "src", "core", "storage", "sqlite", "authoritative-task-store-delegating-base.ts");
const DELEGATING_METHOD_PATHS = [
    "authoritative-task-store-delegating-lifecycle.ts",
    "authoritative-task-store-delegating-engagement.ts",
    "authoritative-task-store-delegating-governance.ts",
    "authoritative-task-store-delegating-runtime.ts",
].map((filename) => join(process.cwd(), "src", "core", "storage", "sqlite", filename));
const DELETED_METHOD_PATHS = [
    "authoritative-task-store-methods-01.ts",
    "authoritative-task-store-methods-01b.ts",
    "authoritative-task-store-methods-02.ts",
    "authoritative-task-store-methods-03.ts",
    "authoritative-task-store-methods-04.ts",
    "authoritative-task-store-methods-05.ts",
    "authoritative-task-store-methods-06.ts",
    "authoritative-task-store-methods-07.ts",
    "authoritative-task-store-methods-08.ts",
    "authoritative-task-store-methods-09.ts",
    "authoritative-task-store-methods-10.ts",
    "authoritative-task-store-methods-11.ts",
    "authoritative-task-store-methods-12.ts",
    "authoritative-task-store-methods-13.ts",
].map((filename) => join(process.cwd(), "src", "core", "storage", "sqlite", filename));
const LEGACY_ADAPTER_PATH = join(process.cwd(), "src", "core", "storage", "sqlite", "repositories", "legacy-authoritative-task-store-adapter.ts");
const CONSUMER_SCAN_ROOTS = [
    join(process.cwd(), "src", "core"),
    join(process.cwd(), "src", "gateway"),
];
const EXPECTED_ACCESSORS = [
    "task",
    "workflow",
    "execution",
    "session",
    "event",
    "worker",
    "approval",
    "billing",
    "lease",
    "lock",
    "memory",
    "artifact",
    "dispatch",
    "division",
    "secret",
    "marketplace",
    "release",
    "organization",
    "intelligence",
    "evolution",
    "governance",
    "operations",
    "runtimeRecovery",
    "views",
];
function countMatches(source, pattern) {
    return [...source.matchAll(pattern)].length;
}
function listTypeScriptFiles(root) {
    const results = [];
    for (const entry of readdirSync(root, { withFileTypes: true })) {
        const candidate = join(root, entry.name);
        if (entry.isDirectory()) {
            if (candidate.includes(`${join("src", "core", "storage", "sqlite")}`)) {
                continue;
            }
            results.push(...listTypeScriptFiles(candidate));
            continue;
        }
        if (entry.isFile() && candidate.endsWith(".ts")) {
            results.push(candidate);
        }
    }
    return results;
}
test("AuthoritativeTaskStore legacy compat stays as a thin abstract signature layer", () => {
    const source = readFileSync(LEGACY_COMPAT_PATH, "utf8");
    const lineCount = source.split("\n").length;
    assert.ok(lineCount <= 350, `legacy compat should stay thin, got ${lineCount} lines`);
    assert.equal(source.includes(".prepare("), false, "legacy compat must not contain direct SQL prepare calls");
    assert.equal(source.includes("INSERT INTO"), false, "legacy compat must not embed SQL statements");
    assert.equal(source.includes("queryAll("), false, "legacy compat must not run query helpers directly");
    assert.equal(source.includes("queryOne("), false, "legacy compat must not run query helpers directly");
    const abstractMethodCount = countMatches(source, /^\s*public abstract \w+\(/gm);
    assert.ok(abstractMethodCount >= 200, `expected broad abstract compatibility surface, got ${abstractMethodCount}`);
});
test("AuthoritativeTaskStore delegating core remains repository-backed and method-complete", () => {
    const legacySource = readFileSync(LEGACY_COMPAT_PATH, "utf8");
    const coreSource = readFileSync(DELEGATING_CORE_PATH, "utf8");
    const baseSource = readFileSync(DELEGATING_BASE_PATH, "utf8");
    const methodSources = DELEGATING_METHOD_PATHS.map((path) => readFileSync(path, "utf8"));
    const combinedMethodSource = methodSources.join("\n");
    assert.ok(baseSource.includes("createAuthoritativeTaskStoreRepositories"), "delegating base should build the repository set");
    assert.ok(coreSource.split("\n").length <= 20, `delegating core entrypoint should stay thin, got ${coreSource.split("\n").length} lines`);
    assert.equal(baseSource.includes(".prepare("), false, "delegating base must not contain direct SQL prepare calls");
    assert.equal(baseSource.includes("INSERT INTO"), false, "delegating base must not embed SQL statements");
    assert.equal(combinedMethodSource.includes(".prepare("), false, "delegating method files must not contain direct SQL prepare calls");
    assert.equal(combinedMethodSource.includes("INSERT INTO"), false, "delegating method files must not embed SQL statements");
    assert.equal(combinedMethodSource.includes("this.callRepo("), false, "delegating method files should use helper delegation instead of direct callRepo");
    const abstractMethodCount = countMatches(legacySource, /^\s*public abstract (\w+)\(/gm);
    const overrideMethodCount = countMatches(combinedMethodSource, /^\s*public override (\w+)\(/gm);
    assert.equal(overrideMethodCount, abstractMethodCount, "delegating method files should implement every abstract compatibility method");
});
test("AuthoritativeTaskStore base exposes repository accessors and query aliases", () => {
    const source = readFileSync(DELEGATING_BASE_PATH, "utf8");
    for (const accessor of EXPECTED_ACCESSORS) {
        assert.ok(source.includes(`public get ${accessor}()`), `delegating base should expose accessor ${accessor}`);
    }
});
test("AuthoritativeTaskStore deletes legacy methods files and unused adapter shims", () => {
    for (const deletedPath of DELETED_METHOD_PATHS) {
        assert.equal(existsSync(deletedPath), false, `legacy methods file should be deleted: ${deletedPath}`);
    }
    assert.equal(existsSync(LEGACY_ADAPTER_PATH), false, "legacy authoritative-task-store adapter should be deleted");
});
test("AuthoritativeTaskStore consumers use repository accessors instead of legacy store methods", () => {
    const offenderPattern = /\b(?:this\.store|store|deps\.store|options\.store|h\.store)\.[A-Za-z_][A-Za-z0-9_]*\(/g;
    const allowList = new Set([
        "withConnection(",
        "set(",
        "invalidateByTag(",
        "invalidateNamespace(",
    ]);
    const offenders = [];
    for (const root of CONSUMER_SCAN_ROOTS) {
        for (const filePath of listTypeScriptFiles(root)) {
            const source = readFileSync(filePath, "utf8");
            if (!source.includes("AuthoritativeTaskStore")
                && !source.includes("Phase1aStore")) {
                continue;
            }
            for (const match of source.matchAll(offenderPattern)) {
                if ([...allowList].some((allowed) => match[0].endsWith(allowed))) {
                    continue;
                }
                offenders.push(`${filePath}: ${match[0]}`);
            }
        }
    }
    assert.deepEqual(offenders, []);
});
//# sourceMappingURL=authoritative-task-store-structure.test.js.map