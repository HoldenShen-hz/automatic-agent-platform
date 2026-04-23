/**
 * Migration Snapshot Generator
 *
 * Generates SQLite snapshot databases at specific schema versions.
 * These snapshots are used for testing upgrade/rollback migration paths.
 *
 * Usage:
 *   npm run build && node dist/tests/fixtures/migration/generate-snapshots.js [outputDir]
 *
 * Key versions for snapshots:
 *   - v1:  Initial phase1a schema (baseline)
 *   - v5:  Early worker routing migrations
 *   - v10: Message parts + remote routing
 *   - v20: Billing + perception + gateway
 *   - v30: Workflow dispatch + LLM eval
 *   - v40: Session events (current latest)
 */
interface SnapshotResult {
    version: number;
    name: string;
    path: string;
    sizeBytes: number;
}
/**
 * Main entry point: generates snapshots for all key versions.
 */
export declare function main(): SnapshotResult[];
export {};
