"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

globalThis.XLSX = require("../vendor/sheetjs/xlsx.full.min.js");
require("../src/namespace.js");
require("../src/constants.js");
require("../src/state-store.js");
require("../src/excel-schema.js");
require("../src/excel-row-mapper.js");
require("../src/excel-exporter.js");

const { createStateStore } = globalThis.ModelEvaluation.state;
const schema = globalThis.ModelEvaluation.excelSchema;
const {
  prepareExportSnapshot,
  createWorkbook,
  createExportFileName,
  exportStore,
} = globalThis.ModelEvaluation.excelExporter;

function createStore() {
  let id = 0;
  const store = createStateStore({
    makeId(prefix) {
      id += 1;
      return `${prefix}-${id}`;
    },
    now: () => "2026-07-30T01:00:00.000Z",
  });
  store.createVersion({
    name: "版本 A",
    question: "问题",
    rubric: "标准",
    records: [
      {
        modelName: "模型 A",
        answer: "回答",
      },
    ],
  });
  return store;
}

test("导出快照写入首次导出时间且不修改原状态", () => {
  const store = createStore();
  const state = store.getState();
  const exportedAt = "2026-07-30T08:00:00.000Z";

  const snapshot = prepareExportSnapshot(state, exportedAt);

  assert.equal(state.versions[0].firstExportedAt, null);
  assert.equal(snapshot.versions[0].firstExportedAt, exportedAt);
  assert.equal(snapshot.versions[0].updatedAt, exportedAt);
});

test("Workbook 只有一个工作表和固定表头", () => {
  const store = createStore();
  const snapshot = prepareExportSnapshot(
    store.getState(),
    "2026-07-30T08:00:00.000Z",
  );
  const workbook = createWorkbook(snapshot);
  const bytes = globalThis.XLSX.write(workbook, {
    bookType: "xlsx",
    type: "buffer",
  });
  const restored = globalThis.XLSX.read(bytes);
  const worksheet = restored.Sheets[restored.SheetNames[0]];
  const rows = globalThis.XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
  });

  assert.deepEqual(restored.SheetNames, [schema.SHEET_NAME]);
  assert.deepEqual(rows[0], schema.HEADERS);
  assert.equal(rows.length, 2);
});

test("文件名使用可安全保存的 ISO 时间", () => {
  assert.equal(
    createExportFileName("2026-07-30T08:00:00.000Z"),
    "模型评测记录_2026-07-30T08-00-00-000Z.xlsx",
  );
});

test("成功生成文件后才把首次导出时间写回 Store", () => {
  const store = createStore();
  const exportedAt = "2026-07-30T08:00:00.000Z";
  let writtenFileName = "";

  const result = exportStore(store, {
    exportedAt,
    writeFile(_workbook, fileName) {
      writtenFileName = fileName;
    },
  });

  assert.equal(result.rowCount, 1);
  assert.equal(writtenFileName, result.fileName);
  assert.equal(
    store.getState().versions[0].firstExportedAt,
    exportedAt,
  );
  assert.equal(store.getState().versions[0].updatedAt, exportedAt);
});

test("文件生成失败时不写入首次导出时间", () => {
  const store = createStore();

  assert.throws(
    () =>
      exportStore(store, {
        exportedAt: "2026-07-30T08:00:00.000Z",
        writeFile() {
          throw new Error("download failed");
        },
      }),
    /download failed/,
  );
  assert.equal(store.getState().versions[0].firstExportedAt, null);
});

test("没有评测记录时拒绝导出", () => {
  assert.throws(
    () =>
      createWorkbook({
        schemaVersion: "A2.1",
        activeVersionId: null,
        versions: [],
        ui: {},
      }),
    /没有可以导出/,
  );
});
