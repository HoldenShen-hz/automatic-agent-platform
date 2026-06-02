// Seeded evasion sample: rmSync wrapped in a helper with no safety check.
// The audit:path-safety script MUST still report this as P0.
import { rmSync } from "node:fs";
function cleanup() {
  rmSync("/var/lib/anything");
}
cleanup();
