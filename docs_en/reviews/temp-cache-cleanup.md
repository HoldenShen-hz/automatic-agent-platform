# Project Cleanup Review - Temporary Files and Cache

**Date**: 2026-05-17
**Purpose**: Identify temporary files, cache files, and runtime artifacts that can be safely deleted

---

## 1. Runtime Database Files (`:memory:` Files)

**Location**: Project root (`/:memory:*`)
**Pattern**: `:memory:aa-truth-append-*`, `:memory:aa-truth-cost-*`, `:memory:aa-truth-exec-*`, `:memory:aa-truth-session-*`
**Quantity**: ~50 files (each 2.1MB)
**Date**: May 8-17, 2026
**Safe to delete**: Yes - these are in-memory databases written to disk during test runtime

```bash
rm -f :memory:*
```

---

## 2. Test Database Files (`.test-db/`)

**Location**: `.test-db/`
**Pattern**: `*.db`, `checkpoint-perf-*.db`, `happy-path-records-*.db`, `multi-step-*`
**Quantity**: 2946 files, ~94MB
**Safe to delete**: Yes - unit/integration test artifacts

```bash
rm -rf .test-db/
```

---

## 3. `.tmp/` Directory

**Location**: `.tmp/`
**Contents**: `delegation/`, `quality.md`
**Date**: May 16, 2026
**Safe to delete**: Yes - temporary files

```bash
rm -rf .tmp/
```

---

## 4. `.audit/` Directory

**Location**: `.audit/`
**Contents**: `delegation/`, `quality.md`
**Safe to delete**: Yes - audit artifacts

```bash
rm -rf .audit/
```

---

## 5. `.runtime/` Directory

**Location**: `.runtime/`
**Contents**: `governance-console.sqlite` (32KB)
**Safe to delete**: Yes - runtime artifacts

```bash
rm -rf .runtime/
```

---

## 6. `.aa-tool-artifacts/` Directory

**Location**: `.aa-tool-artifacts/`
**Contents**: `multi-step/` subdirectory (676 files, 21MB)
**Safe to delete**: Yes - Claude Code session tool artifacts

```bash
rm -rf .aa-tool-artifacts/
```

---

## 7. `logs/` Directory

**Location**: `logs/`
**Contents**: `clamped-files.log` (69KB)
**Safe to delete**: Yes - log files

```bash
rm -f logs/clamped-files.log
```

---

## 8. `.DS_Store` Files

**Location**: Multiple locations (project root, src/, docs_zh/)
**Safe to delete**: Yes - macOS system files

```bash
find . -name ".DS_Store" -delete
```

---

## 9. `.env` and `.env.example`

**Status**: `.env` 9726 bytes (may contain real configuration), `.env.example` same size
**Suggestion**: Keep `.env.example`, check `.env` before deletion - may contain development credentials

---

## Recommended Deletion Commands Summary

```bash
# Dry run first (remove -n after confirmation)
cd <repo-root>

# 1. Runtime in-memory files (50 files, ~100MB)
rm -f :memory:*

# 2. Test databases (~3K files, ~94MB)
rm -rf .test-db/

# 3. Temporary directories (~22MB)
rm -rf .tmp/
rm -rf .audit/
rm -rf .runtime/
rm -rf .aa-tool-artifacts/

# 4. Log files
rm -f logs/clamped-files.log

# 5. macOS system files
find . -name ".DS_Store" -delete
```

**Estimated space recovery**: ~240MB+

**Do not delete**: `.env`, `.env.example`, `.git/`, `.github/`, `.husky/`, `.claude/`
