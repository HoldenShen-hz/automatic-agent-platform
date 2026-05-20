import { pathToFileURL } from "node:url";

import { resolveCliDbPath, withCliStorageBackendAsync } from "./authoritative-storage.js";
import { CLI_EXIT_FAILURE, CLI_EXIT_SUCCESS, runCliMain } from "./cli-exit.js";
import { validateSemanticVectorReadiness } from "../../platform/five-plane-state-evidence/knowledge/semantic-vector-validation.js";

async function main(): Promise<number> {
  const dbPath = resolveCliDbPath();
  const report = await withCliStorageBackendAsync(async (storage) => {
    return validateSemanticVectorReadiness({
      env: process.env,
      storageDriver: storage.driver,
      database: storage.asyncSql,
    });
  }, { dbPath });

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  return report.ready ? CLI_EXIT_SUCCESS : CLI_EXIT_FAILURE;
}

if (process.argv[1] != null && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void runCliMain(main, {
    onError: (error) => {
      const message = error instanceof Error ? error.message : String(error);
      process.stdout.write(`${JSON.stringify({
        validatedAt: new Date().toISOString(),
        ready: false,
        errorCode: message,
        errorMessage: message,
      }, null, 2)}\n`);
    },
  });
}
