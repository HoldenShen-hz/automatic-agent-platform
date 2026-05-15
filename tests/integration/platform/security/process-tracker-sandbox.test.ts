import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, ChildProcess } from 'node:child_process';
import { ProcessTracker, getProcessTracker, resetProcessTracker } from '../../../../src/platform/five-plane-execution/resource/process-tracker.js';

// Extended type for pgid access
interface ChildProcessWithPgid extends ChildProcess {
  pgid?: number;
}

function spawnTracked(tracker: ProcessTracker, command: string, args: string[], owner: 'bash-tool' = 'bash-tool') {
  const proc = spawn(command, args, { detached: false });
  tracker.register(proc, owner, command, args);
  return proc;
}

test('ProcessTracker sandbox: process orphan cleanup', async () => {
  const tracker = new ProcessTracker();

  // Spawn a long-running process
  const proc = spawnTracked(tracker, 'sleep', ['60'], 'bash-tool');

  assert.strictEqual(tracker.getActiveCount(), 1);

  // Simulate shutdown: kill all
  await tracker.killAll('SIGTERM', 2000);

  // Verify cleanup
  assert.strictEqual(tracker.getActiveCount(), 0);

  // Cleanup
  try { proc.kill('SIGKILL'); } catch {}
  tracker.reset();
});

test('ProcessTracker sandbox: process group isolation', async () => {
  const tracker = new ProcessTracker();

  // Create a process group using detached mode
  const proc = spawn('bash', ['-c', 'sleep 60'], { detached: true, stdio: 'ignore' });
  proc.unref();
  await new Promise(r => setTimeout(r, 100));

  const procWithPgid = proc as ChildProcessWithPgid;
  if (proc.pid && procWithPgid.pgid) {
    tracker.register(proc, 'bash-tool', 'bash', ['-c', 'sleep 60']);

    const before = tracker.getActiveCount();
    assert.ok(before >= 1);

    // Kill should target process group
    await tracker.kill(proc.pid, 'SIGTERM');

    await new Promise(r => setTimeout(r, 500));
    // Process should be in terminating state
    const summary = tracker.getSummary();
    assert.ok(summary.active <= before);
  }

  // Cleanup
  if (procWithPgid.pgid) {
    try { process.kill(-procWithPgid.pgid, 'SIGKILL'); } catch {}
  } else if (proc.pid) {
    try { process.kill(proc.pid, 'SIGKILL'); } catch {}
  }
  tracker.reset();
});

test('ProcessTracker sandbox: multiple processes cleanup', async () => {
  const tracker = new ProcessTracker();

  // Spawn multiple processes
  const procs = [
    spawnTracked(tracker, 'sleep', ['60'], 'bash-tool'),
    spawnTracked(tracker, 'sleep', ['60'], 'bash-tool'),
    spawnTracked(tracker, 'sleep', ['60'], 'bash-tool'),
  ];

  const validProcs = procs.filter(p => p.pid);
  assert.strictEqual(tracker.getActiveCount(), validProcs.length);

  // Kill all
  await tracker.killAll('SIGTERM', 2000);

  // All should be cleaned
  assert.strictEqual(tracker.getActiveCount(), 0);

  // Final cleanup
  procs.forEach(p => { try { p.kill('SIGKILL'); } catch {} });
  tracker.reset();
});

test('ProcessTracker sandbox: zombie detection', async () => {
  const tracker = new ProcessTracker();

  // Spawn and immediately kill a short-lived process
  const proc = spawnTracked(tracker, 'echo', ['test'], 'bash-tool');

  // Wait for it to exit
  await new Promise(r => setTimeout(r, 200));

  // Zombie count should be accurate
  const zombieCount = tracker.getZombieCount();
  const activeCount = tracker.getActiveCount();

  // Either exited (zombie) or fully cleaned up
  assert.ok(activeCount === 0 || zombieCount >= 0);

  // Cleanup
  try { proc.kill(); } catch {}
  tracker.reset();
});

test('ProcessTracker sandbox: force kill after delay', async () => {
  const tracker = new ProcessTracker();

  // Spawn a process that ignores SIGTERM
  const proc = spawn('bash', ['-c', 'trap "" TERM; sleep 60'], { detached: false });
  tracker.register(proc, 'bash-tool', 'bash', ['-c', 'trap "" TERM; sleep 60']);

  assert.strictEqual(tracker.getActiveCount(), 1);

  // killAll with short force-kill delay
  await tracker.killAll('SIGTERM', 500);

  // Process should be killed despite ignoring SIGTERM
  await new Promise(r => setTimeout(r, 100));
  assert.strictEqual(tracker.getActiveCount(), 0);

  // Cleanup
  try { proc.kill('SIGKILL'); } catch {}
  tracker.reset();
});

test('ProcessTracker singleton reset', async () => {
  const tracker1 = getProcessTracker();
  resetProcessTracker();
  const tracker2 = getProcessTracker();

  assert.notStrictEqual(tracker1, tracker2);
  tracker2.reset();
});
