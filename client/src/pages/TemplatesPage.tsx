import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/caseUtils";
import { trpc } from "@/lib/trpc";
import { Check, CopyPlus, Edit3, Loader2, Save, Tag, X } from "lucide-react";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";

const emptyForm = { name: "", defaultDescription: "", defaultPenaltyAmount: "0", regulationBasis: "住戶規約" };

export default function TemplatesPage() {
  const utils = trpc.useUtils();
  const templatesQuery = trpc.templates.list.useQuery({ activeOnly: false });
  const createTemplate = trpc.templates.create.useMutation();
  const updateTemplate = trpc.templates.update.useMutation();
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);

  const reset = () => {
    setForm(emptyForm);
    setEditingId(null);
  };
  const refresh = () => utils.templates.list.invalidate();

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const payload = {
        name: form.name.trim(),
        defaultDescription: form.defaultDescription.trim(),
        defaultPenaltyAmount: Number(form.defaultPenaltyAmount || 0),
        regulationBasis: form.regulationBasis.trim(),
      };
      if (editingId) {
        await updateTemplate.mutateAsync({ id: editingId, ...payload });
        toast.success("違規項目範本已更新。");
      } else {
        await createTemplate.mutateAsync(payload);
        toast.success("違規項目範本已儲存。", { description: "日後可在案件登記頁面選單快速調用。" });
      }
      await refresh();
      reset();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "範本儲存失敗。");
    }
  };

  const edit = (template: NonNullable<typeof templatesQuery.data>[number]) => {
    setEditingId(template.id);
    setForm({
      name: template.name,
      defaultDescription: template.defaultDescription,
      defaultPenaltyAmount: String(template.defaultPenaltyAmount),
      regulationBasis: template.regulationBasis,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const toggleActive = async (id: number, isActive: boolean) => {
    try {
      await updateTemplate.mutateAsync({ id, isActive });
      await refresh();
      toast.success(isActive ? "範本已啟用，可供案件登記調用。" : "範本已停用，不會出現在案件登記選單。" );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "範本狀態更新失敗。");
    }
  };

  const templates = templatesQuery.data ?? [];
  const busy = createTemplate.isPending || updateTemplate.isPending;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-[0.14em] text-emerald-700"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> REUSABLE CATALOG</div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">違規項目範本</h2>
        <p className="mt-1 text-sm text-slate-600">將常用開罰項目儲存為範本；登錄案件時可從選單帶入名稱、違規說明、法源依據及建議罰款，仍可逐案修改。</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[.85fr_1.15fr]">
        <Card className="h-fit border-slate-200 shadow-sm">
          <CardHeader className="border-b border-slate-100"><CardTitle className="flex items-center gap-2"><CopyPlus className="h-5 w-5 text-emerald-700" />{editingId ? "編輯範本" : "新增範本"}</CardTitle><CardDescription>範本不會回寫已建立案件，保留個案歷程的完整性。</CardDescription></CardHeader>
          <CardContent className="pt-6"><form className="space-y-4" onSubmit={submit}><div className="grid gap-2"><Label htmlFor="template-name">違規項目名稱</Label><Input id="template-name" value={form.name} onChange={event => setForm(current => ({ ...current, name: event.target.value }))} placeholder="例如：公共空間堆置雜物" required /></div><div className="grid gap-2"><Label htmlFor="template-description">預設違規說明</Label><Textarea id="template-description" rows={6} value={form.defaultDescription} onChange={event => setForm(current => ({ ...current, defaultDescription: event.target.value }))} placeholder="預先編寫違規事實、改善要求或通知文字。" required /></div><div className="grid gap-4 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor="template-amount">建議罰款（元）</Label><Input id="template-amount" type="number" min="0" value={form.defaultPenaltyAmount} onChange={event => setForm(current => ({ ...current, defaultPenaltyAmount: event.target.value }))} required /></div><div className="grid gap-2"><Label htmlFor="template-basis">法源依據</Label><Input id="template-basis" value={form.regulationBasis} onChange={event => setForm(current => ({ ...current, regulationBasis: event.target.value }))} required /></div></div><div className="flex justify-end gap-2 pt-2">{editingId && <Button type="button" variant="outline" className="bg-white" onClick={reset}><X className="mr-2 h-4 w-4" />取消編輯</Button>}<Button type="submit" className="bg-[#14332f] text-white hover:bg-[#0c2723]" disabled={busy}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}{editingId ? "儲存變更" : "儲存範本"}</Button></div></form></CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm"><CardHeader className="flex flex-row items-center justify-between border-b border-slate-100"><CardTitle className="flex items-center gap-2 text-lg"><Tag className="h-5 w-5 text-amber-600" />已儲存項目</CardTitle><Badge variant="secondary">{templates.length} 項</Badge></CardHeader><CardContent className="p-0">{templatesQuery.isLoading ? <div className="p-8 text-center text-sm text-slate-500">載入範本中…</div> : templates.length === 0 ? <div className="p-12 text-center"><Tag className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-3 font-medium text-slate-700">尚未建立違規項目範本</p><p className="mt-1 text-sm text-slate-500">可先新增社區常用的違規類型，減少後續登錄時間。</p></div> : <div className="divide-y divide-slate-100">{templates.map(template => <div key={template.id} className="p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-slate-800">{template.name}</h3><Badge variant="outline" className={template.isActive ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-slate-100 text-slate-600"}>{template.isActive ? "啟用中" : "已停用"}</Badge></div><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{template.defaultDescription}</p><div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500"><span>建議罰款：<strong className="font-semibold text-slate-700">{formatCurrency(template.defaultPenaltyAmount)}</strong></span><span>法源：<strong className="font-semibold text-slate-700">{template.regulationBasis}</strong></span></div></div><div className="flex items-center gap-2"><Switch checked={template.isActive} onCheckedChange={checked => void toggleActive(template.id, checked)} aria-label={`切換 ${template.name} 啟用狀態`} /><Button size="sm" variant="outline" className="bg-white" onClick={() => edit(template)}><Edit3 className="mr-2 h-3.5 w-3.5" />編輯</Button></div></div></div>)}</div>}</CardContent></Card>
      </div>
    </div>
  );
}
