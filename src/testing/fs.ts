import "./test-cleanup.js";
import { mkdtempSync, rmSync, mkdirSync, realpathSync, writeFileSync, symlinkSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";

const CLEANUP_RETRYABLE_CODES = new Set(["EBUSY", "ENOTEMPTY", "EPERM"]);
const CLEANUP_RETRY_ATTEMPTS = 5;
const CLEANUP_RETRY_DELAY_MS = 20;

export function createTempWorkspace(prefix: string): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

export function cleanupPath(path: string): void {
  assertSafeCleanupPath(path);
  for (let attempt = 0; attempt < CLEANUP_RETRY_ATTEMPTS; attempt += 1) {
    try {
      rmSync(path, { recursive: true, force: true });
      return;
    } catch (error) {
      if (!isRetryableCleanupError(error) || attempt === CLEANUP_RETRY_ATTEMPTS - 1) {
        throw error;
      }
      sleepSync(CLEANUP_RETRY_DELAY_MS * (attempt + 1));
    }
  }
}

export function createFile(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, "utf8");
}

export function createSymlink(target: string, path: string): void {
  mkdirSync(dirname(path), { recursive: true });
  const parentRealPath = realpathSync(dirname(path));
  const resolvedTargetPath = realpathSync(target.startsWith("/") ? target : resolve(parentRealPath, target));
  symlinkSync(resolvedTargetPath, path);
}

function isRetryableCleanupError(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === "object"
    && error !== null
    && "code" in error
    && typeof error.code === "string"
    && CLEANUP_RETRYABLE_CODES.has(error.code);
}

function sleepSync(delayMs: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, delayMs);
}

function assertSafeCleanupPath(path: string): void {
  const trimmed = path.trim();
  if (trimmed.length === 0 || trimmed === "/" || trimmed === ".") {
    throw new Error(`unsafe_cleanup_path:${path}`);
  }
  const resolved = resolve(trimmed);
  const tempRoot = resolve(tmpdir());
  if (!resolved.startsWith(`${tempRoot}/`) && resolved !== tempRoot) {
    throw new Error(`unsafe_cleanup_path:${resolved}`);
  }
}
