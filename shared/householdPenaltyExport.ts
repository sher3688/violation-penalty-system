export type HouseholdPenaltyExportRow = {
  householdNo: string;
  caseCount: number;
  assessedAmount: number;
  paidCases: number;
  paidAmount: number;
  outstandingCases: number;
  outstandingAmount: number;
};

export type HouseholdPenaltyExportReport = {
  summary: {
    householdCount: number;
    totalCases: number;
    totalAssessedAmount: number;
    totalPaidAmount: number;
    totalOutstandingAmount: number;
  };
  rows: HouseholdPenaltyExportRow[];
};

export function formatHouseholdPenaltyPeriod(from?: string, to?: string) {
  if (from && to) return `${from} 至 ${to}`;
  if (from) return `${from} 起`;
  if (to) return `${to} 以前`;
  return "全部期間";
}

export function getHouseholdPenaltyExportFilename(from?: string, to?: string) {
  const suffix = from || to ? `${from || "起始"}_${to || "最新"}` : "全部期間";
  return `每戶違規金額統計_${suffix}.xlsx`;
}

export function buildHouseholdPenaltyExcelRows(
  report: HouseholdPenaltyExportReport,
  periodLabel: string,
  exportedAt: string
): Array<Array<string | number>> {
  const paidCases = report.rows.reduce((sum, row) => sum + row.paidCases, 0);
  const outstandingCases = report.rows.reduce((sum, row) => sum + row.outstandingCases, 0);

  return [
    ["每戶違規金額統計表"],
    ["統計區間", periodLabel],
    ["匯出時間", exportedAt],
    [],
    ["戶號", "違規案件數", "應收金額（元）", "已繳案件數", "已繳金額（元）", "未繳案件數", "未繳金額（元）"],
    ...report.rows.map(row => [
      row.householdNo,
      row.caseCount,
      row.assessedAmount,
      row.paidCases,
      row.paidAmount,
      row.outstandingCases,
      row.outstandingAmount,
    ]),
    [],
    [
      "合計",
      report.summary.totalCases,
      report.summary.totalAssessedAmount,
      paidCases,
      report.summary.totalPaidAmount,
      outstandingCases,
      report.summary.totalOutstandingAmount,
    ],
  ];
}
