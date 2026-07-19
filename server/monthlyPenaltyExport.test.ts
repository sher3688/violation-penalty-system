import { describe, expect, it } from "vitest";
import {
  formatExportMonthTitle,
  getDefaultExportMonth,
  getMonthlyExportRange,
  getMonthlyPenaltyPdfFilename,
  isValidExportMonth,
  summarizeMonthlyPenalties,
} from "../shared/monthlyPenaltyExport";

describe("monthlyPenaltyExport", () => {
  it("以選定月份產生該月首日與末日的完整篩選範圍", () => {
    const range = getMonthlyExportRange("2024-02");

    expect(range.from.getFullYear()).toBe(2024);
    expect(range.from.getMonth()).toBe(1);
    expect(range.from.getDate()).toBe(1);
    expect(range.from.getHours()).toBe(0);
    expect(range.to.getFullYear()).toBe(2024);
    expect(range.to.getMonth()).toBe(1);
    expect(range.to.getDate()).toBe(29);
    expect(range.to.getHours()).toBe(23);
    expect(range.to.getMinutes()).toBe(59);
    expect(range.to.getSeconds()).toBe(59);
    expect(range.to.getMilliseconds()).toBe(999);
  });

  it("只接受 YYYY-MM 的有效月份，並拒絕不合法輸入", () => {
    expect(isValidExportMonth("2026-07")).toBe(true);
    expect(isValidExportMonth("2026-00")).toBe(false);
    expect(isValidExportMonth("2026-13")).toBe(false);
    expect(isValidExportMonth("2026-7")).toBe(false);
    expect(() => getMonthlyExportRange("2026-13")).toThrow("月份格式必須為 YYYY-MM。");
  });

  it("產生可讀的報表標題、檔名與預設月份", () => {
    expect(formatExportMonthTitle("2026-07")).toBe("2026 年 7 月罰單紀錄");
    expect(getMonthlyPenaltyPdfFilename("2026-07")).toBe("罰單紀錄_2026-07.pdf");
    expect(getDefaultExportMonth(new Date(2026, 6, 18))).toBe("2026-07");
  });

  it("正確彙整案件數、開立金額、已繳款與待處理筆數", () => {
    expect(
      summarizeMonthlyPenalties([
        { penaltyAmount: 500, status: "paid" },
        { penaltyAmount: 1200, status: "pending_payment" },
        { penaltyAmount: null, status: "appealing" },
        { penaltyAmount: -10, status: "closed" },
      ])
    ).toEqual({
      caseCount: 4,
      totalAmount: 1700,
      paidCount: 1,
      outstandingCount: 3,
    });
  });

  it("空白月份可產生零筆、零金額的安全統計", () => {
    expect(summarizeMonthlyPenalties([])).toEqual({
      caseCount: 0,
      totalAmount: 0,
      paidCount: 0,
      outstandingCount: 0,
    });
  });
});
