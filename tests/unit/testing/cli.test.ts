/**
 * Unit tests for cli helper
 */

import assert from "node:assert/strict";
import test from "node:test";

import { reportSoftPerformanceMiss, failOnListenSocketDenied } from "../../helpers/cli.js";

test("reportSoftPerformanceMiss does not throw on AssertionError", (t) => {
  const assertionError = new assert.AssertionError({ message: "soft performance miss" });

  // Should not throw, just log diagnostic
  reportSoftPerformanceMiss(t, assertionError);
});

test("reportSoftPerformanceMiss rethrows non-AssertionError", (t) => {
  const regularError = new Error("regular error");

  assert.throws(
    () => reportSoftPerformanceMiss(t, regularError),
    { message: "regular error" }
  );
});

test("reportSoftPerformanceMiss rethrows Error subclasses", (t) => {
  const typeError = new TypeError("type error");

  assert.throws(
    () => reportSoftPerformanceMiss(t, typeError),
    { message: "type error" }
  );
});

test("failOnListenSocketDenied rethrows non-EPERM errors", () => {
  const error = new Error("some error");
  (error as NodeJS.ErrnoException).code = "OTHER";

  assert.throws(
    () => failOnListenSocketDenied(error),
    { message: "some error" }
  );
});

test("failOnListenSocketDenied fails on EPERM", () => {
  const error = new Error("listen socket denied");
  (error as NodeJS.ErrnoException).code = "EPERM";

  assert.throws(
    () => failOnListenSocketDenied(error),
    (err) => {
      return err instanceof assert.AssertionError &&
        err.message === "local listen sockets are required for this network-path test";
    }
  );
});

test("failOnListenSocketDenied handles undefined code", () => {
  const error = new Error("no code");

  assert.throws(
    () => failOnListenSocketDenied(error),
    { message: "no code" }
  );
});
