import { describe, expect, it } from "vitest";
import { buildHouseholdPenaltyStats } from "./db";

describe("buildHouseholdPenaltyStats", () => {
  it("依戶號自然排序並正確彙總案件數、應收、已繳與未繳金額", () => {
    const report = buildHouseholdPenaltyStats([
      { householdNo: "A-10", caseId: 3, penaltyAmount: 500, paymentAmount: 250 },
      { householdNo: "A-2", caseId: 1, penaltyAmount: 1200, paymentAmount: 1200 },
      { householdNo: "A-2", caseId: 2, penaltyAmount: 800, paymentAmount: null },
      { householdNo: "A-1", caseId: null, penaltyAmount: null, paymentAmount: null },
    ]);

    expect(report.summary).toEqual({
      householdCount: 3,
      totalCases: 3,
      totalAssessedAmount: 2500,
      totalPaidAmount: 1450,
      totalOutstandingAmount: 1050,
    });
    expect(report.rows).toEqual([
      {
        householdNo: "A-1",
        caseCount: 0,
        assessedAmount: 0,
        paidCases: 0,
        paidAmount: 0,
        outstandingCases: 0,
        outstandingAmount: 0,
      },
      {
        householdNo: "A-2",
        caseCount: 2,
        assessedAmount: 2000,
        paidCases: 1,
        paidAmount: 1200,
        outstandingCases: 1,
        outstandingAmount: 800,
      },
      {
        householdNo: "A-10",
        caseCount: 1,
        assessedAmount: 500,
        paidCases: 1,
        paidAmount: 250,
        outstandingCases: 1,
        outstandingAmount: 250,
      },
    ]);
  });

  it("在沒有戶別資料時回傳安全的零值摘要與空白列", () => {
    expect(buildHouseholdPenaltyStats([])).toEqual({
      summary: {
        householdCount: 0,
        totalCases: 0,
        totalAssessedAmount: 0,
        totalPaidAmount: 0,
        totalOutstandingAmount: 0,
      },
      rows: [],
    });
  });
});
