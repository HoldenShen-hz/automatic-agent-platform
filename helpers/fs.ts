import { mkdtempSync, mkdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

export function createTempWorkspace(prefix: string): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

export function cleanupPath(path: string): void {
  rmSync(path, { recursive: true, force: true });
}

export function createFile(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, "utf8");
}

export function createSymlink(target: string, path: string): void {
  mkdirSync(dirname(path), { recursive: true });
  const parentRealPath = realpathSync(dirname(path));
  const resolvedTargetPath = target.startsWith("/") ? target : resolve(parentRealPath, target);
  realpathSync(resolvedTargetPath);
  symlinkSync(target, path);
}
