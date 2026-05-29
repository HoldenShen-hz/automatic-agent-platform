import "./test-cleanup.js";
import { mkdtempSync, rmSync, mkdirSync, realpathSync, writeFileSync, symlinkSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";

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
