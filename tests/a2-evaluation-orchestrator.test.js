"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

require("../src/namespace.js");
require("../src/evaluation-orchestrator.js");

const {
  MAX_CONCURRENT_REQUESTS,
  runWithConcurrency,
} = globalThis.ModelEvaluation.evaluationOrchestrator;

test("默认最大并发数固定为 99", () => {
  assert.equal(MAX_CONCURRENT_REQUESTS, 99);
});

test("按并发上限执行并保持结果顺序", async () => {
  let activeCount = 0;
  let observedMax = 0;
  const items = [1, 2, 3, 4, 5, 6];

  const results = await runWithConcurrency(
    items,
    async (item) => {
      activeCount += 1;
      observedMax = Math.max(observedMax, activeCount);
      await new Promise((resolve) => setTimeout(resolve, 2));
      activeCount -= 1;
      return item * 10;
    },
    { limit: 2 },
  );

  assert.equal(observedMax, 2);
  assert.deepEqual(results, [10, 20, 30, 40, 50, 60]);
});

test("终止后等待中的任务不再交给 worker", async () => {
  const controller = new AbortController();
  const started = [];

  const results = await runWithConcurrency(
    [1, 2, 3, 4],
    async (item) => {
      started.push(item);
      if (item === 1) {
        controller.abort();
      }
      return { item, status: "done" };
    },
    {
      limit: 1,
      signal: controller.signal,
      createTerminatedResult: (item) => ({
        item,
        status: "terminated",
      }),
    },
  );

  assert.deepEqual(started, [1]);
  assert.deepEqual(
    results.map((result) => result.status),
    ["done", "terminated", "terminated", "terminated"],
  );
});

test("每完成一条任务都会报告进度", async () => {
  const progress = [];

  await runWithConcurrency(
    ["a", "b", "c"],
    async (item) => item,
    {
      limit: 2,
      onProgress(update) {
        progress.push(update.completedCount);
      },
    },
  );

  assert.deepEqual(progress, [1, 2, 3]);
});

test("拒绝非法并发数", async () => {
  await assert.rejects(
    () => runWithConcurrency([1], async () => 1, { limit: 0 }),
    /正整数/,
  );
});
