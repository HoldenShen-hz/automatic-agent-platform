/**
 * Lease Contention Test - Verifies that only one worker can acquire a lease
 * for a given execution under concurrent contention.
 *
 * This test validates:
 * - Multiple workers racing to insert leases → only one succeeds (UNIQUE constraint)
 * - Fencing token is monotonically increasing per execution
 * - No two active leases exist simultaneously for the same execution
 */
export {};
