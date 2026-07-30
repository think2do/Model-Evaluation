"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

require("../src/namespace.js");
require("../src/constants.js");
require("../src/excel-schema.js");
require("../src/excel-row-mapper.js");

const schema = globalThis.ModelEvaluation.excelSchema;
const mapper = globalThis.ModelEvaluation.excelRowMapper;

function createState() {
  return {
    schemaVersion: "A2.1",
    activeVersionId: "version-1",
    versions: [
      {
        id: "version-1",
        name: "",
        question: "问题",
        rubric: "标准",
        firstExportedAt: "2026-07-30T01:00:00.000Z",
        updatedAt: "2026-07-30T02:00:00.000Z",
        records: [
          {
            id: "record-1",
            modelName: "模型 A",
            answer: "回答 A",
            status: "success",
            result: {
              finalScore: 1,
              maxScore: 2,
              scoreRate: 50,
              items: [{ id: "C01", score: 1 }],
            },
            error: null,
            rawResponse: "{\"ok\":true}",
          },
          {
            id: "record-2",
            modelName: "模型 B",
            answer: "回答 B",
            status: "terminated",
            result: null,
            error: {
              type: "terminated",
              message: "本次评测已由用户终止。",
            },
            rawResponse: null,
          },
        ],
      },
    ],
  };
}

test("Schema 固定为一个工作表和 18 列", () => {
  assert.equal(schema.SHEET_NAME, "评测记录");
  assert.equal(schema.COLUMNS.length, 18);
  assert.equal(new Set(schema.HEADERS).size, schema.HEADERS.length);
  assert.equal(schema.DATA_SCHEMA_VERSION, "A2.1");
});

test("每条记录映射为一行并重复版本公共字段", () => {
  const rows = mapper.stateToInternalRows(createState());

  assert.equal(rows.length, 2);
  assert.equal(rows[0].versionId, rows[1].versionId);
  assert.equal(rows[0].question, rows[1].question);
  assert.equal(rows[0].updatedAt, rows[1].updatedAt);
});

test("成功结果同时保留 JSON 和独立摘要列", () => {
  const [row] = mapper.stateToInternalRows(createState());

  assert.equal(row.finalScore, 1);
  assert.equal(row.maxScore, 2);
  assert.equal(row.scoreRate, 50);
  assert.equal(JSON.parse(row.resultJson).finalScore, 1);
});

test("已终止记录不写入分数和结果 JSON", () => {
  const [, row] = mapper.stateToInternalRows(createState());

  assert.equal(row.status, "terminated");
  assert.equal(row.finalScore, "");
  assert.equal(row.resultJson, "");
  assert.equal(row.errorType, "terminated");
});

test("内部行和中文表头行可以往返转换", () => {
  const [internalRow] = mapper.stateToInternalRows(createState());
  const sheetRow = mapper.internalRowToSheetRow(internalRow);
  const restored = mapper.sheetRowToInternalRow(sheetRow);

  assert.deepEqual(restored, internalRow);
  assert.equal(sheetRow["最终分"], 1);
  assert.equal(sheetRow["完整评测结果 JSON"], internalRow.resultJson);
});

test("Excel 行可以恢复为版本与记录候选数据", () => {
  const [row] = mapper.stateToInternalRows(createState());
  const candidate = mapper.internalRowToCandidate(row);

  assert.equal(candidate.version.id, "version-1");
  assert.equal(candidate.record.id, "record-1");
  assert.equal(candidate.record.result.finalScore, 1);
  assert.equal(candidate.summary.scoreRate, 50);
});

test("非法结果 JSON 不会被静默修复", () => {
  const [row] = mapper.stateToInternalRows(createState());
  row.resultJson = "{invalid";

  assert.throws(
    () => mapper.internalRowToCandidate(row),
    SyntaxError,
  );
});
