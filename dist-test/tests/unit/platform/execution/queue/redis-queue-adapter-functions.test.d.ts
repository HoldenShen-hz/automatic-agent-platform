/**
 * RedisQueueAdapter Public Function Tests
 *
 * Tests for public methods on RedisQueueAdapter:
 * - enqueueAsync (edge cases and idempotency)
 * - dequeueAsync (ack/nack paths, delayed job handling)
 * - getJobAsync (not found, malformed data)
 * - listJobsAsync (filtering, limits)
 * - moveToDeadLetterAsync (job states)
 * - retryJobAsync (job states, reset behavior)
 * - statsAsync (queue stats calculation)
 * - listQueuesAsync (queue enumeration)
 * - purgeAsync (job cleanup)
 * - ping, close (connection management)
 * - sync enqueue (pipeline behavior)
 *
 * Uses mock Redis client to test behavior without live Redis connection.
 */
export {};
