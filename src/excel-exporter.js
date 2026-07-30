(function defineExcelExporter(global) {
  "use strict";

  const namespace = global.ModelEvaluation;
  const schema = namespace?.excelSchema;
  const mapper = namespace?.excelRowMapper;
  if (!namespace || !schema || !mapper) {
    throw new Error("请先加载 Excel Schema 和行映射模块。");
  }

  function clone(value) {
    if (typeof global.structuredClone === "function") {
      return global.structuredClone(value);
    }
    return JSON.parse(JSON.stringify(value));
  }

  function prepareExportSnapshot(state, exportedAt) {
    const snapshot = clone(state);
    snapshot.versions = snapshot.versions.map((version) =>
      version.firstExportedAt === null
        ? {
            ...version,
            firstExportedAt: exportedAt,
            updatedAt: exportedAt,
          }
        : version,
    );
    return snapshot;
  }

  function createWorkbook(state, xlsx = global.XLSX) {
    if (!xlsx?.utils?.json_to_sheet || !xlsx?.utils?.book_new) {
      throw new Error("SheetJS 未正确加载，无法生成 Excel。");
    }

    const internalRows = mapper.stateToInternalRows(state);
    if (internalRows.length === 0) {
      throw new Error("当前没有可以导出的评测记录。");
    }

    const sheetRows = internalRows.map(mapper.internalRowToSheetRow);
    const worksheet = xlsx.utils.json_to_sheet(sheetRows, {
      header: schema.HEADERS,
      skipHeader: false,
    });
    worksheet["!cols"] = schema.COLUMNS.map((column) => ({
      wch: ["问题", "评分标准", "模型回答", "完整评测结果 JSON"].includes(
        column.header,
      )
        ? 40
        : Math.max(14, Math.min(24, column.header.length * 2 + 4)),
    }));

    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, schema.SHEET_NAME);
    return workbook;
  }

  function createExportFileName(exportedAt) {
    const safeTime = exportedAt.replace(/[:.]/g, "-");
    return `模型评测记录_${safeTime}.xlsx`;
  }

  function exportStore(store, options = {}) {
    const xlsx = options.xlsx || global.XLSX;
    const exportedAt = options.exportedAt || new Date().toISOString();
    const currentState = store.getState();
    const exportSnapshot = prepareExportSnapshot(currentState, exportedAt);
    const workbook = createWorkbook(exportSnapshot, xlsx);
    const fileName =
      options.fileName || createExportFileName(exportedAt);
    const writeFile =
      options.writeFile ||
      ((targetWorkbook, targetFileName) =>
        xlsx.writeFile(targetWorkbook, targetFileName, {
          compression: true,
        }));

    writeFile(workbook, fileName);

    const firstExportVersionIds = currentState.versions
      .filter((version) => version.firstExportedAt === null)
      .map((version) => version.id);
    if (firstExportVersionIds.length > 0) {
      store.markVersionsExported(firstExportVersionIds, exportedAt);
    }

    return {
      exportedAt,
      fileName,
      rowCount: mapper.stateToInternalRows(exportSnapshot).length,
      workbook,
    };
  }

  namespace.excelExporter = Object.freeze({
    prepareExportSnapshot,
    createWorkbook,
    createExportFileName,
    exportStore,
  });
})(globalThis);
