import { mkdtempSync, rmSync, mkdirSync, writeFileSync, symlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
export function createTempWorkspace(prefix) {
    return mkdtempSync(join(tmpdir(), prefix));
}
export function cleanupPath(path) {
    rmSync(path, { recursive: true, force: true });
}
export function createFile(path, content) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content, "utf8");
}
export function createSymlink(target, path) {
    mkdirSync(dirname(path), { recursive: true });
    symlinkSync(target, path);
}
//# sourceMappingURL=fs.js.map