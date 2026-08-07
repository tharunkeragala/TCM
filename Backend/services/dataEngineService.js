
/**
 * dataEngineService.js
 *
 * Place at:
 *   Backend/services/dataEngineService.js
 *
 * Requires:
 *   npm install csv-parser xlsx axios
 */

const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");
const XLSX = require("xlsx");
const axios = require("axios");

class DataDrivenEngine {
  /* ------------------------------------------------------------------------ */
  /*                               CSV parsing                                */
  /* ------------------------------------------------------------------------ */

  async parseCSV(filePath) {
    this.assertFileExists(filePath);

    return new Promise(
      (resolve, reject) => {
        const rows = [];

        fs.createReadStream(filePath)
          .pipe(csv())
          .on("data", (row) => {
            rows.push(row);
          })
          .on("end", () => {
            resolve(rows);
          })
          .on("error", (error) => {
            reject(error);
          });
      },
    );
  }

  /* ------------------------------------------------------------------------ */
  /*                              Excel parsing                               */
  /* ------------------------------------------------------------------------ */

  async parseExcel(
    filePath,
    sheetName = null,
  ) {
    this.assertFileExists(filePath);

    const workbook =
      XLSX.readFile(filePath);

    if (
      !workbook.SheetNames ||
      workbook.SheetNames.length === 0
    ) {
      throw new Error(
        "The Excel workbook does not contain any worksheets.",
      );
    }

    const selectedSheetName =
      sheetName &&
      workbook.Sheets[sheetName]
        ? sheetName
        : workbook.SheetNames[0];

    const sheet =
      workbook.Sheets[
        selectedSheetName
      ];

    if (!sheet) {
      throw new Error(
        `Excel sheet "${selectedSheetName}" was not found.`,
      );
    }

    return XLSX.utils.sheet_to_json(
      sheet,
      {
        defval: "",
        raw: false,
      },
    );
  }

  /* ------------------------------------------------------------------------ */
  /*                               JSON parsing                               */
  /* ------------------------------------------------------------------------ */

  async parseJSON(filePath) {
    this.assertFileExists(filePath);

    const content =
      await fs.promises.readFile(
        filePath,
        "utf-8",
      );

    let parsed;

    try {
      parsed = JSON.parse(content);
    } catch (error) {
      throw new Error(
        `Invalid JSON test data: ${error.message}`,
      );
    }

    if (Array.isArray(parsed)) {
      return parsed;
    }

    /*
     * Common API-style JSON:
     * {
     *   "data": [...]
     * }
     */
    if (
      parsed &&
      typeof parsed === "object" &&
      Array.isArray(parsed.data)
    ) {
      return parsed.data;
    }

    return [parsed];
  }

  /* ------------------------------------------------------------------------ */
  /*                                API source                                */
  /* ------------------------------------------------------------------------ */

  async fetchFromAPI(
    apiUrl,
    method = "GET",
    headers = {},
    body = null,
    options = {},
  ) {
    if (!apiUrl) {
      throw new Error(
        "API source URL is required.",
      );
    }

    const response = await axios({
      url: apiUrl,
      method:
        String(method).toUpperCase(),
      headers: headers || {},
      data: body ?? undefined,
      params:
        options.params || undefined,
      timeout:
        Number(options.timeout) ||
        30000,
      validateStatus: (
        status,
      ) =>
        status >= 200 &&
        status < 300,
    });

    let data = response.data;

    /*
     * Common response structures:
     *
     * [...]
     *
     * { data: [...] }
     *
     * { results: [...] }
     *
     * { items: [...] }
     */
    if (
      data &&
      !Array.isArray(data) &&
      typeof data === "object"
    ) {
      if (
        Array.isArray(data.data)
      ) {
        data = data.data;
      } else if (
        Array.isArray(
          data.results,
        )
      ) {
        data = data.results;
      } else if (
        Array.isArray(data.items)
      ) {
        data = data.items;
      }
    }

    return Array.isArray(data)
      ? data
      : [data];
  }

  /* ------------------------------------------------------------------------ */
  /*                            Generic data loader                            */
  /* ------------------------------------------------------------------------ */

  async loadTestData(
    sourceType,
    sourcePath,
    options = {},
  ) {
    const type = String(
      sourceType || "",
    ).toUpperCase();

    switch (type) {
      case "CSV":
        return this.parseCSV(
          sourcePath,
        );

      case "XLSX":
      case "EXCEL":
        return this.parseExcel(
          sourcePath,
          options.sheetName,
        );

      case "JSON":
        return this.parseJSON(
          sourcePath,
        );

      case "API":
      case "REST":
        return this.fetchFromAPI(
          sourcePath,
          options.method || "GET",
          options.headers || {},
          options.body ?? null,
          options,
        );

      default:
        throw new Error(
          `Unsupported data source type: ${sourceType}`,
        );
    }
  }

  /* ------------------------------------------------------------------------ */
  /*                           Variable substitution                          */
  /* ------------------------------------------------------------------------ */

  substituteVariables(
    script,
    testDataRow,
    parameterMappings = [],
  ) {
    let processedScript =
      String(script || "");

    for (const mapping of parameterMappings) {
      const dataColumn =
        mapping.data_column_name ??
        mapping.dataColumn;

      const placeholder =
        mapping.variable_placeholder ??
        mapping.placeholder;

      if (
        !dataColumn ||
        !placeholder
      ) {
        continue;
      }

      const value =
        this.getNestedValue(
          testDataRow,
          dataColumn,
        );

      if (value === undefined) {
        console.warn(
          `[dataEngineService] Mapping value not found: ${dataColumn}`,
        );

        continue;
      }

      const escapedValue =
        this.escapeForPlaywrightString(
          value,
        );

      processedScript =
        processedScript
          .split(placeholder)
          .join(escapedValue);
    }

    return processedScript;
  }

  getNestedValue(object, valuePath) {
    if (
      !valuePath ||
      object === null ||
      object === undefined
    ) {
      return undefined;
    }

    const parts = String(valuePath)
      .replace(
        /\[(\d+)\]/g,
        ".$1",
      )
      .split(".")
      .filter(Boolean);

    return parts.reduce(
      (current, property) => {
        if (
          current === null ||
          current === undefined
        ) {
          return undefined;
        }

        return current[property];
      },
      object,
    );
  }

  substituteNestedVariables(
    script,
    testDataRow,
  ) {
    return String(
      script || "",
    ).replace(
      /{{\s*([^}]+?)\s*}}/g,
      (match, variablePath) => {
        const value =
          this.getNestedValue(
            testDataRow,
            variablePath.trim(),
          );

        if (value === undefined) {
          console.warn(
            `[dataEngineService] Variable not found: ${variablePath}`,
          );

          return match;
        }

        return this.escapeForPlaywrightString(
          value,
        );
      },
    );
  }

  /* ------------------------------------------------------------------------ */
  /*                          Playwright-safe escaping                        */
  /* ------------------------------------------------------------------------ */

  escapeForPlaywrightString(
    value,
  ) {
    if (
      value === null ||
      value === undefined
    ) {
      return "";
    }

    if (
      typeof value === "object"
    ) {
      value =
        JSON.stringify(value);
    }

    /*
     * Important for selectors, including XPath:
     *
     * xpath=/html/body/div...
     *
     * This keeps slashes intact while safely
     * escaping backslashes and single quotes.
     */
    return String(value)
      .replace(/\\/g, "\\\\")
      .replace(/'/g, "\\'");
  }

  /* ------------------------------------------------------------------------ */
  /*                       Parameterized run generation                       */
  /* ------------------------------------------------------------------------ */

  async generateParameterizedRuns(
    testCaseId,
    dataRows,
    pool,
  ) {
    const sql = require("mssql");
    const runs = [];

    if (!Array.isArray(dataRows)) {
      throw new Error(
        "Data rows must be an array.",
      );
    }

    for (
      let index = 0;
      index < dataRows.length;
      index += 1
    ) {
      const result = await pool
        .request()
        .input(
          "test_case_id",
          sql.Int,
          testCaseId,
        )
        .input(
          "data_index",
          sql.Int,
          index,
        )
        .query(`
          INSERT INTO test_case_manager.dbo.playwright_test_runs
            (
              test_case_id,
              status,
              started_at,
              data_index
            )
          OUTPUT INSERTED.id
          VALUES
            (
              @test_case_id,
              'pending',
              GETDATE(),
              @data_index
            )
        `);

      runs.push({
        runId:
          result.recordset[0].id,
        iteration: index + 1,
        dataIndex: index,
        dataRow:
          dataRows[index],
      });
    }

    return runs;
  }

  /* ------------------------------------------------------------------------ */
  /*                               Validation                                 */
  /* ------------------------------------------------------------------------ */

  assertFileExists(filePath) {
    if (!filePath) {
      throw new Error(
        "Test data file path is required.",
      );
    }

    const resolvedPath =
      path.resolve(filePath);

    if (
      !fs.existsSync(
        resolvedPath,
      )
    ) {
      throw new Error(
        `Test data file was not found: ${resolvedPath}`,
      );
    }
  }
}

module.exports =
  new DataDrivenEngine();