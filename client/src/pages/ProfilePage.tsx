import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { KeyRound, Loader2, UserRound } from "lucide-react";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";

export default function ProfilePage() {
  const { user } = useAuth();
  const changePassword = trpc.auth.changeOwnPassword.useMutation();
  const [values, setValues] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (values.newPassword !== values.confirmPassword) {
      toast.error("新密碼與確認密碼不一致。");
      return;
    }
    try {
      await changePassword.mutateAsync({ currentPassword: values.currentPassword, newPassword: values.newPassword });
      setValues({ currentPassword: "", newPassword: "", confirmPassword: "" });
      toast.success("密碼已更新。", { description: "下次登入時請使用新的密碼。" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "密碼更新失敗。");
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div><div className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-[0.14em] text-emerald-700"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> ACCOUNT SETTINGS</div><h2 className="text-2xl font-bold tracking-tight text-slate-900">個人帳號設定</h2><p className="mt-1 text-sm text-slate-600">檢視目前登入帳號資訊並自行更新密碼。</p></div>
      <div className="grid gap-6 md:grid-cols-[.8fr_1.2fr]">
        <Card className="h-fit border-slate-200 shadow-sm"><CardHeader><CardTitle className="flex items-center gap-2 text-lg"><UserRound className="h-5 w-5 text-emerald-700" />帳號資料</CardTitle></CardHeader><CardContent className="space-y-4"><Info label="姓名" value={user?.name || "—"} /><Info label="登入帳號" value={user?.username || "—"} mono /><Info label="帳號角色" value={user?.role === "admin" ? "管理員" : "住戶"} /><Info label="綁定戶號" value={user?.householdNo || "—"} /></CardContent></Card>
        <Card className="border-slate-200 shadow-sm"><CardHeader className="border-b border-slate-100"><CardTitle className="flex items-center gap-2 text-lg"><KeyRound className="h-5 w-5 text-amber-600" />更新密碼</CardTitle><CardDescription>新密碼至少須為 10 個字元。請勿使用容易猜測的個人資訊。</CardDescription></CardHeader><CardContent className="pt-6"><form className="space-y-4" onSubmit={submit}><div className="grid gap-2"><Label htmlFor="current-password">目前密碼</Label><Input id="current-password" type="password" autoComplete="current-password" value={values.currentPassword} onChange={event => setValues(current => ({ ...current, currentPassword: event.target.value }))} required /></div><div className="grid gap-2"><Label htmlFor="new-password">新密碼</Label><Input id="new-password" type="password" autoComplete="new-password" minLength={10} value={values.newPassword} onChange={event => setValues(current => ({ ...current, newPassword: event.target.value }))} required /></div><div className="grid gap-2"><Label htmlFor="confirm-password">確認新密碼</Label><Input id="confirm-password" type="password" autoComplete="new-password" minLength={10} value={values.confirmPassword} onChange={event => setValues(current => ({ ...current, confirmPassword: event.target.value }))} required /></div><div className="flex justify-end pt-2"><Button type="submit" className="bg-[#14332f] text-white hover:bg-[#0c2723]" disabled={changePassword.isPending}>{changePassword.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}更新密碼</Button></div></form></CardContent></Card>
      </div>
    </div>
  );
}

function Info({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return <div><p className="text-xs font-semibold tracking-wider text-slate-500">{label}</p><p className={`mt-1 text-sm font-medium text-slate-800 ${mono ? "font-mono" : ""}`}>{value}</p></div>;
}
