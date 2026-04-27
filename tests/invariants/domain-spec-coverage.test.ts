import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const DOMAIN_SPECS = [
  ["§71", "quant-trading"],
  ["§72", "ecommerce"],
  ["§73", "advertising"],
  ["§74", "financial-services"],
  ["§75", "data-engineering"],
  ["§76", "coding"],
  ["§77", "user-operations"],
  ["§78", "industry-research"],
  ["§79", "academic-research"],
  ["§80", "knowledge-base"],
  ["§81", "finance-accounting"],
  ["§82", "legal"],
  ["§83", "live-streaming"],
  ["§84", "creative-production"],
  ["§85", "game-dev"],
  ["§86", "game-publishing"],
  ["§87", "human-resources"],
  ["§88", "supply-chain"],
  ["§89", "healthcare"],
  ["§90", "education"],
  ["§91", "customer-service"],
  ["§92", "content-moderation"],
  ["§93", "it-operations"],
  ["§94", "marketing"],
] as const;

test("§71-§94 domain specs exist with gate-ready metadata", () => {
  for (const [section, domainId] of DOMAIN_SPECS) {
    const specPath = join(process.cwd(), "docs_zh", "domains", domainId, "domain-spec.md");
    assert.equal(existsSync(specPath), true, `${domainId} must have domain-spec.md`);

    const spec = readFileSync(specPath, "utf8");
    assert.match(spec, new RegExp(`architecture_section \\| ${section}`));
    assert.match(spec, /domain_status \| spec_ready/);
    assert.match(spec, /implementation_module \| `src\/domains\//);
    assert.match(spec, /## 硬约束/);
    assert.match(spec, /## 验收入口/);
  }
});
