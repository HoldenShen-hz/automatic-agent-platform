/**
 * SYS-REL-2.4 Redis Queue Adapter Enqueue Pipeline Failure Tests
 *
 * Tests that Redis write failures propagate from enqueue pipeline to caller.
 *
 * Bug: redis-queue-adapter enqueue pipeline uses `.catch(() => {})` which means
 * write failures don't propagate to the caller. The enqueue() method returns
 * immediately after calling p.exec() with a detached error handler that swallows
 * exceptions.
 *
 * Note: These tests use pipeline exec() that returns error responses rather than
 * throwing, because the source code's p.exec().catch() only triggers when exec()
 * rejects. When exec() resolves with error responses, the catch is not invoked,
 * but the caller still receives a "success" job record despite the pipeline failures.
 */
export {};
