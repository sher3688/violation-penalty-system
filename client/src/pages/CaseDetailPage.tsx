import { useAuth } from "@/_core/hooks/useAuth";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency, formatDateTime, getCaseStatusMeta, toDateTimeLocal } from "@/lib/caseUtils";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, ArrowLeft, CheckCircle2, CircleDollarSign, FileText, Gavel, ImageOff, Loader2, MessageSquareText, Pencil, Printer, Trash2, XCircle } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import { useLocation, useRoute } from "wouter";

export default function CaseDetailPage() {
  const [, params] = useRoute("/cases/:id");
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const caseId = Number(params?.id);
  const caseQuery = trpc.cases.get.useQuery({ id: caseId }, { enabled: Number.isInteger(caseId) && caseId > 0 });
  const recordPayment = trpc.cases.recordPayment.useMutation();
  const submitAppeal = trpc.cases.submitAppeal.useMutation();
  const decideAppeal = trpc.cases.decideAppeal.useMutation();
  const closeCase = trpc.cases.close.useMutation();
  const deleteCase = trpc.cases.delete.useMutation();
  const [showPayment, setShowPayment] = useState(false);
  const [showAppeal, setShowAppeal] = useState(false);
  const [payment, setPayment] = useState({ amount: "0", paidAt: toDateTimeLocal(new Date()), note: "" });
  const [appealContent, setAppealContent] = useState("");
  const [decision, setDecision] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const violationCase = caseQuery.data;
  const isAdmin = user?.role === "admin";

  useEffect(() => {
    if (violationCase) setPayment(current => ({ ...current, amount: String(violationCase.penaltyAmount) }));
  }, [violationCase]);

  const refresh = async () => {
    await Promise.all([utils.cases.get.invalidate({ id: caseId }), utils.cases.list.invalidate(), utils.reports.summary.invalidate(), utils.reports.householdPenaltyStats.invalidate()]);
  };

  const onPayment = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await recordPayment.mutateAsync({
        caseId,
        amount: Number(payment.amount || 0),
        paidAt: new Date(payment.paidAt),
        note: payment.note,
      });
      await refresh();
      setShowPayment(false);
      toast.success("已記錄繳款資料。", { description: "案件狀態已更新為已繳款。" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "繳款資料儲存失敗。");
    }
  };

  const onAppeal = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await submitAppeal.mutateAsync({ caseId, content: appealContent });
      await refresh();
      setShowAppeal(false);
      toast.success("申訴已送出。", { description: "案件狀態已更新為申訴中。" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "申訴送出失敗。");
    }
  };

  const onDecision = async (status: "approved" | "rejected") => {
    if (!decision.trim()) {
      toast.error("請輸入申訴處理結果。");
      return;
    }
    try {
      await decideAppeal.mutateAsync({ caseId, status, result: decision.trim() });
      await refresh();
      toast.success(status === "approved" ? "申訴已核准，案件已結案。" : "申訴已駁回，案件恢復待繳款。" );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "申訴審核失敗。");
    }
  };

  const onClose = async () => {
    try {
      await closeCase.mutateAsync({ caseId });
      await refresh();
      toast.success("案件已結案。");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "案件結案失敗。");
    }
  };

  const onDeleteCase = async () => {
    try {
      await deleteCase.mutateAsync({ caseId });
      await Promise.all([utils.cases.list.invalidate(), utils.reports.summary.invalidate(), utils.reports.householdPenaltyStats.invalidate()]);
      toast.success("案件已刪除。", { description: "案件與其關聯照片、繳款及申訴資料已清理。" });
      setLocation("/cases");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "案件刪除失敗，請稍後再試。");
    }
  };

  if (caseQuery.isLoading) return <div className="flex min-h-80 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-[#14332f]" /></div>;
  if (!violationCase) return <Card className="mx-auto max-w-xl"><CardContent className="py-12 text-center"><AlertTriangle className="mx-auto h-8 w-8 text-amber-600" /><h2 className="mt-4 text-lg font-semibold">找不到案件</h2><p className="mt-1 text-sm text-slate-600">此案件可能不存在，或您沒有查看權限。</p><Button className="mt-5" onClick={() => setLocation("/")}>返回總覽</Button></CardContent></Card>;

  const status = getCaseStatusMeta(violationCase.status);
  const backPath = isAdmin ? "/cases" : "/my-cases";
  const appeal = violationCase.appeal;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Button variant="ghost" className="-ml-3 mb-2 text-slate-600" onClick={() => setLocation(backPath)}><ArrowLeft className="mr-2 h-4 w-4" />返回案件列表</Button>
          <div className="flex flex-wrap items-center gap-3"><h2 className="text-2xl font-bold tracking-tight text-slate-900">{violationCase.violationType}</h2><Badge variant="outline" className={status.className}>{status.label}</Badge></div>
          <p className="mt-2 text-sm text-slate-600">通知單編號：<span className="font-mono font-medium text-slate-800">{violationCase.noticeNo}</span>　建立時間：{formatDateTime(violationCase.issuedAt)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="bg-white" onClick={() => setLocation(`/print/${caseId}`)}><Printer className="mr-2 h-4 w-4" />A4 列印預覽</Button>
          {!isAdmin && !appeal && violationCase.status !== "closed" && <Button className="bg-sky-700 text-white hover:bg-sky-800" onClick={() => setShowAppeal(true)}><Gavel className="mr-2 h-4 w-4" />提出申訴</Button>}
          {isAdmin && <Button variant="outline" className="bg-white" onClick={() => setLocation(`/cases/${caseId}/edit`)}><Pencil className="mr-2 h-4 w-4" />修改案件</Button>}
          {isAdmin && <Button variant="outline" className="border-rose-200 bg-white text-rose-700 hover:bg-rose-50 hover:text-rose-800" onClick={() => setShowDeleteConfirm(true)}><Trash2 className="mr-2 h-4 w-4" />刪除案件</Button>}
          {isAdmin && violationCase.status !== "closed" && <Button variant="outline" className="bg-white" onClick={() => void onClose()} disabled={closeCase.isPending}>{closeCase.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}結案</Button>}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.25fr_.75fr]">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="border-b border-slate-100"><CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5 text-emerald-700" />違規內容</CardTitle><CardDescription>本案內容將固定留存，以保留開罰時點之事實紀錄。</CardDescription></CardHeader>
          <CardContent className="space-y-6 pt-6">
            <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
              <DetailItem label="戶號" value={violationCase.householdNo} />
              <DetailItem label="違規日期時間" value={formatDateTime(violationCase.occurredAt)} />
              <DetailItem label="違規地點" value={violationCase.location} />
              <DetailItem label="罰款金額" value={formatCurrency(violationCase.penaltyAmount)} />
              <DetailItem label="法源依據" value={violationCase.regulationBasis} />
              <DetailItem label="管理單位" value={violationCase.managementOfficeName} />
            </div>
            <div className="border-t border-slate-100 pt-5"><p className="text-xs font-semibold tracking-wider text-slate-500">違規描述</p><p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-800">{violationCase.description}</p></div>
            <div className="border-t border-slate-100 pt-5"><p className="mb-3 text-xs font-semibold tracking-wider text-slate-500">現場照片</p>{violationCase.photos.length > 0 ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{violationCase.photos.map(photo => <a className="group aspect-square overflow-hidden rounded-xl border border-slate-200 bg-slate-100" href={`/api/files/${photo.storageKey}`} target="_blank" rel="noreferrer" key={photo.id}><img className="h-full w-full object-cover transition duration-200 group-hover:scale-105" src={`/api/files/${photo.storageKey}`} alt={`案件現場照片：${photo.originalName}`} /></a>)}</div> : <div className="flex items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-500"><ImageOff className="h-4 w-4" />本案件未附現場照片。</div>}</div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-slate-200 shadow-sm"><CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><CircleDollarSign className="h-4 w-4 text-emerald-700" />繳款追蹤</CardTitle></CardHeader><CardContent>{violationCase.payment ? <div className="space-y-2"><div className="text-xl font-semibold text-emerald-800">{formatCurrency(violationCase.payment.amount)}</div><p className="text-sm text-slate-600">繳款日期：{formatDateTime(violationCase.payment.paidAt)}</p>{violationCase.payment.note && <p className="rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-600">{violationCase.payment.note}</p>}</div> : isAdmin ? <><p className="text-sm leading-6 text-slate-600">尚未登錄繳款資料。確認收款後可在此標記。</p><Button className="mt-4 w-full bg-[#14332f] text-white hover:bg-[#0c2723]" onClick={() => setShowPayment(value => !value)}>記錄已繳款</Button></> : <p className="text-sm leading-6 text-slate-600">目前尚無繳款紀錄。若已繳款，請洽管理單位確認。</p>}</CardContent></Card>

          <Card className="border-slate-200 shadow-sm"><CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><MessageSquareText className="h-4 w-4 text-sky-700" />申訴處理</CardTitle></CardHeader><CardContent>{appeal ? <div className="space-y-3"><div><p className="text-xs font-semibold text-slate-500">住戶申訴內容</p><p className="mt-1 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-700">{appeal.content}</p></div><div className="flex items-center gap-2 text-sm"><Badge variant="outline" className={appeal.status === "pending" ? "border-sky-200 bg-sky-50 text-sky-800" : appeal.status === "approved" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-800"}>{appeal.status === "pending" ? "待審核" : appeal.status === "approved" ? "已核准" : "已駁回"}</Badge><span className="text-slate-500">{formatDateTime(appeal.submittedAt)}</span></div>{appeal.result && <div><p className="text-xs font-semibold text-slate-500">處理結果</p><p className="mt-1 whitespace-pre-wrap rounded-lg border border-slate-200 p-3 text-sm leading-6 text-slate-700">{appeal.result}</p></div>}</div> : isAdmin ? <p className="text-sm leading-6 text-slate-600">目前尚無住戶提交申訴。若住戶提出異議，將於此顯示申訴內容及審核入口。</p> : <><p className="text-sm leading-6 text-slate-600">如對本違規案件有異議，可提交申訴說明供管理單位審核。</p><Button variant="outline" className="mt-4 w-full bg-white" onClick={() => setShowAppeal(value => !value)}><Gavel className="mr-2 h-4 w-4" />提出申訴</Button></>}</CardContent></Card>
        </div>
      </div>

      {showPayment && isAdmin && <Card className="border-emerald-200 bg-emerald-50/40"><CardHeader><CardTitle className="text-lg">記錄繳款</CardTitle><CardDescription>儲存後案件狀態將變更為「已繳款」。</CardDescription></CardHeader><CardContent><form className="grid gap-4 md:grid-cols-3" onSubmit={onPayment}><div className="grid gap-2"><Label>繳款金額</Label><Input type="number" min="0" value={payment.amount} onChange={event => setPayment(current => ({ ...current, amount: event.target.value }))} required /></div><div className="grid gap-2"><Label>繳款日期</Label><Input type="datetime-local" value={payment.paidAt} onChange={event => setPayment(current => ({ ...current, paidAt: event.target.value }))} required /></div><div className="grid gap-2"><Label>收款備註</Label><Input value={payment.note} onChange={event => setPayment(current => ({ ...current, note: event.target.value }))} placeholder="例如：管理室現金收款" /></div><div className="md:col-span-3 flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setShowPayment(false)}>取消</Button><Button type="submit" className="bg-[#14332f] text-white hover:bg-[#0c2723]" disabled={recordPayment.isPending}>{recordPayment.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}確認繳款</Button></div></form></CardContent></Card>}

      {showAppeal && <Card className="border-sky-200 bg-sky-50/40"><CardHeader><CardTitle className="text-lg">提出申訴</CardTitle><CardDescription>請說明具體事實及希望管理單位重新審核的內容。</CardDescription></CardHeader><CardContent><form onSubmit={onAppeal} className="space-y-4"><Textarea rows={5} value={appealContent} onChange={event => setAppealContent(event.target.value)} placeholder="輸入申訴內容" required /><div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setShowAppeal(false)}>取消</Button><Button type="submit" className="bg-sky-700 text-white hover:bg-sky-800" disabled={submitAppeal.isPending}>{submitAppeal.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}送出申訴</Button></div></form></CardContent></Card>}

      {isAdmin && appeal?.status === "pending" && <Card className="border-amber-200 bg-amber-50/50"><CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Gavel className="h-5 w-5 text-amber-700" />審核申訴</CardTitle><CardDescription>請留下明確處理結果；核准將使案件結案，駁回則恢復待繳款。</CardDescription></CardHeader><CardContent className="space-y-4"><Textarea rows={4} value={decision} onChange={event => setDecision(event.target.value)} placeholder="輸入申訴審核結果" /><div className="flex flex-wrap justify-end gap-2"><Button variant="outline" className="border-rose-200 bg-white text-rose-700 hover:bg-rose-50" disabled={decideAppeal.isPending} onClick={() => void onDecision("rejected")}><XCircle className="mr-2 h-4 w-4" />駁回申訴</Button><Button className="bg-emerald-700 text-white hover:bg-emerald-800" disabled={decideAppeal.isPending} onClick={() => void onDecision("approved")}>{decideAppeal.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}核准申訴並結案</Button></div></CardContent></Card>}

      <AlertDialog open={showDeleteConfirm} onOpenChange={open => { if (!open && !deleteCase.isPending) setShowDeleteConfirm(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>永久刪除這筆案件？</AlertDialogTitle>
            <AlertDialogDescription>
              通知單「{violationCase.noticeNo}」及其所有照片、繳款紀錄與申訴紀錄將一併刪除。此動作無法復原。
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

function DetailItem({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs font-semibold tracking-wider text-slate-500">{label}</p><p className="mt-1.5 text-sm font-medium text-slate-800">{value}</p></div>;
}
