(function defineEvaluationResultPolicy(global) {
  "use strict";

  const namespace = global.ModelEvaluation;
  if (!namespace) {
    throw new Error("请先加载 src/namespace.js。");
  }

  function clone(value) {
    if (typeof global.structuredClone === "function") {
      return global.structuredClone(value);
    }
    return JSON.parse(JSON.stringify(value));
  }

  function resolveRecordAfterEvaluation(previousRecord, result) {
    if (result.status === "terminated") {
      if (previousRecord.status === "success") {
        return {
          status: "success",
          result: clone(previousRecord.result),
          error: clone(previousRecord.error),
          rawResponse: previousRecord.rawResponse,
        };
      }
      return {
        status: "terminated",
        result: null,
        error: {
          type: "terminated",
          message: "本次评测已由用户终止。",
        },
        rawResponse: null,
      };
    }

    if (result.status === "success") {
      return {
        status: "success",
        result: clone(result.parsedResult),
        error: null,
        rawResponse: result.rawResponse,
      };
    }

    const isParseError = result.status === "parse-error";
    return {
      status: isParseError ? "parse-error" : "request-error",
      result: null,
      error: {
        type: isParseError ? "parse-error" : "request-error",
        message: result.error || "未提供明确错误信息。",
      },
      rawResponse: result.rawResponse ?? null,
    };
  }

  namespace.evaluationResultPolicy = Object.freeze({
    resolveRecordAfterEvaluation,
  });
})(globalThis);
