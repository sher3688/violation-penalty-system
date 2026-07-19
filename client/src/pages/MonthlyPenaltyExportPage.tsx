import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatDate, getCaseStatusMeta } from "@/lib/caseUtils";
import { trpc } from "@/lib/trpc";
import {
  formatExportMonthTitle,
  getDefaultExportMonth,
  getMonthlyExportRange,
  getMonthlyPenaltyPdfFilename,
  getMonthlyPenaltyExcelFilename,
  buildMonthlyPenaltyExcelRows,
  summarizeMonthlyPenalties,
} from "@shared/monthlyPenaltyExport";
import { AlertCircle, Archive, ArrowLeft, Download, FileSpreadsheet, FileText, LoaderCircle, RefreshCw, Trash2 } from "lucide-react";
import { createElement, type ReactElement, useMemo, useState } from "react";
import type { DocumentProps } from "@react-pdf/renderer";
import { toast } from "sonner";
import { useLocation } from "wouter";

export default function MonthlyPenaltyExportPage() {
  const [, setLocation] = useLocation();
  const [month, setMonth] = useState(() => getDefaultExportMonth());
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [backupConfirmed, setBackupConfirmed] = useState(false);
  const [archiveGeneratedForMonth, setArchiveGeneratedForMonth] = useState<string | null>(null);
  const deleteMonth = trpc.cases.deleteMonth.useMutation();
  const range = useMemo(() => getMonthlyExportRange(month), [month]);
  const casesQuery = trpc.cases.list.useQuery(range);
  const cases = casesQuery.data ?? [];
  const summary = useMemo(() => summarizeMonthlyPenalties(cases), [cases]);

  const handleExportPdf = async () => {
    if (casesQuery.isLoading || casesQuery.isError || isExporting) return;

    setIsExporting(true);
    setExportError(null);
    try {
      const [{ pdf }, { MonthlyPenaltyPdfDocument, registerMonthlyPenaltyPdfFont }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("@/lib/monthlyPenaltyPdf"),
      ]);
      registerMonthlyPenaltyPdfFont();
      const fileName = getMonthlyPenaltyPdfFilename(month);
      const pdfDocument = createElement(MonthlyPenaltyPdfDocument, { month, cases, generatedAt: new Date() }) as unknown as ReactElement<DocumentProps>;
      const blob = await pdf(pdfDocument).toBlob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName;
      anchor.style.display = "none";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
      toast.success("PDF 已開始下載。", { description: `${fileName}，共 ${cases.length} 筆罰單紀錄。` });
    } catch (error) {
      const message = error instanceof Error ? error.message : "PDF 產生失敗，請稍後再試。";
      setExportError(message);
      toast.error("PDF 產生失敗。", { description: message });
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportExcel = async () => {
    if (casesQuery.isLoading || casesQuery.isError || isExporting) return;
    setIsExporting(true);
    setExportError(null);
    try {
      const XLSX = await import("xlsx");
      const rows = buildMonthlyPenaltyExcelRows(month, cases, new Date().toLocaleString("zh-TW"));
      const worksheet = XLSX.utils.aoa_to_sheet(rows);
      worksheet["!cols"] = [
        { wch: 22 }, { wch: 12 }, { wch: 14 }, { wch: 18 }, { wch: 24 },
        { wch: 42 }, { wch: 12 }, { wch: 14 }, { wch: 24 }, { wch: 14 },
      ];
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "月份罰單");
      XLSX.writeFile(workbook, getMonthlyPenaltyExcelFilename(month));
      toast.success("Excel 已開始下載。", { description: `${month}，共 ${cases.length} 筆有效罰單。` });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Excel 產生失敗，請稍後再試。";
      setExportError(message);
      toast.error("Excel 產生失敗。", { description: message });
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadArchive = async () => {
    if (casesQuery.isLoading || casesQuery.isError || isExporting) return;
    setIsExporting(true);
    setExportError(null);
    try {
      const [{ pdf }, { MonthlyPenaltyPdfDocument, registerMonthlyPenaltyPdfFont }, XLSX, JSZipModule] = await Promise.all([
        import("@react-pdf/renderer"),
        import("@/lib/monthlyPenaltyPdf"),
        import("xlsx"),
        import("jszip"),
      ]);
      registerMonthlyPenaltyPdfFont();
      const generatedAt = new Date();
      const pdfDocument = createElement(MonthlyPenaltyPdfDocument, { month, cases, generatedAt }) as unknown as ReactElement<DocumentProps>;
      const pdfBlob = await pdf(pdfDocument).toBlob();

      const rows = buildMonthlyPenaltyExcelRows(month, cases, generatedAt.toLocaleString("zh-TW"));
      const worksheet = XLSX.utils.aoa_to_sheet(rows);
      worksheet["!cols"] = [
        { wch: 22 }, { wch: 12 }, { wch: 14 }, { wch: 18 }, { wch: 24 },
        { wch: 42 }, { wch: 12 }, { wch: 14 }, { wch: 24 }, { wch: 14 },
      ];
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "月份罰單");
      const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });

      const JSZip = JSZipModule.default;
      const zip = new JSZip();
      zip.file(getMonthlyPenaltyPdfFilename(month), pdfBlob);
      zip.file(getMonthlyPenaltyExcelFilename(month), excelBuffer);
      zip.file(`${month}_封存說明.json`, JSON.stringify({
        module: "violation-penalty",
        month,
        generatedAt: generatedAt.toISOString(),
        caseCount: summary.caseCount,
        totalAmount: summary.totalAmount,
        paidCount: summary.paidCount,
        outstandingCount: summary.outstandingCount,
        noticeNumbers: cases.map(item => item.noticeNo),
      }, null, 2));
      const zipBlob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
      const url = URL.createObjectURL(zipBlob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${month}_違規罰單封存.zip`;
      anchor.style.display = "none";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
      setArchiveGeneratedForMonth(month);
      setBackupConfirmed(false);
      toast.success("月份封存 ZIP 已開始下載。", { description: `內含 PDF、Excel 與封存說明，共 ${cases.length} 筆有效罰單。` });
    } catch (error) {
      const message = error instanceof Error ? error.message : "封存檔產生失敗，請稍後再試。";
      setExportError(message);
      toast.error("封存 ZIP 產生失敗。", { description: message });
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteMonth = async () => {
    if (!backupConfirmed || archiveGeneratedForMonth !== month || cases.length === 0 || deleteMonth.isPending) return;
    const confirmed = window.confirm(`確定永久刪除 ${month} 的 ${cases.length} 筆罰單嗎？\n\n此動作會同步刪除照片與關聯資料，無法復原。`);
    if (!confirmed) return;
    try {
      const result = await deleteMonth.mutateAsync({ ...range, confirmation: "DELETE_MONTH" });
      setBackupConfirmed(false);
      setArchiveGeneratedForMonth(null);
      await casesQuery.refetch();
      toast.success("月份資料已清除。", { description: `已刪除 ${result.deletedCount} 筆罰單及其照片資料。` });
    } catch (error) {
      toast.error("月份資料清除失敗。", { description: error instanceof Error ? error.message : "請稍後再試。" });
    }
  };

  return (
    <div className="min-h-screen bg-slate-200 px-4 py-7 text-slate-950 md:px-8">
      <div className="mx-auto mb-5 flex w-[210mm] max-w-full flex-wrap items-end justify-between gap-4">
        <div>
          <Button variant="outline" className="bg-white" onClick={() => setLocation("/cases")}>
            <ArrowLeft className="mr-2 h-4 w-4" />返回案件管理
          </Button>
          <p className="mt-3 text-sm text-slate-600">選定月份後，可一次匯出該月全部罰單 PDF 作為備份。</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1.5 text-sm font-medium text-slate-700">
            匯出月份
            <input
              type="month"
              value={month}
              onChange={event => {
                setMonth(event.target.value || getDefaultExportMonth());
                setBackupConfirmed(false);
                setArchiveGeneratedForMonth(null);
              }}
              className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm shadow-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-slate-500"
            />
          </label>
          <Button variant="outline" className="bg-white" onClick={() => void handleExportExcel()} disabled={casesQuery.isLoading || casesQuery.isError || isExporting}>
            <FileSpreadsheet className="mr-2 h-4 w-4" />下載 Excel
          </Button>
          <Button variant="outline" className="bg-white" onClick={() => void handleDownloadArchive()} disabled={casesQuery.isLoading || casesQuery.isError || isExporting}>
            <Archive className="mr-2 h-4 w-4" />下載封存 ZIP
          </Button>
          <Button className="bg-[#14332f] text-white hover:bg-[#0c2723]" onClick={() => void handleExportPdf()} disabled={casesQuery.isLoading || casesQuery.isError || isExporting}>
            {isExporting ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            {isExporting ? "產生檔案…" : "批次匯出 PDF"}
          </Button>
        </div>
      </div>

      {exportError && <div className="mx-auto mb-5 flex w-[210mm] max-w-full items-start gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><p>PDF 產生失敗：{exportError}</p></div>}

      <section className="mx-auto mb-5 w-[210mm] max-w-full rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-bold">月份封存與雲端清理</h2>
            <p className="mt-1 text-amber-800">請先下載「封存 ZIP」（內含 PDF、Excel 與封存說明），確認已保存到管理室電腦後，才可永久刪除雲端資料。</p>
            <p className="mt-2 font-medium">封存狀態：{archiveGeneratedForMonth === month ? "✓ 本月封存 ZIP 已產生" : "尚未產生本月封存 ZIP"}</p>
            <label className="mt-3 flex cursor-pointer items-center gap-2 font-medium">
              <input type="checkbox" checked={backupConfirmed} disabled={archiveGeneratedForMonth !== month} onChange={event => setBackupConfirmed(event.target.checked)} />
              我已確認封存 ZIP 已下載、可正常開啟並妥善備份
            </label>
          </div>
          <Button variant="destructive" onClick={() => void handleDeleteMonth()} disabled={!backupConfirmed || archiveGeneratedForMonth !== month || cases.length === 0 || deleteMonth.isPending}>
            {deleteMonth.isPending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
            {deleteMonth.isPending ? "清除中…" : `刪除 ${month} 雲端資料`}
          </Button>
        </div>
      </section>

      <article className="mx-auto min-h-[297mm] w-[210mm] max-w-full bg-white px-[12mm] py-[12mm] shadow-2xl shadow-slate-500/20" aria-label={`${formatExportMonthTitle(month)} PDF 預覽`}>
        <header className="border-b-2 border-[#14332f] pb-5">
          <div className="flex items-start justify-between gap-6">
            <div>
              <div className="mb-2 flex items-center gap-2 text-[10pt] font-semibold tracking-[0.14em] text-emerald-800"><FileText className="h-4 w-4" /> COMMUNITY OFFICE</div>
              <h1 className="text-[22pt] font-bold tracking-[0.04em] text-slate-950">{formatExportMonthTitle(month)}</h1>
              <p className="mt-2 text-[10.5pt] text-slate-600">社區違規開罰管理系統｜依違規日期彙整</p>
            </div>
            <div className="shrink-0 text-right text-[10pt] leading-6 text-slate-600">
              <p>匯出日期：{formatDate(new Date())}</p>
              <p>報表月份：{month}</p>
            </div>
          </div>
        </header>

        <section className="mt-6 grid grid-cols-4 divide-x divide-slate-200 rounded-lg border border-slate-200 bg-slate-50" aria-label="本月罰單統計">
          <SummaryItem label="罰單筆數" value={`${summary.caseCount} 筆`} />
          <SummaryItem label="開立金額" value={formatCurrency(summary.totalAmount)} />
          <SummaryItem label="已繳款" value={`${summary.paidCount} 筆`} />
          <SummaryItem label="待處理" value={`${summary.outstandingCount} 筆`} />
        </section>

        <section className="mt-7">
          <div className="mb-3 flex items-center justify-between gap-4">
            <h2 className="text-[14pt] font-bold text-slate-900">罰單明細</h2>
            <span className="text-[10pt] text-slate-500">共 {cases.length} 筆</span>
          </div>

          {casesQuery.isLoading ? (
            <div className="space-y-3"><Skeleton className="h-12 w-full" />{Array.from({ length: 7 }).map((_, index) => <Skeleton key={index} className="h-14 w-full" />)}</div>
          ) : casesQuery.isError ? (
            <Card className="border-rose-200 bg-rose-50 shadow-none"><CardContent className="py-16 text-center"><AlertCircle className="mx-auto h-9 w-9 text-rose-400" /><p className="mt-3 font-medium text-rose-900">無法讀取本月罰單紀錄</p><p className="mt-1 text-sm text-rose-700">{casesQuery.error.message}</p><Button variant="outline" className="mt-5 bg-white" onClick={() => void casesQuery.refetch()}><RefreshCw className="mr-2 h-4 w-4" />重新讀取</Button></CardContent></Card>
          ) : cases.length === 0 ? (
            <Card className="border-dashed border-slate-300 shadow-none"><CardContent className="py-16 text-center"><FileText className="mx-auto h-9 w-9 text-slate-300" /><p className="mt-3 font-medium text-slate-700">本月沒有已開立的罰單紀錄</p><p className="mt-1 text-sm text-slate-500">仍可下載包含零筆統計與月份資訊的 PDF。</p></CardContent></Card>
          ) : (
            <div className="overflow-hidden rounded-lg border border-slate-300">
              <table className="w-full table-fixed border-collapse text-left text-[10pt] text-slate-700">
                <thead className="bg-[#14332f] text-white">
                  <tr>
                    <th className="w-[17%] px-3 py-3 font-semibold">通知單</th>
                    <th className="w-[11%] px-3 py-3 font-semibold">戶號</th>
                    <th className="w-[15%] px-3 py-3 font-semibold">違規日期</th>
                    <th className="w-[32%] px-3 py-3 font-semibold">違規類型／地點</th>
                    <th className="w-[13%] px-3 py-3 text-right font-semibold">金額</th>
                    <th className="w-[12%] px-3 py-3 font-semibold">狀態</th>
                  </tr>
                </thead>
                <tbody>
                  {cases.map(violationCase => {
                    const statusMeta = getCaseStatusMeta(violationCase.status);
                    return (
                      <tr key={violationCase.id} className="border-t border-slate-200 align-top">
                        <td className="break-all px-3 py-3 font-mono text-[9pt] font-medium">{violationCase.noticeNo}</td>
                        <td className="px-3 py-3 font-semibold">{violationCase.householdNo}</td>
                        <td className="px-3 py-3 whitespace-nowrap">{formatDate(violationCase.occurredAt)}</td>
                        <td className="px-3 py-3"><p className="font-medium text-slate-900">{violationCase.violationType}</p><p className="mt-1 text-[9pt] text-slate-500">{violationCase.location}</p></td>
                        <td className="px-3 py-3 text-right font-semibold whitespace-nowrap">{formatCurrency(violationCase.penaltyAmount)}</td>
                        <td className="px-3 py-3">{statusMeta.label}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <footer className="mt-8 flex items-center justify-between border-t border-slate-300 pt-4 text-[9.5pt] text-slate-500">
          <span>本報表為系統依違規日期自動彙整。</span>
          <span>罰單紀錄 {month}</span>
        </footer>
      </article>

      <p className="mx-auto mt-4 w-[210mm] max-w-full text-center text-sm text-slate-600"><Download className="mr-1 inline h-4 w-4" />檔案會以「{getMonthlyPenaltyPdfFilename(month)}」直接下載。</p>
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-4 py-4 text-center">
      <p className="text-[9.5pt] text-slate-500">{label}</p>
      <p className="mt-1 text-[15pt] font-bold text-slate-900">{value}</p>
    </div>
  );
}
