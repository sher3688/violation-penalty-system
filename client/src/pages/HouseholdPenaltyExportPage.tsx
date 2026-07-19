import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { buildHouseholdPenaltyExcelRows, formatHouseholdPenaltyPeriod, getHouseholdPenaltyExportFilename } from "../../../shared/householdPenaltyExport";
import { AlertCircle, CalendarDays, CircleDollarSign, Download, FileSpreadsheet, Landmark, RefreshCcw, UsersRound } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const currencyFormatter = new Intl.NumberFormat("zh-TW", {
  style: "currency",
  currency: "TWD",
  maximumFractionDigits: 0,
});

function formatCurrency(value: number) {
  return currencyFormatter.format(value);
}

export default function HouseholdPenaltyExportPage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const input = useMemo(
    () => ({
      from: from ? new Date(`${from}T00:00:00`) : undefined,
      to: to ? new Date(`${to}T23:59:59`) : undefined,
    }),
    [from, to]
  );
  const reportQuery = trpc.reports.householdPenaltyStats.useQuery(input);
  const report = reportQuery.data;

  const exportWorkbook = async () => {
    setIsExporting(true);
    try {
      // 匯出前強制向伺服器重新讀取，避免刪除案件後仍使用 React Query 快取中的舊統計。
      const refreshed = await reportQuery.refetch();
      const freshReport = refreshed.data;
      if (!freshReport) throw new Error("無法取得最新統計資料。");
      const XLSX = await import("xlsx");
      const periodLabel = formatHouseholdPenaltyPeriod(from, to);
      const rows = buildHouseholdPenaltyExcelRows(freshReport, periodLabel, new Date().toLocaleString("zh-TW"));
      const worksheet = XLSX.utils.aoa_to_sheet(rows);
      worksheet["!cols"] = [
        { wch: 15 },
        { wch: 14 },
        { wch: 18 },
        { wch: 14 },
        { wch: 18 },
        { wch: 14 },
        { wch: 18 },
      ];
      worksheet["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }];
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "戶別金額統計");
      XLSX.writeFile(workbook, getHouseholdPenaltyExportFilename(from, to));
      toast.success("Excel 統計表已開始下載。", { description: `${periodLabel} · ${freshReport.summary.householdCount} 戶` });
    } catch (error) {
      console.error("[Household penalty export] Excel 產製失敗", error);
      toast.error("Excel 匯出失敗，請稍後再試。", { description: "請確認瀏覽器允許下載檔案。" });
    } finally {
      setIsExporting(false);
    }
  };

  const summaryCards = report
    ? [
        { label: "納入戶數", value: `${report.summary.householdCount} 戶`, detail: "包含零違規戶別", icon: UsersRound, tone: "bg-emerald-50 text-emerald-700" },
        { label: "應收總額", value: formatCurrency(report.summary.totalAssessedAmount), detail: `${report.summary.totalCases} 筆違規案件`, icon: Landmark, tone: "bg-sky-50 text-sky-700" },
        { label: "已繳總額", value: formatCurrency(report.summary.totalPaidAmount), detail: "依實際登錄繳款金額統計", icon: CircleDollarSign, tone: "bg-emerald-50 text-emerald-700" },
        { label: "未繳總額", value: formatCurrency(report.summary.totalOutstandingAmount), detail: "應收金額扣除已繳金額", icon: AlertCircle, tone: "bg-amber-50 text-amber-700" },
      ]
    : [];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-[0.14em] text-emerald-700">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> FINANCIAL EXPORT
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">每戶違規金額統計</h2>
          <p className="mt-1 text-sm text-slate-600">依發生日期彙整各戶違規案件、應收、已繳與未繳金額，可直接下載 Excel。</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
          <CalendarDays className="ml-1 h-4 w-4 text-slate-500" />
          <Input className="h-8 w-[145px] border-0 px-2 shadow-none focus-visible:ring-0" type="date" value={from} onChange={event => setFrom(event.target.value)} aria-label="統計開始日期" />
          <span className="text-xs text-slate-400">至</span>
          <Input className="h-8 w-[145px] border-0 px-2 shadow-none focus-visible:ring-0" type="date" value={to} onChange={event => setTo(event.target.value)} aria-label="統計結束日期" />
          {(from || to) && <Button variant="ghost" size="sm" onClick={() => { setFrom(""); setTo(""); }}><RefreshCcw className="mr-1.5 h-3.5 w-3.5" />清除</Button>}
        </div>
      </div>

      {reportQuery.isError ? (
        <Card className="border-rose-200 bg-rose-50 shadow-sm">
          <CardContent className="flex items-start gap-3 p-5 text-rose-800"><AlertCircle className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="font-semibold">無法讀取戶別金額統計</p><p className="mt-1 text-sm">請重新整理頁面；若問題持續，請確認管理員帳號權限。</p></div></CardContent>
        </Card>
      ) : reportQuery.isLoading || !report ? (
        <><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }).map((_, index) => <Skeleton className="h-32" key={index} />)}</div><Skeleton className="h-[360px]" /></>
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {summaryCards.map(item => <Card key={item.label} className="border-slate-200 shadow-sm"><CardContent className="flex items-start justify-between p-5"><div><p className="text-sm font-medium text-slate-500">{item.label}</p><p className="mt-3 text-2xl font-bold tracking-tight text-slate-900">{item.value}</p><p className="mt-2 text-xs text-slate-500">{item.detail}</p></div><div className={`flex h-10 w-10 items-center justify-center rounded-xl ${item.tone}`}><item.icon className="h-5 w-5" /></div></CardContent></Card>)}
          </section>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4 border-b border-slate-100">
              <div>
                <CardTitle className="flex items-center gap-2 text-base"><FileSpreadsheet className="h-4 w-4 text-emerald-700" />戶別金額明細</CardTitle>
                <CardDescription className="mt-1">統計區間：{formatHouseholdPenaltyPeriod(from, to)}。Excel 會保留同一組金額欄位與合計列。</CardDescription>
              </div>
              <Button onClick={() => void exportWorkbook()} disabled={isExporting} className="bg-emerald-700 text-white hover:bg-emerald-800">
                <Download className="mr-2 h-4 w-4" />{isExporting ? "正在建立 Excel…" : "匯出 Excel"}
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {report.rows.length === 0 ? (
                <div className="flex min-h-56 flex-col items-center justify-center px-6 text-center"><FileSpreadsheet className="h-9 w-9 text-slate-300" /><p className="mt-3 font-medium text-slate-700">此統計區間沒有可列出的住戶資料</p><p className="mt-1 text-sm text-slate-500">仍可匯出含統計期間與零值合計的 Excel 檔案。</p></div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px] text-sm">
                    <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-600"><tr><th className="px-5 py-3">戶號</th><th className="px-4 py-3 text-right">案件數</th><th className="px-4 py-3 text-right">應收金額</th><th className="px-4 py-3 text-right">已繳案件</th><th className="px-4 py-3 text-right">已繳金額</th><th className="px-4 py-3 text-right">未繳案件</th><th className="px-5 py-3 text-right">未繳金額</th></tr></thead>
                    <tbody className="divide-y divide-slate-100">{report.rows.map(row => <tr key={row.householdNo} className="hover:bg-slate-50/80"><td className="px-5 py-3.5 font-semibold text-slate-800">{row.householdNo}</td><td className="px-4 py-3.5 text-right text-slate-600">{row.caseCount}</td><td className="px-4 py-3.5 text-right font-medium text-slate-800">{formatCurrency(row.assessedAmount)}</td><td className="px-4 py-3.5 text-right text-emerald-700">{row.paidCases}</td><td className="px-4 py-3.5 text-right text-emerald-700">{formatCurrency(row.paidAmount)}</td><td className="px-4 py-3.5 text-right text-amber-700">{row.outstandingCases}</td><td className="px-5 py-3.5 text-right font-semibold text-amber-700">{formatCurrency(row.outstandingAmount)}</td></tr>)}</tbody>
                    <tfoot className="border-t-2 border-slate-200 bg-slate-50 font-semibold text-slate-800"><tr><td className="px-5 py-3.5">合計</td><td className="px-4 py-3.5 text-right">{report.summary.totalCases}</td><td className="px-4 py-3.5 text-right">{formatCurrency(report.summary.totalAssessedAmount)}</td><td className="px-4 py-3.5 text-right">{report.rows.reduce((sum, row) => sum + row.paidCases, 0)}</td><td className="px-4 py-3.5 text-right text-emerald-700">{formatCurrency(report.summary.totalPaidAmount)}</td><td className="px-4 py-3.5 text-right">{report.rows.reduce((sum, row) => sum + row.outstandingCases, 0)}</td><td className="px-5 py-3.5 text-right text-amber-700">{formatCurrency(report.summary.totalOutstandingAmount)}</td></tr></tfoot>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
