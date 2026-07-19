export type MonthlyPenaltySummaryRecord = {
  penaltyAmount: number | null | undefined;
  status: string;
};

const monthPattern = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function isValidExportMonth(value: string | null | undefined): value is string {
  return typeof value === "string" && monthPattern.test(value);
}

export function getDefaultExportMonth(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function getMonthlyExportRange(month: string) {
  if (!isValidExportMonth(month)) {
    throw new Error("月份格式必須為 YYYY-MM。");
  }

  const [yearText, monthText] = month.split("-");
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;

  return {
    from: new Date(year, monthIndex, 1, 0, 0, 0, 0),
    to: new Date(year, monthIndex + 1, 0, 23, 59, 59, 999),
  };
}

export function formatExportMonthTitle(month: string) {
  if (!isValidExportMonth(month)) return "每月罰單紀錄";
  const [year, monthNumber] = month.split("-");
  return `${year} 年 ${Number(monthNumber)} 月罰單紀錄`;
}

export function getMonthlyPenaltyPdfFilename(month: string) {
  return `罰單紀錄_${isValidExportMonth(month) ? month : "未指定月份"}.pdf`;
}

export function summarizeMonthlyPenalties(records: MonthlyPenaltySummaryRecord[]) {
  const totalAmount = records.reduce((sum, record) => sum + Math.max(0, Math.trunc(record.penaltyAmount ?? 0)), 0);
  const paidCount = records.filter(record => record.status === "paid").length;

  return {
    caseCount: records.length,
    totalAmount,
    paidCount,
    outstandingCount: records.length - paidCount,
  };
}

export type MonthlyPenaltyExcelRecord = MonthlyPenaltySummaryRecord & {
  noticeNo: string;
  householdNo: string;
  occurredAt: Date | string;
  violationType: string;
  location: string;
  description: string;
  regulationBasis: string;
  issuedAt: Date | string;
};

function formatExcelDate(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("zh-TW");
}

export function getMonthlyPenaltyExcelFilename(month: string) {
  return `罰單紀錄_${isValidExportMonth(month) ? month : "未指定月份"}.xlsx`;
}

export function buildMonthlyPenaltyExcelRows(month: string, records: MonthlyPenaltyExcelRecord[], generatedAt: string) {
  const summary = summarizeMonthlyPenalties(records);
  return [
    [formatExportMonthTitle(month)],
    ["匯出時間", generatedAt],
    ["罰單筆數", summary.caseCount, "開立金額", summary.totalAmount, "已繳款", summary.paidCount, "待處理", summary.outstandingCount],
    [],
    ["通知單號", "戶號", "違規日期", "違規類型", "地點", "違規說明", "裁罰金額", "狀態", "法規依據", "開立日期"],
    ...records.map(record => [
      record.noticeNo,
      record.householdNo,
      formatExcelDate(record.occurredAt),
      record.violationType,
      record.location,
      record.description,
      Math.max(0, Math.trunc(record.penaltyAmount ?? 0)),
      record.status,
      record.regulationBasis,
      formatExcelDate(record.issuedAt),
    ]),
  ];
}
