import { readFileSync, readdirSync, statSync } from "node:fs";
import { basename, relative, resolve } from "node:path";

const PAIRS = [
  {
    name: "human takeover",
    syncFile: "src/platform/five-plane-control-plane/incident-control/human-takeover-service.ts",
    asyncFile: "src/platform/five-plane-control-plane/incident-control/human-takeover-service-async.ts",
  },
  {
    name: "execution dispatch",
    syncFile: "src/platform/five-plane-execution/dispatcher/execution-dispatch-service.ts",
    asyncFile: "src/platform/five-plane-execution/dispatcher/execution-dispatch-service-async.ts",
  },
  {
    name: "execution worker handshake",
    syncFile: "src/platform/five-plane-execution/worker-pool/execution-worker-handshake-service.ts",
    asyncFile: "src/platform/five-plane-execution/worker-pool/execution-worker-handshake-service-async.ts",
  },
  {
    name: "execution worker writeback",
    syncFile: "src/platform/five-plane-execution/worker-pool/execution-worker-writeback-service.ts",
    asyncFile: "src/platform/five-plane-execution/worker-pool/execution-worker-writeback-service-async.ts",
  },
];

function walk(root) {
  const files = [];
  const visit = (current) => {
    for (const entry of readdirSync(current)) {
      const path = `${current}/${entry}`;
      const stat = statSync(path);
      if (stat.isDirectory()) {
        visit(path);
      } else if (stat.isFile() && path.endsWith(".ts")) {
        files.push(path);
      }
    }
  };
  visit(root);
  return files;
}

function countImportReferences(files, target, excluded = new Set()) {
  const specifier = basename(target).replace(/\.ts$/, ".js");
  let count = 0;
  const matchedFiles = [];

  for (const file of files) {
    if (excluded.has(resolve(file))) {
      continue;
    }
    const source = readFileSync(file, "utf8");
    if (source.includes(specifier)) {
      count += 1;
      matchedFiles.push(relative(process.cwd(), file));
    }
  }

  return { count, matchedFiles };
}

const srcFiles = walk("src");
const testFiles = walk("tests");
const failures = [];

for (const pair of PAIRS) {
  const syncResolved = resolve(pair.syncFile);
  const asyncResolved = resolve(pair.asyncFile);

  const syncImportedByAsync = countImportReferences(
    [pair.asyncFile],
    pair.syncFile,
  ).count > 0;

  const syncExternalSrc = countImportReferences(
    srcFiles,
    pair.syncFile,
    new Set([syncResolved, asyncResolved]),
  );

  const asyncExternalSrc = countImportReferences(
    srcFiles,
    pair.asyncFile,
    new Set([asyncResolved]),
  );

  const syncTests = countImportReferences(
    testFiles,
    pair.syncFile,
  );

  const asyncTests = countImportReferences(
    testFiles,
    pair.asyncFile,
  );

  const ok = syncImportedByAsync
    && syncExternalSrc.count > 0
    && asyncExternalSrc.count > 0
    && syncTests.count > 0
    && asyncTests.count > 0;

  const detail = [
    `syncImportedByAsync=${syncImportedByAsync}`,
    `syncExternalSrc=${syncExternalSrc.count}`,
    `asyncExternalSrc=${asyncExternalSrc.count}`,
    `syncTests=${syncTests.count}`,
    `asyncTests=${asyncTests.count}`,
  ].join(", ");

  console.log(`${ok ? "ok" : "fail"} ${pair.name} - ${detail}`);

  if (!ok) {
    failures.push({
      pair: pair.name,
      detail,
      syncExamples: syncExternalSrc.matchedFiles.slice(0, 5),
      asyncExamples: asyncExternalSrc.matchedFiles.slice(0, 5),
      syncTestExamples: syncTests.matchedFiles.slice(0, 5),
      asyncTestExamples: asyncTests.matchedFiles.slice(0, 5),
    });
  }
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`pair audit failed for ${failure.pair}`);
    console.error(`  ${failure.detail}`);
    console.error(`  sync examples: ${failure.syncExamples.join(", ") || "none"}`);
    console.error(`  async examples: ${failure.asyncExamples.join(", ") || "none"}`);
    console.error(`  sync test examples: ${failure.syncTestExamples.join(", ") || "none"}`);
    console.error(`  async test examples: ${failure.asyncTestExamples.join(", ") || "none"}`);
  }
  console.error(`sync/async service pair audit failed: ${failures.length}/${PAIRS.length}`);
  process.exit(1);
}

console.log(`sync/async service pair audit passed: ${PAIRS.length}/${PAIRS.length}`);
