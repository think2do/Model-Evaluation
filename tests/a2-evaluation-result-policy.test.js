"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

require("../src/namespace.js");
require("../src/evaluation-result-policy.js");

const { resolveRecordAfterEvaluation } =
  globalThis.ModelEvaluation.evaluationResultPolicy;

test("无旧成功结果的任务被终止后标记为已终止", () => {
  const resolved = resolveRecordAfterEvaluation(
    {
      status: "unscored",
      result: null,
      error: null,
      rawResponse: null,
    },
    { status: "terminated" },
  );

  assert.equal(resolved.status, "terminated");
  assert.equal(resolved.result, null);
  assert.equal(resolved.error.type, "terminated");
});

test("重新评测被终止时保留旧成功结果", () => {
  const oldResult = { finalScore: 8 };
  const resolved = resolveRecordAfterEvaluation(
    {
      status: "success",
      result: oldResult,
      error: null,
      rawResponse: "old response",
    },
    { status: "terminated" },
  );

  assert.equal(resolved.status, "success");
  assert.deepEqual(resolved.result, oldResult);
  assert.equal(resolved.rawResponse, "old response");
});

test("最新成功结果覆盖旧结果", () => {
  const resolved = resolveRecordAfterEvaluation(
    {
      status: "success",
      result: { finalScore: 1 },
      error: null,
      rawResponse: "old",
    },
    {
      status: "success",
      parsedResult: { finalScore: 9 },
      rawResponse: "new",
    },
  );

  assert.equal(resolved.status, "success");
  assert.equal(resolved.result.finalScore, 9);
  assert.equal(resolved.rawResponse, "new");
});

test("最新请求失败覆盖旧成功结果", () => {
  const resolved = resolveRecordAfterEvaluation(
    {
      status: "success",
      result: { finalScore: 9 },
      error: null,
      rawResponse: "old",
    },
    {
      status: "error",
      error: "网络错误",
    },
  );

  assert.equal(resolved.status, "request-error");
  assert.equal(resolved.result, null);
  assert.equal(resolved.error.message, "网络错误");
});

test("最新解析失败覆盖旧成功结果并保留原文", () => {
  const resolved = resolveRecordAfterEvaluation(
    {
      status: "success",
      result: { finalScore: 9 },
      error: null,
      rawResponse: "old",
    },
    {
      status: "parse-error",
      error: "JSON 错误",
      rawResponse: "not json",
    },
  );

  assert.equal(resolved.status, "parse-error");
  assert.equal(resolved.result, null);
  assert.equal(resolved.rawResponse, "not json");
});
