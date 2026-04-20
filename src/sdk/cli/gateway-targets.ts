/**
 * Gateway Targets CLI
 *
 * This module provides the command-line entry point for gateway target directory management.
 * It allows registration, listing, and resolution of gateway targets that define where
 * events and messages should be delivered within the Automatic Agent system.
 *
 * Environment Variables:
 *   - AA_DB_PATH: Path to the SQLite database
 *   - AA_GATEWAY_TARGET_ACTION: Action to perform (upsert, list, resolve)
 *   - AA_GATEWAY_CHANNEL: Channel name for target operations
 *   - AA_GATEWAY_TARGET_KIND: Kind of target (e.g., worker, queue, webhook)
 *   - AA_GATEWAY_EXTERNAL_TARGET_ID: External identifier for the target
 *   - AA_GATEWAY_DISPLAY_NAME: Human-readable name for the target
 *   - AA_GATEWAY_ALIASES_JSON: JSON array of target aliases
 *   - AA_GATEWAY_METADATA_JSON: JSON object with target metadata
 *   - AA_GATEWAY_QUERY: Query string for list/resolve operations
 *   - AA_GATEWAY_LIMIT: Maximum number of results to return
 *
 * Actions:
 *   - upsert: Register or update a gateway target
 *   - list: List gateway targets matching optional filters
 *   - resolve: Resolve a target by query string
 *
 * @see {@link https://github.com/anomalyco/automatic-agent/blob/main/docs_zh/automatic_agent_patform_arthitecture_design.md | Architecture and Technical Design}
 * @see {@link https://github.com/anomalyco/automatic-agent/blob/main/docs_zh/governance/glossary_and_terminology.md | Glossary and Terminology}
 */

import { withCliStorage } from "./authoritative-storage.js";
import { loadGatewayTargetsCliEnv } from "../../platform/control-plane/config-center/remaining-cli-env.js";
import { ValidationError } from "../../platform/contracts/errors.js";
import { GatewayTargetDirectoryService } from "../../platform/interface/channel-gateway/gateway-target-directory-service.js";
import { GatewayStorageAdapter } from "../../platform/interface/channel-gateway/storage-adapter.js";

/**
 * Main entry point for the gateway targets CLI.
 *
 * Initializes storage, creates the gateway target service, dispatches the requested action,
 * outputs the result as JSON, and closes the storage connection.
 */
function main(): void {
  const envConfig = loadGatewayTargetsCliEnv();
  const output = withCliStorage((storage) => {
    const gatewayStorage = new GatewayStorageAdapter(storage.store);
    const service = new GatewayTargetDirectoryService(gatewayStorage);
    switch (envConfig.action) {
      case "upsert":
        if (
          envConfig.channel == null ||
          envConfig.targetKind == null ||
          envConfig.externalTargetId == null ||
          envConfig.displayName == null
        ) {
          throw new ValidationError("missing_env:gateway_target_upsert", "missing_env:gateway_target_upsert");
        }
        return service.registerTarget({
          channel: envConfig.channel,
          targetKind: envConfig.targetKind as never,
          externalTargetId: envConfig.externalTargetId,
          displayName: envConfig.displayName,
          ...(envConfig.aliases ? { aliases: envConfig.aliases } : {}),
          ...(envConfig.metadata ? { metadata: envConfig.metadata } : {}),
        });
      case "list":
        return service.listTargets({
          ...(envConfig.channel ? { channel: envConfig.channel } : {}),
          ...(envConfig.query ? { query: envConfig.query } : {}),
          ...(envConfig.limit != null ? { limit: envConfig.limit } : {}),
        });
      case "resolve":
        if (envConfig.query == null) {
          throw new ValidationError("missing_env:AA_GATEWAY_QUERY", "missing_env:AA_GATEWAY_QUERY");
        }
        return service.resolveTarget({
          query: envConfig.query,
          ...(envConfig.channel ? { channel: envConfig.channel } : {}),
        });
      default:
        throw new ValidationError(`unknown_gateway_target_action:${envConfig.action}`, `unknown_gateway_target_action:${envConfig.action}`);
    }
  }, envConfig.dbPath != null ? { dbPath: envConfig.dbPath } : {});

  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
}

main();
