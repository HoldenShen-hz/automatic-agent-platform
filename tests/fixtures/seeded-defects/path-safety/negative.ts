// Seeded negative sample: rmSync called inside a function that has repoRoot guard.
// The audit:path-safety script MUST NOT report this.
import { rmSync } from "node:fs";
import { resolve } from "node:path";
const repoRoot = resolve(process.cwd());
rmSync(`${repoRoot}/.tmp/cache`);
