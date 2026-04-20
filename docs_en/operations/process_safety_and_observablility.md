# ADR-072: Process Safety Protection, Testing System Enhancement, and Observability Improvement

Status: Accepted
Date: 2026-04-10

## Background

During the 2026-04-10 full test run, a P0-level zombie process storm occurred (see `doc/postmortem-20260410-zombie-storm.md` for details). The root cause was fork bomb regex escape + unisolated process groups + no zombie collection. Post-mortem revealed structural deficiencies in three dimensions:

1. **Process lifecycle management**: No PID tracking for child processes, no global registration, GracefulShutdown does not perceive child processes
2. **Testing safety net**: No global teardown, no process leak detection, inconsistent cleanup modes
3. **Observability**: Logs without correlation ID, no file output, no process-level tracing, no multi-transport

This ADR defines a systematic improvement plan to prevent recurrence of similar events.

---

## 1. Process Safety Protection Specification

### 1.1 Child Process Registry (ProcessTracker)

New `src/core/resource/process-tracker.ts`, unified tracking of all OS child processes:

```typescript
interface TrackedProcess {
  pid: number
  command: string
  spawnedAt: number
  owner: string        // 'bash-tool' | 'mcp-transport' | 'lsp-client' | ...
  pgid?: number        // Process group ID (equals pid in detached mode)
}

// Core API
register(proc: ChildProcess, owner: string): void
unregister(pid: number): void
getActive(): TrackedProcess[]
killAll(signal?: string): Promise<void>
getZombieCount(): Promise<number>
```

All `spawn()` and `execa()` call sites must invoke `register()`, and invoke `unregister()` on process `exit` event.

### 1.2 Mandatory Rules: spawn/execa Must Follow

| Rule | Description |
|------|-------------|
| `detached: true` | All execa/spawn must use process group isolation |
| `forceKillAfterDelay` | Timeout kill must have SIGKILL fallback, default 5s |
| `proc.on('exit')` | Must register exit event handler for unregister and resource recovery |
| `register()` | Must register to ProcessTracker immediately after spawn |
| `finally { release() }` | Semaphores must be released in finally block |

### 1.3 GracefulShutdown Integration

`GracefulShutdown` registers a high-priority cleanup callback:

```typescript
GracefulShutdown.register(async () => {
  const tracker = getProcessTracker()
  const active = tracker.getActive()
  if (active.length > 0) {
    logger.warn('Killing orphaned child processes', { count: active.length })
    await tracker.killAll('SIGTERM')
    // Force kill residuals after 5s
    await sleep(5000)
    await tracker.killAll('SIGKILL')
  }
})
```

### 1.4 Process Semaphore Enhancement

Current `process-semaphore.ts` is pure logical counter, has counting drift risk. Enhancement plan:

- Link with ProcessTracker: `release()` verifies PID is still alive
- Periodic reconciliation: Every 30s compare semaphore count with ProcessTracker actual survivor count, log alert on difference
- Leak self-healing: If some `acquire()` does not `release()` for over `2 * timeout`, auto-release and warn

### 1.5 Container-Level Protection (Operations Specification)

| Measure | Configuration |
|---------|---------------|
| PID 1 zombie collection | Dockerfile: `ENTRYPOINT ["/usr/bin/tini", "--"]` or K8s `shareProcessNamespace: true` |
| Process count limit | `docker run --pids-limit=4096` or K8s `spec.containers[].resources.limits` |
| ulimit | `bash -c 'ulimit -u 1024 && exec ...'` as execa pre-check |
| Secure seccomp | Block `unshare`, `clone` and other high-risk syscalls (production) |

---

## 2. Testing System Enhancement Plan

### 2.1 Global Test Lifecycle

New `tests/global-setup.ts` and `tests/global-teardown.ts`, registered in vitest.config.ts:

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    globalSetup: ['./tests/global-setup.ts'],
    // ...
  },
})
```

**global-setup.ts**:
- Record process snapshot at test start (PID list)
- Start built-in process monitor (replacing external proc-monitor.sh)

**global-teardown.ts**:
- Get process snapshot after test ends
- Compare with start snapshot, detect leaked child processes
- If leaks found, print detailed process tree and return non-zero exit code
- Kill all leaked child processes

### 2.2 Unified Test Cleanup Helper

New `tests/helpers/test-cleanup.ts`, centralized management of all singleton resets:

```typescript
export function resetAllSingletons(): void {
  resetProcessSemaphore()
  resetEventBus()
  resetLogger()
  clearDivisions()
  clearCustomRules()
  clearAllOverrides()
  resetProviderHealth()
  GracefulShutdown.reset()
  clearSpawnedTasks()
}
```

All test files call this function in `afterEach`, replacing current practice of each selecting a subset.

### 2.3 Process Leak Assertion

New `tests/helpers/process-guard.ts`:

```typescript
export function createProcessGuard() {
  const pidsBefore = getChildPids()
  return {
    assertNoLeaks() {
      const pidsAfter = getChildPids()
      const leaked = pidsAfter.filter(p => !pidsBefore.includes(p))
      if (leaked.length > 0) {
        // Kill leaked processes first, then assert failure
        leaked.forEach(pid => {
          try { process.kill(pid, 'SIGKILL') } catch {}
        })
        throw new Error(`Process leak: ${leaked.length} child processes not cleaned up: ${leaked.join(', ')}`)
      }
    }
  }
}
```

Use in test files involving child processes:

```typescript
let guard: ReturnType<typeof createProcessGuard>
beforeEach(() => { guard = createProcessGuard() })
afterEach(() => { guard.assertNoLeaks() })
```

### 2.4 Timer Leak Detection

Use Vitest's `fakeTimers` or custom hook to detect `setInterval`/`setTimeout` leaks:

```typescript
// tests/helpers/timer-guard.ts
export function createTimerGuard() {
  const origSetInterval = globalThis.setInterval
  const activeIntervals = new Set<ReturnType<typeof setInterval>>()

  globalThis.setInterval = ((...args: Parameters<typeof setInterval>) => {
    const id = origSetInterval(...args)
    activeIntervals.add(id)
    return id
  }) as typeof setInterval

  return {
    assertNoLeaks() {
      globalThis.setInterval = origSetInterval
      if (activeIntervals.size > 0) {
        activeIntervals.forEach(id => clearInterval(id))
        throw new Error(`Timer leak: ${activeIntervals.size} intervals not cleared`)
      }
    },
    cleanup() {
      globalThis.setInterval = origSetInterval
      activeIntervals.forEach(id => clearInterval(id))
    }
  }
}
```

### 2.5 Security Regex Special Testing

New `tests/core/security/fork-bomb-regex.test.ts`, exhaustive fork bomb variants:

```typescript
const FORK_BOMB_VARIANTS = [
  ':(){ :|:& };:',
  ':(){:|:&};:',
  'bomb(){ bomb|bomb& };bomb',
  'f(){ f|f& };f',
  ':(){ :|:& };:',    // Full-width characters
  '.() { .|.& }; .',
  'x(){ x|x & };x',
]

describe('fork bomb detection', () => {
  for (const variant of FORK_BOMB_VARIANTS) {
    it(`blocks: ${variant}`, () => {
      expect(evaluateCommand(variant).decision).toBe('deny')
    })
  }
})
```

### 2.6 Stress Testing

New `tests/stress/process-stress.test.ts`:

```typescript
describe('process stress', () => {
  it('handles 100 concurrent bash commands without leaking', async () => {
    const guard = createProcessGuard()
    const tasks = Array.from({ length: 100 }, (_, i) =>
      bashTool.execute({ command: `echo ${i}`, timeout: 5000 }, ctx)
    )
    await Promise.all(tasks)
    guard.assertNoLeaks()
    expect(getActiveProcessCount()).toBe(0)
  }, 60_000)

  it('handles timeout without leaking processes', async () => {
    const guard = createProcessGuard()
    const tasks = Array.from({ length: 10 }, () =>
      bashTool.execute({ command: 'sleep 30', timeout: 500 }, ctx)
    )
    await Promise.allSettled(tasks)
    // Wait for forceKillAfterDelay
    await new Promise(r => setTimeout(r, 6000))
    guard.assertNoLeaks()
  }, 30_000)
})
```

### 2.7 CI Integration

```yaml
# .github/workflows/test.yml or equivalent CI config
- name: Run tests
  run: |
    /usr/local/nvm/versions/node/v22.22.2/bin/node \
      --require ./tests/crypto-polyfill.cjs \
      node_modules/vitest/vitest.mjs run \
      --reporter=verbose 2>&1 | tee tests/logs/test-$(date +%Y%m%d-%H%M%S).log

- name: Check for zombie processes
  if: always()
  run: |
    ZOMBIE=$(ps -eo stat | grep -c '^Z' || echo 0)
    echo "Zombie processes: $ZOMBIE"
    if [ "$ZOMBIE" -gt 0 ]; then
      echo "::error::Found $ZOMBIE zombie processes after test run"
      ps -eo pid,ppid,stat,args | grep ' Z '
      exit 1
    fi
```

---

## 3. Logging and Observability Enhancement Plan

### 3.1 Logger Architecture Upgrade

Current `logger.ts` is single transport single instance design, needs upgrade to:

```
Logger (singleton)
  ├── Transport[]          ← Support multiple transports simultaneously
  │    ├── ConsoleTransport (existing)
  │    ├── JsonFileTransport (new)
  │    └── RotatingFileTransport (new)
  ├── Context (via AsyncLocalStorage)
  │    ├── traceId
  │    ├── taskId
  │    ├── sessionId
  │    └── component
  └── child(component)     ← Child logger, auto-attaches component context
```

### 3.2 Multi-Transport Support

```typescript
interface LogTransport {
  name: string
  write(entry: LogEntry): void
}

// Logger internally changed to transport array
private transports: LogTransport[] = []

addTransport(transport: LogTransport): void
removeTransport(name: string): void
```

### 3.3 File Transport + Log Rotation

New `JsonFileTransport`:

```typescript
interface FileTransportConfig {
  dir: string              // Log directory
  prefix: string           // Filename prefix, e.g. 'agent'
  maxSizeMb: number        // Single file limit, default 50MB
  maxFiles: number          // Retained file count, default 10
  flushIntervalMs: number  // Flush interval, default 1000ms
}
```

Log file format: `{dir}/{prefix}-{YYYYMMDD}-{seq}.jsonl`

Each line is a JSON object:
```json
{"ts":"2026-04-10T20:16:38.123Z","level":"warn","msg":"Semaphore queue timeout","trace":"tr-abc123","task":"t-xyz","component":"process-semaphore","data":{"active":16,"max":16,"queued":5}}
```

### 3.4 Correlation Context Auto-Injection

Using existing `AsyncLocalStorage` infrastructure (`TaskContext`), auto-inject correlation ID:

```typescript
// src/core/logger/logger-context.ts
import { AsyncLocalStorage } from 'node:async_hooks'

interface LogContext {
  traceId?: string
  taskId?: string
  sessionId?: string
  component?: string
}

const logContextStore = new AsyncLocalStorage<LogContext>()

export function runWithLogContext<T>(ctx: LogContext, fn: () => T): T {
  const parent = logContextStore.getStore()
  return logContextStore.run({ ...parent, ...ctx }, fn)
}

export function getLogContext(): LogContext {
  return logContextStore.getStore() ?? {}
}
```

Logger auto-merges current `LogContext` when formatting:

```typescript
private formatEntry(level: LogLevel, message: string, context?: Record<string, unknown>): LogEntry {
  const logCtx = getLogContext()
  return {
    level,
    message,
    timestamp: new Date().toISOString(),
    context: { ...logCtx, ...context },
  }
}
```

### 3.5 Child Process Lifecycle Logging

Add structured logging at all process spawn points:

```typescript
// On spawn
logger.info('Child process spawned', {
  pid: proc.pid,
  command: cmd,
  args: args.join(' '),
  owner: 'bash-tool',
  detached: true,
  timeout: timeoutMs,
})

// On exit
proc.on('exit', (code, signal) => {
  logger.info('Child process exited', {
    pid: proc.pid,
    exitCode: code,
    signal,
    durationMs: Date.now() - spawnedAt,
    owner: 'bash-tool',
  })
})

// On kill
logger.warn('Child process killed', {
  pid: proc.pid,
  signal: 'SIGTERM',
  reason: 'timeout',
  owner: 'bash-tool',
})
```

### 3.6 Periodic Health Snapshot

Output system health snapshot log (info level) every 30s, containing:

```json
{
  "msg": "System health snapshot",
  "processes": { "semaphoreActive": 3, "trackerActive": 3, "zombies": 0 },
  "memory": { "rss": 156, "heapUsed": 89, "heapTotal": 120 },
  "eventLoop": { "lagMs": 2.3 },
  "uptime": 3600
}
```

Implemented as `src/core/observability/health-reporter.ts`, auto-registered at startup. Can be disabled in tests via environment variable `DISABLE_HEALTH_REPORTER=1`.

### 3.7 Process Anomaly Alerting

ProcessTracker periodically checks (every 10s):

| Check | Threshold | Action |
|-------|-----------|--------|
| Active child process count | > `maxProcesses * 2` | `logger.error` + print process tree |
| Zombie process count | > 0 | `logger.error` + record PID list |
| Semaphore/Tracker count mismatch | diff > 2 | `logger.warn` + auto-correct semaphore |
| Single process survival time | > `2 * timeout` | `logger.warn` + force kill |

### 3.8 Test Logging Enhancement

Auto-enable JSON file logging during test runs:

```typescript
// tests/global-setup.ts
export async function setup() {
  const logger = getLogger()
  logger.setLevel('debug')
  logger.addTransport(new JsonFileTransport({
    dir: 'tests/logs',
    prefix: 'test-debug',
    maxSizeMb: 100,
    maxFiles: 3,
  }))
}
```

On test failure, CI auto-uploads `tests/logs/` directory as artifact for post-mortem analysis.

---

## 4. Implementation Priority

| Phase | Content | Effort | Priority |
|-------|---------|--------|----------|
| P0-Immediate | ProcessTracker + spawn spec + GracefulShutdown integration | 2d | Required |
| P0-Immediate | global-setup/teardown + process leak assertion | 1d | Required |
| P0-Immediate | Fork bomb variant special testing | 0.5d | Required |
| P1-This week | Logger multi-transport + child logger | 2d | High |
| P1-This week | JsonFileTransport + log rotation | 1d | High |
| P1-This week | Child process lifecycle logging | 1d | High |
| P1-This week | Unified test cleanup helper | 0.5d | High |
| P2-Next week | Correlation context (AsyncLocalStorage → Logger) | 1d | Medium |
| P2-Next week | Health snapshot + process anomaly alerting | 1d | Medium |
| P2-Next week | Stress testing + timer leak detection | 1d | Medium |
| P3-Within month | CI zombie process detection integration | 0.5d | Medium |
| P3-Within month | Container-level tini + pids-limit specification | Ops cooperation | Medium |

---

## 5. Acceptance Criteria

### Process Safety
- [ ] All `spawn()`/`execa()` call sites registered to ProcessTracker
- [ ] GracefulShutdown can kill all child processes within 15s
- [ ] `detached: true` + `forceKillAfterDelay` enabled in all execa calls
- [ ] Fork bomb variant testing covers ≥ 10 variants

### Testing Safety Net
- [ ] global-teardown detects process leaks, test fails if leaks found
- [ ] Test files involving child processes use processGuard
- [ ] Full test run ends with zombie=0
- [ ] All test files use unified cleanup helper

### Observability
- [ ] Logs include traceId/taskId/component
- [ ] Child process spawn/exit/kill all have structured logs (with PID)
- [ ] Test runs produce JSONL log files, CI can archive
- [ ] Health snapshot outputs every 30s, containing process and memory data

---

## Related Documents

- Incident report: `doc/postmortem-20260410-zombie-storm.md`
- Security model: `doc/adr/012-security-model.md`
- Runtime hardening: `doc/adr/060-runtime-stability-hardening.md`
- Industrial-grade hardening: `doc/adr/071-industrial-grade-hardening.md`

This **ADR-072** is solid, it's not a "patch-style fix" but a systematic reinforcement of **process safety, testing safety net, and log observability**.
Overall judgment: **Direction is correct, priority is reasonable, content is actionable, sufficient to take effect as a P0/P1-level engineering governance ADR.**

---

## Overall Evaluation

This ADR's biggest strengths are 4.

### 1. Root cause chain is correct

You didn't just focus on fork bomb regex escape, but split the incident into three layers:

* Process lifecycle out of control
* Testing system lacks safety net
* Insufficient observability causes slow discovery and localization

This is correct.
What really takes down a system is usually not a single bug, but **"one bug + two layers of missing protection"**.

### 2. Fix plan is "layered defense", not single-point fix

ADR doesn't just say "fix the regex" or "kill -9 everything", but completely covers:

* ProcessTracker
* detached / process group isolation
* GracefulShutdown integration
* Semaphore reconciliation and self-healing
* global setup/teardown
* processGuard/timerGuard
* CI zombie detection
* Logger multi-transport
* traceId/taskId/sessionId correlation

This shows the plan already has industrial-grade governance thinking.

### 3. Acceptance criteria are clear enough

The final checklist is critical, avoiding ADR becoming a "concept document".
Especially these points are solid:

* All spawn/execa registered to ProcessTracker
* Kill all child processes within 15s
* `detached: true` + `forceKillAfterDelay` enabled in all execa calls
* Fork bomb variant testing covers ≥ 10 variants

These are all verifiable.

### 4. Implementation order is reasonable

Putting **ProcessTracker + test teardown + fork bomb testing** at P0 is correct.
Because these three are the minimum closed loop:

* First be able to track
* Then be able to detect leaks
* Then be able to prevent recurrence

---

## The Strongest Parts of This ADR

### A. ProcessTracker is the core pivot of this ADR

This is the most critical design in the whole piece.
Because without a unified process source of truth, these are hard to establish:

* GracefulShutdown cleanup
* Semaphore reconciliation
* Health snapshot
* Leak testing
* Orphan process kill
* Zombie monitoring

In other words, **ProcessTracker is not a utility class, but the foundation of runtime resource governance**.

---

### B. global-teardown + processGuard this pair of designs is valuable

Many systems' problems are not "no teardown", but teardown is too scattered and random.
You made it into two layers here:

* **global-teardown**: Global fallback
* **processGuard**: Child process test special assertion

This is correct.
Because global teardown is responsible for "don't pollute the whole test process", processGuard is responsible for "which test leaked then precisely fail that test".

---

### C. Logger upgrade direction is correct

You didn't simply add a file logger, but completed 3 things:

* Multi-transport
* AsyncLocalStorage correlation context
* Child logger / component auto-injection

These three combined make logs truly useful for troubleshooting.
Otherwise it's just "more logs", not "more useful logs".

---

## 10 Points I Recommend Strengthening

Below are not reversals, but will make the ADR more complete.

---

### 1. `killAll()` must prioritize killing by **process group**, not just by PID

You mentioned `pgid` in the article, but the specification is not rigorous.

Recommend explicitly writing into ADR:

* In detached mode, must prioritize `kill(-pgid, signal)`
* Only fall back to single PID kill when process group kill fails
* Otherwise shell-derived grandson processes, background processes, pipe child processes will be missed

Recommend adding something like:

```typescript
// Prioritize killing process group, ensuring all shell-derived child processes terminate together
process.kill(-tracked.pgid, signal)
```

Otherwise many situations where "parent process appears killed" actually have child/grandchild processes still alive.

---

### 2. `register()` timing must be stricter: **immediately after spawn success and getting pid**

Recommend adding to spec:

* Registration must occur before any `await`, any event binding, any timer

The reason is if an error is thrown in between, the process may already be up but not yet in registry.

Recommend making it a hard rule:

> The first thing after a child process gets a valid pid must be register().

---

### 3. `unregister()` must not only hook `exit`, but also `close`

Node child processes often have:

* `exit` already fired
* stdio handles not yet fully closed
* `close` arrives later

Recommend ADR explicitly states:

* `exit` used to record exit code
* `close` used for final resource cleanup
* unregister needs to be reentrant-safe, but at least compatible with either triggering

Otherwise there are boundary race conditions.

---

### 4. Need an intermediate state for **"kill sent but not exited"**

Current `TrackedProcess` only has active information, insufficient to distinguish:

* Running normally
* SIGTERM sent, waiting to exit
* SIGKILL sent
* Zombie/unrecoverable

Recommend adding fields:

```typescript
killRequestedAt?: number
lastSignal?: string
state?: 'running' | 'terminating' | 'killed' | 'exited'
```

This way health snapshots and alerts can be more accurate, otherwise you only know "still alive", not whether it's already in cleanup.

---

### 5. `getZombieCount()` may not be reliable in containers, need compatibility strategy

Reading `ps` on Linux is fine, but in different runtime environments:

* CI containers may trim ps capability
* Non-Linux platform behaviors differ
* PID namespace may isolate the view

Recommend noting in ADR:

* Zombie detection prefers Linux `ps`
* Falls back to approximate judgment "process in tracker has exited but not close timed out" when failing
* Don't treat `ps` as the only source of truth

---

### 6. Semaphore self-healing must be very conservative, avoid "releasing truly active processes"

This is high risk.
"Auto-release if acquire exceeds `2 * timeout` without release" may cause collateral damage:

* Truly running long tasks
* Processes blocked but not zombie
* Tasks that have escaped JS tracking but are still alive on OS side

Recommend changing to:

* **Do not auto-release**
* First enter `suspected_leak` state
* Log warn/error
* ProcessTracker re-verifies PID survival and process group status
* Only modify count when explicitly confirmed process does not exist on OS layer

In other words, change "self-heal" to "prudent correction".

---

### 7. global-teardown process snapshot must not only look at PID, must look at PPID/PGID/command line

Otherwise misjudgment may occur:

* New processes that naturally exist in the system during testing
* Short-lived processes reusing PIDs
* System processes not derived from current test runner

Recommend snapshot records:

* pid
* ppid
* pgid
* command / args
* start time (if obtainable)

Then preferentially judge "is this process a descendant of the current test runner process" for leak, not just PID diff.

---

### 8. Timer leak guard currently only covers `setInterval`, not enough

Actual leaks may also come from:

* `setTimeout`
* `setImmediate`
* `AbortSignal.timeout`
* Unclosed file watcher / fs watcher
* Uncancelled EventEmitter listener

Recommend uniformly expanding into an `resource-guard`:

* timers
* intervals
* immediates
* watchers
* listeners (optional)

Otherwise "no timer leaks" does not equal "no async resource leaks".

---

### 9. Log transport needs backpressure and failure strategy

File logging easily has these types of issues:

* High-volume writes blow up disk
* Single flush hangs event loop
* File write failure backfires on main flow

Recommend supplementing transport constraints in ADR:

* File transport must not block main business path
* Transport write failure at most alerts, must not throw to business caller
* Must have memory buffer cap
* When buffer is full, can discard debug/info, retain warn/error

Otherwise the logging system itself may become a new stability risk.

---

### 10. Health snapshot must include **event loop delay histogram** and **open handles count**

You already have:

* processes
* memory
* lagMs
* uptime

Recommend adding two more useful metrics:

* `activeHandles`
* `activeRequests`

These are very helpful in Node for troubleshooting "why won't the process exit".
More advanced, can add:

* `processTracker.active`
* `processTracker.terminating`
* `processSemaphore.active`
* `processSemaphore.queued`
* `orphanedChildrenDetected`

---

## Supplementary Clauses I Suggest Adding Directly to ADR

You can use the following as "supplementary specifications" and add them in.

---

### Recommended addition: 1.2.1 Process Group Priority Termination

```md
#### 1.2.1 Process Group Priority Termination

All child processes started with `detached: true` must prioritize sending signals to the process group when terminating, not just the main PID.

Reason:
- Commands started by shell/bash/sh often derive grandson processes
- Killing only parent PID cannot guarantee background processes, pipe child processes are recovered
- Process group kill is the basic requirement to prevent orphan/zombie spread

Implementation requirements:
- `TrackedProcess` must record `pgid`
- `killAll()` by default prioritizes `kill(-pgid, signal)`
- Falls back to single PID kill only when process group kill fails
```

---

### Recommended addition: 1.4.1 Semaphore Self-Healing Protection

```md
#### 1.4.1 Semaphore Self-Healing Protection

Semaphore must not auto-correct count solely based on "not released for too long".
Any self-healing action must first be verified by ProcessTracker:

- Is PID/PGID still alive
- Has kill signal been received but not yet exited
- Is there exit/close race

Only when OS-layer process is confirmed to not exist, count correction is allowed.
```

---

### Recommended addition: 2.1.1 Test Process Snapshot Fields

```md
#### 2.1.1 Test Process Snapshot Fields

Test before/after process snapshots must record at least:
- pid
- ppid
- pgid
- command
- startTime (when obtainable)

Leak judgment prioritizes "is this a descendant of the current test runner process" rather than pure PID diff.
```

---

### Recommended addition: 3.2.1 Transport Fault Isolation

```md
#### 3.2.1 Transport Fault Isolation

Any log transport write failure must not affect the main business flow.

Requirements:
- Transport errors can only be swallowed internally and counted/alerted
- File transport uses buffered writing
- When buffer reaches upper limit, low-priority logs (debug/info) are preferentially discarded
- warn/error should be retained as much as possible
```

---

## Relationship Between This ADR and Your Preceding "Industrial/Production-Grade" Analysis

Looking at your preceding competitor analysis and this ADR together, I would define it that way:

* Preceding Aider / Claude Code / OpenCode / Temporal / LangGraph / Hermes analysis solves **"what capabilities the system still lacks"**
* This ADR-072 solves **"how the system no longer self-destructs from basic runtime issues"**

In other words, this ADR does not belong to "feature enhancement", but:

**Production-ready basic threshold completion**

This is critical, because without this layer, the more high-end capabilities above, the more serious the damage when they break.

---

## Final Judgment

My conclusion is:

### This ADR Can Directly Enter Execution

And the priority ordering is broadly correct.

### But I Recommend Adding 4 Mandatory Items Before Formal Freeze

These four:

1. **killAll prioritizes process group kill**
2. **register must execute immediately after getting pid**
3. **unregister compatible with both exit/close**
4. **semaphore self-healing must pass ProcessTracker verification, cannot auto-release by time**

After these four are added, this ADR will be closer to a true industrial-grade specification.

If you want, I can next help you organize this **ADR-072** into a "review-approved draft", directly merging the supplementary clauses I suggested above to form a submittable version.
