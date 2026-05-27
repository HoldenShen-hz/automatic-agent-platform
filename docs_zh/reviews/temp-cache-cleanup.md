# 项目清理审查 - 临时文件与缓存

**日期**: 2026-05-17
**目的**: 识别可安全删除的临时文件、缓存文件和运行时产物

---

## 1. 运行时数据库文件 (`:memory:` 文件)

**位置**: 项目根目录 (`/:memory:*`)
**模式**: `:memory:aa-truth-append-*`, `:memory:aa-truth-cost-*`, `:memory:aa-truth-exec-*`, `:memory:aa-truth-session-*`
**数量**: 约 50 个文件 (每个 2.1MB)
**日期**: 2026年5月8-17日
**可安全删除**: 是 - 这些是测试运行时写入磁盘的内存数据库

```bash
rm -f :memory:*
```

---

## 2. 测试数据库文件 (`.test-db/`)

**位置**: `.test-db/`
**模式**: `*.db`, `checkpoint-perf-*.db`, `happy-path-records-*.db`, `multi-step-*`
**数量**: 2946 个文件，约 94MB
**可安全删除**: 是 - 单元/集成测试的产物

```bash
rm -rf .test-db/
```

---

## 3. `.tmp/` 目录

**位置**: `.tmp/`
**内容**: `delegation/`, `quality.md`
**日期**: 2026年5月16日
**可安全删除**: 是 - 临时文件

```bash
rm -rf .tmp/
```

---

## 4. `.audit/` 目录

**位置**: `.audit/`
**内容**: `delegation/`, `quality.md`
**可安全删除**: 是 - 审计产物

```bash
rm -rf .audit/
```

---

## 5. `.runtime/` 目录

**位置**: `.runtime/`
**内容**: `governance-console.sqlite` (32KB)
**可安全删除**: 是 - 运行时产物

```bash
rm -rf .runtime/
```

---

## 6. `.aa-tool-artifacts/` 目录

**位置**: `.aa-tool-artifacts/`
**内容**: `multi-step/` 子目录 (676 文件, 21MB)
**可安全删除**: 是 - Claude Code 会话的工具产物

```bash
rm -rf .aa-tool-artifacts/
```

---

## 7. `logs/` 目录

**位置**: `logs/`
**内容**: `clamped-files.log` (69KB)
**可安全删除**: 是 - 日志文件

```bash
rm -f logs/clamped-files.log
```

---

## 8. `.DS_Store` 文件

**位置**: 多处 (项目根目录, src/, docs_zh/)
**可安全删除**: 是 - macOS 系统文件

```bash
find . -name ".DS_Store" -delete
```

---

## 9. `.env` 和 `.env.example`

**状态**: `.env` 9726 字节 (可能包含真实配置), `.env.example` 大小相同
**建议**: 保留 `.env.example`，删除前检查 `.env` - 可能包含开发凭据

---

## 推荐删除命令汇总

```bash
# 试运行先 (确认后去掉 -n 参数)
cd <repo-root>

# 1. 运行时内存文件 (50 文件, ~100MB)
rm -f :memory:*

# 2. 测试数据库 (~3K 文件, ~94MB)
rm -rf .test-db/

# 3. 临时目录 (~22MB)
rm -rf .tmp/
rm -rf .audit/
rm -rf .runtime/
rm -rf .aa-tool-artifacts/

# 4. 日志文件
rm -f logs/clamped-files.log

# 5. macOS 系统文件
find . -name ".DS_Store" -delete
```

**预计回收空间**: ~240MB+

**不要删除**: `.env`, `.env.example`, `.git/`, `.github/`, `.husky/`, `.claude/`
