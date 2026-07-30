(function defineExcelRowMapper(global) {
  "use strict";

  const namespace = global.ModelEvaluation;
  const schema = namespace?.excelSchema;
  if (!namespace || !schema) {
    throw new Error("请先加载 excel-schema.js。");
  }

  function stringifyResult(result) {
    return result === null ? "" : JSON.stringify(result);
  }

  function parseOptionalJson(value) {
    if (value === "" || value === null || value === undefined) {
      return null;
    }
    if (typeof value !== "string") {
      throw new TypeError("完整评测结果 JSON 必须是字符串。");
    }
    return JSON.parse(value);
  }

  function recordToInternalRow(version, record) {
    const result = record.status === "success" ? record.result : null;
    return {
      schemaVersion: schema.DATA_SCHEMA_VERSION,
      versionId: version.id,
      versionName: version.name,
      question: version.question,
      rubric: version.rubric,
      recordId: record.id,
      modelName: record.modelName,
      answer: record.answer,
      status: record.status,
      finalScore: result?.finalScore ?? "",
      maxScore: result?.maxScore ?? "",
      scoreRate: result?.scoreRate ?? "",
      resultJson: stringifyResult(result),
      errorType: record.error?.type ?? "",
      errorMessage: record.error?.message ?? "",
      rawResponse: record.rawResponse ?? "",
      firstExportedAt: version.firstExportedAt ?? "",
      updatedAt: version.updatedAt,
    };
  }

  function stateToInternalRows(state) {
    return state.versions.flatMap((version) =>
      version.records.map((record) =>
        recordToInternalRow(version, record),
      ),
    );
  }

  function internalRowToSheetRow(row) {
    return Object.fromEntries(
      schema.COLUMNS.map((column) => [
        column.header,
        row[column.key] ?? "",
      ]),
    );
  }

  function sheetRowToInternalRow(sheetRow) {
    return Object.fromEntries(
      schema.COLUMNS.map((column) => [
        column.key,
        sheetRow[column.header] ?? "",
      ]),
    );
  }

  function internalRowToCandidate(row) {
    return {
      schemaVersion: row.schemaVersion,
      version: {
        id: row.versionId,
        name: row.versionName,
        question: row.question,
        rubric: row.rubric,
        firstExportedAt: row.firstExportedAt || null,
        updatedAt: row.updatedAt,
      },
      record: {
        id: row.recordId,
        modelName: row.modelName,
        answer: row.answer,
        status: row.status,
        result: parseOptionalJson(row.resultJson),
        error:
          row.errorType || row.errorMessage
            ? {
                type: row.errorType,
                message: row.errorMessage,
              }
            : null,
        rawResponse: row.rawResponse || null,
      },
      summary: {
        finalScore: row.finalScore,
        maxScore: row.maxScore,
        scoreRate: row.scoreRate,
      },
    };
  }

  namespace.excelRowMapper = Object.freeze({
    recordToInternalRow,
    stateToInternalRows,
    internalRowToSheetRow,
    sheetRowToInternalRow,
    internalRowToCandidate,
    parseOptionalJson,
  });
})(globalThis);
