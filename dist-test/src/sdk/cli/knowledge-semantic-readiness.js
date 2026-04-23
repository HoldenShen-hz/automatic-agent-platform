import { resolveCliDbPath, withCliStorageBackendAsync } from "./authoritative-storage.js";
import { validateSemanticVectorReadiness } from "../../platform/state-evidence/knowledge/semantic-vector-validation.js";
async function main() {
    const dbPath = resolveCliDbPath();
    const report = await withCliStorageBackendAsync(async (storage) => {
        return validateSemanticVectorReadiness({
            env: process.env,
            storageDriver: storage.driver,
            database: storage.asyncSql,
        });
    }, { dbPath });
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    if (!report.ready) {
        process.exitCode = 1;
    }
}
main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stdout.write(`${JSON.stringify({
        validatedAt: new Date().toISOString(),
        ready: false,
        errorCode: message,
        errorMessage: message,
    }, null, 2)}\n`);
    process.exitCode = 1;
});
//# sourceMappingURL=knowledge-semantic-readiness.js.map