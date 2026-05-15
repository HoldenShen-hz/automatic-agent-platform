import { dirname } from "node:path";

import { withCliStorageAsync } from "./authoritative-storage.js";
import { loadAcceptanceReadinessCliEnv } from "../../platform/five-plane-control-plane/config-center/operations-cli-env.js";
import { AcceptanceReadinessService } from "../../platform/five-plane-control-plane/incident-control/acceptance-readiness-service.js";
import { createWorkspaceWritePolicy } from "../../platform/five-plane-control-plane/iam/sandbox-policy.js";
import { SecretManagementService } from "../../platform/five-plane-control-plane/iam/secret-management-service.js";

const envConfig = loadAcceptanceReadinessCliEnv();

const result = await withCliStorageAsync(async (storage) => {
  const secretManagementService = new SecretManagementService(storage.sql, storage.store);
  const service = new AcceptanceReadinessService(storage.store, {
    repoRootDir: envConfig.repoRootDir,
    evidenceRootDir: envConfig.evidenceRootDir,
    secretManagementService,
    observedStorageDriver: storage.driver,
    ...(envConfig.artifactRoot == null
      ? {}
      : {
          artifactStoreOptions: {
            rootDir: envConfig.artifactRoot,
            sandboxPolicy: createWorkspaceWritePolicy(dirname(envConfig.artifactRoot)),
          },
        }),
  });

  const input = {
    targetEnvironment: envConfig.targetEnvironment,
    ...(envConfig.generatedAt ? { generatedAt: envConfig.generatedAt } : {}),
    ...(envConfig.taskId ? { taskId: envConfig.taskId } : {}),
    ...(envConfig.version ? { version: envConfig.version } : {}),
    ...(envConfig.commitSha ? { commitSha: envConfig.commitSha } : {}),
    ...(envConfig.rolloutStrategy ? { rolloutStrategy: envConfig.rolloutStrategy } : {}),
  };

  return envConfig.action === "export"
    ? await service.exportReport(input)
    : await service.buildReport(input);
}, { dbPath: envConfig.dbPath });

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
