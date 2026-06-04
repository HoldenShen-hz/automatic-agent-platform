import { mkdtempSync, mkdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REPO_TEST_ARTIFACT_ROOT = resolve(REPO_ROOT, "data", "test-artifacts");

let cachedTempRoot: string | null = null;

function resolveUsableTempRoot(): string {
  if (cachedTempRoot != null) {
    return cachedTempRoot;
  }

  const configuredRoot = process.env["AA_TEST_TMPDIR"]?.trim();
  const candidates = [
    configuredRoot,
    tmpdir(),
    REPO_TEST_ARTIFACT_ROOT,
  ].filter((candidate): candidate is string => typeof candidate === "string" && candidate.length > 0);

  for (const candidate of candidates) {
    try {
      mkdirSync(candidate, { recursive: true });
      const probe = mkdtempSync(join(candidate, "aa-temp-root-probe-"));
      rmSync(probe, { recursive: true, force: true });
      cachedTempRoot = candidate;
      return candidate;
    } catch {
      continue;
    }
  }

  throw new Error("test_temp_root_unavailable");
}

export function createTempWorkspace(prefix: string): string {
  return mkdtempSync(join(resolveUsableTempRoot(), prefix));
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
