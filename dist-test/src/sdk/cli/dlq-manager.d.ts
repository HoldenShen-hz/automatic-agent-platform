/**
 * DLQ Manager CLI Tool
 *
 * Manages Dead Letter Queues across three backends:
 * - Gateway DLQ (gateway_dead_letters table)
 * - Jobs DLQ (queue_jobs with status='dead_letter')
 * - Event DLQ (event_dead_letters table)
 *
 * Usage:
 *   npm run dlq -- -a list -q gateway
 *   npm run dlq -- -a count
 *   npm run dlq -- -a retry -q jobs
 *   npm run dlq -- -a purge -q events
 *   npm run dlq -- -a list -q gateway -l 50
 *
 * Environment:
 *   AA_DB_PATH - Path to SQLite database (defaults to data/sqlite/authoritative-demo.db)
 */
export {};
