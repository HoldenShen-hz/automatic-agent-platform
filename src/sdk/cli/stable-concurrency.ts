import {
  runStableConcurrencyRehearsal,
  writeStableConcurrencyRehearsalReport,
} from "../../platform/shared/stability/stable-concurrency-rehearsal.js";
import { createStableCli } from "./stable-runner-factory.js";

createStableCli({
  envVar: "AA_STABLE_CONCURRENCY",
  defaultDir: "data/stable-concurrency",
  reportFilename: "stable-concurrency-report.json",
  runner: runStableConcurrencyRehearsal,
  writer: writeStableConcurrencyRehearsalReport,
});
