import { useAuth } from "@/_core/hooks/useAuth";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatDateTime, getCaseStatusMeta } from "@/lib/caseUtils";
import { trpc } from "@/lib/trpc";
import { FileDown, FilePlus2, FilterX, Pencil, Printer, Search, SlidersHorizontal, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

const statuses = [
  ["all", "全部狀態"],
  ["pending_payment", "待繳款"],
  ["paid", "已繳款"],
  ["appealing", "申訴中"],
  ["closed", "結案"],
] as const;

export default function CasesPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const isAdmin = user?.role === "admin";
  const [keyword, setKeyword] = useState("");
  const [householdNo, setHouseholdNo] = useState("");
  const [status, setStatus] = useState<(typeof statuses)[number][0]>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const queryInput = useMemo(
    () => ({
      keyword: keyword || undefined,
      householdNo: householdNo || undefined,
      status: status === "all" ? undefined : status,
      from: from ? new Date(`${from}T00:00:00`) : undefined,
      to: to ? new Date(`${to}T23:59:59`) : undefined,
    }),
    [from, householdNo, keyword, status, to]
  );
  const casesQuery = trpc.cases.list.useQuery(queryInput);
  const cases = casesQuery.data ?? [];
  const utils = trpc.useUtils();
  const deleteCase = trpc.cases.delete.useMutation();
  const [casePendingDeletion, setCasePendingDeletion] = useState<{ id: number; noticeNo: string; householdNo: string } | null>(null);

  const resetFilters = () => {
    setKeyword("");
    setHouseholdNo("");
    setStatus("all");
    setFrom("");
    setTo("");
  };

  const hasFilters = Boolean(keyword || householdNo || status !== "all" || from || to);

  const onDeleteCase = async () => {
    if (!casePendingDeletion) return;
    try {
      await deleteCase.mutateAsync({ caseId: casePendingDeletion.id });
      await Promise.all([utils.cases.list.invalidate(), utils.reports.summary.invalidate(), utils.reports.householdPenaltyStats.invalidate()]);
      toast.success("案件已刪除。", { description: `通知單 ${casePendingDeletion.noticeNo} 及其關聯資料已清理。` });
      setCasePendingDeletion(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "案件刪除失敗，請稍後再試。");
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-[0.14em] text-emerald-700"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> CASE REGISTER</div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">{isAdmin ? "案件管理" : "我的違規案件"}</h2>
          <p className="mt-1 text-sm text-slate-600">{isAdmin ? "查看、篩選與追蹤所有已開立的違規案件。" : "僅顯示與您綁定戶號相關的案件與處理進度。"}</p>
        </div>
        {isAdmin && <div className="flex flex-wrap items-center gap-2"><Button variant="outline" className="bg-white" onClick={() => setLocation("/monthly-penalties/export")}><FileDown className="mr-2 h-4 w-4" />每月罰單 PDF</Button><Button className="bg-[#14332f] text-white hover:bg-[#0c2723]" onClick={() => setLocation("/cases/new")}><FilePlus2 className="mr-2 h-4 w-4" />新增開罰</Button></div>}
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardContent className="pt-6">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.3fr_.7fr_.7fr_.7fr_.7fr_auto]">
            <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input className="pl-9" value={keyword} onChange={event => setKeyword(event.target.value)} placeholder="搜尋單號、類型、地點或描述" /></div>
            {isAdmin && <Input value={householdNo} onChange={event => setHouseholdNo(event.target.value)} placeholder="戶號" />}
            <Select value={status} onValueChange={value => setStatus(value as typeof status)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{statuses.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select>
            <Input type="date" value={from} onChange={event => setFrom(event.target.value)} aria-label="開始日期" />
            <Input type="date" value={to} onChange={event => setTo(event.target.value)} aria-label="結束日期" />
            {hasFilters ? <Button variant="outline" className="bg-white" onClick={resetFilters}><FilterX className="mr-2 h-4 w-4" />清除</Button> : <div className="flex items-center justify-center gap-2 text-xs text-slate-500"><SlidersHorizontal className="h-4 w-4" />篩選案件</div>}
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-slate-200 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 py-4"><CardTitle className="text-base">案件清單 <span className="ml-1 text-sm font-normal text-slate-500">共 {cases.length} 筆</span></CardTitle></CardHeader>
        <CardContent className="p-0">
          {casesQuery.isLoading ? <div className="space-y-3 p-5">{Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-16 w-full" />)}</div> : cases.length === 0 ? <div className="px-6 py-16 text-center"><Search className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-3 font-medium text-slate-700">目前沒有符合條件的案件</p><p className="mt-1 text-sm text-slate-500">{isAdmin ? "可調整篩選條件，或建立第一筆違規案件。" : "目前未查到與您的戶號相關的違規案件。"}</p></div> : <div className="overflow-x-auto"><table className="w-full min-w-[880px] text-left"><thead className="bg-slate-50 text-xs font-semibold tracking-wider text-slate-500"><tr><th className="px-5 py-3">通知單</th><th className="px-5 py-3">戶號</th><th className="px-5 py-3">違規類型／地點</th><th className="px-5 py-3">違規時間</th><th className="px-5 py-3">金額</th><th className="px-5 py-3">狀態</th><th className="px-5 py-3 text-right">操作</th></tr></thead><tbody className="divide-y divide-slate-100">{cases.map(violationCase => { const meta = getCaseStatusMeta(violationCase.status); return <tr key={violationCase.id} className="transition hover:bg-slate-50/70"><td className="px-5 py-4 font-mono text-xs font-medium text-slate-700">{violationCase.noticeNo}</td><td className="px-5 py-4 text-sm font-semibold text-slate-800">{violationCase.householdNo}</td><td className="max-w-[250px] px-5 py-4"><p className="truncate text-sm font-medium text-slate-800">{violationCase.violationType}</p><p className="mt-1 truncate text-xs text-slate-500">{violationCase.location}</p></td><td className="px-5 py-4 text-sm text-slate-600">{formatDateTime(violationCase.occurredAt)}</td><td className="px-5 py-4 text-sm font-medium text-slate-700">{formatCurrency(violationCase.penaltyAmount)}</td><td className="px-5 py-4"><Badge variant="outline" className={meta.className}>{meta.label}</Badge></td><td className="px-5 py-4"><div className="flex justify-end gap-1"><Button size="sm" variant="ghost" onClick={() => setLocation(`/cases/${violationCase.id}`)}>{isAdmin ? "詳情" : "查看／申訴"}</Button>{isAdmin && <Button size="sm" variant="ghost" className="text-emerald-800 hover:text-emerald-950" onClick={() => setLocation(`/cases/${violationCase.id}/edit`)}><Pencil className="mr-1.5 h-3.5 w-3.5" />修改</Button>}{isAdmin && <Button size="sm" variant="ghost" className="text-rose-700 hover:bg-rose-50 hover:text-rose-800" onClick={() => setCasePendingDeletion({ id: violationCase.id, noticeNo: violationCase.noticeNo, householdNo: violationCase.householdNo })}><Trash2 className="mr-1.5 h-3.5 w-3.5" />刪除</Button>}<Button size="icon" variant="ghost" className="h-8 w-8" aria-label="列印通知單" onClick={() => setLocation(`/print/${violationCase.id}`)}><Printer className="h-4 w-4" /></Button></div></td></tr>; })}</tbody></table></div>}
        </CardContent>
      </Card>

      <AlertDialog open={Boolean(casePendingDeletion)} onOpenChange={open => { if (!open && !deleteCase.isPending) setCasePendingDeletion(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>刪除案件？</AlertDialogTitle>
            <AlertDialogDescription>
              {casePendingDeletion ? <>通知單「{casePendingDeletion.noticeNo}」與戶號「{casePendingDeletion.householdNo}」的案件將被永久刪除。關聯照片、繳款與申訴紀錄也會一併清理，且無法復原。</> : "此動作無法復原。"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteCase.isPending}>取消</AlertDialogCancel>
            <AlertDialogAction className="bg-rose-700 text-white hover:bg-rose-800" disabled={deleteCase.isPending} onClick={() => void onDeleteCase()}>
              {deleteCase.isPending ? "刪除中…" : "確認刪除案件"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
