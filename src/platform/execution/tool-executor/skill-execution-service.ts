
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { realpathSync } from "node:fs";
import { resolve } from "node:path";

import {
  DEFAULT_MODEL_METADATA_REGISTRY,
  type ModelMetadataRegistry,
  type ModelProfileMetadata,
} from "../../control-plane/config-center/model-metadata-registry.js";
import {
  createDefaultResourceCeilingGuard,
  type ResourceCeilingGuard,
} from "../../control-plane/config-center/resource-ceiling.js";
import { ValidationError } from "../../contracts/errors.js";
import { TypedEventBus, type SkillEventType, type TypedEventPayloadMap } from "../../state-evidence/events/typed-event-bus.js";
import { AuthoritativeTaskStore } from "../../state-evidence/truth/authoritative-task-store.js";
import type { AuthoritativeSqlDatabase } from "../../state-evidence/truth/authoritative-sql-database.js";
import type { AgentExecutionRecord, StepOutputRecord } from "../../contracts/types/domain.js";
import { newId, nowIso } from "../../contracts/types/ids.js";
import { sanitizeMcpToolCallResult, validateMcpToolDefinition, validateMcpToolRuntime } from "./mcp-tool-guard.js";
import type { ToolCallErrorSource, ToolCallStatus } from "./tool-call-result.js";
import { resolveExecutionAllowedTools } from "./tool-execution-access.js";
import {
  isToolFailureRetryable,
  resolveToolExecutionMetadata,
  resolveToolTimeoutMs,
  type ToolExecutionMetadata,
  type ToolRecoveryStrategy,
} from "./tool-metadata.js";
import { defaultGitHeadResolver } from "./skill-execution-support.js";
import type {
  CachedSkillExecutionEntry,
  SkillExecutionServiceOptions,
  SkillToolRunner,
} from "./skill-execution-support.js";

import { skillExecutionCoreMethods } from "./skill-execution-core-methods.js";
import { skillExecutionCacheMethods } from "./skill-execution-cache-methods.js";

export type {
  SkillDefinition,
  SkillExecutionCacheMetadata,
  SkillExecutionCachePolicy,
  SkillExecutionRequest,
  SkillExecutionResult,
  SkillExecutionServiceOptions,
  SkillStepDefinition,
  SkillStepExecutionResult,
  SkillToolCallRequest,
  SkillToolCallResult,
  SkillToolRunner,
} from "./skill-execution-support.js";

type SkillExecutionServiceMethodSet =
  & typeof skillExecutionCoreMethods
  & typeof skillExecutionCacheMethods;

// eslint-disable-next-line @typescript-eslint/no-empty-object-type, @typescript-eslint/no-unsafe-declaration-merging
export interface SkillExecutionService extends SkillExecutionServiceMethodSet {}

export class SkillExecutionService {
  readonly bus: TypedEventBus;
  readonly cache = new Map<string, CachedSkillExecutionEntry>();
  readonly cacheMaxEntries: number;
  readonly gitHeadResolver: (workingDirectory: string) => string | null;
  readonly modelMetadataRegistry: ModelMetadataRegistry;
  readonly toolMetadataResolver: (toolName: string) => ToolExecutionMetadata | null;
  readonly resourceCeilingGuard: ResourceCeilingGuard;
  public constructor(
    public readonly db: AuthoritativeSqlDatabase,
    public readonly store: AuthoritativeTaskStore,
    public readonly toolRunner: SkillToolRunner,
    options: SkillExecutionServiceOptions = {}
  ) {
    this.bus = new TypedEventBus(db, store);
    this.cacheMaxEntries = Math.max(1, Math.trunc(options.cacheMaxEntries ?? 128));
    this.gitHeadResolver = options.gitHeadResolver ?? defaultGitHeadResolver;
    this.modelMetadataRegistry = options.modelMetadataRegistry ?? DEFAULT_MODEL_METADATA_REGISTRY;
    this.toolMetadataResolver = options.toolMetadataResolver ?? resolveToolExecutionMetadata;
    this.resourceCeilingGuard = options.resourceCeilingGuard ?? createDefaultResourceCeilingGuard();
  }
}

Object.assign(SkillExecutionService.prototype, skillExecutionCoreMethods, skillExecutionCacheMethods);
