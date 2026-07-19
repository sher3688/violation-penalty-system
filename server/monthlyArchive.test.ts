import { describe, expect, it } from "vitest";
import {
  buildMonthlyPenaltyExcelRows,
  getMonthlyPenaltyExcelFilename,
} from "../shared/monthlyPenaltyExport";

describe("月份罰單封存匯出", () => {
  it("建立月份 Excel 檔名", () => {
    expect(getMonthlyPenaltyExcelFilename("2026-07")).toBe("罰單紀錄_2026-07.xlsx");
  });

  it("只使用傳入的有效案件建立 Excel 明細", () => {
    const rows = buildMonthlyPenaltyExcelRows("2026-07", [{
      noticeNo: "V20260701-ABC123",
      householdNo: "A-101",
      occurredAt: "2026-07-01T08:00:00.000Z",
      violationType: "違規停車",
      location: "地下室",
      description: "占用車道",
      penaltyAmount: 1200,
      status: "pending_payment",
      regulationBasis: "住戶規約",
      issuedAt: "2026-07-01T09:00:00.000Z",
    }], "2026/7/31 18:00:00");

    expect(rows[2]).toEqual(["罰單筆數", 1, "開立金額", 1200, "已繳款", 0, "待處理", 1]);
    expect(rows[5]?.[0]).toBe("V20260701-ABC123");
  });
});
