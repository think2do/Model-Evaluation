(function defineModelEvaluationConstants(global) {
  "use strict";

  const namespace = global.ModelEvaluation;
  if (!namespace) {
    throw new Error("请先加载 src/namespace.js。");
  }

  const EVALUATION_STATUS = Object.freeze({
    UNSCORED: "unscored",
    EVALUATING: "evaluating",
    SUCCESS: "success",
    REQUEST_ERROR: "request-error",
    PARSE_ERROR: "parse-error",
    TERMINATED: "terminated",
  });

  const STABLE_EVALUATION_STATUSES = Object.freeze([
    EVALUATION_STATUS.UNSCORED,
    EVALUATION_STATUS.SUCCESS,
    EVALUATION_STATUS.REQUEST_ERROR,
    EVALUATION_STATUS.PARSE_ERROR,
    EVALUATION_STATUS.TERMINATED,
  ]);

  namespace.constants = Object.freeze({
    DATA_SCHEMA_VERSION: "A2.1",
    EVALUATION_STATUS,
    EVALUATION_STATUS_VALUES: Object.freeze(Object.values(EVALUATION_STATUS)),
    STABLE_EVALUATION_STATUSES,
  });
})(globalThis);
