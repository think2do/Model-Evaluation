"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

globalThis.XLSX = require("../vendor/sheetjs/xlsx.full.min.js");
require("../src/namespace.js");
require("../src/constants.js");
require("../src/excel-schema.js");
require("../src/excel-row-mapper.js");
require("../src/excel-importer.js");

const schema = globalThis.ModelEvaluation.excelSchema;
const mapper = globalThis.ModelEvaluation.excelRowMapper;
const {
  ExcelImportError,
  importMatrix,
  readWorkbook,
} = globalThis.ModelEvaluation.excelImporter;

function createInternalRow(overrides = {}) {
  return {
    schemaVersion: "A2.1",
    versionId: "version-1",
    versionName: "版本 A",
    question: "问题",
    rubric: "标准",
    recordId: "record-1",
    modelName: "模型 A",
    answer: "回答",
    status: "unscored",
    finalScore: "",
    maxScore: "",
    scoreRate: "",
    resultJson: "",
    errorType: "",
    errorMessage: "",
    rawResponse: "",
    firstExportedAt: "2026-07-30T01:00:00.000Z",
    updatedAt: "2026-07-30T02:00:00.000Z",
    ...overrides,
  };
}

function rowsToMatrix(rows) {
  return [
    schema.HEADERS,
    ...rows.map((row) => {
      const sheetRow = mapper.internalRowToSheetRow(row);
      return schema.HEADERS.map((header) => sheetRow[header]);
    }),
  ];
}

test("合法行恢复为版本级状态且保留时间", () => {
  const result = importMatrix(
    rowsToMatrix([
      createInternalRow(),
      createInternalRow({
        recordId: "record-2",
        modelName: "模型 B",
      }),
    ]),
  );

  assert.equal(result.report.importedRowCount, 2);
  assert.equal(result.report.skippedRowCount, 0);
  assert.equal(result.state.versions.length, 1);
  assert.equal(result.state.versions[0].records.length, 2);
  assert.equal(
    result.state.versions[0].updatedAt,
    "2026-07-30T02:00:00.000Z",
  );
});

test("错误行被跳过，合法行继续导入并报告实际行号", () => {
  const result = importMatrix(
    rowsToMatrix([
      createInternalRow(),
      createInternalRow({
        recordId: "record-2",
        modelName: "",
      }),
    ]),
  );

  assert.equal(result.report.importedRowCount, 1);
  assert.equal(result.report.skippedRowCount, 1);
  assert.equal(result.report.errors[0].rowNumber, 3);
  assert.match(result.report.errors[0].message, /模型名/);
});

test("同版本公共字段冲突时只跳过冲突行", () => {
  const result = importMatrix(
    rowsToMatrix([
      createInternalRow(),
      createInternalRow({
        recordId: "record-2",
        question: "冲突问题",
      }),
      createInternalRow({
        recordId: "record-3",
        modelName: "模型 C",
      }),
    ]),
  );

  assert.equal(result.report.importedRowCount, 2);
  assert.equal(result.report.skippedRowCount, 1);
  assert.equal(result.state.versions[0].records.length, 2);
  assert.ok(
    result.report.errors.some(
      (error) => error.code === "VERSION_FIELDS_CONFLICT",
    ),
  );
});

test("没有合法行时抛出报告并阻止替换", () => {
  assert.throws(
    () =>
      importMatrix(
        rowsToMatrix([
          createInternalRow({
            modelName: "",
          }),
        ]),
      ),
    (error) => {
      assert.ok(error instanceof ExcelImportError);
      assert.equal(error.report.importedRowCount, 0);
      assert.equal(error.report.skippedRowCount, 1);
      return true;
    },
  );
});

test("成功结果校验 JSON 和独立摘要列", () => {
  const resultJson = {
    candidateId: "record-1",
    modelName: "模型 A",
    finalScore: 1,
    maxScore: 2,
    scoreRate: 50,
  };
  const result = importMatrix(
    rowsToMatrix([
      createInternalRow({
        status: "success",
        finalScore: 1,
        maxScore: 2,
        scoreRate: 50,
        resultJson: JSON.stringify(resultJson),
      }),
    ]),
  );

  assert.equal(
    result.state.versions[0].records[0].result.finalScore,
    1,
  );
});

test("摘要列与 JSON 冲突时跳过该行", () => {
  assert.throws(
    () =>
      importMatrix(
        rowsToMatrix([
          createInternalRow({
            status: "success",
            finalScore: 9,
            maxScore: 2,
            scoreRate: 50,
            resultJson: JSON.stringify({
              finalScore: 1,
              maxScore: 2,
              scoreRate: 50,
            }),
          }),
        ]),
      ),
    (error) => {
      assert.ok(
        error.report.errors.some(
          (item) => item.code === "RESULT_SUMMARY_MISMATCH",
        ),
      );
      return true;
    },
  );
});

test("缺少必要列时文件级失败", () => {
  const headers = schema.HEADERS.filter((header) => header !== "模型名");

  assert.throws(
    () => importMatrix([headers]),
    /缺少必要列：模型名/,
  );
});

test("Workbook 必须只有一个工作表", () => {
  const workbook = globalThis.XLSX.utils.book_new();
  globalThis.XLSX.utils.book_append_sheet(
    workbook,
    globalThis.XLSX.utils.aoa_to_sheet([schema.HEADERS]),
    "Sheet1",
  );
  globalThis.XLSX.utils.book_append_sheet(
    workbook,
    globalThis.XLSX.utils.aoa_to_sheet([schema.HEADERS]),
    "Sheet2",
  );
  const bytes = globalThis.XLSX.write(workbook, {
    type: "buffer",
    bookType: "xlsx",
  });

  assert.throws(
    () => readWorkbook(bytes),
    /必须且只能包含一个工作表/,
  );
});

test("读取真实 XLSX 字节并恢复合法行", () => {
  const matrix = rowsToMatrix([createInternalRow()]);
  const workbook = globalThis.XLSX.utils.book_new();
  globalThis.XLSX.utils.book_append_sheet(
    workbook,
    globalThis.XLSX.utils.aoa_to_sheet(matrix),
    schema.SHEET_NAME,
  );
  const bytes = globalThis.XLSX.write(workbook, {
    type: "buffer",
    bookType: "xlsx",
  });

  const result = readWorkbook(bytes);
  assert.equal(result.report.importedRowCount, 1);
  assert.equal(result.state.versions[0].id, "version-1");
});
