// Seeded positive sample: rmSync called without a real safety guard.
// The audit:path-safety script MUST report this as P0.
import { rmSync } from "node:fs";
rmSync("/tmp/whatever");
