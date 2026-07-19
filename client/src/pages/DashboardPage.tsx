import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatDateTime, getCaseStatusMeta } from "@/lib/caseUtils";
import { trpc } from "@/lib/trpc";
import { AlertCircle, ArrowRight, BadgeDollarSign, BarChart3, CheckCircle2, FileDown, FilePlus2, FileText, Gavel, TrendingUp } from "lucide-react";
import { useLocation } from "wouter";

export default function DashboardPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const isAdmin = user?.role === "admin";
  const casesQuery = trpc.cases.list.useQuery(undefined, { refetchOnWindowFocus: false });
  const reportsQuery = trpc.reports.summary.useQuery(undefined, { enabled: isAdmin, refetchOnWindowFocus: false });
  const cases = casesQuery.data ?? [];
  const report = reportsQuery.data;
  const residentSummary = {
    totalCases: cases.length,
    paidCases: cases.filter(item => item.status === "paid").length,
    pendingCases: cases.filter(item => item.status === "pending_payment").length,
    appealingCases: cases.filter(item => item.status === "appealing").length,
  };
  const summary = isAdmin && report ? report.summary : residentSummary;

  const cards = isAdmin
    ? [
        { label: "本期案件", value: summary.totalCases, detail: "所有登錄案件", icon: FileText, tone: "bg-emerald-50 text-emerald-700" },
        { label: "待繳款", value: summary.pendingCases, detail: "尚待確認收款", icon: BadgeDollarSign, tone: "bg-amber-50 text-amber-700" },
        { label: "申訴中", value: summary.appealingCases, detail: "需進行審核", icon: Gavel, tone: "bg-sky-50 text-sky-700" },
        { label: "繳款率", value: `${report?.summary.paymentRate ?? 0}%`, detail: "以已繳款案件計算", icon: TrendingUp, tone: "bg-violet-50 text-violet-700" },
      ]
    : [
        { label: "我的案件", value: summary.totalCases, detail: "與您戶號相關", icon: FileText, tone: "bg-emerald-50 text-emerald-700" },
        { label: "待繳款", value: summary.pendingCases, detail: "請留意管理單位通知", icon: BadgeDollarSign, tone: "bg-amber-50 text-amber-700" },
        { label: "申訴中", value: summary.appealingCases, detail: "等待管理單位審核", icon: Gavel, tone: "bg-sky-50 text-sky-700" },
        { label: "已繳款", value: summary.paidCases, detail: "已完成繳款紀錄", icon: CheckCircle2, tone: "bg-violet-50 text-violet-700" },
      ];

  return (
    <div className="mx-auto max-w-7xl space-y-7">
      <div className="rounded-3xl bg-[#14332f] px-6 py-7 text-white shadow-lg shadow-emerald-950/10 md:px-8">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div>
            <p className="text-sm font-medium text-amber-200">{isAdmin ? "管理員作業中心" : `戶號 ${user?.householdNo ?? "—"} 的案件中心`}</p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight">{isAdmin ? `您好，${user?.name || "管理員"}` : `您好，${user?.name || "住戶"}`}</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-emerald-50/75">{isAdmin ? "從案件登記到繳款與申訴處理，所有作業紀錄均可在此統一管理。" : "您可以查看與您的戶號相關之案件，必要時提交申訴並追蹤處理狀態。"}</p>
          </div>
          {isAdmin ? <div className="flex flex-wrap items-center gap-2"><Button variant="outline" className="border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white" onClick={() => setLocation("/monthly-penalties/export")}><FileDown className="mr-2 h-4 w-4" />每月 PDF 匯出</Button><Button className="bg-amber-300 text-[#14332f] hover:bg-amber-200" onClick={() => setLocation("/cases/new")}><FilePlus2 className="mr-2 h-4 w-4" />建立新案件</Button></div> : <Button variant="outline" className="border-white/25 bg-white/10 text-white hover:bg-white/20 hover:text-white" onClick={() => setLocation("/my-cases")}>查看我的案件<ArrowRight className="ml-2 h-4 w-4" /></Button>}
        </div>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {casesQuery.isLoading ? Array.from({ length: 4 }).map((_, index) => <Skeleton className="h-32" key={index} />) : cards.map(card => <Card key={card.label} className="border-slate-200 shadow-sm"><CardContent className="flex items-start justify-between p-5"><div><p className="text-sm font-medium text-slate-500">{card.label}</p><p className="mt-3 text-3xl font-bold tracking-tight text-slate-900">{card.value}</p><p className="mt-2 text-xs text-slate-500">{card.detail}</p></div><div className={`flex h-10 w-10 items-center justify-center rounded-xl ${card.tone}`}><card.icon className="h-5 w-5" /></div></CardContent></Card>)}
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_.7fr]">
        <Card className="overflow-hidden border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 py-4"><CardTitle className="text-base">近期案件</CardTitle><Button variant="ghost" size="sm" className="text-emerald-800" onClick={() => setLocation(isAdmin ? "/cases" : "/my-cases")}>查看全部<ArrowRight className="ml-1 h-4 w-4" /></Button></CardHeader>
          <CardContent className="p-0">{casesQuery.isLoading ? <div className="space-y-3 p-5">{Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-14 w-full" />)}</div> : cases.length === 0 ? <div className="px-6 py-14 text-center"><AlertCircle className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-3 text-sm font-medium text-slate-700">目前尚無案件資料</p>{isAdmin && <Button variant="link" className="mt-1 text-emerald-800" onClick={() => setLocation("/cases/new")}>建立第一筆案件</Button>}</div> : <div className="divide-y divide-slate-100">{cases.slice(0, 6).map(violationCase => { const meta = getCaseStatusMeta(violationCase.status); return <button key={violationCase.id} className="flex w-full items-center gap-4 px-5 py-4 text-left transition hover:bg-slate-50" onClick={() => setLocation(`/cases/${violationCase.id}`)}><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-sm font-bold text-emerald-800">{violationCase.householdNo.slice(0, 2)}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-800">{violationCase.violationType}</p><p className="mt-0.5 truncate text-xs text-slate-500">{violationCase.householdNo} · {formatDateTime(violationCase.occurredAt)}</p></div><Badge variant="outline" className={`${meta.className} hidden sm:inline-flex`}>{meta.label}</Badge><span className="hidden text-sm font-medium text-slate-700 md:block">{formatCurrency(violationCase.penaltyAmount)}</span><ArrowRight className="h-4 w-4 text-slate-400" /></button>; })}</div>}</CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="border-b border-slate-100"><CardTitle className="flex items-center gap-2 text-base"><BarChart3 className="h-4 w-4 text-emerald-700" />快速摘要</CardTitle></CardHeader>
          <CardContent className="p-5">{isAdmin ? <div className="space-y-4">{[{ label: "已繳款", value: summary.paidCases, color: "bg-emerald-500" }, { label: "待繳款", value: summary.pendingCases, color: "bg-amber-400" }, { label: "申訴中", value: summary.appealingCases, color: "bg-sky-500" }, { label: "已結案", value: report?.summary.closedCases ?? 0, color: "bg-slate-400" }].map(item => { const percent = summary.totalCases ? Math.round((Number(item.value) / summary.totalCases) * 100) : 0; return <div key={item.label}><div className="mb-2 flex items-center justify-between text-sm"><span className="text-slate-600">{item.label}</span><span className="font-semibold text-slate-800">{item.value} <span className="text-xs font-normal text-slate-500">({percent}%)</span></span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${item.color}`} style={{ width: `${percent}%` }} /></div></div>; })}<Button variant="outline" className="mt-2 w-full bg-white" onClick={() => setLocation("/reports")}>前往完整統計報表</Button></div> : <div className="space-y-4"><p className="text-sm leading-6 text-slate-600">案件狀態與處理進度會在此同步更新。若需提出異議，請開啟案件明細後使用「提交申訴」。</p><div className="rounded-xl bg-emerald-50 p-4"><p className="text-sm font-semibold text-emerald-900">申訴使用說明</p><p className="mt-1 text-xs leading-5 text-emerald-800">申訴送出後，管理單位會審核並在案件明細留下處理結果。</p></div><Button variant="outline" className="w-full bg-white" onClick={() => setLocation("/my-cases")}>查看案件清單</Button></div>}</CardContent>
        </Card>
      </div>
    </div>
  );
}
