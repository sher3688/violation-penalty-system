import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import {
  buildHouseholdPenaltyExcelRows,
  formatHouseholdPenaltyPeriod,
  getHouseholdPenaltyExportFilename,
} from "../shared/householdPenaltyExport";

const report = {
  summary: {
    householdCount: 2,
    totalCases: 3,
    totalAssessedAmount: 2600,
    totalPaidAmount: 1600,
    totalOutstandingAmount: 1000,
  },
  rows: [
    {
      householdNo: "A-1",
      caseCount: 2,
      assessedAmount: 2100,
      paidCases: 1,
      paidAmount: 1200,
      outstandingCases: 1,
      outstandingAmount: 900,
    },
    {
      householdNo: "A-10",
      caseCount: 1,
      assessedAmount: 500,
      paidCases: 1,
      paidAmount: 400,
      outstandingCases: 1,
      outstandingAmount: 100,
    },
  ],
};

describe("每戶違規金額 Excel 匯出工具", () => {
  it("格式化日期區間與安全檔名", () => {
    expect(formatHouseholdPenaltyPeriod("2026-01-01", "2026-01-31")).toBe("2026-01-01 至 2026-01-31");
    expect(formatHouseholdPenaltyPeriod()).toBe("全部期間");
    expect(getHouseholdPenaltyExportFilename("2026-01-01", "2026-01-31")).toBe("每戶違規金額統計_2026-01-01_2026-01-31.xlsx");
    expect(getHouseholdPenaltyExportFilename()).toBe("每戶違規金額統計_全部期間.xlsx");
  });

  it("建立含標題、戶別明細與金額合計的 Excel 資料列", () => {
    const rows = buildHouseholdPenaltyExcelRows(report, "2026-01-01 至 2026-01-31", "2026/1/31 上午 10:00:00");

    expect(rows.slice(0, 5)).toEqual([
      ["每戶違規金額統計表"],
      ["統計區間", "2026-01-01 至 2026-01-31"],
      ["匯出時間", "2026/1/31 上午 10:00:00"],
      [],
      ["戶號", "違規案件數", "應收金額（元）", "已繳案件數", "已繳金額（元）", "未繳案件數", "未繳金額（元）"],
    ]);
    expect(rows[5]).toEqual(["A-1", 2, 2100, 1, 1200, 1, 900]);
    expect(rows[6]).toEqual(["A-10", 1, 500, 1, 400, 1, 100]);
    expect(rows.at(-1)).toEqual(["合計", 3, 2600, 2, 1600, 2, 1000]);
  });

  it("可產製並讀回有效的 XLSX 工作簿", () => {
    const rows = buildHouseholdPenaltyExcelRows(report, "全部期間", "2026/1/31 上午 10:00:00");
    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "戶別金額統計");

    const bytes = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });
    const restoredWorkbook = XLSX.read(bytes, { type: "buffer" });
    const restoredSheet = restoredWorkbook.Sheets["戶別金額統計"];

    expect(bytes.byteLength).toBeGreaterThan(1000);
    expect(restoredWorkbook.SheetNames).toEqual(["戶別金額統計"]);
    expect(restoredSheet.A1.v).toBe("每戶違規金額統計表");
    expect(restoredSheet.A6.v).toBe("A-1");
    expect(restoredSheet.G9.v).toBe(1000);
  });
});
