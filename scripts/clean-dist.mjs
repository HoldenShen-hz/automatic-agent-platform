import { existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const distPath = resolve(process.cwd(), "dist");
const preserveDist = process.env.AA_PRESERVE_DIST === "1";

if (!preserveDist && existsSync(distPath)) {
  try {
    rmSync(distPath, { recursive: true, force: true });
  } catch (err) {
    if (err.code !== "ENOENT" && err.code !== "ENOTEMPTY") {
      throw err;
    }
  }
}
