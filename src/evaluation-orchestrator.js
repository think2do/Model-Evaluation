(function defineEvaluationOrchestrator(global) {
  "use strict";

  const namespace = global.ModelEvaluation;
  if (!namespace) {
    throw new Error("请先加载 src/namespace.js。");
  }

  const MAX_CONCURRENT_REQUESTS = 99;

  async function runWithConcurrency(items, worker, options = {}) {
    if (!Array.isArray(items)) {
      throw new TypeError("评测任务必须是数组。");
    }
    if (typeof worker !== "function") {
      throw new TypeError("评测 worker 必须是函数。");
    }

    const limit = options.limit ?? MAX_CONCURRENT_REQUESTS;
    if (!Number.isInteger(limit) || limit < 1) {
      throw new TypeError("最大并发数必须是正整数。");
    }

    const signal = options.signal;
    const onProgress =
      typeof options.onProgress === "function" ? options.onProgress : () => {};
    const createTerminatedResult =
      typeof options.createTerminatedResult === "function"
        ? options.createTerminatedResult
        : (item) => ({ item, status: "terminated" });
    const results = new Array(items.length);
    let nextIndex = 0;
    let completedCount = 0;

    async function runNext() {
      while (nextIndex < items.length) {
        const index = nextIndex;
        nextIndex += 1;
        const item = items[index];

        results[index] = signal?.aborted
          ? createTerminatedResult(item, index)
          : await worker(item, { index, signal });

        completedCount += 1;
        onProgress({
          completedCount,
          totalCount: items.length,
          result: results[index],
          index,
        });
      }
    }

    const workerCount = Math.min(limit, items.length);
    await Promise.all(
      Array.from({ length: workerCount }, () => runNext()),
    );
    return results;
  }

  namespace.evaluationOrchestrator = Object.freeze({
    MAX_CONCURRENT_REQUESTS,
    runWithConcurrency,
  });
})(globalThis);
