(function defineModelEvaluationStateStore(global) {
  "use strict";

  const namespace = global.ModelEvaluation;
  const constants = namespace?.constants;

  if (!namespace || !constants) {
    throw new Error("请先加载 namespace.js 和 constants.js。");
  }

  const {
    DATA_SCHEMA_VERSION,
    EVALUATION_STATUS,
    EVALUATION_STATUS_VALUES,
  } = constants;

  function clone(value) {
    if (typeof global.structuredClone === "function") {
      return global.structuredClone(value);
    }
    return JSON.parse(JSON.stringify(value));
  }

  function defaultNow() {
    return new Date().toISOString();
  }

  function defaultMakeId(prefix) {
    const randomId = global.crypto?.randomUUID?.();
    if (randomId) {
      return `${prefix}-${randomId}`;
    }
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  function assertNonEmptyString(value, fieldName) {
    if (typeof value !== "string" || value.trim() === "") {
      throw new TypeError(`${fieldName} 必须是非空字符串。`);
    }
  }

  function assertString(value, fieldName) {
    if (typeof value !== "string") {
      throw new TypeError(`${fieldName} 必须是字符串。`);
    }
  }

  function assertIsoDateString(value, fieldName, allowNull = false) {
    if (allowNull && value === null) {
      return;
    }
    assertNonEmptyString(value, fieldName);
    if (Number.isNaN(Date.parse(value))) {
      throw new TypeError(`${fieldName} 必须是可解析的 ISO 时间字符串。`);
    }
  }

  function assertEvaluationStatus(status) {
    if (!EVALUATION_STATUS_VALUES.includes(status)) {
      throw new TypeError(`不支持的评测状态：${String(status)}`);
    }
  }

  function createEvaluationRecord(input = {}, dependencies = {}) {
    const makeId = dependencies.makeId || defaultMakeId;
    const id = input.id ?? makeId("record");
    const status = input.status ?? EVALUATION_STATUS.UNSCORED;

    assertNonEmptyString(id, "记录 ID");
    assertString(input.modelName ?? "", "模型名");
    assertString(input.answer ?? "", "模型回答");
    assertEvaluationStatus(status);

    return {
      id,
      modelName: input.modelName ?? "",
      answer: input.answer ?? "",
      status,
      result: input.result === undefined ? null : clone(input.result),
      error: input.error === undefined ? null : clone(input.error),
      rawResponse: input.rawResponse ?? null,
    };
  }

  function createEvaluationVersion(input = {}, dependencies = {}) {
    const makeId = dependencies.makeId || defaultMakeId;
    const now = dependencies.now || defaultNow;
    const id = input.id ?? makeId("version");
    const updatedAt = input.updatedAt ?? now();
    const recordInputs =
      input.records === undefined ? [{}] : input.records;

    assertNonEmptyString(id, "版本 ID");
    assertString(input.name ?? "", "版本名称");
    assertString(input.question ?? "", "问题");
    assertString(input.rubric ?? "", "评分标准");
    assertIsoDateString(
      input.firstExportedAt ?? null,
      "第一次导出时间",
      true,
    );
    assertIsoDateString(updatedAt, "最后更新时间");

    if (!Array.isArray(recordInputs) || recordInputs.length === 0) {
      throw new TypeError("每个评测版本至少需要一条评测记录。");
    }

    const records = recordInputs.map((record) =>
      createEvaluationRecord(record, { makeId }),
    );
    assertUniqueIds(records, "记录");

    return {
      id,
      name: input.name ?? "",
      question: input.question ?? "",
      rubric: input.rubric ?? "",
      firstExportedAt: input.firstExportedAt ?? null,
      updatedAt,
      records,
    };
  }

  function createInitialState(input = {}) {
    const versions = input.versions ? clone(input.versions) : [];
    assertUniqueIds(versions, "版本");

    return {
      schemaVersion: DATA_SCHEMA_VERSION,
      activeVersionId:
        input.activeVersionId === undefined
          ? versions[0]?.id ?? null
          : input.activeVersionId,
      versions,
      ui: {
        isImporting: false,
        isExporting: false,
        evaluatingRecordIds: [],
        lastImportReport: null,
        ...(input.ui ? clone(input.ui) : {}),
      },
    };
  }

  function assertUniqueIds(items, label) {
    const ids = new Set();
    items.forEach((item) => {
      assertNonEmptyString(item?.id, `${label} ID`);
      if (ids.has(item.id)) {
        throw new Error(`${label} ID 重复：${item.id}`);
      }
      ids.add(item.id);
    });
  }

  function validateState(state) {
    if (!state || typeof state !== "object" || Array.isArray(state)) {
      throw new TypeError("应用状态必须是对象。");
    }
    if (state.schemaVersion !== DATA_SCHEMA_VERSION) {
      throw new Error(`不支持的数据格式版本：${state.schemaVersion}`);
    }
    if (!Array.isArray(state.versions)) {
      throw new TypeError("versions 必须是数组。");
    }

    assertUniqueIds(state.versions, "版本");
    state.versions.forEach((version) => {
      createEvaluationVersion(version, {
        makeId: () => {
          throw new Error("校验现有数据时不得生成 ID。");
        },
      });
    });

    if (
      state.activeVersionId !== null &&
      !state.versions.some((version) => version.id === state.activeVersionId)
    ) {
      throw new Error("activeVersionId 未指向现有版本。");
    }
  }

  function createStateStore(options = {}) {
    const now = options.now || defaultNow;
    const makeId = options.makeId || defaultMakeId;
    let state = createInitialState(options.initialState);
    const listeners = new Set();

    validateState(state);

    function emit() {
      const snapshot = clone(state);
      listeners.forEach((listener) => listener(snapshot));
    }

    function commit(nextState) {
      validateState(nextState);
      state = nextState;
      emit();
      return clone(state);
    }

    function findVersionIndex(versionId) {
      const index = state.versions.findIndex(
        (version) => version.id === versionId,
      );
      if (index === -1) {
        throw new Error(`未找到评测版本：${versionId}`);
      }
      return index;
    }

    function updateVersionAtIndex(index, updater, touch = true) {
      const current = state.versions[index];
      const updated = updater(clone(current));
      const nextVersion = {
        ...updated,
        updatedAt: touch ? now() : updated.updatedAt,
      };
      const versions = [...state.versions];
      versions[index] = nextVersion;
      return commit({ ...state, versions });
    }

    return Object.freeze({
      getState() {
        return clone(state);
      },

      subscribe(listener) {
        if (typeof listener !== "function") {
          throw new TypeError("订阅者必须是函数。");
        }
        listeners.add(listener);
        return () => listeners.delete(listener);
      },

      replaceState(nextState) {
        return commit(clone(nextState));
      },

      setActiveVersion(versionId) {
        if (versionId === state.activeVersionId) {
          return clone(state);
        }
        if (
          versionId !== null &&
          !state.versions.some((version) => version.id === versionId)
        ) {
          throw new Error(`未找到评测版本：${versionId}`);
        }
        return commit({ ...state, activeVersionId: versionId });
      },

      createVersion(input = {}) {
        const version = createEvaluationVersion(input, { now, makeId });
        if (state.versions.some((item) => item.id === version.id)) {
          throw new Error(`版本 ID 重复：${version.id}`);
        }
        return commit({
          ...state,
          activeVersionId: version.id,
          versions: [...state.versions, version],
        });
      },

      updateVersion(versionId, changes) {
        const index = findVersionIndex(versionId);
        const allowedKeys = ["name", "question", "rubric"];
        const nextChanges = {};

        allowedKeys.forEach((key) => {
          if (Object.prototype.hasOwnProperty.call(changes, key)) {
            assertString(changes[key], key);
            nextChanges[key] = changes[key];
          }
        });

        const current = state.versions[index];
        const hasChanges = Object.entries(nextChanges).some(
          ([key, value]) => current[key] !== value,
        );
        if (!hasChanges) {
          return clone(state);
        }
        return updateVersionAtIndex(index, (version) => ({
          ...version,
          ...nextChanges,
        }));
      },

      deleteVersion(versionId) {
        const index = findVersionIndex(versionId);
        const versions = state.versions.filter(
          (version) => version.id !== versionId,
        );
        let activeVersionId = state.activeVersionId;

        if (activeVersionId === versionId) {
          activeVersionId =
            versions[index]?.id ?? versions[index - 1]?.id ?? null;
        }
        return commit({ ...state, activeVersionId, versions });
      },

      addRecord(versionId, input = {}) {
        const index = findVersionIndex(versionId);
        const record = createEvaluationRecord(input, { makeId });
        const version = state.versions[index];
        if (version.records.some((item) => item.id === record.id)) {
          throw new Error(`记录 ID 重复：${record.id}`);
        }
        return updateVersionAtIndex(index, (draft) => ({
          ...draft,
          records: [...draft.records, record],
        }));
      },

      updateRecord(versionId, recordId, changes) {
        const index = findVersionIndex(versionId);
        const version = state.versions[index];
        const recordIndex = version.records.findIndex(
          (record) => record.id === recordId,
        );
        if (recordIndex === -1) {
          throw new Error(`未找到评测记录：${recordId}`);
        }

        const allowedKeys = [
          "modelName",
          "answer",
          "status",
          "result",
          "error",
          "rawResponse",
        ];
        const nextChanges = {};
        allowedKeys.forEach((key) => {
          if (Object.prototype.hasOwnProperty.call(changes, key)) {
            nextChanges[key] = clone(changes[key]);
          }
        });
        if (Object.prototype.hasOwnProperty.call(nextChanges, "modelName")) {
          assertString(nextChanges.modelName, "模型名");
        }
        if (Object.prototype.hasOwnProperty.call(nextChanges, "answer")) {
          assertString(nextChanges.answer, "模型回答");
        }
        if (Object.prototype.hasOwnProperty.call(nextChanges, "status")) {
          assertEvaluationStatus(nextChanges.status);
        }

        const currentRecord = version.records[recordIndex];
        const hasChanges = Object.entries(nextChanges).some(
          ([key, value]) =>
            JSON.stringify(currentRecord[key]) !== JSON.stringify(value),
        );
        if (!hasChanges) {
          return clone(state);
        }

        return updateVersionAtIndex(index, (draft) => {
          const records = [...draft.records];
          records[recordIndex] = { ...records[recordIndex], ...nextChanges };
          return { ...draft, records };
        });
      },

      deleteRecord(versionId, recordId) {
        const index = findVersionIndex(versionId);
        const version = state.versions[index];
        if (version.records.length === 1) {
          throw new Error("每个评测版本至少需要保留一条记录。");
        }
        if (!version.records.some((record) => record.id === recordId)) {
          throw new Error(`未找到评测记录：${recordId}`);
        }
        return updateVersionAtIndex(index, (draft) => ({
          ...draft,
          records: draft.records.filter((record) => record.id !== recordId),
        }));
      },

      markVersionsExported(versionIds, exportedAt = now()) {
        assertIsoDateString(exportedAt, "导出时间");
        const targetIds = new Set(versionIds);
        const missingIds = [...targetIds].filter(
          (id) => !state.versions.some((version) => version.id === id),
        );
        if (missingIds.length > 0) {
          throw new Error(`未找到评测版本：${missingIds.join(", ")}`);
        }

        const versions = state.versions.map((version) =>
          targetIds.has(version.id) && version.firstExportedAt === null
            ? {
                ...version,
                firstExportedAt: exportedAt,
                updatedAt: exportedAt,
              }
            : version,
        );

        const changed = versions.some(
          (version, index) => version !== state.versions[index],
        );
        return changed ? commit({ ...state, versions }) : clone(state);
      },
    });
  }

  namespace.state = Object.freeze({
    createEvaluationRecord,
    createEvaluationVersion,
    createInitialState,
    createStateStore,
    validateState,
  });
})(globalThis);
