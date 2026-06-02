import assert from "node:assert/strict";
import test from "node:test";

type GenerateCoverageReportModule = {
  assertRepoSubpath: (targetPath: string, label: string) => string;
  buildCoverageChildEnv: (overrides?: Record<string, string>) => Record<string, string>;
};

const coverageReportModule = await import(
  new URL("../../../scripts/ci/generate-coverage-report.mjs", import.meta.url).href,
) as GenerateCoverageReportModule;

const { assertRepoSubpath, buildCoverageChildEnv } = coverageReportModule;

test("assertRepoSubpath rejects recursive delete targets outside repository root", () => {
  assert.equal(
    assertRepoSubpath(`${process.cwd()}/coverage`, "coverage path"),
    `${process.cwd()}/coverage`,
  );
  assert.throws(
    () => assertRepoSubpath("/tmp/outside-repo", "coverage path"),
    /must stay within/,
  );
});

test("buildCoverageChildEnv strips secret-bearing environment variables", () => {
  const previousSecretFile = process.env.AA_SECRET_FILE;
  const previousToken = process.env.GITHUB_TOKEN;
  const previousVisible = process.env.VISIBLE_ENV;
  try {
    process.env.AA_SECRET_FILE = "/tmp/secret.txt";
    process.env.GITHUB_TOKEN = "secret";
    process.env.VISIBLE_ENV = "ok";

    const env = buildCoverageChildEnv({ AA_RUNNING_TESTS: "1" });
    assert.equal(env.AA_SECRET_FILE, undefined);
    assert.equal(env.GITHUB_TOKEN, undefined);
    assert.equal(env.VISIBLE_ENV, "ok");
    assert.equal(env.AA_RUNNING_TESTS, "1");
  } finally {
    if (previousSecretFile == null) {
      delete process.env.AA_SECRET_FILE;
    } else {
      process.env.AA_SECRET_FILE = previousSecretFile;
    }
    if (previousToken == null) {
      delete process.env.GITHUB_TOKEN;
    } else {
      process.env.GITHUB_TOKEN = previousToken;
    }
    if (previousVisible == null) {
      delete process.env.VISIBLE_ENV;
    } else {
      process.env.VISIBLE_ENV = previousVisible;
    }
  }
});
