import { execFileSync, spawn } from "node:child_process";

function listTrackedTests() {
  const output = execFileSync("git", ["ls-files", "tests/**/*.test.ts"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function runTestSubset(files, extraArgs = []) {
  if (files.length === 0) {
    return Promise.resolve(0);
  }

  return new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      ["--import", "tsx", "--test", ...extraArgs, ...files],
      {
        cwd: process.cwd(),
        env: process.env,
        stdio: "inherit",
      },
    );

    child.on("exit", (code, signal) => {
      if (signal != null) {
        process.kill(process.pid, signal);
        return;
      }
      resolve(code ?? 1);
    });
  });
}

const trackedTests = listTrackedTests();
const performanceTests = trackedTests.filter((file) => file.startsWith("tests/performance/"));
const regularTests = trackedTests.filter((file) => !file.startsWith("tests/performance/"));

const regularExitCode = await runTestSubset(regularTests, ["--test-concurrency=12"]);
if (regularExitCode !== 0) {
  process.exit(regularExitCode);
}

const performanceExitCode = await runTestSubset(performanceTests, ["--test-concurrency=1"]);
process.exit(performanceExitCode);
