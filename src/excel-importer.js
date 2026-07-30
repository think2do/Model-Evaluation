(function defineExcelImporter(global) {
  "use strict";

  const namespace = global.ModelEvaluation;
  const constants = namespace?.constants;
  const schema = namespace?.excelSchema;
  const mapper = namespace?.excelRowMapper;
  if (!namespace || !constants || !schema || !mapper) {
    throw new Error("请先加载 Excel Schema 和行映射模块。");
  }

  const stableStatuses = new Set(constants.STABLE_EVALUATION_STATUSES);

  class ExcelImportError extends Error {
    constructor(message, report = null) {
      super(message);
      this.name = "ExcelImportError";
      this.report = report;
    }
  }

  function isBlank(value) {
    return value === "" || value === null || value === undefined;
  }

  function isBlankRow(values) {
    return values.every(isBlank);
  }

  function isNonEmptyString(value) {
    return typeof value === "string" && value.trim() !== "";
  }

  function isIsoDateString(value) {
    return isNonEmptyString(value) && !Number.isNaN(Date.parse(value));
  }

  function createRowError(rowNumber, code, message) {
    return { rowNumber, code, message };
  }

  function validateHeaders(headerValues) {
    const seen = new Set();
    const duplicates = [];
    headerValues.forEach((header) => {
      if (seen.has(header) && !isBlank(header)) {
        duplicates.push(header);
      }
      seen.add(header);
    });
    if (duplicates.length > 0) {
      throw new ExcelImportError(
        `工作表存在重复列：${[...new Set(duplicates)].join("、")}`,
      );
    }

    const missing = schema.HEADERS.filter(
      (header) => !seen.has(header),
    );
    if (missing.length > 0) {
      throw new ExcelImportError(
        `工作表缺少必要列：${missing.join("、")}`,
      );
    }
  }

  function matrixToSheetRows(matrix) {
    if (!Array.isArray(matrix) || matrix.length === 0) {
      throw new ExcelImportError("工作表为空。");
    }
    const headers = matrix[0].map((value) => String(value ?? "").trim());
    validateHeaders(headers);
    const headerIndexes = Object.fromEntries(
      schema.HEADERS.map((header) => [header, headers.indexOf(header)]),
    );

    return matrix
      .slice(1)
      .map((values, index) => ({
        rowNumber: index + 2,
        values,
      }))
      .filter(({ values }) => !isBlankRow(values))
      .map(({ rowNumber, values }) => ({
        rowNumber,
        sheetRow: Object.fromEntries(
          schema.HEADERS.map((header) => [
            header,
            values[headerIndexes[header]] ?? "",
          ]),
        ),
      }));
  }

  function validateBaseFields(row, rowNumber) {
    const errors = [];
    const requiredTextFields = [
      ["schemaVersion", "数据格式版本"],
      ["versionId", "评测版本 ID"],
      ["question", "问题"],
      ["rubric", "评分标准"],
      ["recordId", "记录 ID"],
      ["modelName", "模型名"],
      ["answer", "模型回答"],
      ["status", "评测状态"],
      ["updatedAt", "最后更新时间"],
    ];

    requiredTextFields.forEach(([key, label]) => {
      if (!isNonEmptyString(row[key])) {
        errors.push(
          createRowError(
            rowNumber,
            `MISSING_${key.toUpperCase()}`,
            `${label}为空或不是文本。`,
          ),
        );
      }
    });

    if (
      isNonEmptyString(row.schemaVersion) &&
      row.schemaVersion !== schema.DATA_SCHEMA_VERSION
    ) {
      errors.push(
        createRowError(
          rowNumber,
          "UNSUPPORTED_SCHEMA_VERSION",
          `不支持的数据格式版本：${row.schemaVersion}`,
        ),
      );
    }
    if (
      isNonEmptyString(row.status) &&
      !stableStatuses.has(row.status)
    ) {
      errors.push(
        createRowError(
          rowNumber,
          "INVALID_STATUS",
          `不支持的评测状态：${row.status}`,
        ),
      );
    }
    if (
      !isBlank(row.firstExportedAt) &&
      !isIsoDateString(row.firstExportedAt)
    ) {
      errors.push(
        createRowError(
          rowNumber,
          "INVALID_FIRST_EXPORTED_AT",
          "第一次导出时间格式错误。",
        ),
      );
    }
    if (
      isNonEmptyString(row.updatedAt) &&
      !isIsoDateString(row.updatedAt)
    ) {
      errors.push(
        createRowError(
          rowNumber,
          "INVALID_UPDATED_AT",
          "最后更新时间格式错误。",
        ),
      );
    }
    return errors;
  }

  function parseNumericSummary(value, label, rowNumber, errors) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string" && value.trim() !== "") {
      const number = Number(value);
      if (Number.isFinite(number)) {
        return number;
      }
    }
    errors.push(
      createRowError(
        rowNumber,
        "INVALID_SCORE_SUMMARY",
        `${label}缺失或不是数字。`,
      ),
    );
    return null;
  }

  function validateStatusFields(row, rowNumber, validateResult) {
    const errors = [];

    if (row.status === "success") {
      let result = null;
      try {
        result = mapper.parseOptionalJson(row.resultJson);
      } catch {
        errors.push(
          createRowError(
            rowNumber,
            "INVALID_RESULT_JSON",
            "完整评测结果 JSON 无法解析。",
          ),
        );
      }
      if (result === null) {
        errors.push(
          createRowError(
            rowNumber,
            "MISSING_RESULT_JSON",
            "成功记录缺少完整评测结果 JSON。",
          ),
        );
      }

      const finalScore = parseNumericSummary(
        row.finalScore,
        "最终分",
        rowNumber,
        errors,
      );
      const maxScore = parseNumericSummary(
        row.maxScore,
        "满分",
        rowNumber,
        errors,
      );
      const scoreRate = parseNumericSummary(
        row.scoreRate,
        "得分率",
        rowNumber,
        errors,
      );

      if (result && typeof validateResult === "function") {
        try {
          result = validateResult(result, row);
        } catch (error) {
          errors.push(
            createRowError(
              rowNumber,
              "INVALID_RESULT_STRUCTURE",
              error instanceof Error
                ? error.message
                : "评测结果结构校验失败。",
            ),
          );
        }
      }
      if (
        result &&
        (result.finalScore !== finalScore ||
          result.maxScore !== maxScore ||
          result.scoreRate !== scoreRate)
      ) {
        errors.push(
          createRowError(
            rowNumber,
            "RESULT_SUMMARY_MISMATCH",
            "独立分数列与完整评测结果 JSON 不一致。",
          ),
        );
      }
      return { errors, result };
    }

    if (!isBlank(row.resultJson)) {
      errors.push(
        createRowError(
          rowNumber,
          "UNEXPECTED_RESULT_JSON",
          "非成功记录不应包含完整评测结果 JSON。",
        ),
      );
    }
    if (
      !isBlank(row.finalScore) ||
      !isBlank(row.maxScore) ||
      !isBlank(row.scoreRate)
    ) {
      errors.push(
        createRowError(
          rowNumber,
          "UNEXPECTED_SCORE_SUMMARY",
          "非成功记录不应包含分数摘要。",
        ),
      );
    }
    if (
      ["request-error", "parse-error"].includes(row.status) &&
      !isNonEmptyString(row.errorMessage)
    ) {
      errors.push(
        createRowError(
          rowNumber,
          "MISSING_ERROR_MESSAGE",
          "失败记录缺少错误信息。",
        ),
      );
    }
    return { errors, result: null };
  }

  function publicVersionFieldsMatch(left, right) {
    return [
      "versionName",
      "question",
      "rubric",
      "firstExportedAt",
      "updatedAt",
    ].every((key) => left[key] === right[key]);
  }

  function importMatrix(matrix, options = {}) {
    const sourceRows = matrixToSheetRows(matrix);
    const report = {
      importedRowCount: 0,
      skippedRowCount: 0,
      errors: [],
    };
    const versionRows = new Map();
    const seenRecordIds = new Set();

    sourceRows.forEach(({ rowNumber, sheetRow }) => {
      const row = mapper.sheetRowToInternalRow(sheetRow);
      const baseErrors = validateBaseFields(row, rowNumber);
      const statusValidation = validateStatusFields(
        row,
        rowNumber,
        options.validateResult,
      );
      const rowErrors = [...baseErrors, ...statusValidation.errors];

      if (seenRecordIds.has(row.recordId)) {
        rowErrors.push(
          createRowError(
            rowNumber,
            "DUPLICATE_RECORD_ID",
            `记录 ID 重复：${row.recordId}`,
          ),
        );
      }

      const existingVersion = versionRows.get(row.versionId);
      if (
        existingVersion &&
        !publicVersionFieldsMatch(existingVersion.sourceRow, row)
      ) {
        rowErrors.push(
          createRowError(
            rowNumber,
            "VERSION_FIELDS_CONFLICT",
            "同一评测版本的公共字段与此前合法行冲突。",
          ),
        );
      }

      if (rowErrors.length > 0) {
        report.errors.push(...rowErrors);
        report.skippedRowCount += 1;
        return;
      }

      const candidate = mapper.internalRowToCandidate({
        ...row,
        resultJson:
          statusValidation.result === null
            ? ""
            : JSON.stringify(statusValidation.result),
      });
      seenRecordIds.add(candidate.record.id);

      if (existingVersion) {
        existingVersion.records.push(candidate.record);
      } else {
        versionRows.set(candidate.version.id, {
          sourceRow: row,
          version: candidate.version,
          records: [candidate.record],
        });
      }
      report.importedRowCount += 1;
    });

    if (report.importedRowCount === 0) {
      throw new ExcelImportError(
        "Excel 中没有可以导入的合法记录，网页当前数据已保留。",
        report,
      );
    }

    const versions = [...versionRows.values()].map((entry) => ({
      ...entry.version,
      records: entry.records,
    }));
    return {
      state: {
        schemaVersion: schema.DATA_SCHEMA_VERSION,
        activeVersionId: versions[0]?.id ?? null,
        versions,
        ui: {
          isImporting: false,
          isExporting: false,
          evaluatingRecordIds: [],
          lastImportReport: report,
        },
      },
      report,
    };
  }

  function readWorkbook(data, options = {}) {
    const xlsx = options.xlsx || global.XLSX;
    if (!xlsx?.read || !xlsx?.utils?.sheet_to_json) {
      throw new ExcelImportError("SheetJS 未正确加载，无法读取 Excel。");
    }
    const workbook = xlsx.read(data, {
      type: data instanceof ArrayBuffer ? "array" : undefined,
      cellFormula: true,
      cellHTML: false,
      cellNF: false,
      cellStyles: false,
      bookVBA: true,
    });
    if (workbook.SheetNames.length !== 1) {
      throw new ExcelImportError("Excel 必须且只能包含一个工作表。");
    }
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const formulaCell = Object.entries(worksheet).find(
      ([address, cell]) =>
        !address.startsWith("!") &&
        cell &&
        typeof cell === "object" &&
        typeof cell.f === "string" &&
        cell.f.trim() !== "",
    );
    if (formulaCell) {
      throw new ExcelImportError(
        `检测到公式单元格 ${formulaCell[0]}。为避免执行或信任公式结果，文件未导入。`,
      );
    }
    if (workbook.vbaraw) {
      throw new ExcelImportError(
        "检测到 Excel 宏内容。为保证安全，文件未导入。",
      );
    }
    const matrix = xlsx.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: "",
      raw: true,
      blankrows: false,
    });
    return importMatrix(matrix, options);
  }

  async function importFile(file, options = {}) {
    if (!file || typeof file.arrayBuffer !== "function") {
      throw new ExcelImportError("请选择有效的 Excel 文件。");
    }
    const data = await file.arrayBuffer();
    return readWorkbook(data, options);
  }

  namespace.excelImporter = Object.freeze({
    ExcelImportError,
    validateHeaders,
    matrixToSheetRows,
    importMatrix,
    readWorkbook,
    importFile,
  });
})(globalThis);
