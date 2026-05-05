import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const source = readFileSync(
  join(process.cwd(), "src", "platform", "orchestration", "oapeflir", "oapeflir-loop-service.ts"),
  "utf8",
);

test("2294: OapeflirLoopService exposes injectable dependencies instead of hard-only construction", () => {
  assert.match(source, /export interface OapeflirLoopServiceOptions/);
  assert.match(source, /executeBridge\?: ExecuteBridge/);
  assert.match(source, /situationBuilder\?:/);
  assert.match(source, /observationAggregator\?:/);
  assert.match(source, /assessmentService\?: AssessmentService/);
  assert.match(source, /feedbackCollector\?: FeedbackCollector/);
  assert.match(source, /directiveSink\?: ControlPlaneDirectiveSink \| null/);
  assert.match(source, /this\.observationAggregator = options\.observationAggregator \?\? new ObservationAggregator\(\)/);
  assert.match(source, /this\.assessment = options\.assessmentService \?\? new AssessmentService\(\)/);
  assert.match(source, /this\.directiveSink = options\.directiveSink \?\? null/);
});
