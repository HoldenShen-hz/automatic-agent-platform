# Project Cleanup Review - Temp & Cache Files

**Date**: 2026-05-17
**Purpose**: Identify temporary files, cache files, and runtime artifacts that can be safely deleted

---

## 1. Runtime Database Files (`:memory:` files)

**Location**: Project root (`/:memory:*`)
**Pattern**: `:memory:aa-truth-append-*`, `:memory:aa-truth-cost-*`, `:memory:aa-truth-exec-*`, `:memory:aa-truth-session-*`
**Count**: ~50 files (2.1MB each)
**Age**: Various dates (May 8-17, 2026)
**Safe to Delete**: Yes - these are in-memory SQLite databases written to disk as temp files during test runs

```bash
rm -f /Users/holden/Project/automatic_agent/automatic_agent_platform/:memory:*
```

---

## 2. Test Database Files (`.test-db/`)

**Location**: `.test-db/`
**Pattern**: `*.db`, `checkpoint-perf-*.db`, `happy-path-records-*.db`, `multi-step-*`
**Count**: 2946 files totaling ~94MB
**Age**: Various
**Safe to Delete**: Yes - test artifacts from unit/integration tests

```bash
rm -rf /Users/holden/Project/automatic_agent/automatic_agent_platform/.test-db/
```

---

## 3. `.tmp/` Directory

**Location**: `.tmp/`
**Contents**: `delegation/`, `quality.md`
**Age**: May 16, 2026
**Safe to Delete**: Yes - temporary files

```bash
rm -rf /Users/holden/Project/automatic_agent/automatic_agent_platform/.tmp/
```

---

## 4. `.audit/` Directory

**Location**: `.audit/`
**Contents**: `delegation/`, `quality.md`
**Safe to Delete**: Yes - audit artifacts

```bash
rm -rf /Users/holden/Project/automatic_agent/automatic_agent_platform/.audit/
```

---

## 5. Runtime Directory (`.runtime/`)

**Location**: `.runtime/`
**Contents**: `governance-console.sqlite` (32KB)
**Safe to Delete**: Yes - runtime artifact

```bash
rm -rf /Users/holden/Project/automatic_agent/automatic_agent_platform/.runtime/
```

---

## 6. `.aa-tool-artifacts/` Directory

**Location**: `.aa-tool-artifacts/`
**Contents**: `multi-step/` subdirectory (676 files, 21MB)
**Safe to Delete**: Yes - tool artifacts from Claude Code sessions

```bash
rm -rf /Users/holden/Project/automatic_agent/automatic_agent_platform/.aa-tool-artifacts/
```

---

## 7. `logs/` Directory

**Location**: `logs/`
**Contents**: `clamped-files.log` (69KB)
**Safe to Delete**: Yes - log file

```bash
rm -f /Users/holden/Project/automatic_agent/automatic_agent_platform/logs/clamped-files.log
```

---

## 8. `.DS_Store` Files

**Location**: Various (project root, src/, docs_zh/)
**Safe to Delete**: Yes - macOS system files

```bash
find /Users/holden/Project/automatic_agent/automatic_agent_platform -name ".DS_Store" -delete
```

---

## 9. `.env` and `.env.example`

**Status**: `.env` is 9726 bytes (likely contains real config), `.env.example` is same size
**Recommendation**: Keep `.env.example`, review `.env` before deletion - may contain development credentials

---

## Summary - Recommended Deletion Commands

```bash
# Dry run first (remove -n flag for actual deletion)
cd /Users/holden/Project/automatic_agent/automatic_agent_platform

# 1. Runtime memory files (50 files, ~100MB)
rm -f :memory:*

# 2. Test databases (~3K files, ~94MB)
rm -rf .test-db/

# 3. Temp directories (~22MB)
rm -rf .tmp/
rm -rf .audit/
rm -rf .runtime/
rm -rf .aa-tool-artifacts/

# 4. Log file
rm -f logs/clamped-files.log

# 5. macOS system files
find . -name ".DS_Store" -delete
```

**Total Space Recovery**: ~240MB+

**Do NOT delete**: `.env`, `.env.example`, `.git/`, `.github/`, `.husky/`, `.claude/`