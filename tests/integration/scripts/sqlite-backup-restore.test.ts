import assert from "node:assert/strict";
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

const REPO_ROOT = process.cwd();
const BACKUP_SCRIPT_SOURCE = join(REPO_ROOT, "scripts", "backup-sqlite.sh");
const RESTORE_SCRIPT_SOURCE = join(REPO_ROOT, "scripts", "restore-sqlite.sh");

function writeExecutable(path: string, content: string) {
  writeFileSync(path, content);
  chmodSync(path, 0o755);
}

function setupBackupWorkspace() {
  const workspace = mkdtempSync(join(tmpdir(), "aa-backup-script-"));
  mkdirSync(join(workspace, "scripts"), { recursive: true });
  mkdirSync(join(workspace, "data", "sqlite"), { recursive: true });
  mkdirSync(join(workspace, "backups"), { recursive: true });
  copyFileSync(BACKUP_SCRIPT_SOURCE, join(workspace, "scripts", "backup-sqlite.sh"));
  return workspace;
}

function setupRestoreWorkspace(migrationPlanContents = "defineMigration(5, async () => {});\n") {
  const workspace = mkdtempSync(join(tmpdir(), "aa-restore-script-"));
  mkdirSync(join(workspace, "scripts"), { recursive: true });
  mkdirSync(join(workspace, "data", "sqlite"), { recursive: true });
  mkdirSync(
    join(workspace, "src", "platform", "five-plane-state-evidence", "truth", "sqlite"),
    { recursive: true },
  );
  copyFileSync(RESTORE_SCRIPT_SOURCE, join(workspace, "scripts", "restore-sqlite.sh"));
  writeFileSync(
    join(
      workspace,
      "src",
      "platform",
      "five-plane-state-evidence",
      "truth",
      "sqlite",
      "sqlite-migration-plan.ts",
    ),
    migrationPlanContents,
  );
  return workspace;
}

function installFakeSqliteAndRclone(workspace: string) {
  const binDir = join(workspace, "bin");
  mkdirSync(binDir, { recursive: true });
  writeExecutable(
    join(binDir, "sqlite3"),
    [
      "#!/usr/bin/env bash",
      "set -euo pipefail",
      "db_path=\"$1\"",
      "shift || true",
      "command=\"$*\"",
      "if [[ \"$command\" == *\".backup '\"* ]]; then",
      "  destination=\"${command##*.backup \\'}\"",
      "  destination=\"${destination%\\'}\"",
      "  printf 'backup:%s\\n' \"$db_path\" > \"$destination\"",
      "  exit 0",
      "fi",
      "if [[ \"$command\" == *\".restore '\"* ]]; then",
      "  exit 0",
      "fi",
      "if [[ \"$command\" == \"PRAGMA integrity_check;\" ]]; then",
      "  printf 'ok\\n'",
      "  exit 0",
      "fi",
      "if [[ \"$command\" == \"SELECT COALESCE(MAX(version), 0) FROM schema_migrations;\" ]]; then",
      "  case \"$db_path\" in",
      "    *backup-downgrade.db) printf '2\\n' ;;",
      "    *current-downgrade.db) printf '5\\n' ;;",
      "    *backup-newer.db) printf '999999\\n' ;;",
      "    *) printf '3\\n' ;;",
      "  esac",
      "  exit 0",
      "fi",
      "if [[ \"$command\" == \"SELECT COUNT(*) FROM sqlite_master WHERE type='table';\" ]]; then",
      "  printf '1\\n'",
      "  exit 0",
      "fi",
      "echo \"unexpected sqlite3 invocation: $db_path $command\" >&2",
      "exit 1",
      "",
    ].join("\n"),
  );
  writeExecutable(
    join(binDir, "rclone"),
    [
      "#!/usr/bin/env bash",
      "set -euo pipefail",
      "exit 0",
      "",
    ].join("\n"),
  );
  return binDir;
}

function runBashScript(scriptPath: string, args: string[], cwd: string, env: NodeJS.ProcessEnv = {}) {
  return spawnSync("bash", [scriptPath, ...args], {
    cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      ...env,
    },
  });
}

test("backup-sqlite refuses backup directories outside repo backups root", () => {
  const workspace = setupBackupWorkspace();
  const outsideDir = mkdtempSync(join(tmpdir(), "aa-backup-outside-"));

  try {
    const result = runBashScript(
      join(workspace, "scripts", "backup-sqlite.sh"),
      ["data/sqlite/test.db", outsideDir],
      workspace,
    );

    assert.equal(result.status, 2, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stderr, /BACKUP_DIR must stay within/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
    rmSync(outsideDir, { recursive: true, force: true });
  }
});

test("backup-sqlite rejects sqlite meta-command characters in backup path", () => {
  const workspace = setupBackupWorkspace();

  try {
    const result = runBashScript(
      join(workspace, "scripts", "backup-sqlite.sh"),
      ["data/sqlite/test.db", "backups/bad;dir"],
      workspace,
    );

    assert.equal(result.status, 2, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stderr, /unsupported sqlite meta-command characters/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test("backup-sqlite uses explicit lock-conflict exit code", () => {
  const workspace = setupBackupWorkspace();
  mkdirSync(join(workspace, "backups", ".backup_lock.d"), { recursive: true });

  try {
    const result = runBashScript(
      join(workspace, "scripts", "backup-sqlite.sh"),
      ["data/sqlite/test.db", "backups"],
      workspace,
    );

    assert.equal(result.status, 3, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stderr, /Backup already in progress/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test("backup-sqlite rejects invalid remote destinations before upload", () => {
  const workspace = setupBackupWorkspace();
  const binDir = installFakeSqliteAndRclone(workspace);

  try {
    const result = runBashScript(
      join(workspace, "scripts", "backup-sqlite.sh"),
      ["data/sqlite/test.db", "backups"],
      workspace,
      {
        PATH: `${binDir}:${process.env.PATH ?? ""}`,
        AA_BACKUP_REMOTE_URI: "remote:--config",
      },
    );

    assert.equal(result.status, 2, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stderr, /AA_BACKUP_REMOTE_URI is not an approved remote destination/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test("backup-sqlite retention preserves unuploaded remote backups and deletes uploaded ones", () => {
  const workspace = setupBackupWorkspace();
  const binDir = installFakeSqliteAndRclone(workspace);
  const staleUnuploaded = join(workspace, "backups", "backup_20000101_000000_000000.db");
  const staleUploaded = join(workspace, "backups", "backup_20000102_000000_000000.db");
  const oldDate = new Date("2000-01-01T00:00:00.000Z");

  writeFileSync(staleUnuploaded, "stale-unuploaded\n");
  writeFileSync(`${staleUnuploaded}.sha256`, "checksum\n");
  writeFileSync(staleUploaded, "stale-uploaded\n");
  writeFileSync(`${staleUploaded}.sha256`, "checksum\n");
  writeFileSync(`${staleUploaded}.uploaded`, "");
  utimesSync(staleUnuploaded, oldDate, oldDate);
  utimesSync(`${staleUnuploaded}.sha256`, oldDate, oldDate);
  utimesSync(staleUploaded, oldDate, oldDate);
  utimesSync(`${staleUploaded}.sha256`, oldDate, oldDate);
  utimesSync(`${staleUploaded}.uploaded`, oldDate, oldDate);

  try {
    const result = runBashScript(
      join(workspace, "scripts", "backup-sqlite.sh"),
      ["data/sqlite/test.db", "backups"],
      workspace,
      {
        PATH: `${binDir}:${process.env.PATH ?? ""}`,
        AA_BACKUP_REMOTE_URI: "approved-remote:sqlite-backups",
        RETENTION_DAYS: "7",
      },
    );

    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.equal(existsSync(staleUnuploaded), true);
    assert.equal(existsSync(`${staleUnuploaded}.sha256`), true);
    assert.equal(existsSync(staleUploaded), false);
    assert.equal(existsSync(`${staleUploaded}.sha256`), false);
    assert.equal(existsSync(`${staleUploaded}.uploaded`), false);
    assert.equal(
      existsSync(join(workspace, "backups", "backup_20000101_000000_000000.db.uploaded")),
      false,
    );
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test("restore-sqlite refuses target paths outside repo data root", () => {
  const workspace = setupRestoreWorkspace();
  const outsideDir = mkdtempSync(join(tmpdir(), "aa-restore-outside-"));

  try {
    const result = runBashScript(
      join(workspace, "scripts", "restore-sqlite.sh"),
      [join(workspace, "backups", "missing.db"), join(outsideDir, "target.db")],
      workspace,
    );

    assert.equal(result.status, 2, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stderr, /DB_PATH must stay within/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
    rmSync(outsideDir, { recursive: true, force: true });
  }
});

test("restore-sqlite fails closed when migration head cannot be determined", () => {
  const workspace = setupRestoreWorkspace("// empty on purpose\n");
  const binDir = installFakeSqliteAndRclone(workspace);
  const backupPath = join(workspace, "backups", "restore-input.db");
  const dbPath = join(workspace, "data", "sqlite", "restore-target.db");

  mkdirSync(join(workspace, "backups"), { recursive: true });
  writeFileSync(backupPath, "backup\n");
  writeFileSync(dbPath, "current\n");

  try {
    const result = runBashScript(
      join(workspace, "scripts", "restore-sqlite.sh"),
      [backupPath, dbPath],
      workspace,
      {
        PATH: `${binDir}:${process.env.PATH ?? ""}`,
      },
    );

    assert.equal(result.status, 1, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stderr, /Could not determine repository migration head|No migrations found/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test("restore-sqlite requires explicit downgrade confirmation flag", () => {
  const workspace = setupRestoreWorkspace();
  const binDir = installFakeSqliteAndRclone(workspace);
  const backupPath = join(workspace, "backups", "backup-downgrade.db");
  const dbPath = join(workspace, "data", "sqlite", "current-downgrade.db");

  mkdirSync(join(workspace, "backups"), { recursive: true });
  writeFileSync(backupPath, "backup\n");
  writeFileSync(dbPath, "current\n");

  try {
    const result = runBashScript(
      join(workspace, "scripts", "restore-sqlite.sh"),
      [backupPath, dbPath],
      workspace,
      {
        PATH: `${binDir}:${process.env.PATH ?? ""}`,
        AA_RESTORE_ALLOW_SCHEMA_DOWNGRADE: "1",
      },
    );

    assert.equal(result.status, 1, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stderr, /--confirm-schema-downgrade/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test("restore-sqlite permits downgrade only with env override and confirmation flag", () => {
  const workspace = setupRestoreWorkspace();
  const binDir = installFakeSqliteAndRclone(workspace);
  const backupPath = join(workspace, "backups", "backup-downgrade.db");
  const dbPath = join(workspace, "data", "sqlite", "current-downgrade.db");

  mkdirSync(join(workspace, "backups"), { recursive: true });
  writeFileSync(backupPath, "backup\n");
  writeFileSync(dbPath, "current\n");

  try {
    const result = runBashScript(
      join(workspace, "scripts", "restore-sqlite.sh"),
      [backupPath, dbPath, "--confirm-schema-downgrade"],
      workspace,
      {
        PATH: `${binDir}:${process.env.PATH ?? ""}`,
        AA_RESTORE_ALLOW_SCHEMA_DOWNGRADE: "1",
      },
    );

    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /Restored successfully/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});
