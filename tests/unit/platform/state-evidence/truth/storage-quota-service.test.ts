import assert from "node:assert/strict";
import { existsSync, symlinkSync, utimesSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";

import { createWorkspaceWritePolicy } from "../../../../../src/platform/control-plane/iam/sandbox-policy.js";
import {
  StorageQuotaService,
  type StorageQuotaCategoryConfig,
} from "../../../../../src/platform/state-evidence/truth/storage-quota-service.js";
import { cleanupPath, createFile, createTempWorkspace } from "../../../../helpers/fs.js";

function applyModifiedAt(path: string, unixSeconds: number): void {
  utimesSync(path, unixSeconds, unixSeconds);
}

test("storage quota service removes oldest unpinned files until category falls under quota", () => {
  const workspace = createTempWorkspace("aa-storage-quota-");
  const artifactRoot = join(workspace, "artifacts");
  const debugRoot = join(workspace, "debug");
  const backupRoot = join(workspace, "backups");

  try {
    const oldArtifact = join(artifactRoot, "task-1", "artifact-old", "old.txt");
    const pinnedArtifact = join(artifactRoot, "task-1", "artifact-keep", "keep.txt");
    const debugLog = join(debugRoot, "debug.log");
    const backupFile = join(backupRoot, "runtime.db.backup");

    createFile(oldArtifact, "a".repeat(80));
    createFile(pinnedArtifact, "b".repeat(90));
    createFile(debugLog, "c".repeat(120));
    createFile(backupFile, "d".repeat(100));

    applyModifiedAt(oldArtifact, 1_000);
    applyModifiedAt(pinnedArtifact, 2_000);
    applyModifiedAt(debugLog, 1_500);
    applyModifiedAt(backupFile, 1_250);

    const categories: StorageQuotaCategoryConfig[] = [
      {
        categoryId: "artifact",
        roots: [artifactRoot],
        maxBytes: 120,
        cleanupEnabled: true,
        pinnedPaths: [pinnedArtifact],
      },
      {
        categoryId: "debug",
        roots: [debugRoot],
        maxBytes: 64,
        cleanupEnabled: true,
        pinnedPaths: [],
      },
      {
        categoryId: "backup",
        roots: [backupRoot],
        maxBytes: 64,
        cleanupEnabled: true,
        pinnedPaths: [],
      },
    ];

    const report = new StorageQuotaService({
      sandboxPolicy: createWorkspaceWritePolicy(workspace),
      categories,
    }).enforce();

    assert.equal(report.categories.length, 3);
    assert.equal(existsSync(oldArtifact), false);
    assert.equal(existsSync(pinnedArtifact), true);
    assert.equal(existsSync(debugLog), false);
    assert.equal(existsSync(backupFile), false);
    assert.equal(report.categories.every((category) => category.overQuota === false), true);
    assert.equal(report.categories.find((category) => category.categoryId === "artifact")?.pinnedFileCount, 1);
  } finally {
    cleanupPath(workspace);
  }
});

test("storage quota service reports file roots and preserves over-quota files when cleanup is disabled", () => {
  const workspace = createTempWorkspace("aa-storage-quota-file-root-");
  const artifactFile = join(workspace, "artifacts", "bundle.json");

  try {
    createFile(artifactFile, "x".repeat(64));

    const report = new StorageQuotaService({
      sandboxPolicy: createWorkspaceWritePolicy(workspace),
      categories: [
        {
          categoryId: "artifact",
          roots: [artifactFile],
          maxBytes: 32,
          cleanupEnabled: false,
          pinnedPaths: [artifactFile],
        },
      ],
    }).enforce();

    assert.equal(existsSync(artifactFile), true);
    assert.equal(report.categories.length, 1);
    assert.equal(report.categories[0]?.fileCount, 1);
    assert.equal(report.categories[0]?.pinnedFileCount, 1);
    assert.equal(report.categories[0]?.overQuota, true);
    assert.deepEqual(report.categories[0]?.removedFiles, []);
    assert.equal(report.categories[0]?.removedBytes, 0);
  } finally {
    cleanupPath(workspace);
  }
});

test("storage quota service skips missing roots and treats unlimited categories as not over quota", () => {
  const workspace = createTempWorkspace("aa-storage-quota-unlimited-");
  const backupFile = join(workspace, "backups", "runtime.db");
  const missingRoot = join(workspace, "missing-root");

  try {
    createFile(backupFile, "y".repeat(48));

    const report = new StorageQuotaService({
      sandboxPolicy: createWorkspaceWritePolicy(workspace),
      categories: [
        {
          categoryId: "backup",
          roots: [missingRoot, backupFile],
          maxBytes: null,
          cleanupEnabled: true,
          pinnedPaths: [],
        },
      ],
    }).enforce();

    assert.equal(existsSync(backupFile), true);
    assert.equal(report.categories.length, 1);
    assert.equal(report.categories[0]?.fileCount, 1);
    assert.equal(report.categories[0]?.totalBytes, 48);
    assert.equal(report.categories[0]?.overQuota, false);
    assert.equal(report.categories[0]?.overQuotaBytes, 0);
    assert.deepEqual(report.categories[0]?.removedFiles, []);
  } finally {
    cleanupPath(workspace);
  }
});

test("storage quota service skips symlink roots that are neither direct files nor directories", () => {
  const workspace = createTempWorkspace("aa-storage-quota-symlink-root-");
  const artifactRoot = join(workspace, "artifacts");
  const realFile = join(workspace, "real", "bundle.json");
  const symlinkRoot = join(artifactRoot, "bundle-link.json");

  try {
    createFile(realFile, "z".repeat(32));
    createFile(symlinkRoot, "");
    // Replace the regular file created above with a symlink root to exercise the lstat non-file/non-dir path.
    cleanupPath(symlinkRoot);
    symlinkSync(realFile, symlinkRoot);

    const report = new StorageQuotaService({
      sandboxPolicy: createWorkspaceWritePolicy(workspace),
      categories: [
        {
          categoryId: "artifact",
          roots: [symlinkRoot],
          maxBytes: 16,
          cleanupEnabled: true,
          pinnedPaths: [],
        },
      ],
    }).enforce();

    assert.equal(report.categories.length, 1);
    assert.equal(report.categories[0]?.fileCount, 0);
    assert.equal(report.categories[0]?.totalBytes, 0);
    assert.deepEqual(report.categories[0]?.removedFiles, []);
  } finally {
    cleanupPath(workspace);
  }
});

test("storage quota service fail-closes symlink escapes discovered during directory walk", () => {
  const workspace = createTempWorkspace("aa-storage-quota-symlink-escape-");
  const artifactRoot = join(workspace, "artifacts");
  const outsideFile = join(createTempWorkspace("aa-storage-quota-outside-"), "escape.txt");
  const escapedPath = join(artifactRoot, "escape-link");

  try {
    createFile(outsideFile, "outside");
    createFile(escapedPath, "");
    cleanupPath(escapedPath);
    symlinkSync(outsideFile, escapedPath);

    assert.throws(
      () =>
        new StorageQuotaService({
          sandboxPolicy: createWorkspaceWritePolicy(workspace),
          categories: [
            {
              categoryId: "artifact",
              roots: [artifactRoot],
              maxBytes: 16,
              cleanupEnabled: true,
              pinnedPaths: [],
            },
          ],
        }).enforce(),
      /storage_quota\.path_denied|sandbox\.path_outside_allowed_roots/,
    );
  } finally {
    cleanupPath(workspace);
    cleanupPath(dirname(outsideFile));
  }
});

test("storage quota service rejects roots whose nearest existing ancestor is outside the sandbox", () => {
  const workspace = createTempWorkspace("aa-storage-quota-denied-root-");
  const outsideWorkspace = createTempWorkspace("aa-storage-quota-outside-root-");
  const deniedRoot = join(outsideWorkspace, "nested", "missing", "artifact-root");

  try {
    assert.throws(
      () =>
        new StorageQuotaService({
          sandboxPolicy: createWorkspaceWritePolicy(workspace),
          categories: [
            {
              categoryId: "artifact",
              roots: [deniedRoot],
              maxBytes: 16,
              cleanupEnabled: true,
              pinnedPaths: [],
            },
          ],
        }).enforce(),
      /storage_quota\.path_denied|sandbox\.path_outside_allowed_roots/,
    );
  } finally {
    cleanupPath(workspace);
    cleanupPath(outsideWorkspace);
  }
});
