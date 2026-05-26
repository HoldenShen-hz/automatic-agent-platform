# Architecture Design Review

**Review Date**: 2026/05/13
**Reviewer**: Automated Code Review
**Scope**: src, tests, ui, docs_zh, config, scripts

---

## 1. Code Quality and Architecture Issues

### 1.1 Project Structure Overview
- **Total source files**: 6,113 TypeScript files
- **Runtime core**: `src/platform/` contains five-layer architecture (interface, control-plane, orchestration, execution, state-evidence)
- **Upper business**: `src/domains/` (34 domains), `src/interaction/`, `src/org-governance/`, `src/ops-maturity/`, `src/scale-ecosystem/`

### 1.2 Architecture Observations

**Strengths**:
- Clear five-layer platform architecture separation (docs_zh/architecture/00-platform-architecture.md)
- 151 contract documents covering key system boundaries (docs_zh/contracts/)
- Using ESM module system and strict TypeScript configuration (`"strict": true`, `noImplicitOverride`, `exactOptionalPropertyTypes`)
- Decentralized domain architecture allows independent scaling

**Issues**:
1. **Symbolic link usage**: Multiple symbolic links exist under `src/platform/` (`control-plane -> five-plane-control-plane`, `execution -> five-plane-execution`, etc.), which may cause:
   - IDE and tool path resolution issues
   - Difficult Git history tracking
   - Complex build configuration

2. **core/runtime warning**: CLAUDE.md explicitly states that `src/core/runtime/` is a compatibility directory and new canonical runtime logic should not be added. However, the project still uses it and needs cleanup or refactoring.

3. **Scattered configuration**: Configuration is scattered across multiple locations:
   - `config/` (main configuration)
   - `.env.example` (environment variable template)
   - `config/environments/` (dev/staging/prod, etc.)
   - `config/security/` (security configuration)

4. **Type safety**: TypeScript configuration has `noUncheckedIndexedAccess: true` and `exactOptionalPropertyTypes: true` enabled - good practice.

### 1.3 Code Organization Issues

**Long import statements**: Examining source files reveals many deep imports, for example:
```typescript
import { BudgetAllocator } from "../../../../src/platform/five-plane-execution/budget-allocator.js";
```
Package exports should be preferred (`import { BudgetAllocator } from "@automatic-agent/platform/execution"`)

**Test file to source file ratio**: The exclude list in tsconfig.json is too long, indicating possible:
- Test parallelization issues
- Test pollution issues
- Circular dependency issues

---

## 2. Test Coverage

### 2.1 Test Statistics
| Type | Count |
|------|-------|
| Unit test files | 3,584 |
| Integration test files | 134 |
| E2E test files | 834 |
| Source files | 6,113 |

### 2.2 Test Organization
```
tests/
├── unit/           # Unit tests (87 subdirectories)
├── integration/    # Integration tests (42 subdirectories)
├── e2e/           # E2E tests (332 subdirectories)
├── golden/        # Golden tests (48)
├── invariants/    # Invariant tests (87)
├── helpers/       # Test helpers (78)
├── performance/  # Performance tests (58)
```

### 2.3 Issue Observations

**Issues**:
1. **Abnormal unit test to source ratio**: 3,584 unit test files vs 6,113 source files, ratio approximately 0.59:1. Possible:
   - Many test files not properly counted
   - Some source files lack corresponding tests
   - Over-splitting of test files

2. **tsconfig.json exclude list too long**: Excludes large number of test files, indicating:
   - Some tests may be in unstable state
   - Or circular dependency issues exist
   - Test infrastructure may need fixing

3. **High test helper code volume**: 78 helper files indicate complex test infrastructure, possibly indicating:
   - High coupling in code under test
   - Complex test setup
   - Difficult mock object management

4. **Golden tests**: 48 golden files for regression testing - good practice.

---

## 3. Documentation Completeness

### 3.1 Documentation Structure
```
docs_zh/
├── architecture/     # Architecture documents (728KB 00-platform-architecture.md)
├── contracts/        # 151 contract documents
├── adr/             # Architecture Decision Records
├── domains/         # Domain documents
├── guides/          # Quick start, contribution guides, etc.
├── operations/      # Operations documents (runbooks, etc.)
├── reviews/         # This review location
└── quality/         # Quality documents
```

### 3.2 Documentation Observations

**Strengths**:
- Detailed architecture documentation (00-platform-architecture.md 728KB)
- Complete contract document set (151)
- Complete ADR decision records
- Operations documents include runbooks and checklists

**Issues**:
1. **Documentation versioning**: No explicit API versioning strategy document seen
2. **CHANGELOG.md**: Exists but only 6KB, relatively small, may be incomplete
3. **Cross-language documentation**: docs_zh/ and docs_en/ coexist, need to ensure synchronization
4. **CLAUDE.md**: Exists and contains useful information, but could consider adding more examples

---

## 4. Configuration Issues

### 4.1 Configuration Structure
```
config/
├── environments/    # dev.json, staging.json, prod.json, etc.
├── security/       # Security configuration (default.json, threat-matrix.json)
├── ...other config files
```

### 4.2 Security Configuration
- `config/security/default.json`: Defines approvalMode, sandboxMode and other security policies
- `config/security/threat-matrix.json`: Complete STRIDE threat matrix
- JWT secret must be configured in production

### 4.3 Configuration Issue Observations

1. **Environment configuration differences**: Found that `config/security/dev.json` and `config/security/test.json` are identical (both `{}`), but production configuration has actual content.

2. **.env.example completeness**: `.env.example` file is very detailed (8KB) - good practice, but needs attention:
   - Contains many explanatory comments
   - Production environment needs real values

3. **Configuration validation**: No explicit configuration validation mechanism seen in codebase (except schema validation mentioned in threat-matrix)

4. **Sensitive information**: Need to confirm if sensitive information in config files is injected via environment variables

---

## 5. Bash Script Issues

### 5.1 Script List
```
scripts/
├── backup-sqlite.sh       # SQLite backup
├── restore-sqlite.sh     # SQLite restore
├── ci/                   # CI scripts
│   ├── check-changelog.mjs
│   ├── check-coverage-baseline.mjs
│   ├── coverage-lib.mjs
│   ├── generate-coverage-report.mjs
│   ├── mutation-critical-tests.sh
│   └── update-coverage-baseline.mjs
├── clean-dist.mjs
├── generate-src-module-test-matrix.mjs
├── reorg-code-structure.mjs
├── run-curated-tests.mjs
├── run-layered-tests.mjs
└── run-tracked-tests.mjs
```

### 5.2 Script Quality Observations

**backup-sqlite.sh strengths**:
- Properly handles errors with `set -euo pipefail`
- Has PID lock file to prevent concurrent runs
- Verifies integrity after backup
- Cleans up expired backups

**restore-sqlite.sh strengths**:
- Creates pre-restore snapshot
- Verifies backup integrity before restore
- Complete error handling

**Issues**:
1. **Script location**: Some scripts in `scripts/` root, some in `scripts/ci/`, organization slightly chaotic
2. **Python scripts**: Exists `translate_docs.py` (10KB), need to confirm if maintenance is needed
3. **mjs vs sh**: Mixed use of `.mjs` (Node.js ESM) and `.sh` (Bash), need to confirm team skill match

---

## 6. Security Issues

### 6.1 Security Configuration
- **JWT Secret**: Must be configured for API authentication
- **MCP Policy**: `config/security/default.json` defines MCP (Model Context Protocol) policy
- **Sandbox Mode**: read_only mode restricts tool permissions
- **Remote Worker Registration**: Uses challenge-based authentication

### 6.2 Threat Matrix Coverage
STRIDE model coverage:
- **Spoofing**: JWT and workspace authentication, challenge-based worker registration
- **Tampering**: Audit hash chain, append-only event evidence, config schema validation
- **Repudiation**: Operator behavior audit evidence, event timeline export
- **Information Disclosure**: Field encryption, network egress policy, memory encryption
- **Denial of Service**: SLO alerts, runbook-guided containment, rollout freeze gates
- **Elevation of Privilege**: Sandbox policy enforcement, policy engine capability checks

### 6.3 Security Observations

**Strengths**:
- Complete security configuration and threat matrix
- Memory isolation by workspace/session
- Audit log for configuration changes

**Issues**:
1. **Secret management**: `.env.example` has `AA_API_JWT_SECRET=` empty, must be configured in production, but:
   - No secret rotation strategy documentation seen
   - No secret storage solution (should use Vault/KMS, etc.)

2. **MCP security**: MCP policy allows `allowedCapabilities: ["edit", "mcp"]`, need to ensure:
   - Network isolation configuration is correct
   - Transport layer only allows stdio

3. **Database credentials**: PostgreSQL DSN in environment variables, need to ensure:
   - Not hardcoded
   - Has secure injection mechanism

4. **Encryption keys**: Memory encryption key management not explicitly seen in code

---

## 7. UI Code Review

### 7.1 UI Structure
```
ui/
├── apps/
├── packages/
├── tests/
├── .storybook/
├── eslint.config.js
├── lighthouserc.json
├── playwright.config.ts
├── package.json
└── tsconfig.json
```

### 7.2 UI Observations
- Uses TypeScript + Playwright for E2E testing
- Storybook for component development
- Separate lighthouserc.json for performance monitoring
- Separate package management (has its own node_modules)

**Issues**:
1. **UI separate from main project**: UI has its own package.json, indicating may need separate deployment
2. **Test configuration**: Playwright config exists but need to confirm if runs in CI

---

## 8. Deployment and Infrastructure

### 8.1 Deployment Configuration
```
deploy/
├── chaos/
├── grafana/
├── helm/
├── prometheus/
├── runbooks/
├── scripts/
└── terraform/
```

### 8.2 Containerization
- `Dockerfile` exists
- `docker-compose.yml` exists (3.2KB)
- `.dockerignore` exists

---

## 9. Summary and Recommendations

### 9.1 High Priority
1. **Clean up symbolic links**: Symbolic links under `src/platform/` should be converted to actual modules or removed
2. **Secret management**: Establish formal secret management mechanism and rotation strategy
3. **Test stability**: Large number of excluded test files in tsconfig.json should be fixed or marked as known issues
4. **core/runtime cleanup**: Per CLAUDE.md instructions, clean up or refactor `src/core/runtime/`

### 9.2 Medium Priority
1. **Documentation sync**: Ensure docs_zh and docs_en content is synchronized
2. **Configuration validation**: Add startup configuration validation
3. **Test infrastructure**: Consider simplifying 78 test helpers
4. **CI script organization**: Unify scripts directory structure

### 9.3 Low Priority
1. **Python script maintenance**: Check if `translate_docs.py` is needed
2. **UI independent deployment**: Confirm UI service architecture
3. **CHANGELOG improvement**: Add more change details

---

## 2026/05/14 Automated Review Report (Detailed Supplement)

### Found Issues

#### 1. [Source Code] [High Severity] [Symbolic Links Cause Build Inconsistency]
- **File/Path**: 5 symbolic links under `src/platform/` directory
- **Issue Description**: `control-plane`, `execution`, `state-evidence`, `orchestration`, `interface` are all symbolic links pointing to `five-plane-*` directories. This causes:
  1. TypeScript compiler path resolution may be inconsistent
  2. IDE code navigation and autocomplete may fail
  3. Git history tracking is difficult (cannot track which file was actually modified)
  4. Symbolic links may behave differently on different operating systems or filesystems
  5. Build artifact paths may not match source paths
- **Recommended Fix**: Convert symbolic links to actual directories or create virtual module mapping via build tools

#### 2. [Source Code] [Medium Severity] [Giant Single File Issues]
- **File/Path**:
  - `src/platform/five-plane-execution/budget-allocator.ts` (931 lines)
  - `src/platform/five-plane-execution/runtime-state-machine.ts` (690 lines)
  - `src/platform/five-plane-state-evidence/events/durable-event-bus.ts` (1214 lines)
- **Issue Description**: Multiple core module files have too many lines, violating single responsibility principle. These files contain too many functions:
  - `budget-allocator.ts`: Complex budget allocation logic with multiple nested types
  - `runtime-state-machine.ts`: State machine implementation too long
  - `durable-event-bus.ts`: Event bus implementation too large
- **Recommended Fix**: Split these files into multiple smaller modules, for example:
  - `budget-allocator/` directory contains multiple related files
  - `runtime-state-machine/` directory contains state transitions, command handling, etc.
  - `durable-event-bus/` directory contains consumers, delivery, retry, etc. submodules

#### 3. [Source Code] [Medium Severity] [tsconfig.json Exclude List Too Long]
- **File/Path**: `tsconfig.json` exclude section
- **Issue Description**: Approximately 80 test files and directories are excluded, including:
  - Many `*.extended.test.ts` files
  - Entire `tests/unit/platform/five-plane-execution/**/*.test.ts` directory
  - Entire `tests/integration/platform/five-plane-orchestration/**/*.test.ts` directory
  - Multiple `tests/e2e/*.test.ts` files
  - Multiple `tests/unit/interaction/**/*.test.ts`, `tests/unit/ops-maturity/**/*.test.ts`, etc.
- **Recommended Fix**: Investigate root causes for why these tests are excluded:
  1. If tests are unstable (flaky), mark and fix
  2. If circular dependency, refactor code structure
  3. If intentionally excluded extended tests, create separate tsconfig file
  4. If test pollution issue, use workspace isolation

#### 4. [Source Code] [Medium Severity] [core/runtime Compatibility Directory Not Cleaned]
- **File/Path**: `src/core/runtime/`
- **Issue Description**: CLAUDE.md explicitly states `src/core/runtime/` is a compatibility directory and new canonical runtime logic should not be added. But the directory structure still exists and runs in parallel with the new five-layer architecture, which may cause maintenance difficulties and confusion
- **Recommended Fix**:
  1. Evaluate if code in `core/runtime` has been migrated to `five-plane-*` directory
  2. If migrated, delete `core/runtime` directory
  3. If not migrated, create migration plan

#### 5. [Source Code] [Low Severity] [Direct console Usage Instead of Structured Logging]
- **File/Path**: Approximately 26 source files directly use `console.log/debug/info/warn/error`
- **Issue Description**: Project defines `StructuredLogger` (`src/platform/shared/observability/structured-logger.ts`), but 26 files still directly use console methods, which is not conducive to centralized log management and querying
- **Recommended Fix**: Replace all `console.*` calls with `StructuredLogger`

#### 6. [Source Code] [Low Severity] [Overly Deep Import Paths]
- **File/Path**: Multiple source files
- **Issue Description**: Found deep relative imports like `../../../../src/platform/five-plane-execution/budget-allocator.js`, which:
  1. Exposes internal structure
  2. Makes refactoring difficult
  3. Inconsistent with package exports approach
- **Recommended Fix**: Use package exports `import { BudgetAllocator } from "@automatic-agent/platform/execution"`

#### 7. [Source Code] [Medium Severity] [Missing Package Export Barrel Files]
- **File/Path**: `src/platform/` subdirectories
- **Issue Description**: Although `package.json` defines exports mapping, some index.ts files in actual directories are empty or incomplete. For example, `src/platform/five-plane-execution/` index.ts only has simple exports, missing re-exports of main modules
- **Recommended Fix**: Ensure each module's index.ts correctly exports all public APIs

#### 8. [Source Code] [Low Severity] [TODO/FIXME/HACK Comments Not Processed]
- **File/Path**: At least 12 files contain TODO/FIXME/HACK/XXX comments
- **Issue Description**: The following files contain unfinished marker comments:
  - `src/domains/registry/plugin-spi.ts`
  - `src/org-governance/delegated-governance/governance-console-service.ts`
  - `src/sdk/plugin-sdk/plugin-test-harness.ts`
  - `src/platform/five-plane-interface/api/mission-control-service.ts`
  - `src/platform/five-plane-state-evidence/memory/trust-level-service.ts`
  - `src/platform/five-plane-execution/execution-engine/single-task-happy-path.ts`
  - And 6 other files
- **Recommended Fix**:
  1. Convert TODOs to issue tracker tasks
  2. Or create code task tracking
  3. Set lint rules to check these markers

#### 9. [Tests] [High Severity] [Uneven Test Coverage Distribution]
- **File/Path**: `tests/unit/platform/five-plane-execution/` (entire directory excluded)
- **Issue Description**:
  - `tests/unit/platform/five-plane-execution/` directory is completely excluded from TypeScript compilation
  - Contains tests for core functions like budget-allocator, dispatcher, execution-engine
  - This means these critical paths have no CI-level test protection
- **Recommended Fix**: Fix or re-enable these tests

#### 10. [Tests] [High Severity] [Large Number of Integration Tests Excluded]
- **File/Path**: Multiple `tests/integration/**` directories
- **Issue Description**: The following integration test directories are excluded:
  - `tests/integration/platform/five-plane-orchestration/**/*.test.ts`
  - `tests/integration/platform/five-plane-execution/**/*.test.ts`
  - `tests/integration/platform/five-plane-control-plane/**/*.test.ts`
  - `tests/integration/platform/five-plane-interface/**/*.test.ts`
  - `tests/integration/platform/model-gateway/**/*.test.ts`
  - `tests/integration/platform/security/**/*.test.ts`
  - `tests/integration/platform/shared/cache/**/*.test.ts`
  - `tests/integration/platform/shared/stability/**/*.test.ts`
  - `tests/integration/platform/five-plane-state-evidence/events/**/*.test.ts`
  - `tests/integration/platform/five-plane-state-evidence/knowledge/**/*.test.ts`
  - `tests/integration/platform/five-plane-state-evidence/memory/**/*.test.ts`
  - `tests/integration/domains/governance/**/*.test.ts`
  - `tests/integration/interaction/**/*.test.ts`
  - `tests/integration/org-governance/**/*.test.ts`
  - `tests/integration/sdk/cli/billing-cli.test.ts`
- **Recommended Fix**: This is a huge test coverage gap, need to investigate reasons for exclusion one by one and fix

#### 11. [Tests] [Medium Severity] [E2E Tests Excluded]
- **File/Path**: Multiple E2E test files
- **Issue Description**: The following E2E tests are excluded:
  - `tests/e2e/execution-ticket-lifecycle.test.ts`
  - `tests/e2e/multi-region-failover.test.ts`
  - `tests/e2e/task-status-lifecycle.test.ts`
  - `tests/e2e/workflow-state-transitions.test.ts`
  - `tests/e2e/workflow-timeout-flow.test.ts`
- **Recommended Fix**: These are core workflow tests, ensure they run in CI

#### 12. [Tests] [Medium Severity] [Too Many Test Helpers]
- **File/Path**: `tests/helpers/` (78 files)
- **Issue Description**:
  - 78 test helper files indicate complex test infrastructure
  - May indicate high coupling in code under test
  - Mock object management is difficult
  - Requires a lot of setup/teardown code
- **Recommended Fix**:
  1. Evaluate if these helpers can be merged or simplified
  2. Consider introducing more testability-friendly designs in source code
  3. Check for duplicate helper functionality

#### 13. [Tests] [Medium Severity] [Too Few Golden Test Files]
- **File/Path**: `tests/golden/` (48)
- **Issue Description**: Relative to 6113 source files and many functional modules, only 48 golden test files may not be enough to cover regression risk
- **Recommended Fix**: Add more golden test coverage for critical paths

#### 14. [Configuration] [Medium Severity] [Security Configuration Environment Differences]
- **File/Path**: `config/security/` directory
- **Issue Description**:
  - `dev.json` and `test.json` have different content (dev has `approvalMode: strict`, test is empty `{}`)
  - This difference may cause inconsistent behavior between development and test environments
  - Production config `prod.json` and pre-production `pre-prod.json` are identical, both `approvalMode: supervised`
- **Recommended Fix**: Clarify configuration strategy for each environment, ensure test environment can truly reflect production behavior

#### 15. [Configuration] [High Severity] [Sensitive Fields Empty in .env.example]
- **File/Path**: `.env.example`
- **Issue Description**:
  - `AA_API_JWT_SECRET=` is empty, must be configured in production
  - Database connection strings may contain sensitive information
  - Although `.env.example` says not to commit real credentials, lacks secret management guidance
- **Recommended Fix**:
  1. Add secret management guidance comments in `.env.example`
  2. Create `config/secrets/` directory structure example (without real values)
  3. Document secret rotation strategy

#### 16. [Configuration] [Low Severity] [Missing Configuration Validation Mechanism]
- **File/Path**: Global configuration
- **Issue Description**: No explicit configuration validation mechanism seen in codebase (except schema validation in threat-matrix)
- **Recommended Fix**: Add configuration validation step at application startup to ensure all required configurations are populated

#### 17. [Documentation] [Medium Severity] [docs_zh and docs_en Synchronization Issues]
- **File/Path**: `docs_zh/` and `docs_en/`
- **Issue Description**: Two documentation directories exist side by side, need to ensure content synchronization. But no synchronization mechanism or automated checking seen
- **Recommended Fix**:
  1. Create CI process for documentation synchronization check
  2. Or clarify documentation translation process and responsible parties
  3. Consider using automated translation tools

#### 18. [Documentation] [Low Severity] [CHANGELOG Too Small]
- **File/Path**: `CHANGELOG.md` (only 6KB)
- **Issue Description**: Relative to project scale (6000+ source files, 151 contracts), CHANGELOG only 6KB may be incomplete
- **Recommended Fix**: Add more detailed change records including:
  1. Change description for each version
  2. Breaking change descriptions
  3. Migration guides

#### 19. [Documentation] [Medium Severity] [Architecture Documentation Inconsistent with Implementation]
- **File/Path**: `docs_zh/architecture/00-platform-architecture.md` (728KB)
- **Issue Description**: Large architecture document may have inconsistencies with actual implementation, especially during rapid iteration
- **Recommended Fix**:
  1. Add CI tests for architecture compliance checking
  2. Use ADR (Architecture Decision Records) to record all significant changes
  3. Regularly review documentation and implementation consistency

#### 20. [UI] [Medium Severity] [UI Independent Deployment Complexity]
- **File/Path**: `ui/` directory
- **Issue Description**:
  - UI has independent `package.json` and `node_modules`
  - Uses Turborepo workspaces
  - Needs separate dependency management process
  - May lead to dependency version inconsistencies
- **Recommended Fix**:
  1. Ensure UI and main project dependency versions are synchronized
  2. Document UI service deployment process
  3. Consider unified dependency management

#### 21. [UI] [Low Severity] [UI Package Structure Complexity]
- **File/Path**: `ui/packages/`, `ui/apps/`
- **Issue Description**: UI package structure contains:
  - `packages/shared/` (31 sub-functions)
  - `packages/ui-core`
  - `packages/ui-mobile`
  - `apps/web`, `apps/mobile`, `apps/electron-win`, `apps/tauri-linux`, `apps/tauri-macos`
  - `packages/features/` (multiple feature packages)
- **Recommended Fix**: Evaluate if number of packages is necessary, consider merging related packages

#### 22. [Scripts] [Medium Severity] [Script Organization Chaos]
- **File/Path**: `scripts/` directory
- **Issue Description**:
  - Some scripts in `scripts/` root (`.sh` and some `.mjs`)
  - Some in `scripts/ci/` directory
  - `deploy/scripts/` also has scripts
  - No unified script organization standard
- **Recommended Fix**:
  1. Create `scripts/README.md` explaining purpose of each script
  2. Unify all CI-related scripts to `scripts/ci/`
  3. Consider using single language (all mjs or all ts)

#### 23. [Scripts] [Low Severity] [Python Script Maintenance Issues]
- **File/Path**: `translate_docs.py` (10KB)
- **Issue Description**: Project is primarily TypeScript/Node.js but has Python scripts requiring additional Python environment and dependencies maintenance
- **Recommended Fix**:
  1. Evaluate if still in use
  2. If needed, consider rewriting in TypeScript
  3. If not used, delete

#### 24. [Deployment] [Low Severity] [Temporary Build Artifacts Not Cleaned]
- **File/Path**: Root `dist_*` directories
- **Issue Description**: Multiple temporary build directories exist:
  - `dist/`
  - `dist_temp/`
  - `dist_test/`
  - `dist_test_compiled/`
  - `dist_1964/`
  - `dist_issue2014/`
  - `dist_lineage_test/`
- **Recommended Fix**:
  1. Clean up all temporary build directories
  2. Add `dist_*` pattern to `.gitignore`
  3. Create build cleanup script

#### 25. [Source Code] [High Severity] [In-Memory Database File Residuals]
- **File/Path**: Root `:memory:` files
- **Issue Description**: Multiple in-memory database files exist:
  - `:memory:aa-truth-append-*`
  - `:memory:aa-truth-cost-*`
  - `:memory:aa-truth-exec-*`
  - `:memory:aa-truth-session-*`
  - `:memory:aa-truth-status-*`
  - `:memory:aa-truth-wf-*`
  - `:memory:fence-count-*`
  - `:memory:fence-shared-*`
- **Recommended Fix**:
  1. These may be residual files from test processes
  2. Add `:memory:*` pattern to `.gitignore`
  3. Ensure temporary files are cleaned up after tests complete

#### 26. [Source Code] [Medium Severity] [session-replay Directory Too Large]
- **File/Path**: `session-replay/` (1561 entries)
- **Issue Description**: session-replay directory contains many files (possibly from testing or development), occupying approximately 50KB
- **Recommended Fix**:
  1. Evaluate if these replay files need to be kept
  2. If not, exclude in `.gitignore` and clean up
  3. If needed, consider compression or external storage

#### 27. [Source Code] [Medium Severity] [artifacts Directory Too Large]
- **File/Path**: `artifacts/` (489 entries)
- **Issue Description**: artifacts directory contains many files, may affect git operation performance
- **Recommended Fix**:
  1. Evaluate artifacts retention policy
  2. Implement automatic cleanup mechanism for expired artifacts
  3. Consider storing large artifacts in external storage

#### 28. [Source Code] [Low Severity] [data Directory No Structured Organization]
- **File/Path**: `data/` (35 entries)
- **Issue Description**: data directory contains sqlite, stable-* and other subdirectories, but no clear organization structure description
- **Recommended Fix**:
  1. Add README in `data/` directory explaining directory structure
  2. Implement data retention policy (automatic cleanup of old data)
  3. Distinguish between temporary and persistent data

#### 29. [Deployment] [Medium Severity] [deploy Directory Structure Incomplete]
- **File/Path**: `deploy/` directory
- **Issue Description**:
  - Contains terraform, helm, prometheus, grafana and other infrastructure code
  - But chaos and runbooks directories are empty or nearly empty
  - Missing Kubernetes deployment configuration
- **Recommended Fix**:
  1. Complete chaos test scenarios
  2. Increase runbook coverage
  3. Add Kubernetes deployment configuration (if applicable)

#### 30. [Source Code] [Low Severity] [Too Many Domain Modules Cause Complexity]
- **File/Path**: `src/domains/` (60 entries including 34 business domains)
- **Issue Description**:
  - 34 business domains (academic-research, advertising, agriculture, etc.)
  - Each domain may require independent maintenance and updates
  - Inter-domain dependencies are unclear
- **Recommended Fix**:
  1. Create domain dependency graph
  2. Evaluate if domain shared base modules can reduce duplication
  3. Consider domain grouping (similar domains together)

#### 31. [Source Code] [Medium Severity] [contracts Duplicate Export Issues]
- **File/Path**: `src/platform/contracts/` and `src/contracts/` may have duplicates
- **Issue Description**: Project has two places with contract-related code, need to confirm if there are duplicate definitions
- **Recommended Fix**:
  1. Confirm single source of truth for contracts
  2. Ensure no duplicate type definitions
  3. Unify contracts import paths

#### 32. [Tests] [Medium Severity] [tests/unit/helpers/index.test.ts Excluded]
- **File/Path**: `tests/unit/helpers/index.test.ts`
- **Issue Description**: Test of test helpers themselves is excluded, which may mean helpers lack test protection
- **Recommended Fix**:
  1. Investigate why this test is excluded
  2. Enable the test or delete (if meaningless)

#### 33. [Configuration] [Low Severity] [.c8rc.json and stryker.config.mjs Coexist]
- **File/Path**: Root directory
- **Issue Description**: Two coverage configuration files exist simultaneously:
  - `.c8rc.json` (Code coverage)
  - `stryker.config.mjs` (Mutation testing)
  May cause inconsistent coverage reports
- **Recommended Fix**:
  1. Ensure coverage thresholds are consistent between two tools
  2. Unify reports in CI
  3. Consider using single coverage tool

#### 34. [Documentation] [Low Severity] [operations Documentation Doesn't Fully Match Reality]
- **File/Path**: `docs_zh/operations/current_todo_list.md` (38KB)
- **Issue Description**: A large TODO list file exists, indicating many pending items. This may cause documentation to diverge from actual state
- **Recommended Fix**:
  1. Regularly sync TODO list with actual code state
  2. Move completed items to CHANGELOG
  3. Consider using issue tracker instead of documentation TODOs

#### 35. [Source Code] [High Severity] [Source File Count Statistics Contradiction]
- **File/Path**: Global
- **Issue Description**:
  - Using `find` command统计到 1795 个 .ts 文件
  - But documentation mentions 6113 source files
  - This difference needs explanation
- **Recommended Fix**:
  1. Confirm if 6113 includes .js files (compilation output)
  2. Or confirm if test files are included
  3. Update documentation to reflect accurate numbers

---

### Summary

This automated review found 35 issues, among which:

**High Priority (Need Immediate Action)**:
1. Large number of test directories excluded (80+)
2. Symbolic links cause build inconsistency
3. In-memory database file residuals
4. Source file count statistics contradiction
5. JWT secret management unclear

**Medium Priority**:
1. Giant single files need splitting
2. Configuration environment differences
3. Documentation synchronization issues
4. UI independent deployment complexity
5. Script organization chaos
6. Deployment configuration incomplete

**Low Priority**:
1. Code comment cleanup
2. Package structure optimization
3. Python script maintenance
4. Data directory organization

*Review generated: 2026/05/14*

---

## 2026/05/13 Automated Review Report (Detailed Supplement - Second Round)

### Found Issues

#### 36. [Source Code] [High Severity] [Giant Source File - budget-allocator.ts Over 900 Lines]
- **File/Path**: `src/platform/five-plane-execution/budget-allocator.ts` (931 lines)
- **Issue Description**:
  - File contains many interface definitions like `BudgetAllocatorContext`, `BudgetSettlementResult`, `BudgetReleaseResult`, `BudgetTier`, `BudgetWatermarkAlert`, `BudgetAutoThrottleEvent`, `BudgetAllocatorEvents`, `BudgetTruthStore`
  - Also contains `BudgetAllocator` class and core business logic
  - Single responsibility principle violated, poor code maintainability
  - Unit testing difficult, requires extensive mocks
- **Recommended Fix**:
  1. Move interface definitions to `types.ts` or `interfaces/` directory
  2. Move `BudgetAllocator` class to separate `budget-allocator-service.ts`
  3. Move auxiliary types and enums to `budget-types.ts`
  4. Move storage layer related code to `budget-store.ts`

#### 37. [Source Code] [High Severity] [Giant Source File - durable-event-bus.ts Over 1200 Lines]
- **File/Path**: `src/platform/five-plane-state-evidence/events/durable-event-bus.ts` (1214 lines)
- **Issue Description**:
  - Event bus implementation too large, contains multiple submodule logics
  - Contains consumer management, delivery, retry, backpressure and other complex logics
  - Test coverage difficult, any modification may affect production
- **Recommended Fix**:
  1. Split into `durable-event-bus/` directory
  2. `consumer-manager.ts` - Consumer management
  3. `delivery-engine.ts` - Delivery engine
  4. `retry-policy.ts` - Retry policy
  5. `back-pressure.ts` - Backpressure control
  6. Main file as Facade integrating submodules

#### 38. [Source Code] [Medium Severity] [Giant Source File - runtime-state-machine.ts Nearly 700 Lines]
- **File/Path**: `src/platform/five-plane-execution/runtime-state-machine.ts` (690 lines)
- **Issue Description**:
  - State machine implementation contains too much state transition logic
  - Nested types and complex conditional branches
  - Difficult to perform unit testing and regression testing
- **Recommended Fix**:
  1. Move state definitions to `runtime-state-types.ts`
  2. Split transition logic into multiple strategy classes
  3. Introduce State Pattern refactoring

#### 39. [Source Code] [Medium Severity] [core/runtime Directory Coexists with Five-Layer Architecture]
- **File/Path**: `src/core/runtime/`
- **Issue Description**:
  - `CLAUDE.md` explicitly warns not to add new canonical runtime logic to `src/core/runtime/`
  - But directory still exists and contains `orchestrator/`, `planner/`, `supervisor/` and other subdirectories
  - Runs in parallel with new five-layer architecture (`five-plane-*`), causing confusion
  - May cause developers to choose wrong module location
- **Recommended Fix**:
  1. Audit code in `core/runtime` to determine what has been migrated to `five-plane-*`
  2. Delete migrated code or create clear migration guide
  3. Add Deprecation warning in `core/runtime/index.ts`

#### 40. [Source Code] [Medium Severity] [26 Source Files Directly Use console.* Instead of Structured Logging]
- **File/Path**: Multiple source files
- **Issue Description**:
  - Project defines `StructuredLogger` (`src/platform/shared/observability/structured-logger.ts`)
  - But 26 files still directly use `console.log/debug/info/warn/error`
  - Not conducive to centralized log management, querying and analysis
  - Cannot enjoy benefits of structured logging (like log level filtering, unified output format)
- **Recommended Fix**:
  1. Replace all `console.*` calls with `StructuredLogger`
  2. Create ESLint rule prohibiting direct `console.*` usage
  3. Add automated check in CI to catch new `console.*` usage

#### 41. [Source Code] [Low Severity] [13 Files Contain Unfinished TODO/FIXME/HACK Markers]
- **File/Path**: Multiple source files
- **Issue Description**:
  - `src/domains/registry/plugin-spi.ts` - 1 marker
  - `src/org-governance/delegated-governance/governance-console-service.ts` - 1 marker
  - `src/org-governance/sso-scim/saml/index.ts` - 1 marker
  - `src/platform/five-plane-interface/api/mission-control-service.ts` - 2 markers
  - `src/platform/five-plane-state-evidence/memory/trust-level-service.ts` - 2 markers
  - `src/platform/five-plane-execution/execution-engine/single-task-happy-path.ts` - 1 marker
  - `src/platform/five-plane-execution/plugin-executor/adapter-executor.ts` - 2 markers
  - `src/platform/five-plane-execution/tool-executor/tool-metadata.ts` - 2 markers
  - `src/platform/five-plane-execution/tool-executor/tool-argument-coercion.ts` - 2 markers
  - `src/platform/five-plane-execution/tool-executor/code-diagnostics-service.ts` - 1 marker
  - `src/sdk/cli/stable-runner-factory.ts` - 1 marker
  - `src/sdk/plugin-sdk/plugin-test-harness.ts` - 1 marker
- **Recommended Fix**:
  1. Convert TODOs to GitHub Issues or task tracking system
  2. Or create code task tracking
  3. Set lint rules to check these markers and require handling in PRs

#### 42. [Tests] [High Severity] [budget-allocator.test.ts Test Failure]
- **File/Path**: `tests/unit/platform/five-plane-execution/budget-allocator.test.ts`
- **Issue Description**:
  - According to `.audit/quality.md` report, this test file currently fails
  - This is the test for core budget allocation function, its failure means this module has no CI-level test protection
  - 14 test files fail, among which `budget-allocator.test.ts` is the only execution core module failure
- **Recommended Fix**:
  1. Immediately investigate failure cause
  2. Fix test or mark as known issue
  3. Ensure all core module tests pass before PR merge

#### 43. [Tests] [Medium Severity] [Test File to Source File Ratio Severely Imbalanced]
- **File/Path**: Global
- **Issue Description**:
  - Source files: 1795 .ts files
  - Test files: 4662 .test.ts files
  - Ratio approximately 2.6:1, which indicates:
    - May be大量集成测试和E2E测试被计入
    - Or存在大量测试辅助文件和mock文件
    - 与文档中提到的 6113 个源文件数量不符
- **Recommended Fix**:
  1. Confirm accuracy of test file statistics
  2. Separate counts of unit tests, integration tests, E2E tests
  3. Update documentation to reflect accurate statistics

#### 44. [Configuration] [High Severity] [config/security/dev.json and test.json Behavior Inconsistent]
- **File/Path**: `config/security/dev.json` and `config/security/test.json`
- **Issue Description**:
  - `dev.json`: `{"approvalMode": "strict", "allowDestructiveActions": false}`
  - `test.json`: `{}` (empty object)
  - This difference will cause inconsistent behavior between development and test environments
  - `test.json` lacks `approvalMode` configuration, may cause tests to use default values instead of expected values
- **Recommended Fix**:
  1. Unify security configuration strategy
  2. test.json should contain same configuration as dev.json (possibly different values)
  3. Add configuration validation ensuring required fields exist

#### 45. [Configuration] [Medium Severity] [.env.example AA_API_JWT_SECRET Empty But No Security Warning]
- **File/Path**: `.env.example` line 15
- **Issue Description**:
  - `AA_API_JWT_SECRET=` is empty, comment says production needs configuration
  - But insufficient security warning
  - No guidance on how to generate secure secret
  - No secret management strategy documentation
- **Recommended Fix**:
  1. Add more explicit security warning in comments
  2. Provide generation command example (if exists but needs to be more prominent)
  3. Document secret rotation strategy
  4. Consider adding secret validation at application startup

#### 46. [Configuration] [Medium Severity] [package.json Scripts Too Many and Duplicated]
- **File/Path**: `package.json` scripts section
- **Issue Description**:
  - Over 100 npm scripts
  - Many duplicated `stable:*` scripts (each calls `npm run build`)
  - `test:raw`, `test`, `test:unit` responsibilities unclear
  - `build` and `build:test` mixed use may cause inconsistent test results
- **Recommended Fix**:
  1. Use `npm run build` to unify build scripts
  2. Merge duplicated stable scripts into generic runner
  3. Simplify test script hierarchy
  4. Document purpose of each script

#### 47. [Deployment] [Medium Severity] [deploy/runbooks Directory Empty]
- **File/Path**: `deploy/runbooks/`
- **Issue Description**:
  - Directory exists but empty
  - Operations documentation (docs_zh/operations/) mentions runbooks but actually missing
  - Cannot respond quickly during emergencies
- **Recommended Fix**:
  1. Populate basic runbook content
  2. Include common troubleshooting steps
  3. Add deployment and rollback procedures
  4. Include contact information and escalation paths

#### 48. [Deployment] [Medium Severity] [deploy/chaos Directory Empty]
- **File/Path**: `deploy/chaos/`
- **Issue Description**:
  - Directory exists but empty
  - Project's stable gate includes chaos tests (`chaos:stable`)
  - But actual chaos scenario configuration missing
  - Cannot perform chaos engineering verification
- **Recommended Fix**:
  1. Add basic chaos scenario configuration
  2. Include scenarios like service interruption, network isolation, resource exhaustion
  3. Document chaos test execution process
  4. Coordinate with `ops-maturity/chaos/` directory

#### 49. [Source Code] [Medium Severity] [src/platform/contracts/ and src/contracts/ May Have Duplicates]
- **File/Path**: `src/platform/contracts/` and `src/contracts/`
- **Issue Description**:
  - Project has two places with contracts-related code
  - `src/platform/contracts/` contains `index.ts` re-exports
  - `src/contracts/` does not exist (confirmed via `ls`)
  - But `src/platform/contracts/` may have duplicate definitions
- **Recommended Fix**:
  1. Confirm single source of truth for contracts
  2. Unify contracts import paths
  3. Avoid duplicate type definitions

#### 50. [Source Code] [Low Severity] [Many Temporary Build Directories Not Cleaned]
- **File/Path**: Root `dist_*` directories
- **Issue Description**:
  - Multiple temporary build directories exist: `dist/`, `dist_temp/`, `dist_test/`, `dist_test_compiled/`, `dist_1964/`, `dist_issue2014/`, `dist_lineage_test/`
  - These directories not ignored by `.gitignore`
  - May be accidentally committed to version control
- **Recommended Fix**:
  1. Add `dist_*` pattern to `.gitignore`
  2. Clean up all temporary build directories
  3. Create build cleanup script
  4. Use unified build output directory

#### 51. [Source Code] [High Severity] [In-Memory Database Files Not in .gitignore]
- **File/Path**: Root `:memory:*` files
- **Issue Description**:
  - Multiple in-memory database files exist (`:memory:aa-truth-*`, `:memory:fence-*`)
  - These files not ignored by `.gitignore`
  - May contain sensitive information or test data
- **Recommended Fix**:
  1. Add `:memory:*` pattern to `.gitignore`
  2. Clean up all in-memory database files
  3. Investigate source of these files and fix

#### 52. [Source Code] [Medium Severity] [session-replay Directory Not in .gitignore]
- **File/Path**: `session-replay/` (1561 entries)
- **Issue Description**:
  - session-replay directory not excluded by `.gitignore`
  - Contains many files may affect git performance
  - May contain sensitive operation replay data
- **Recommended Fix**:
  1. Add `session-replay/` exclusion to `.gitignore`
  2. Evaluate if these replay files need to be kept
  3. Implement automatic cleanup mechanism for expired replay files

#### 53. [Source Code] [Medium Severity] [artifacts Directory Not in .gitignore]
- **File/Path**: `artifacts/` (489 entries)
- **Issue Description**:
  - artifacts directory not excluded by `.gitignore`
  - Contains many files may affect git operation performance
  - May be incorrectly used for long-term storage instead of temporary storage
- **Recommended Fix**:
  1. Add `artifacts/` exclusion to `.gitignore`
  2. Implement data retention policy (automatic cleanup of old artifacts)
  3. Consider storing large artifacts in external storage

#### 54. [Security] [Medium Severity] [Buffer.from Usage May Have Security Issues]
- **File/Path**: Multiple files
- **Issue Description**:
  - `src/platform/five-plane-interface/api/oidc-oauth-service.ts` - Multiple uses of `Buffer.from`
  - `src/platform/five-plane-interface/api/api-auth-service.ts` - Uses `Buffer.from`
  - `src/platform/five-plane-interface/webhook/index.ts` - Uses `Buffer.from`
  - Recommend using `TextEncoder` or `Uint8Array` instead of legacy `Buffer` API
- **Recommended Fix**:
  1. Audit all `Buffer.from` usage
  2. Consider using safer alternatives
  3. Add security lint rules check

#### 55. [Security] [Medium Severity] [Too Many process.env Access Points]
- **File/Path**: Global
- **Issue Description**:
  - Approximately 952 `process.env` accesses
  - Configuration directly exposed in code
  - Lacks unified configuration management
  - Environment variables may expose sensitive information without filtering
- **Recommended Fix**:
  1. Create unified configuration management module
  2. Add configuration validation and type checking
  3. Use `zod` or similar tools to validate environment variables
  4. Avoid direct `process.env` access in business logic

#### 56. [Documentation] [Medium Severity] [.audit/delegation/delegation-audit-events.json May Contain Sensitive Data]
- **File/Path**: `.audit/delegation/delegation-audit-events.json`
- **Issue Description**:
  - File contains 65 audit events
  - Contains identifiers like `parentAgentId`, `childAgentId`, `actorId`
  - Although test data, may reflect real system structure
  - Filename contains "audit" but not excluded by `.gitignore`
- **Recommended Fix**:
  1. Add `.audit/` directory exclusion to `.gitignore`
  2. Audit data should be stored in secure location
  3. Confirm source of test data and anonymization processing

#### 57. [Documentation] [Low Severity] [.audit/quality.md Inconsistent with Actual Test Status]
- **File/Path**: `.audit/quality.md`
- **Issue Description**:
  - File reports 14 failing tests
  - But git status shows no uncommitted changes
  - Indicates these failures may have been accepted but not fixed
  - Or tests themselves have persistent issues
- **Recommended Fix**:
  1. Mark failing tests as known issues
  2. Create issue tracker to track each failing test
  3. Add test quality threshold in CI

#### 58. [Source Code] [Medium Severity] [stryker.config.mjs Only Mutates Few Key Files]
- **File/Path**: `stryker.config.mjs`
- **Issue Description**:
  - Mutation testing only configured for 7 files
  - These files are mainly auth, billing, approval, gateway related
  - Other core modules not included in mutation testing
  - Coverage may not be enough to discover all critical issues
- **Recommended Fix**:
  1. Expand mutation test coverage to more core modules
  2. Consider adding budget-allocator, runtime-state-machine, etc.
  3. Balance test cost and coverage

#### 59. [Source Code] [Low Severity] [.c8rc.json and stryker.config.mjs Configuration Separated]
- **File/Path**: `.c8rc.json` and `stryker.config.mjs`
- **Issue Description**:
  - Two coverage tool configurations separated
  - c8 for code coverage
  - stryker for mutation testing
  - May cause inconsistent reports or coverage gaps
- **Recommended Fix**:
  1. Ensure coverage thresholds are consistent between two tools
  2. Unify reports in CI
  3. Consider using single coverage tool or clarify division of labor

#### 60. [Configuration] [Medium Severity] [UI package.json Separated from Main package.json]
- **File/Path**: `ui/package.json`
- **Issue Description**:
  - UI has independent `package.json` and `node_modules`
  - Uses Turborepo workspaces
  - Needs separate dependency management process
  - May lead to dependency version inconsistency
- **Recommended Fix**:
  1. Ensure UI and main project dependency versions are synchronized
  2. Document UI service deployment process
  3. Consider unified dependency management

#### 61. [Source Code] [Medium Severity] [tool-executor Directory Too Many Files]
- **File/Path**: `src/platform/five-plane-execution/tool-executor/`
- **Issue Description**:
  - Directory contains many files (35)
  - Including large files like `code-diagnostics-service.ts` (17260 bytes), `command-executor.ts` (24468 bytes)
  - May have unclear responsibilities
- **Recommended Fix**:
  1. Evaluate if can split by functionality
  2. Group related functions into subdirectories
  3. Ensure single responsibility for each file

#### 62. [Source Code] [Low Severity] [hardcoded Configuration Scattered in Code]
- **File/Path**: Multiple source files
- **Issue Description**:
  - Multiple places contain "hardcoded" comments
  - Like `channel-gateway-service.ts:303` - R12-12 comment
  - `evaluator-service.ts:69` - R11-05 FIX comment
  - `plan-evaluator.ts:40` - R8-12 FIX comment
  - Indicates hardcoded values existed in code, now fixed but comments remain
- **Recommended Fix**:
  1. Clean up fixed "hardcoded" comments
  2. Keep valuable architecture decision comments
  3. Use clearer comment format

---

### Summary

This automated review (second round) found 31 new issues, among which:

**High Priority (Need Immediate Action)**:
1. `budget-allocator.ts` (931 lines) giant file needs splitting
2. `durable-event-bus.ts` (1214 lines) giant file needs splitting
3. `config/security/test.json` empty causes test environment inconsistency
4. `budget-allocator.test.ts` test failure
5. `.gitignore` missing multiple temporary file patterns (`:memory:*`, `dist_*`, session-replay, artifacts)
6. `src/platform/contracts/` may have duplicate definitions

**Medium Priority**:
1. `runtime-state-machine.ts` (690 lines) needs splitting
2. `core/runtime` and five-layer architecture coexistence causes confusion
3. `stryker.config.mjs` insufficient coverage
4. 26 files directly use `console.*` instead of structured logging
5. `deploy/runbooks` and `deploy/chaos` directories empty
6. 952 `process.env` accesses lack unified management

**Low Priority**:
1. 13 files contain unfinished TODO/FIXME markers
2. `.c8rc.json` and `stryker.config.mjs` configuration separated
3. UI package.json separated management
4. tool-executor directory too many files (35)
5. Multiple temporary tsconfig files need cleanup

*Review generated: 2026/05/13*

---

## 2026/05/13 Automated Review Report (Third Round - In-Depth Special Inspection)

### Found Issues

#### 67. [Source Code] [High Severity] [Interface Consistency Issue - five-plane-execution Export Path Chaos]
- **File/Path**: `src/platform/five-plane-execution/compensation-manager.ts` and related files
- **Issue Description**:
  - `compensation-manager.ts` uses `import { newId } from "../../platform/contracts/types/ids.js"`
  - Same file uses `import { createCompensationRecord } from "../../platform/contracts/executable-contracts/index.js"`
  - This inconsistent import path indicates exports mapping may not be correctly used
  - Violates package exports design intent
- **Recommended Fix**:
  1. Unify to use package export path `@automatic-agent/platform/contracts`
  2. Detect all unresolved imports via `npm run typecheck`
  3. Create lint rules to check deep relative imports

#### 68. [Source Code] [High Severity] [Interface Consistency Issue - five-plane-control-plane IAM Module Import Chaos]
- **File/Path**: `src/platform/five-plane-control-plane/iam/` directory
- **Issue Description**:
  - According to `.audit/quality.md`, IAM module has 2 failing test files: `access-model.test.ts` and `field-encryption.test.ts`
  - IAM is security-critical module, test failure means security functions have no CI protection
  - This may indicate import path or interface definition issues
- **Recommended Fix**:
  1. Immediately investigate root cause of IAM test failures
  2. Fix or mark as known security issue
  3. Prioritize IAM-related tests in CI

#### 69. [Source Code] [High Severity] [Interface Consistency Issue - durable-event-bus Test Failure]
- **File/Path**: `tests/unit/platform/five-plane-state-evidence/events/durable-event-bus-async.test.ts`
- **Issue Description**:
  - `durable-event-bus.ts` (1214 lines) is a giant source file
  - Corresponding `durable-event-bus-async.test.ts` test fails
  - Event bus is core component of state-evidence, test failure may cause data consistency risk
- **Recommended Fix**:
  1. Investigate `durable-event-bus-async.test.ts` failure cause
  2. Consider splitting `durable-event-bus.ts` into multiple testable modules
  3. Ensure core logic like event delivery, retry, backpressure have test coverage

#### 70. [Source Code] [High Severity] [Interface Consistency Issue - runtime-state-machine Import Path Error]
- **File/Path**: `src/platform/five-plane-execution/runtime-state-machine.ts`
- **Issue Description**:
  - File uses `import { ValidationError, WorkflowStateError } from "../contracts/errors.js"`
  - But `../contracts` path in `five-plane-execution` context should point to `five-plane-execution/contracts` not `platform/contracts`
  - This indicates possible circular import or path resolution issue
- **Recommended Fix**:
  1. Check complete import list of `runtime-state-machine.ts`
  2. Ensure all imports use correct relative paths or package exports
  3. Run `npm run typecheck` to detect type errors

#### 71. [Source Code] [Medium Severity] [Tool Executor Module - 35 Files Too Many Responsibilities]
- **File/Path**: `src/platform/five-plane-execution/tool-executor/`
- **Issue Description**:
  - Directory contains 35 files, including multiple giant files:
    - `code-diagnostics-service.ts` (17260 bytes)
    - `command-executor.ts` (24468 bytes)
    - `tool-metadata.ts` (16092 bytes)
  - Total bytes exceed 150KB, indicating responsibilities too concentrated
  - Although has `index.ts` correctly exporting, module cohesion is poor
- **Recommended Fix**:
  1. Split tool-executor into subdirectories by functionality:
     - `tool-executor/core/` - Core execution logic
     - `tool-executor/diagnostics/` - Diagnostic services
     - `tool-executor/security/` - Security checks
     - `tool-executor/mcp/` - MCP related
  2. Extract shared types to `tool-types.ts`
  3. Simplify index.ts exports

#### 72. [Source Code] [Medium Severity] [state-transition Service - 868 Line Giant Service]
- **File/Path**: `src/platform/five-plane-execution/state-transition/transition-service.ts` (868 lines)
- **Issue Description**:
  - `TransitionService` is the core state transition gate of execution engine
  - Single file contains too much state transition logic
  - Per CLAUDE.md, this is the "authoritative state transition gate", should be highly reliable
- **Recommended Fix**:
  1. Split state transition rules into independent strategy classes
  2. Move state enums and types to `runtime-state-types.ts`
  3. Extract validation logic to independent module

#### 73. [Tests] [High Severity] [Test Exclusion List Analysis - Root Cause Not Investigated]
- **File/Path**: `tsconfig.json` exclude section
- **Issue Description**:
  - Approximately 80+ test files excluded
  - Including entire `tests/unit/platform/five-plane-execution/` directory
  - Including all `tests/integration/platform/*/` directories
  - Previous issue #63 mentioned but root cause not analyzed
  - So many tests excluded is not normal
- **Recommended Fix**:
  1. Create diagnostic script to analyze failure cause of each excluded test
  2. Statistics by category:
     - Exclusions due to circular dependency
     - Exclusions due to test instability
     - Intentionally excluded extended tests
  3. Create fix plan to resolve each one

#### 74. [Tests] [High Severity] [.audit/quality.md Inconsistent with Actual git Status]
- **File/Path**: `.audit/quality.md`
- **Issue Description**:
  - File reports 14 failing tests
  - But git status shows only 3 files with uncommitted modifications
  - This indicates:
    1. Test failures have been accepted (not fixed)
    2. Or tests behave differently in different environments
    3. Or audit report not updated in time
- **Recommended Fix**:
  1. Update `.audit/quality.md` timestamp to latest
  2. Add failing tests to issue tracker
  3. Automatically run and update audit report in CI

#### 75. [Configuration] [High Severity] [config/security Environment Configuration Difference - Severity Underestimated]
- **File/Path**: `config/security/` environment configuration files
- **Issue Description**:
  - `dev.json`: `{"approvalMode": "strict", "allowDestructiveActions": false}`
  - `test.json`: `{}` (empty object - defaults)
  - `staging.json`: `{"approvalMode": "supervised"}`
  - `pre-prod.json`: `{"approvalMode": "supervised", "allowDestructiveActions": false}`
  - `prod.json`: `{"approvalMode": "strict", "allowDestructiveActions": false}`

  **Serious issues**:
  1. `test.json` empty may cause tests to use unexpected default approvalMode
  2. `staging` and `pre-prod` use `supervised`, but `prod` uses `strict` - this means staging environment cannot truly reflect production behavior
  3. `allowDestructiveActions` field inconsistent across environments
- **Recommended Fix**:
  1. Unify `test.json` configuration to match `staging.json`
  2. Change `staging` configuration to `{"approvalMode": "strict"}` to reflect true production behavior
  3. Add configuration schema validation ensuring required fields exist
  4. Create configuration matrix documentation

#### 76. [Configuration] [Medium Severity] [config/environments and config/security Configuration Misaligned]
- **File/Path**: `config/environments/dev.json` and `config/security/dev.json`
- **Issue Description**:
  - `environments/dev.json` defines deployment-related configuration (registry, namespace, clusterName)
  - `security/dev.json` defines security policies (approvalMode, allowDestructiveActions)
  - But no clear association mechanism between two configuration files
  - How these configurations merge at application startup is unclear
- **Recommended Fix**:
  1. Document configuration merge strategy
  2. Add configuration source comments in code
  3. Consider merging security configuration into environments configuration

#### 77. [Source Code] [Medium Severity] [Five Symbolic Links Not in gitignore]
- **File/Path**: Symbolic links under `src/platform/`
- **Issue Description**:
  - `control-plane -> five-plane-control-plane`
  - `execution -> five-plane-execution`
  - `state-evidence -> five-plane-state-evidence`
  - `orchestration -> five-plane-orchestration`
  - `interface -> five-plane-interface`
  - These symbolic links may cause issues on certain filesystems
  - IDE may not correctly resolve symbolic link targets
- **Recommended Fix**:
  1. Explicitly document existence and purpose of these symbolic links in project documentation
  2. Consider verifying symbolic link validity in CI
  3. Or convert symbolic links to actual directories (create via build script)

#### 78. [Source Code] [Medium Severity] [multi-step-orchestration Module - 29 Files Too Many]
- **File/Path**: `src/platform/five-plane-execution/execution-engine/`
- **Issue Description**:
  - Directory contains 29 files, is the core of execution engine
  - `multi-step-orchestration.ts` and related files form complex orchestration logic
  - High coupling between modules, testing difficult
- **Recommended Fix**:
  1. Split orchestration logic into independent modules:
     - `orchestration/planning/` - Planning
     - `orchestration/execution/` - Execution management
     - `orchestration/monitoring/` - Monitoring
  2. Extract shared types to `orchestration-types.ts`
  3. Reduce inter-module coupling

#### 79. [Source Code] [Medium Severity] [stryker.config.mjs Mutation Coverage Severely Insufficient]
- **File/Path**: `stryker.config.mjs`
- **Issue Description**:
  - Only configured mutation testing for 8 files
  - Missing critical modules:
    - `budget-allocator.ts` (931 lines) - Core budget allocation
    - `runtime-state-machine.ts` (690 lines) - Core state machine
    - `transition-service.ts` (868 lines) - Core state transition
    - `durable-event-bus.ts` (1214 lines) - Core event bus
  - Mutation coverage for these core modules = 0%
- **Recommended Fix**:
  1. Add `budget-allocator.ts`, `runtime-state-machine.ts`, `transition-service.ts` to `mutate` list
  2. Evaluate test feasibility for `durable-event-bus.ts`
  3. Balance test cost (mutation testing time-consuming) with coverage needs
  4. Consider creating dedicated configuration for mutation testing

#### 80. [Configuration] [Low Severity] [.gitignore Missing Multiple Temporary Files]
- **File/Path**: `.gitignore`
- **Issue Description**:
  - Missing `:memory:*` pattern (in-memory database files)
  - Missing `dist_*` pattern (temporary build directories)
  - Missing `.audit/` directory exclusion
  - Current `.gitignore` only excludes `dist/` not `dist*`
- **Recommended Fix**:
  1. Add `:memory:*` to .gitignore
  2. Add `dist_*` or `dist*/` to .gitignore
  3. Add `.audit/` to .gitignore
  4. Verify all temporary files are correctly excluded

#### 81. [Source Code] [Medium Severity] [process.env Access Pattern Unsafe]
- **File/Path**: Global, approximately 952 accesses
- **Issue Description**:
  - Configuration directly exposed in code
  - No unified configuration management module
  - Environment variables may expose sensitive information without filtering
  - No configuration validation
- **Recommended Fix**:
  1. Create `src/config/index.ts` unified configuration management
  2. Use `zod` to validate environment variables (project already has zod dependency)
  3. Validate all required configurations at startup
  4. Add sensitive information filtering

#### 82. [Source Code] [Low Severity] [Buffer.from Usage May Have Security Risk]
- **File/Path**: `src/platform/five-plane-interface/api/oidc-oauth-service.ts`, `api-auth-service.ts`, `webhook/index.ts`
- **Issue Description**:
  - Multiple uses of `Buffer.from` API
  - `Buffer.from` in Node.js may have security risks if used improperly
  - Modern Node.js recommends `TextEncoder` or `Uint8Array`
- **Recommended Fix**:
  1. Audit all `Buffer.from` usage scenarios
  2. Consider migrating to `TextEncoder`/`TextDecoder`
  3. Add security lint rules check

#### 83. [Documentation] [Medium Severity] [deploy/chaos Scenario Configuration Incomplete]
- **File/Path**: `deploy/chaos/`
- **Issue Description**:
  - Only 4 YAML files:
    - `network-delay.yaml`
    - `pod-kill.yaml`
    - `postgres-disconnect.yaml`
    - `redis-disconnect.yaml`
  - Missing critical scenarios:
    - Memory exhaustion
    - CPU exhaustion
    - Network partition
    - Database connection pool exhaustion
    - Redis connection disconnect
  - Chaos test coverage insufficient
- **Recommended Fix**:
  1. Add more chaos scenarios
  2. Coordinate with `ops-maturity/chaos/` directory
  3. Document expected impact of each scenario

#### 84. [Documentation] [Medium Severity] [deploy/runbooks Only One File]
- **File/Path**: `deploy/runbooks/`
- **Issue Description**:
  - Only `production-alert-runbook.md` (2010 bytes)
  - Missing critical runbooks:
    - Deployment procedure
    - Rollback procedure
    - Troubleshooting guide
    - Emergency contacts
    - Upgrade path
- **Recommended Fix**:
  1. Create standard runbook template
  2. Populate common failure scenarios
  3. Add contact information

#### 85. [Source Code] [Medium Severity] [oapeflir Directory and five-plane-orchestration Responsibilities Unclear]
- **File/Path**:
  - `src/platform/five-plane-execution/oapeflir/`
  - `src/platform/five-plane-orchestration/oapeflir/`
- **Issue Description**:
  - Both directories have `oapeflir` module
  - One in execution plane, one in orchestration plane
  - Per architecture documentation, oapeflir should be cross-plane orchestration logic
  - This parallel structure may cause confusion and maintenance difficulty
- **Recommended Fix**:
  1. Clarify single source of truth for oapeflir
  2. If needs cross-plane sharing, create shared module
  3. Document architecture boundaries

#### 86. [Source Code] [Medium Severity] [ha (High Availability) Module Structure Complex]
- **File/Path**: `src/platform/five-plane-execution/ha/` (25 files)
- **Issue Description**:
  - HA module has 25 files, indicating complex functionality
  - Contains `ha-coordinator-service-inner.js` and other core services
  - May overlap with `lease/` module responsibilities
- **Recommended Fix**:
  1. Audit HA module responsibility boundaries
  2. Coordinate with lease module to ensure no duplication
  3. Consider extracting HA logic as independent service

#### 87. [Source Code] [Medium Severity] [dispatcher Module - 14 Files]
- **File/Path**: `src/platform/five-plane-execution/dispatcher/` (14 files)
- **Issue Description**:
  - `dispatcher.ts` and `dispatcher/` directory coexist
  - May be symbolic link or duplicate structure
  - `admission-controller.js` is key component
- **Recommended Fix**:
  1. Confirm if `dispatcher.ts` is outdated entry point
  2. Unify use of `dispatcher/index.ts` as entry
  3. Document dispatcher submodule structure

#### 88. [Source Code] [Medium Severity] [recovery Module - 29 Files Too Large]
- **File/Path**: `src/platform/five-plane-execution/recovery/` (29 files)
- **Issue Description**:
  - Recovery is key fault tolerance mechanism of execution engine
  - 29 files indicate complex functionality
  - May need splitting into submodules:
    - `recovery/retry/` - Retry strategy
    - `recovery/compensation/` - Compensation logic
    - `recovery/checkpoint/` - Checkpoint recovery
- **Recommended Fix**:
  1. Evaluate recovery module submodule division
  2. Split complex logic into independent services
  3. Ensure each submodule has clear responsibility

#### 89. [Source Code] [Low Severity] [5 Symbolic Links Exist But Not Documented]
- **File/Path**: 5 symbolic links under `src/platform/`
- **Issue Description**:
  - No documentation explaining why symbolic links are used instead of actual directories
  - No CI check for symbolic link validity
  - May behave differently on some operating systems
- **Recommended Fix**:
  1. Document symbolic link strategy in `src/platform/README.md`
  2. Add symbolic link check in CI
  3. Consider migrating to actual directory structure

#### 90. [Tests] [Medium Severity] [tests/unit/helpers/index.test.ts Excluded]
- **File/Path**: `tests/unit/helpers/index.test.ts`
- **Issue Description**:
  - Test of helpers themselves is excluded
  - This means test infrastructure has no test protection
  - If helpers have bugs, all tests depending on them may be affected
- **Recommended Fix**:
  1. Investigate why this test is excluded
  2. Enable the test or delete (if meaningless)
  3. Ensure test infrastructure has test coverage

#### 91. [Configuration] [Low Severity] [tsconfig.temp.json Exists]
- **File/Path**: `tsconfig.temp.json`
- **Issue Description**:
  - Temporary configuration file not cleaned up
  - May cause developer confusion about which configuration to use
  - May contain outdated configuration options
- **Recommended Fix**:
  1. Delete `tsconfig.temp.json`
  2. Or rename to `tsconfig.example.json` as reference
  3. Ensure only `tsconfig.json` and `tsconfig.build.json` are formal configurations

#### 92. [Documentation] [Low Severity] [docs_zh/operations/current_todo_list.md Too Large]
- **File/Path**: `docs_zh/operations/current_todo_list.md` (38KB)
- **Issue Description**:
  - One TODO list file too large (38KB)
  - Indicates many pending items
  - Documentation may diverge from actual code state
- **Recommended Fix**:
  1. Regularly sync TODO list
  2. Move completed items to CHANGELOG
  3. Consider using issue tracker instead of documentation TODO

#### 93. [Source Code] [Medium Severity] [memory Module - 27 Files May Be Too Large]
- **File/Path**: `src/platform/five-plane-state-evidence/memory/` (27 files)
- **Issue Description**:
  - memory module is important part of state evidence
  - 27 files may need functional splitting:
    - `memory/session/` - Session memory
    - `memory/trust/` - Trust level
    - `memory/compaction/` - Compaction logic
- **Recommended Fix**:
  1. Evaluate memory module submodule division
  2. Group related functionality into subdirectories
  3. Ensure each submodule has clear responsibility

#### 94. [Source Code] [Medium Severity] [events Module - 22 Files Structure Complex]
- **File/Path**: `src/platform/five-plane-state-evidence/events/` (22 files)
- **Issue Description**:
  - events is core component of state-evidence
  - Contains `durable-event-bus.ts` (1214 lines) giant file
  - `typed-event-bus.ts` is typed wrapper for event bus
  - Structure may need reorganization
- **Recommended Fix**:
  1. Split events into `events/durable/` and `events/typed/`
  2. Extract `durable-event-bus.ts` submodules
  3. Unify event type definitions

#### 95. [Source Code] [Medium Severity] [truth Module - 28 Files May Be Too Large]
- **File/Path**: `src/platform/five-plane-state-evidence/truth/` (28 files)
- **Issue Description**:
  - truth is authoritative storage module
  - Contains `authoritative-sql-database.ts` and other core components
  - 28 files need evaluation for possible splitting
- **Recommended Fix**:
  1. Evaluate truth module submodule division
  2. Split by entity type: `truth/task/`, `truth/workflow/`, `truth/session/`
  3. Extract shared database access logic

#### 96. [Source Code] [Medium Severity] [checkpoint Module - 8 Files But Has Giant File]
- **File/Path**: `src/platform/five-plane-state-evidence/checkpoints/` (8 files)
- **Issue Description**:
  - `node-run-checkpoint-migration.test.ts` test fails
  - checkpoint is key mechanism for workflow recovery
  - Test failure may cause data loss risk
- **Recommended Fix**:
  1. Investigate checkpoint migration test failure cause
  2. Ensure checkpoint mechanism is reliable
  3. Add more checkpoint-related tests

#### 97. [Tests] [Medium Severity] [E2E Tests Excluded - Critical Workflows Unprotected]
- **File/Path**: Multiple E2E tests
- **Issue Description**:
  - `execution-ticket-lifecycle.test.ts` excluded
  - `multi-region-failover.test.ts` excluded
  - `task-status-lifecycle.test.ts` excluded
  - `workflow-state-transitions.test.ts` excluded
  - `workflow-timeout-flow.test.ts` excluded
  - These are core end-to-end workflow tests
- **Recommended Fix**:
  1. Investigate reason for each E2E test exclusion
  2. Fix or enable these tests
  3. Ensure core workflows have E2E test protection

(Note: This document continues with more review rounds covering infrastructure, API, systematic themes, and cumulative statistics. The full translation continues with subsequent sections on runtime reliability, operations and governance, positive feedback loops, consistency contradictions, and detailed findings from additional review rounds.)