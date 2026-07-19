import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { toDateTimeLocal } from "@/lib/caseUtils";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, FileImage, Loader2, Paperclip, Save, Sparkles, Trash2, X } from "lucide-react";
import { type ChangeEvent, type FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation, useRoute } from "wouter";

type UploadedPhoto = { storageKey: string; originalName: string; mimeType: string };
type ExistingPhoto = UploadedPhoto & { id: number };

type FormState = {
  householdNo: string;
  templateId: string;
  violationType: string;
  occurredAt: string;
  location: string;
  description: string;
  penaltyAmount: string;
  regulationBasis: string;
  managementOfficeName: string;
};

const createInitialState = (): FormState => ({
  householdNo: "",
  templateId: "manual",
  violationType: "",
  occurredAt: toDateTimeLocal(new Date()),
  location: "",
  description: "",
  penaltyAmount: "0",
  regulationBasis: "住戶規約",
  managementOfficeName: "社區管理委員會",
});

async function uploadCasePhotos(files: File[]): Promise<UploadedPhoto[]> {
  if (!files.length) return [];
  const formData = new FormData();
  files.forEach(file => formData.append("photos", file));
  const response = await fetch("/api/uploads/case-photos", {
    method: "POST",
    body: formData,
    credentials: "include",
  });
  const payload = (await response.json()) as { message?: string; photos?: UploadedPhoto[] };
  if (!response.ok || !payload.photos) throw new Error(payload.message ?? "照片上傳失敗。");
  return payload.photos;
}

export default function CaseFormPage() {
  const [, editParams] = useRoute("/cases/:id/edit");
  const [location, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const isEditing = Boolean(editParams?.id);
  const caseId = Number(editParams?.id);
  const hasValidCaseId = Number.isInteger(caseId) && caseId > 0;
  const templatesQuery = trpc.templates.list.useQuery({ activeOnly: true });
  const householdsQuery = trpc.households.list.useQuery({});
  const caseQuery = trpc.cases.get.useQuery({ id: hasValidCaseId ? caseId : 1 }, { enabled: isEditing && hasValidCaseId });
  const createCase = trpc.cases.create.useMutation();
  const updateCase = trpc.cases.update.useMutation();
  const deletePhoto = trpc.cases.deletePhoto.useMutation();
  const [form, setForm] = useState<FormState>(() => createInitialState());
  const [files, setFiles] = useState<File[]>([]);
  const [existingPhotos, setExistingPhotos] = useState<ExistingPhoto[]>([]);
  const [initializedCaseId, setInitializedCaseId] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [deletingPhotoId, setDeletingPhotoId] = useState<number | null>(null);
  const templates = templatesQuery.data ?? [];
  const knownHouseholds = useMemo(() => householdsQuery.data?.map(item => item.householdNo) ?? [], [householdsQuery.data]);

  useEffect(() => {
    if (isEditing) return;
    setForm(createInitialState());
    setFiles([]);
    setExistingPhotos([]);
    setInitializedCaseId(null);
  }, [isEditing, location]);

  useEffect(() => {
    if (!isEditing) return;
    setFiles([]);
    setExistingPhotos([]);
    setInitializedCaseId(null);
  }, [caseId, isEditing]);

  useEffect(() => {
    const violationCase = caseQuery.data;
    if (!isEditing || !violationCase || initializedCaseId === violationCase.id) return;
    setForm({
      householdNo: violationCase.householdNo,
      templateId: violationCase.templateId ? String(violationCase.templateId) : "manual",
      violationType: violationCase.violationType,
      occurredAt: toDateTimeLocal(new Date(violationCase.occurredAt)),
      location: violationCase.location,
      description: violationCase.description,
      penaltyAmount: String(violationCase.penaltyAmount),
      regulationBasis: violationCase.regulationBasis,
      managementOfficeName: violationCase.managementOfficeName,
    });
    setExistingPhotos(violationCase.photos);
    setFiles([]);
    setInitializedCaseId(violationCase.id);
  }, [caseQuery.data, initializedCaseId, isEditing]);

  const change = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm(current => ({ ...current, [key]: value }));
  };

  const selectTemplate = (value: string) => {
    if (value === "manual") {
      change("templateId", "manual");
      return;
    }
    const template = templates.find(item => String(item.id) === value);
    if (!template) return;
    setForm(current => ({
      ...current,
      templateId: value,
      violationType: template.name,
      description: template.defaultDescription,
      penaltyAmount: String(template.defaultPenaltyAmount),
      regulationBasis: template.regulationBasis,
    }));
  };

  const onFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files ?? []);
    event.currentTarget.value = "";
    if (!selected.length) return;
    if (existingPhotos.length + files.length + selected.length > 2) {
      toast.error("每筆案件最多保留 2 張照片。", { description: "請先移除不需要的照片後再新增。" });
      return;
    }
    const invalid = selected.find(file => !["image/jpeg", "image/png", "image/webp"].includes(file.type));
    if (invalid) {
      toast.error("僅支援 JPG、PNG 或 WebP 格式照片。");
      return;
    }
    const oversized = selected.find(file => file.size > 8 * 1024 * 1024);
    if (oversized) {
      toast.error("單張照片不可超過 8 MB。");
      return;
    }
    setFiles(current => [...current, ...selected]);
  };

  const removeSelectedFile = (target: File) => {
    setFiles(current => current.filter(file => file !== target));
  };

  const removeExistingPhoto = async (photo: ExistingPhoto) => {
    if (!isEditing || !hasValidCaseId) return;
    try {
      setDeletingPhotoId(photo.id);
      await deletePhoto.mutateAsync({ caseId, photoId: photo.id });
      setExistingPhotos(current => current.filter(item => item.id !== photo.id));
      await Promise.all([utils.cases.get.invalidate({ id: caseId }), utils.cases.list.invalidate(), utils.reports.summary.invalidate()]);
      toast.success("照片已刪除。", { description: "通知單預覽將不再顯示此照片。" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "照片刪除失敗，請稍後再試。");
    } finally {
      setDeletingPhotoId(null);
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.householdNo.trim()) {
      toast.error("請輸入住戶戶號。");
      return;
    }
    try {
      setIsUploading(true);
      const photos = await uploadCasePhotos(files);
      const payload = {
        householdNo: form.householdNo.trim(),
        templateId: form.templateId === "manual" ? null : Number(form.templateId),
        violationType: form.violationType.trim(),
        occurredAt: new Date(form.occurredAt),
        location: form.location.trim(),
        description: form.description.trim(),
        penaltyAmount: Number(form.penaltyAmount || 0),
        regulationBasis: form.regulationBasis.trim(),
        managementOfficeName: form.managementOfficeName.trim(),
        photos,
      };
      if (isEditing && hasValidCaseId) {
        await updateCase.mutateAsync({ id: caseId, ...payload });
        await Promise.all([utils.cases.get.invalidate({ id: caseId }), utils.cases.list.invalidate(), utils.reports.summary.invalidate()]);
        toast.success("案件已更新。", { description: files.length ? "新增照片已併入案件與通知單。" : "案件資料已儲存。" });
        setLocation(`/cases/${caseId}`);
      } else {
        const result = await createCase.mutateAsync(payload);
        await Promise.all([utils.cases.list.invalidate(), utils.reports.summary.invalidate()]);
        setForm(createInitialState());
        setFiles([]);
        setExistingPhotos([]);
        setInitializedCaseId(null);
        toast.success("違規案件已建立。", { description: "現在可檢視通知單並列印 A4 雙聯。" });
        setLocation(`/cases/${result.id}`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : isEditing ? "案件更新失敗，請稍後再試。" : "案件建立失敗，請稍後再試。");
    } finally {
      setIsUploading(false);
    }
  };

  const busy = isUploading || createCase.isPending || updateCase.isPending;
  const editingCaseReady = !isEditing || (caseQuery.data && initializedCaseId === caseQuery.data.id);

  if (isEditing && caseQuery.isLoading) {
    return <div className="mx-auto max-w-6xl space-y-6"><Skeleton className="h-12 w-60" /><div className="grid gap-6 lg:grid-cols-[1.2fr_.8fr]"><Skeleton className="h-[650px]" /><Skeleton className="h-[440px]" /></div></div>;
  }

  if (isEditing && (!hasValidCaseId || !caseQuery.data)) {
    return <Card className="mx-auto max-w-xl"><CardContent className="py-12 text-center"><p className="font-semibold text-slate-800">找不到可修改的案件</p><p className="mt-2 text-sm text-slate-600">案件可能不存在，或您沒有修改權限。</p><Button className="mt-5" onClick={() => setLocation("/cases")}>返回案件管理</Button></CardContent></Card>;
  }

  if (!editingCaseReady) return null;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-[0.14em] text-emerald-700"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> {isEditing ? "CASE EDIT" : "CASE INTAKE"}</div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">{isEditing ? "修改違規案件" : "建立違規案件"}</h2>
          <p className="mt-1 text-sm text-slate-600">{isEditing ? "可修正案件資料、追加現場照片或移除不需要的照片。" : "選用儲存的違規項目後，可再依現場情況個別修改內容。"}</p>
        </div>
        <Button variant="outline" className="bg-white" onClick={() => setLocation(isEditing ? `/cases/${caseId}` : "/cases")}><ArrowLeft className="mr-2 h-4 w-4" />{isEditing ? "返回案件明細" : "返回案件管理"}</Button>
      </div>

      <form className="grid gap-6 lg:grid-cols-[1.2fr_.8fr]" onSubmit={submit} autoComplete="off">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="border-b border-slate-100">
            <CardTitle className="flex items-center gap-2 text-lg"><Sparkles className="h-4 w-4 text-amber-600" />案件內容</CardTitle>
            <CardDescription>戶號、現場事實與規約依據將列印於罰單聯及留存聯。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 pt-6">
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="householdNo">戶號 <span className="text-destructive">*</span></Label>
                <Input id="householdNo" list="household-options" placeholder="例如：A1-3F" value={form.householdNo} onChange={event => change("householdNo", event.target.value)} required />
                <datalist id="household-options">{knownHouseholds.map(number => <option key={number} value={number} />)}</datalist>
                <p className="text-xs text-slate-500">可直接輸入新戶號，系統會自動建立住戶索引。</p>
              </div>
              <div className="grid gap-2">
                <Label>違規項目範本</Label>
                <Select value={form.templateId} onValueChange={selectTemplate}>
                  <SelectTrigger><SelectValue placeholder="選擇已儲存的違規項目" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">不套用範本，手動輸入</SelectItem>
                    {templates.map(template => <SelectItem key={template.id} value={String(template.id)}>{template.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                {templates.length === 0 && <p className="text-xs text-amber-700">尚無啟用中的項目範本，可先至「違規項目範本」建立。</p>}
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="violationType">違規類型 <span className="text-destructive">*</span></Label>
                <Input id="violationType" value={form.violationType} onChange={event => change("violationType", event.target.value)} placeholder="例如：公共空間堆置雜物" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="occurredAt">違規日期與時間 <span className="text-destructive">*</span></Label>
                <Input id="occurredAt" type="datetime-local" value={form.occurredAt} onChange={event => change("occurredAt", event.target.value)} required />
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="location">違規地點 <span className="text-destructive">*</span></Label>
                <Input id="location" value={form.location} onChange={event => change("location", event.target.value)} placeholder="例如：A棟 3 樓公共走道" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="penaltyAmount">罰款金額（新臺幣）</Label>
                <Input id="penaltyAmount" type="number" min="0" step="1" value={form.penaltyAmount} onChange={event => change("penaltyAmount", event.target.value)} />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">違規描述 <span className="text-destructive">*</span></Label>
              <Textarea id="description" value={form.description} onChange={event => change("description", event.target.value)} placeholder="請清楚敘明現場情況、違規事實及限期改善事項。" rows={5} required />
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="regulationBasis">法源依據</Label>
                <Input id="regulationBasis" value={form.regulationBasis} onChange={event => change("regulationBasis", event.target.value)} required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="officeName">管理單位名稱</Label>
                <Input id="officeName" value={form.managementOfficeName} onChange={event => change("managementOfficeName", event.target.value)} required />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="border-b border-slate-100"><CardTitle className="flex items-center gap-2 text-lg"><FileImage className="h-4 w-4 text-emerald-700" />現場照片</CardTitle><CardDescription>支援 JPG、PNG、WebP；每張最大 8 MB，最多 2 張。</CardDescription></CardHeader>
            <CardContent className="pt-5">
              <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center transition hover:border-emerald-400 hover:bg-emerald-50/50">
                <Paperclip className="mb-2 h-6 w-6 text-slate-500" />
                <span className="text-sm font-medium text-slate-700">{isEditing ? "新增現場照片" : "選擇現場照片"}</span>
                <span className="mt-1 text-xs text-slate-500">目前 {existingPhotos.length + files.length}／2 張，{isEditing ? "儲存修改後會併入此案件。" : "新增後將隨案件保存並顯示於列印版面。"}</span>
                <input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={onFiles} disabled={existingPhotos.length + files.length >= 2} />
              </label>

              {existingPhotos.length > 0 && <div className="mt-4 grid grid-cols-2 gap-3">{existingPhotos.map(photo => <div className="group relative aspect-square overflow-hidden rounded-xl border border-slate-200 bg-slate-100" key={photo.id}><img className="h-full w-full object-cover" src={`/api/files/${photo.storageKey}`} alt={`案件現場照片：${photo.originalName}`} /><Button type="button" size="icon" variant="destructive" className="absolute right-2 top-2 h-8 w-8 shadow-sm" aria-label={`刪除照片 ${photo.originalName}`} disabled={deletingPhotoId === photo.id} onClick={() => void removeExistingPhoto(photo)}>{deletingPhotoId === photo.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}</Button></div>)}</div>}

              {files.length > 0 && <div className="mt-4 space-y-2">{files.map(file => <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-emerald-300 bg-emerald-50/40 px-3 py-2 text-sm" key={`${file.name}-${file.lastModified}`}><span className="min-w-0 truncate text-slate-700">{file.name}</span><div className="flex items-center gap-2"><Badge variant="secondary" className="shrink-0">待新增 {Math.ceil(file.size / 1024)} KB</Badge><Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-slate-500 hover:text-rose-700" aria-label={`移除待新增照片 ${file.name}`} onClick={() => removeSelectedFile(file)}><X className="h-4 w-4" /></Button></div></div>)}</div>}
            </CardContent>
          </Card>
          <Card className="border-amber-100 bg-amber-50/50 shadow-sm"><CardContent className="pt-5"><p className="text-sm font-semibold text-amber-900">列印前提醒</p><p className="mt-2 text-sm leading-6 text-amber-800">{isEditing ? "儲存後，通知單將立即採用更新後的案件內容與照片。" : "案件建立後，系統會產生 A4 上半部罰單聯、下半部留存聯的列印預覽。請於送出前確認戶號與現場紀錄。"}</p></CardContent></Card>
          <Button type="submit" className="h-11 w-full bg-[#14332f] text-white hover:bg-[#0c2723]" disabled={busy}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}{isEditing ? "儲存案件修改" : "建立案件並產生通知單"}</Button>
        </div>
      </form>
    </div>
  );
}
