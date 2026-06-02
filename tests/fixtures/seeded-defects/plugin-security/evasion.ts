// Seeded evasion sample: loadPlugin is invoked through a thin local
// wrapper, but the wrapper itself does NOT verify. The audit:plugin-security
// script MUST still report this because the call site has no
// preceding verify step on the same line.
import { loadPlugin } from "./plugin-shim.js";

export async function load(): Promise<unknown> {
  return loadPlugin("my-plugin");
}
