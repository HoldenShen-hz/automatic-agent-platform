#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

cd "${REPO_ROOT}"

MANIFEST_PATH="config/quality/mutation-critical-tests.json"

if [ ! -f "${MANIFEST_PATH}" ]; then
  echo "Missing mutation-critical manifest: ${MANIFEST_PATH}" >&2
  exit 1
fi

mapfile -t TEST_FILES < <(
  node -e '
    const fs = require("node:fs");
    const manifest = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    if (!Array.isArray(manifest.testFiles) || manifest.testFiles.length === 0) {
      console.error(`mutation_critical.invalid_manifest:${process.argv[1]}`);
      process.exit(1);
    }
    for (const file of manifest.testFiles) {
      if (typeof file !== "string" || file.trim().length === 0) {
        console.error(`mutation_critical.invalid_test_file:${String(file)}`);
        process.exit(1);
      }
      process.stdout.write(`${file}\n`);
    }
  ' "${MANIFEST_PATH}"
)

for file in "${TEST_FILES[@]}"; do
  if [ ! -f "${file}" ]; then
    echo "Missing mutation-critical test file: ${file}" >&2
    exit 1
  fi
done

node scripts/run-node-tests.mjs "${TEST_FILES[@]}"
