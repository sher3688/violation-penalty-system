import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { BarChart3, CalendarDays, CheckCircle2, CircleDollarSign, FileWarning, Gavel, UsersRound } from "lucide-react";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const chartGreen = "#1f7a65";
const chartAmber = "#d38a25";

export default function ReportsPage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const input = useMemo(() => ({ from: from ? new Date(`${from}T00:00:00`) : undefined, to: to ? new Date(`${to}T23:59:59`) : undefined }), [from, to]);
  const reportsQuery = trpc.reports.summary.useQuery(input);
  const data = reportsQuery.data;
  const summary = data?.summary;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-[0.14em] text-emerald-700"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> MANAGEMENT INSIGHTS</div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">統計報表</h2>
          <p className="mt-1 text-sm text-slate-600">以案件實際登錄資料呈現違規趨勢、戶別次數與繳款完成狀態。</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm"><CalendarDays className="ml-1 h-4 w-4 text-slate-500" /><Input className="h-8 w-[145px] border-0 px-2 shadow-none focus-visible:ring-0" type="date" value={from} onChange={event => setFrom(event.target.value)} aria-label="開始日期" /><span className="text-xs text-slate-400">至</span><Input className="h-8 w-[145px] border-0 px-2 shadow-none focus-visible:ring-0" type="date" value={to} onChange={event => setTo(event.target.value)} aria-label="結束日期" />{(from || to) && <Button variant="ghost" size="sm" onClick={() => { setFrom(""); setTo(""); }}>清除</Button>}</div>
      </div>

      {reportsQuery.isLoading || !summary ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }).map((_, index) => <Skeleton className="h-32" key={index} />)}</div> : <><section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[
        { label: "違規案件", value: summary.totalCases, detail: "選擇期間內的全部案件", icon: FileWarning, tone: "bg-emerald-50 text-emerald-700" },
        { label: "繳款率", value: `${summary.paymentRate}%`, detail: `${summary.paidCases} 筆已繳款`, icon: CircleDollarSign, tone: "bg-amber-50 text-amber-700" },
        { label: "待處理申訴", value: summary.appealingCases, detail: "等待管理員審核", icon: Gavel, tone: "bg-sky-50 text-sky-700" },
        { label: "已結案件", value: summary.closedCases, detail: "處理流程已完成", icon: CheckCircle2, tone: "bg-violet-50 text-violet-700" },
      ].map(item => <Card key={item.label} className="border-slate-200 shadow-sm"><CardContent className="flex items-start justify-between p-5"><div><p className="text-sm font-medium text-slate-500">{item.label}</p><p className="mt-3 text-3xl font-bold tracking-tight text-slate-900">{item.value}</p><p className="mt-2 text-xs text-slate-500">{item.detail}</p></div><div className={`flex h-10 w-10 items-center justify-center rounded-xl ${item.tone}`}><item.icon className="h-5 w-5" /></div></CardContent></Card>)}</section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card className="border-slate-200 shadow-sm"><CardHeader className="border-b border-slate-100"><CardTitle className="flex items-center gap-2 text-base"><BarChart3 className="h-4 w-4 text-emerald-700" />違規件數趨勢</CardTitle></CardHeader><CardContent className="h-[300px] pt-6">{data.monthlyTrend.length === 0 ? <EmptyChart message="尚無案件資料可形成趨勢圖。" /> : <ResponsiveContainer width="100%" height="100%"><LineChart data={data.monthlyTrend} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" /><XAxis dataKey="month" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} /><YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} /><Tooltip contentStyle={{ borderRadius: 12, borderColor: "#e2e8f0" }} formatter={(value: number) => [`${value} 件`, "違規案件"]} /><Line type="monotone" dataKey="count" stroke={chartGreen} strokeWidth={3} dot={{ r: 4, fill: chartGreen }} activeDot={{ r: 6 }} /></LineChart></ResponsiveContainer>}</CardContent></Card>

        <Card className="border-slate-200 shadow-sm"><CardHeader className="border-b border-slate-100"><CardTitle className="flex items-center gap-2 text-base"><UsersRound className="h-4 w-4 text-amber-600" />各戶違規次數</CardTitle></CardHeader><CardContent className="h-[300px] pt-6">{data.byHousehold.length === 0 ? <EmptyChart message="尚無戶別案件資料。" /> : <ResponsiveContainer width="100%" height="100%"><BarChart data={data.byHousehold.slice(0, 12)} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" /><XAxis dataKey="householdNo" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} /><YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} /><Tooltip contentStyle={{ borderRadius: 12, borderColor: "#e2e8f0" }} formatter={(value: number) => [`${value} 件`, "違規次數"]} /><Bar dataKey="count" radius={[7, 7, 0, 0]}>{data.byHousehold.slice(0, 12).map((entry, index) => <Cell key={entry.householdNo} fill={index === 0 ? chartAmber : chartGreen} />)}</Bar></BarChart></ResponsiveContainer>}</CardContent></Card>
      </section>

      <Card className="border-slate-200 shadow-sm"><CardHeader className="border-b border-slate-100"><CardTitle className="text-base">案件狀態組成</CardTitle></CardHeader><CardContent className="grid gap-4 p-5 sm:grid-cols-4">{[{ label: "待繳款", value: summary.pendingCases, color: "bg-amber-400" }, { label: "已繳款", value: summary.paidCases, color: "bg-emerald-500" }, { label: "申訴中", value: summary.appealingCases, color: "bg-sky-500" }, { label: "已結案", value: summary.closedCases, color: "bg-slate-400" }].map(item => { const percent = summary.totalCases ? Math.round((item.value / summary.totalCases) * 100) : 0; return <div key={item.label} className="rounded-xl bg-slate-50 p-4"><div className="flex items-center justify-between"><span className="text-sm text-slate-600">{item.label}</span><span className="font-semibold text-slate-800">{item.value} 件</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200"><div className={`h-full rounded-full ${item.color}`} style={{ width: `${percent}%` }} /></div><p className="mt-2 text-xs text-slate-500">占全部案件 {percent}%</p></div>; })}</CardContent></Card></>}
    </div>
  );
}

function EmptyChart({ message }: { message: string }) {
  return <div className="flex h-full flex-col items-center justify-center text-center"><BarChart3 className="h-8 w-8 text-slate-300" /><p className="mt-3 text-sm text-slate-500">{message}</p></div>;
}
