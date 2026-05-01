/**
 * @fileoverview Pack Scaffold Service
 *
 * Implements §22.2 Pack SDK core capability: `scaffold(config)`.
 * Generates Pack project structure from template.
 */

import { join } from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";
import { ValidationError } from "../../platform/contracts/errors.js";

export type PackTemplate = "minimal" | "standard" | "full";

/**
 * Sanitizes a template variable value to prevent injection attacks.
 * Issue #2021 P1: Template variables were used directly without sanitization,
 * allowing path traversal and content injection attacks via malicious packId/name/domain.
 */
function sanitizeTemplateValue(value: string, fieldName: string): string {
  // Allow only alphanumeric, hyphens, underscores, and dots
  const safe = value.replace(/[^a-zA-Z0-9._-]/g, "_");
  if (safe !== value) {
    throw new ValidationError(
      "pack_scaffold.invalid_template_value",
      `Template value for ${fieldName} contains invalid characters. Use alphanumeric, hyphens, underscores, and dots only.`,
      { details: { fieldName, value, sanitized: safe } },
    );
  }
  return safe;
}

export interface ScaffoldConfig {
  packId: string;
  name: string;
  template: PackTemplate;
  domain: string;
  owner: string;
  riskLevel: "low" | "medium" | "high";
}

export interface ScaffoldResult {
  rootDir: string;
  files: string[];
  manifestPath: string;
  entryPointPath: string;
}

// Template file contents - defined first so TEMPLATE_STRUCTURE can reference them
const MINIMAL_PACKAGE_JSON = `{
  "name": "{{PACK_ID}}",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "test": "node --test tests/",
    "domain:lint": "agent-platform domain validate --domain-id={{DOMAIN_ID}} --lint-only",
    "domain:validate": "agent-platform domain validate --domain-id={{DOMAIN_ID}}"
  }
}`;

const MINIMAL_INDEX_TS = `export async function handleQuery(input: { query: string }) {
  return { result: \`Processed: \${input.query}\` };
}`;

const MINIMAL_QUERY_TOOL = `import { defineTool } from "@platform/plugin-sdk";

export const queryTool = defineTool({
  toolId: "{{PACK_ID}}.query",
  name: "Query",
  description: "Execute a query",
  async execute(input: { query: string }) {
    return { result: \`Query executed: \${input.query}\` };
  },
});`;

const MINIMAL_UNIT_TEST = `import { describe, it } from "node:test";
import assert from "node:assert";

describe("{{PACK_NAME}}", () => {
  it("executes query", async () => {
    const { handleQuery } = await import("../src/index.js");
    const result = await handleQuery({ query: "test" });
    assert.ok(result.result);
  });
});`;

const STANDARD_TRANSFORM_TOOL = `import { defineTool } from "@platform/plugin-sdk";

export const transformTool = defineTool({
  toolId: "{{PACK_ID}}.transform",
  name: "Transform",
  description: "Transform data",
  async execute(input: { data: unknown }) {
    return { result: JSON.stringify(input.data) };
  },
});`;

const STANDARD_HTTP_ADAPTER = `import { defineAdapter } from "@platform/plugin-sdk";

export const httpAdapter = defineAdapter({
  adapterId: "{{PACK_ID}}.http",
  name: "HTTP Adapter",
  async execute(input: { url: string; method: string }) {
    return { status: 200, body: "OK" };
  },
});`;

const STANDARD_RESULT_EVALUATOR = `import { defineEvaluator } from "@platform/plugin-sdk";

export const resultEvaluator = defineEvaluator({
  evaluatorId: "{{PACK_ID}}.result",
  name: "Result Evaluator",
  async evaluate(input: { result: unknown }) {
    return { passed: true, score: 1.0 };
  },
});`;

const STANDARD_INTEGRATION_TEST = `import { describe, it } from "node:test";
import assert from "node:assert";

describe("{{PACK_NAME}} integration", () => {
  it("runs integration test", () => {
    assert.ok(true);
  });
});`;

const STANDARD_QUERY_TOOL = MINIMAL_QUERY_TOOL;
const STANDARD_UNIT_TEST = MINIMAL_UNIT_TEST;
const STANDARD_INDEX_TS = MINIMAL_INDEX_TS;
const STANDARD_PACKAGE_JSON = MINIMAL_PACKAGE_JSON;

const FULL_SEARCH_TOOL = `import { defineTool } from "@platform/plugin-sdk";

export const searchTool = defineTool({
  toolId: "{{PACK_ID}}.search",
  name: "Search",
  description: "Search resources",
  async execute(input: { query: string }) {
    return { results: [] };
  },
});`;

const FULL_DB_ADAPTER = `import { defineAdapter } from "@platform/plugin-sdk";

export const dbAdapter = defineAdapter({
  adapterId: "{{PACK_ID}}.db",
  name: "Database Adapter",
  async execute(input: { query: string }) {
    return { rows: [], affected: 0 };
  },
});`;

const FULL_CONTEXT_RETRIEVER = `import { defineRetriever } from "@platform/plugin-sdk";

export const contextRetriever = defineRetriever({
  retrieverId: "{{PACK_ID}}.context",
  name: "Context Retriever",
  async retrieve(input: { query: string }) {
    return { documents: [] };
  },
});`;

const FULL_SAFETY_EVALUATOR = `import { defineEvaluator } from "@platform/plugin-sdk";

export const safetyEvaluator = defineEvaluator({
  evaluatorId: "{{PACK_ID}}.safety",
  name: "Safety Evaluator",
  async evaluate(input: { result: unknown }) {
    return { passed: true, score: 1.0, findings: [] };
  },
});`;

const FULL_SIMULATION_TEST = `import { describe, it } from "node:test";
import assert from "node:assert";

describe("{{PACK_NAME}} simulation", () => {
  it("runs simulation", () => {
    assert.ok(true);
  });
});`;

const FULL_DEPLOY_SCRIPT = `#!/bin/bash
echo "Deploying {{PACK_ID}}..."
npm run build
echo "Done"`;

const FULL_INDEX_TS = MINIMAL_INDEX_TS;
const FULL_QUERY_TOOL = STANDARD_QUERY_TOOL;
const FULL_TRANSFORM_TOOL = STANDARD_TRANSFORM_TOOL;
const FULL_HTTP_ADAPTER = STANDARD_HTTP_ADAPTER;
const FULL_RESULT_EVALUATOR = STANDARD_RESULT_EVALUATOR;
const FULL_UNIT_TEST = MINIMAL_UNIT_TEST;
const FULL_INTEGRATION_TEST = STANDARD_INTEGRATION_TEST;
const FULL_PACKAGE_JSON = MINIMAL_PACKAGE_JSON;

const TEMPLATE_STRUCTURE: Record<PackTemplate, {
  files: Array<{ path: string; content: string }>;
  manifestCapabilities: Array<{ capabilityKey: string; maturity: "experimental" | "beta" | "ga"; requiredContracts: string[] }>;
}> = {
  minimal: {
    files: [
      { path: "package.json", content: MINIMAL_PACKAGE_JSON },
      { path: "src/index.ts", content: MINIMAL_INDEX_TS },
      { path: "src/tools/query-tool.ts", content: MINIMAL_QUERY_TOOL },
      { path: "tests/unit.test.ts", content: MINIMAL_UNIT_TEST },
    ],
    manifestCapabilities: [
      { capabilityKey: "query.execute", maturity: "ga", requiredContracts: ["runtime_execution_contract"] },
    ],
  },
  standard: {
    files: [
      { path: "package.json", content: STANDARD_PACKAGE_JSON },
      { path: "src/index.ts", content: STANDARD_INDEX_TS },
      { path: "src/tools/query-tool.ts", content: STANDARD_QUERY_TOOL },
      { path: "src/tools/transform-tool.ts", content: STANDARD_TRANSFORM_TOOL },
      { path: "src/adapters/http-adapter.ts", content: STANDARD_HTTP_ADAPTER },
      { path: "src/evaluators/result-evaluator.ts", content: STANDARD_RESULT_EVALUATOR },
      { path: "tests/unit.test.ts", content: STANDARD_UNIT_TEST },
      { path: "tests/integration.test.ts", content: STANDARD_INTEGRATION_TEST },
    ],
    manifestCapabilities: [
      { capabilityKey: "query.execute", maturity: "ga", requiredContracts: ["runtime_execution_contract"] },
      { capabilityKey: "data.transform", maturity: "beta", requiredContracts: ["runtime_execution_contract"] },
      { capabilityKey: "eval.result", maturity: "experimental", requiredContracts: ["evaluation_contract"] },
    ],
  },
  full: {
    files: [
      { path: "package.json", content: FULL_PACKAGE_JSON },
      { path: "src/index.ts", content: FULL_INDEX_TS },
      { path: "src/tools/query-tool.ts", content: FULL_QUERY_TOOL },
      { path: "src/tools/transform-tool.ts", content: FULL_TRANSFORM_TOOL },
      { path: "src/tools/search-tool.ts", content: FULL_SEARCH_TOOL },
      { path: "src/adapters/http-adapter.ts", content: FULL_HTTP_ADAPTER },
      { path: "src/adapters/db-adapter.ts", content: FULL_DB_ADAPTER },
      { path: "src/retrievers/context-retriever.ts", content: FULL_CONTEXT_RETRIEVER },
      { path: "src/evaluators/result-evaluator.ts", content: FULL_RESULT_EVALUATOR },
      { path: "src/evaluators/safety-evaluator.ts", content: FULL_SAFETY_EVALUATOR },
      { path: "tests/unit.test.ts", content: FULL_UNIT_TEST },
      { path: "tests/integration.test.ts", content: FULL_INTEGRATION_TEST },
      { path: "tests/simulation.test.ts", content: FULL_SIMULATION_TEST },
      { path: "scripts/deploy.sh", content: FULL_DEPLOY_SCRIPT },
    ],
    manifestCapabilities: [
      { capabilityKey: "query.execute", maturity: "ga", requiredContracts: ["runtime_execution_contract"] },
      { capabilityKey: "data.transform", maturity: "ga", requiredContracts: ["runtime_execution_contract"] },
      { capabilityKey: "search.execute", maturity: "beta", requiredContracts: ["runtime_execution_contract"] },
      { capabilityKey: "eval.result", maturity: "beta", requiredContracts: ["evaluation_contract"] },
      { capabilityKey: "eval.safety", maturity: "experimental", requiredContracts: ["evaluation_contract"] },
    ],
  },
};

export class PackScaffoldService {
  /**
   * Generate Pack project structure from template.
   */
  scaffold(config: ScaffoldConfig): ScaffoldResult {
    validateScaffoldConfig(config);

    const rootDir = resolvePackDir(config.packId);
    const structure = TEMPLATE_STRUCTURE[config.template];
    const manifestPath = join(rootDir, "manifest.json");
    const entryPointPath = join(rootDir, "src", "index.ts");

    // Create directory structure
    mkdirSync(rootDir, { recursive: true });
    mkdirSync(join(rootDir, "src", "tools"), { recursive: true });
    mkdirSync(join(rootDir, "src", "adapters"), { recursive: true });
    mkdirSync(join(rootDir, "src", "retrievers"), { recursive: true });
    mkdirSync(join(rootDir, "src", "evaluators"), { recursive: true });
    mkdirSync(join(rootDir, "tests"), { recursive: true });
    mkdirSync(join(rootDir, "scripts"), { recursive: true });

    // Write manifest
    const manifest = buildManifest(config, structure.manifestCapabilities);
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");

    // Write files
    const files: string[] = [manifestPath];
    // Issue #2021 P1: Sanitize template values to prevent injection attacks
    const safePackId = sanitizeTemplateValue(config.packId, "packId");
    const safeName = sanitizeTemplateValue(config.name, "name");
    const safeDomain = sanitizeTemplateValue(config.domain, "domain");
    for (const file of structure.files) {
      const filePath = join(rootDir, file.path);
      writeFileSync(
        filePath,
        file.content
          .replace(/{{PACK_ID}}/g, safePackId)
          .replace(/{{PACK_NAME}}/g, safeName)
          .replace(/{{DOMAIN_ID}}/g, safeDomain),
        "utf-8",
      );
      files.push(filePath);
    }

    return {
      rootDir,
      files,
      manifestPath,
      entryPointPath,
    };
  }

  /**
   * List available templates.
   */
  listTemplates(): Array<{ id: PackTemplate; description: string }> {
    return [
      { id: "minimal", description: "Single tool, basic structure" },
      { id: "standard", description: "Multiple tools, adapters, evaluators" },
      { id: "full", description: "Complete structure with retrievers, safety evaluators" },
    ];
  }
}

function validateScaffoldConfig(config: ScaffoldConfig): void {
  if (!config.packId?.trim()) {
    throw new ValidationError("pack_scaffold.invalid_pack_id", "Pack ID is required and cannot be empty.");
  }
  if (!/^[a-z0-9][a-z0-9-_.]*$/.test(config.packId)) {
    throw new ValidationError("pack_scaffold.invalid_pack_id_format", "Pack ID must match pattern: lowercase, numbers, hyphens, underscores, dots.");
  }
  if (!config.name?.trim()) {
    throw new ValidationError("pack_scaffold.invalid_name", "Pack name is required.");
  }
  // Root cause: name and domain were not validated for injection characters.
  // Special characters like quotes, backslashes, newlines, or template sequences (${...})
  // could break string literals or inject content when substituted into generated files.
  if (/[\\"$`]/.test(config.name)) {
    throw new ValidationError("pack_scaffold.invalid_name", "Pack name contains invalid characters (quotes, backslashes, backticks, or $ not allowed).");
  }
  if (config.name.includes('\n') || config.name.includes('\r')) {
    throw new ValidationError("pack_scaffold.invalid_name", "Pack name cannot contain newlines.");
  }
  if (!config.owner?.trim()) {
    throw new ValidationError("pack_scaffold.invalid_owner", "Pack owner is required.");
  }
  // Validate domain similarly - it's used in template substitutions too
  if (/[\\"$`]/.test(config.domain)) {
    throw new ValidationError("pack_scaffold.invalid_domain", "Domain contains invalid characters (quotes, backslashes, backticks, or $ not allowed).");
  }
  if (config.domain.includes('\n') || config.domain.includes('\r')) {
    throw new ValidationError("pack_scaffold.invalid_domain", "Domain cannot contain newlines.");
  }
}

function resolvePackDir(packId: string): string {
  return join(process.cwd(), "packs", packId);
}

function buildManifest(
  config: ScaffoldConfig,
  capabilities: Array<{ capabilityKey: string; maturity: "experimental" | "beta" | "ga"; requiredContracts: string[] }>,
) {
  return {
    packId: config.packId,
    version: "0.1.0",
    domainId: config.domain,
    domain: config.domain,
    owner: config.owner,
    sideEffects: [],
    dataClasses: [],
    maxRiskClass: config.riskLevel,
    tools: [],
    connectors: [],
    plugins: [],
    evalRequirements: {
      requiredDatasets: [],
      blockingEvaluators: [],
    },
    compatibility: {
      requiresActiveDomain: true,
      supportedDomainSpecVersions: ["cdm-v2"],
    },
    capabilities,
  };
}
