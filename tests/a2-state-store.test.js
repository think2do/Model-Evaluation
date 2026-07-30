"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

require("../src/namespace.js");
require("../src/constants.js");
require("../src/state-store.js");

const { EVALUATION_STATUS } = globalThis.ModelEvaluation.constants;
const {
  createEvaluationRecord,
  createEvaluationVersion,
  createStateStore,
} = globalThis.ModelEvaluation.state;

function createDependencies() {
  let id = 0;
  let tick = 0;
  return {
    makeId(prefix) {
      id += 1;
      return `${prefix}-${id}`;
    },
    now() {
      tick += 1;
      return `2026-07-30T00:00:${String(tick).padStart(2, "0")}.000Z`;
    },
  };
}

test("记录工厂默认创建未评测记录", () => {
  const record = createEvaluationRecord(
    {},
    { makeId: () => "record-1" },
  );

  assert.deepEqual(record, {
    id: "record-1",
    modelName: "",
    answer: "",
    status: EVALUATION_STATUS.UNSCORED,
    result: null,
    error: null,
    rawResponse: null,
  });
});

test("版本工厂允许空名称，并至少创建一条记录", () => {
  const dependencies = createDependencies();
  const version = createEvaluationVersion({}, dependencies);

  assert.equal(version.name, "");
  assert.equal(version.firstExportedAt, null);
  assert.equal(version.records.length, 1);
  assert.equal(version.records[0].status, EVALUATION_STATUS.UNSCORED);
});

test("Store 可以创建多个版本并切换活动版本", () => {
  const store = createStateStore(createDependencies());
  store.createVersion({ name: "版本 A" });
  const firstId = store.getState().activeVersionId;
  store.createVersion({ name: "" });
  const secondId = store.getState().activeVersionId;

  assert.notEqual(firstId, secondId);
  assert.equal(store.getState().versions.length, 2);

  store.setActiveVersion(firstId);
  assert.equal(store.getState().activeVersionId, firstId);
});

test("只切换活动版本不会改变更新时间", () => {
  const store = createStateStore(createDependencies());
  store.createVersion({ name: "版本 A" });
  const firstId = store.getState().activeVersionId;
  store.createVersion({ name: "版本 B" });
  const before = store
    .getState()
    .versions.find((version) => version.id === firstId).updatedAt;

  store.setActiveVersion(firstId);
  const after = store
    .getState()
    .versions.find((version) => version.id === firstId).updatedAt;

  assert.equal(after, before);
});

test("修改版本或记录会更新所属版本时间", () => {
  const store = createStateStore(createDependencies());
  store.createVersion({ name: "版本 A" });
  let version = store.getState().versions[0];
  const createdAt = version.updatedAt;

  store.updateVersion(version.id, { question: "新问题" });
  version = store.getState().versions[0];
  assert.notEqual(version.updatedAt, createdAt);

  const afterVersionUpdate = version.updatedAt;
  store.updateRecord(version.id, version.records[0].id, {
    modelName: "模型 A",
  });
  version = store.getState().versions[0];
  assert.notEqual(version.updatedAt, afterVersionUpdate);
});

test("写入相同内容不会更新时间", () => {
  const store = createStateStore(createDependencies());
  store.createVersion({ name: "版本 A" });
  const version = store.getState().versions[0];

  store.updateVersion(version.id, { name: "版本 A" });
  assert.equal(store.getState().versions[0].updatedAt, version.updatedAt);
});

test("删除活动版本会选择相邻版本", () => {
  const store = createStateStore(createDependencies());
  store.createVersion({ name: "版本 A" });
  const firstId = store.getState().activeVersionId;
  store.createVersion({ name: "版本 B" });
  const secondId = store.getState().activeVersionId;

  store.deleteVersion(secondId);
  assert.equal(store.getState().activeVersionId, firstId);

  store.deleteVersion(firstId);
  assert.equal(store.getState().activeVersionId, null);
});

test("每个版本至少保留一条记录", () => {
  const store = createStateStore(createDependencies());
  store.createVersion({ name: "版本 A" });
  const version = store.getState().versions[0];

  assert.throws(
    () => store.deleteRecord(version.id, version.records[0].id),
    /至少需要保留一条记录/,
  );
});

test("Store 拒绝非法状态和重复 ID", () => {
  assert.throws(
    () =>
      createEvaluationRecord(
        { status: "unknown" },
        { makeId: () => "record-1" },
      ),
    /不支持的评测状态/,
  );

  assert.throws(
    () =>
      createEvaluationVersion(
        {
          records: [
            { id: "record-1" },
            { id: "record-1" },
          ],
        },
        {
          makeId: () => "version-1",
          now: () => "2026-07-30T00:00:00.000Z",
        },
      ),
    /记录 ID 重复/,
  );
});

test("首次导出同时写入第一次导出时间和最后更新时间", () => {
  const store = createStateStore(createDependencies());
  store.createVersion({ name: "版本 A" });
  const versionId = store.getState().versions[0].id;
  const exportedAt = "2026-07-30T08:00:00.000Z";

  store.markVersionsExported([versionId], exportedAt);
  const exported = store.getState().versions[0];
  assert.equal(exported.firstExportedAt, exportedAt);
  assert.equal(exported.updatedAt, exportedAt);

  store.markVersionsExported(
    [versionId],
    "2026-07-31T08:00:00.000Z",
  );
  const exportedAgain = store.getState().versions[0];
  assert.equal(exportedAgain.firstExportedAt, exportedAt);
  assert.equal(exportedAgain.updatedAt, exportedAt);
});

test("replaceState 是全量替换且不会改写导入时间", () => {
  const store = createStateStore(createDependencies());
  store.createVersion({ name: "旧版本" });

  const importedState = {
    schemaVersion: "A2.1",
    activeVersionId: "version-imported",
    versions: [
      {
        id: "version-imported",
        name: "导入版本",
        question: "问题",
        rubric: "标准",
        firstExportedAt: "2026-07-01T00:00:00.000Z",
        updatedAt: "2026-07-02T00:00:00.000Z",
        records: [
          {
            id: "record-imported",
            modelName: "模型",
            answer: "回答",
            status: "terminated",
            result: null,
            error: null,
            rawResponse: null,
          },
        ],
      },
    ],
    ui: {
      isImporting: false,
      isExporting: false,
      evaluatingRecordIds: [],
      lastImportReport: null,
    },
  };

  store.replaceState(importedState);
  const state = store.getState();
  assert.equal(state.versions.length, 1);
  assert.equal(state.versions[0].name, "导入版本");
  assert.equal(
    state.versions[0].updatedAt,
    "2026-07-02T00:00:00.000Z",
  );
  assert.equal(state.versions[0].records[0].status, "terminated");
});

test("getState 返回副本，外部修改不会污染 Store", () => {
  const store = createStateStore(createDependencies());
  store.createVersion({ name: "版本 A" });
  const snapshot = store.getState();

  snapshot.versions[0].name = "外部修改";
  assert.equal(store.getState().versions[0].name, "版本 A");
});
