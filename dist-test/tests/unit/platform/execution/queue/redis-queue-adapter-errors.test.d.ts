/**
 * RedisQueueAdapter Error Path Security Tests
 *
 * P0 security boundary tests per §8 安全回归测试规范
 * Tests: hmset failure during enqueueAsync pipeline, malformed Redis hash data,
 * nack() when currentAttempts >= maxAttempts (dead letter path),
 * mapRedisToJobRecord() error handling
 */
export {};
