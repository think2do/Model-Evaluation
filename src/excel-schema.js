(function defineExcelSchema(global) {
  "use strict";

  const namespace = global.ModelEvaluation;
  const constants = namespace?.constants;
  if (!namespace || !constants) {
    throw new Error("请先加载 namespace.js 和 constants.js。");
  }

  const SHEET_NAME = "评测记录";
  const COLUMNS = Object.freeze([
    { key: "schemaVersion", header: "数据格式版本" },
    { key: "versionId", header: "评测版本 ID" },
    { key: "versionName", header: "评测版本名称" },
    { key: "question", header: "问题" },
    { key: "rubric", header: "评分标准" },
    { key: "recordId", header: "记录 ID" },
    { key: "modelName", header: "模型名" },
    { key: "answer", header: "模型回答" },
    { key: "status", header: "评测状态" },
    { key: "finalScore", header: "最终分" },
    { key: "maxScore", header: "满分" },
    { key: "scoreRate", header: "得分率" },
    { key: "resultJson", header: "完整评测结果 JSON" },
    { key: "errorType", header: "错误类型" },
    { key: "errorMessage", header: "错误信息" },
    { key: "rawResponse", header: "原始裁判返回" },
    { key: "firstExportedAt", header: "第一次导出时间" },
    { key: "updatedAt", header: "最后更新时间" },
  ]);

  const COLUMN_BY_KEY = Object.freeze(
    Object.fromEntries(COLUMNS.map((column) => [column.key, column])),
  );
  const COLUMN_BY_HEADER = Object.freeze(
    Object.fromEntries(COLUMNS.map((column) => [column.header, column])),
  );

  namespace.excelSchema = Object.freeze({
    SHEET_NAME,
    COLUMNS,
    COLUMN_BY_KEY,
    COLUMN_BY_HEADER,
    HEADERS: Object.freeze(COLUMNS.map((column) => column.header)),
    DATA_SCHEMA_VERSION: constants.DATA_SCHEMA_VERSION,
  });
})(globalThis);
