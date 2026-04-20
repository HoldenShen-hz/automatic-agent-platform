/**
 * Memory CLI Tool
 *
 * This module provides a command-line interface for memory operations including
 * initialization, remembering facts, prefetching memories, syncing turn history,
 * querying memories, quality reporting, memory consolidation, and revocation.
 *
 * Usage:
 *   npm run memory initialize                      # Initialize memory provider
 *   npm run memory remember                       # Store a memory
 *   npm run memory prefetch                       # Prefetch memories for query
 *   npm run memory queue_prefetch                 # Queue async prefetch
 *   npm run memory system_prompt_block             # Generate system prompt block
 *   npm run memory sync_turn                       # Sync turn with memories
 *   npm run memory list                           # Query/list memories
 *   npm run memory quality                         # Get quality report
 *   npm run memory consolidate                     # Consolidate memories
 *   npm run memory revoke                          # Revoke a memory
 *
 * Environment Variables:
 *   - AA_MEMORY_ACTION: The memory operation to perform
 *   - AA_DB_PATH: Optional database path for persistent storage
 *   - AA_MEMORY_SCOPE: Memory scope (task, session, agent, execution)
 *   - Additional action-specific variables documented in the CLI env loader
 *
 * @see {@link docs_zh/contracts/memory_contract.md} - Memory contracts
 * @see {@link docs_zh/governance/glossary_and_terminology.md} - Memory terminology
 * @see {@link docs_zh/automatic_agent_patform_arthitecture_design.md} - Architecture
 */

import { withCliStorageAsync } from "./authoritative-storage.js";
import {
  buildMemoryProviderQuery,
  buildStructuredMemoryContentFromCliEnv,
  loadMemoryCliEnv,
} from "../../platform/control-plane/config-center/remaining-cli-env.js";
import { ValidationError } from "../../platform/contracts/errors.js";
import { BuiltInMemoryProvider } from "../../platform/state-evidence/memory/builtin-memory-provider.js";
import { MemoryService } from "../../platform/state-evidence/memory/memory-service.js";
import type { ConsolidateMemoriesInput, RememberMemoryInput } from "../../platform/state-evidence/memory/memory-service.js";
import type { MemoryLayer, MemorySourceTrustLevel } from "../../platform/contracts/types/domain.js";

/**
 * Main entry point for the memory CLI.
 *
 * Initializes the database, memory service, and built-in memory provider,
 * then dispatches to the appropriate memory operation based on the
 * AA_MEMORY_ACTION environment variable. Outputs results as formatted
 * JSON and ensures the database connection is properly closed.
 */
async function main(): Promise<void> {
  const envConfig = loadMemoryCliEnv();
  await withCliStorageAsync(async (storage) => {
    const store = storage.store;
    const memory = new MemoryService(store);
    const provider = new BuiltInMemoryProvider(memory);
    const action = envConfig.action;
    let output: unknown;
    switch (action) {
    case "initialize":
      output = await provider.initialize();
      break;
    case "remember": {
      const memoryLayer = envConfig.memoryLayer as MemoryLayer | undefined;
      const sourceTrustLevel = envConfig.sourceTrustLevel as MemorySourceTrustLevel | undefined;
      const classification = envConfig.classification;
      const structuredContent = buildStructuredMemoryContentFromCliEnv(envConfig);
      const rememberInput: RememberMemoryInput = {
        taskId: envConfig.taskId ?? null,
        sessionId: envConfig.sessionId ?? null,
        agentId: envConfig.agentId ?? null,
        executionId: envConfig.executionId ?? null,
        scope: envConfig.scope ?? missingRequired("AA_MEMORY_SCOPE"),
        content: structuredContent
          ?? envConfig.contentJson
          ?? envConfig.memoryText
          ?? missingRequired("AA_MEMORY_TEXT"),
        qualityScore: envConfig.qualityScore ?? null,
        expiresAt: envConfig.expiresAt ?? null,
      };
      if (classification) {
        rememberInput.classification = classification;
      }
      if (memoryLayer) {
        rememberInput.memoryLayer = memoryLayer;
      }
      if (sourceTrustLevel) {
        rememberInput.sourceTrustLevel = sourceTrustLevel;
      }
      if (envConfig.createdAt != null) {
        rememberInput.createdAt = envConfig.createdAt;
      }
      output = memory.remember(rememberInput);
      break;
    }
    case "prefetch": {
      output = await provider.prefetch(buildMemoryProviderQuery(envConfig));
      break;
    }
    case "queue_prefetch": {
      const queued = await provider.queuePrefetch(buildMemoryProviderQuery(envConfig));

      output = envConfig.prefetchAwait
        ? await provider.awaitQueuedPrefetch(queued.requestId)
        : queued;
      break;
    }
    case "system_prompt_block": {
      output = await provider.systemPromptBlock(buildMemoryProviderQuery(envConfig));
      break;
    }
    case "sync_turn": {
      const structuredContent = buildStructuredMemoryContentFromCliEnv(envConfig);
      const memories: RememberMemoryInput[] = [];
      if (envConfig.scope != null) {
        const syncMemoryInput: RememberMemoryInput = {
          taskId: envConfig.taskId ?? null,
          sessionId: envConfig.sessionId ?? null,
          agentId: envConfig.agentId ?? null,
          executionId: envConfig.executionId ?? null,
          scope: envConfig.scope,
          content: structuredContent
            ?? envConfig.contentJson
            ?? envConfig.memoryText
            ?? missingRequired("AA_MEMORY_TEXT"),
          qualityScore: envConfig.qualityScore ?? null,
          expiresAt: envConfig.expiresAt ?? null,
        };
        const classification = envConfig.classification;
        const sourceTrustLevel = envConfig.sourceTrustLevel as MemorySourceTrustLevel | undefined;
        const memoryLayer = envConfig.memoryLayer as MemoryLayer | undefined;
        if (classification) {
          syncMemoryInput.classification = classification;
        }
        if (sourceTrustLevel) {
          syncMemoryInput.sourceTrustLevel = sourceTrustLevel;
        }
        if (memoryLayer) {
          syncMemoryInput.memoryLayer = memoryLayer;
        }
        memories.push(syncMemoryInput);
      }

      const hasExperience =
        envConfig.experienceTaskContext
        && envConfig.experienceTaskIntent
        && envConfig.sessionId
        && envConfig.agentId
        && envConfig.executionId
        && envConfig.taskId;

      output = await provider.syncTurn({
        memories,
        experience: hasExperience
          ? {
              taskId: envConfig.taskId!,
              sessionId: envConfig.sessionId!,
              agentId: envConfig.agentId!,
              executionId: envConfig.executionId!,
              taskContext: envConfig.experienceTaskContext!,
              taskIntent: envConfig.experienceTaskIntent!,
              toolsUsed: envConfig.experienceTools ?? [],
              outcome: envConfig.experienceOutcome ?? "succeeded",
              finalErrorCode: envConfig.experienceFinalErrorCode ?? null,
              qualityScore: envConfig.experienceQualityScore ?? 0.8,
            }
          : null,
      });
      break;
    }
    case "shutdown":
      output = await provider.shutdown();
      break;
    case "list": {
      output = memory.recall({
        ...(envConfig.taskId ? { taskId: envConfig.taskId } : {}),
        ...(envConfig.sessionId ? { sessionId: envConfig.sessionId } : {}),
        ...(envConfig.agentId ? { agentId: envConfig.agentId } : {}),
        ...(envConfig.executionId ? { executionId: envConfig.executionId } : {}),
        ...(envConfig.scopes ? { scopes: envConfig.scopes } : {}),
        ...(envConfig.memoryLayers ? { memoryLayers: envConfig.memoryLayers } : {}),
        ...(envConfig.classifications ? { classifications: envConfig.classifications } : {}),
        ...(envConfig.sourceTrustLevels ? { sourceTrustLevels: envConfig.sourceTrustLevels } : {}),
        ...(envConfig.minQualityScore != null ? { minQualityScore: envConfig.minQualityScore } : {}),
        ...(envConfig.limit != null ? { limit: envConfig.limit } : {}),
        ...(envConfig.evaluatedAt ? { evaluatedAt: envConfig.evaluatedAt } : {}),
        includeExpired: envConfig.includeExpired,
        includeRevoked: envConfig.includeRevoked,
      });
      break;
    }
    case "quality": {
      output = memory.getQualityReport({
        ...(envConfig.taskId ? { taskId: envConfig.taskId } : {}),
        ...(envConfig.sessionId ? { sessionId: envConfig.sessionId } : {}),
        ...(envConfig.agentId ? { agentId: envConfig.agentId } : {}),
        ...(envConfig.executionId ? { executionId: envConfig.executionId } : {}),
        ...(envConfig.scopes ? { scopes: envConfig.scopes } : {}),
        ...(envConfig.memoryLayers ? { memoryLayers: envConfig.memoryLayers } : {}),
        ...(envConfig.classifications ? { classifications: envConfig.classifications } : {}),
        ...(envConfig.sourceTrustLevels ? { sourceTrustLevels: envConfig.sourceTrustLevels } : {}),
        ...(envConfig.minQualityScore != null ? { minQualityScore: envConfig.minQualityScore } : {}),
        ...(envConfig.evaluatedAt ? { evaluatedAt: envConfig.evaluatedAt } : {}),
      });
      break;
    }
    case "consolidate": {
      const consolidateInput: ConsolidateMemoriesInput = {
        revokeSourceMemories: envConfig.revokeSourceMemories,
      };
      if (envConfig.taskId) {
        consolidateInput.taskId = envConfig.taskId;
      }
      if (envConfig.sessionId) {
        consolidateInput.sessionId = envConfig.sessionId;
      }
      if (envConfig.agentId) {
        consolidateInput.agentId = envConfig.agentId;
      }
      if (envConfig.executionId) {
        consolidateInput.executionId = envConfig.executionId;
      }
      if (envConfig.scopes) {
        consolidateInput.scopes = envConfig.scopes;
      }
      if (envConfig.classifications) {
        consolidateInput.classifications = envConfig.classifications;
      }
      if (envConfig.sourceTrustLevels) {
        consolidateInput.sourceTrustLevels = envConfig.sourceTrustLevels;
      }
      if (envConfig.targetMemoryLayer) {
        consolidateInput.targetMemoryLayer = envConfig.targetMemoryLayer;
      }
      if (envConfig.olderThanCreatedAt) {
        consolidateInput.olderThanCreatedAt = envConfig.olderThanCreatedAt;
      }
      if (envConfig.evaluatedAt) {
        consolidateInput.evaluatedAt = envConfig.evaluatedAt;
      }
      if (envConfig.minSourceMemories != null) {
        consolidateInput.minSourceMemories = envConfig.minSourceMemories;
      }
      if (envConfig.maxSourceMemories != null) {
        consolidateInput.maxSourceMemories = envConfig.maxSourceMemories;
      }

      output = memory.consolidate(consolidateInput);
      break;
    }
    case "revoke":
      output = memory.revoke(
        envConfig.memoryId ?? missingRequired("AA_MEMORY_ID"),
        envConfig.revocationReason ?? missingRequired("AA_MEMORY_REVOCATION_REASON"),
      );
      break;
    default:
      throw new ValidationError(`unsupported_memory_action:${action}`, `unsupported_memory_action:${action}`);
    }

    process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  }, envConfig.dbPath != null ? { dbPath: envConfig.dbPath } : {});
}

function missingRequired(name: string): never {
  throw new ValidationError(`missing_env:${name}`, `missing_env:${name}`);
}

await main();
