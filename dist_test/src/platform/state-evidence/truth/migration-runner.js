export class MigrationRunner {
    storage;
    constructor(storage) {
        this.storage = storage;
    }
    async status() {
        return this.buildResult("status");
    }
    async up() {
        await this.storage.migrate();
        return this.buildResult("up");
    }
    async down() {
        return this.buildResult("down");
    }
    async buildResult(action) {
        const status = this.storage.driver === "sqlite"
            ? this.storage.sql.getSchemaStatus()
            : await this.storage.postgres.getSchemaStatus();
        const rollbackSupported = false;
        const rollbackReason = action === "down"
            ? "authoritative storage down migrations are not supported"
            : null;
        return {
            action,
            driver: this.storage.driver,
            status: {
                currentVersion: status.currentVersion,
                expectedVersion: status.expectedVersion,
                upToDate: status.upToDate,
                pendingVersions: [...status.pendingVersions],
                checksumMismatches: [...status.checksumMismatches],
            },
            rollbackSupported,
            rollbackReason,
        };
    }
}
//# sourceMappingURL=migration-runner.js.map