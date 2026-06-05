import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readSource(path: string): string {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

test("workbench deep links stay aligned with registered web routes", () => {
  const assertions: Array<{ file: string; fragment: string }> = [
    {
      file: "../../../../ui/packages/features/release-console/src/web/index.tsx",
      fragment: 'deepLinkPath: "/operations/release-console/leadership-claims"',
    },
    {
      file: "../../../../ui/packages/features/explainability/src/web/index.tsx",
      fragment: 'deepLinkPath: "/shared/explainability?view=causal-chain"',
    },
    {
      file: "../../../../ui/packages/features/marketplace/src/web/index.tsx",
      fragment: 'deepLinkPath: "/shared/marketplace?mode=preview"',
    },
    {
      file: "../../../../ui/packages/features/marketplace/src/web/index.tsx",
      fragment: 'deepLinkPath: "/shared/marketplace?mode=approval"',
    },
    {
      file: "../../../../ui/packages/features/agent-manager/src/web/index.tsx",
      fragment: 'deepLinkPath: "/extended/agents?mode=isolate"',
    },
    {
      file: "../../../../ui/packages/features/agent-manager/src/web/index.tsx",
      fragment: '? "/extended/agents" : `/extended/agents?focus=${encodeURIComponent(item.id)}`',
    },
    {
      file: "../../../../ui/packages/features/workflow-debugger/src/web/index.tsx",
      fragment: 'deepLinkPath: "/extended/debugger?mode=replay"',
    },
    {
      file: "../../../../ui/packages/features/workflow-debugger/src/web/index.tsx",
      fragment: 'deepLinkPath: "/extended/debugger?view=failure"',
    },
    {
      file: "../../../../ui/packages/features/cost-center/src/web/index.tsx",
      fragment: 'deepLinkPath: "/shared/costs?mode=refresh"',
    },
    {
      file: "../../../../ui/packages/features/cost-center/src/web/index.tsx",
      fragment: 'deepLinkPath: "/shared/costs?view=drilldown"',
    },
  ];

  for (const assertion of assertions) {
    const source = readSource(assertion.file);
    assert.equal(
      source.includes(assertion.fragment),
      true,
      `Expected ${assertion.file} to contain ${assertion.fragment}`,
    );
  }
});
