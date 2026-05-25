import { existsSync } from "node:fs";
import { relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { DomainRetrieverPlugin, RetrieverKnowledgeResult } from "../../domains/registry/plugin-spi.js";
import { SemanticRepoMapService } from "../../platform/five-plane-execution/tool-executor/semantic-repo-map-service.js";

export interface CodingRetrieverPluginOptions {
  rootPath?: string;
  repoMapService?: SemanticRepoMapService;
}

export const DEFAULT_CODING_RETRIEVER_ROOT_PATH = resolve(
  fileURLToPath(new URL("../../..", import.meta.url)),
);
const APPROX_RETRIEVER_RESULT_CHARS = 256;
const APPROX_RETRIEVER_RESULT_TOKENS = Math.ceil(APPROX_RETRIEVER_RESULT_CHARS / 4);

function buildQuery(intent: string, context: Record<string, unknown>): string {
  const fragments = [intent];
  if (typeof context["focus"] === "string") {
    fragments.push(context["focus"]);
  }
  if (typeof context["currentFile"] === "string") {
    fragments.push(context["currentFile"]);
  }
  return fragments.join(" ").trim();
}

export function createCodingRetrieverPlugin(options: CodingRetrieverPluginOptions = {}): DomainRetrieverPlugin {
  const rootPath = options.rootPath ?? DEFAULT_CODING_RETRIEVER_ROOT_PATH;
  const repoMapService = options.repoMapService ?? new SemanticRepoMapService(rootPath);

  return {
    pluginId: "plugin.coding.retriever",
    domainId: "coding",
    spiType: "retriever",
    capabilityIds: ["knowledge.retrieve", "domain.observe", "repo.search"],
    async initialize() {},
    async healthCheck() {
      return existsSync(rootPath);
    },
    async shutdown() {
      repoMapService.invalidateCache();
    },
    async retrieve(query) {
      const currentFile = typeof query.context["currentFile"] === "string" ? query.context["currentFile"] : null;
      const search = repoMapService.search({
        query: buildQuery(query.intent, query.context),
        ...(currentFile ? { currentFile } : {}),
        limit: Math.max(4, Math.min(20, Math.floor(query.tokenBudget / APPROX_RETRIEVER_RESULT_TOKENS))),
      });

      const symbolResults: RetrieverKnowledgeResult[] = search.symbols.slice(0, 8).map((symbol) => ({
        knowledgeRef: `knowledge:repo:${relative(rootPath, symbol.filePath)}#L${symbol.line}` as string,
        snippet: `${symbol.kind} ${symbol.name} defined at ${relative(rootPath, symbol.filePath)}:${symbol.line}`,
        score: search.relevanceScores.get(`${symbol.name}@${symbol.filePath}`) ?? 0.8,
        namespace: "repo/coding",
        chunkId: `symbol:${symbol.name}@${relative(rootPath, symbol.filePath)}`,
        documentId: relative(rootPath, symbol.filePath),
        matchType: "structural",
      }));

      const fileResults: RetrieverKnowledgeResult[] = search.files.slice(0, 8).map((file) => ({
        knowledgeRef: `knowledge:repo:${file.relativePath}` as string,
        snippet: `File ${file.relativePath} imports ${file.imports.length} modules and is referenced by ${file.referencedBy.length} files.`,
        score: search.relevanceScores.get(file.filePath) ?? 0.5,
        namespace: "repo/coding",
        chunkId: `file:${file.relativePath}`,
        documentId: file.relativePath,
        matchType: "keyword",
      }));

      return [...symbolResults, ...fileResults].slice(0, 12) as RetrieverKnowledgeResult[];
    },
  };
}
