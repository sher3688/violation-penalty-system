import { describe, expect, it } from "vitest";
import { buildReportData, compareHouseholdNo } from "./db";

describe("buildReportData", () => {
  it("正確計算案件狀態、繳款率、戶別違規次數與月份趨勢", () => {
    const report = buildReportData([
      { householdNo: "A-101", status: "paid", occurredAt: new Date("2026-01-02T00:00:00.000Z") },
      { householdNo: "A-101", status: "pending_payment", occurredAt: new Date("2026-01-12T00:00:00.000Z") },
      { householdNo: "B-202", status: "paid", occurredAt: new Date("2026-02-05T00:00:00.000Z") },
      { householdNo: "C-303", status: "appealing", occurredAt: new Date("2026-02-16T00:00:00.000Z") },
      { householdNo: "B-202", status: "closed", occurredAt: new Date("2026-03-01T00:00:00.000Z") },
    ]);

    expect(report.summary).toEqual({
      totalCases: 5,
      paidCases: 2,
      pendingCases: 1,
      appealingCases: 1,
      closedCases: 1,
      paymentRate: 40,
    });
    expect(report.byHousehold).toEqual([
      { householdNo: "A-101", count: 2 },
      { householdNo: "B-202", count: 2 },
      { householdNo: "C-303", count: 1 },
    ]);
    expect(report.monthlyTrend).toEqual([
      { month: "2026-01", count: 2 },
      { month: "2026-02", count: 2 },
      { month: "2026-03", count: 1 },
    ]);
  });

  it("以自然排序排列戶號，避免雙位數戶號出現在單位數之前", () => {
    const households = ["A-10", "A-2", "A-1", "B-1"].sort(compareHouseholdNo);
    expect(households).toEqual(["A-1", "A-2", "A-10", "B-1"]);
  });

  it("在沒有案件時回傳零繳款率與空資料集", () => {
    expect(buildReportData([])).toEqual({
      summary: {
        totalCases: 0,
        paidCases: 0,
        pendingCases: 0,
        appealingCases: 0,
        closedCases: 0,
        paymentRate: 0,
      },
      byHousehold: [],
      monthlyTrend: [],
    });
  });
});
