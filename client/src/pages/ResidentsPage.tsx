import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";
import { KeyRound, Loader2, UserPlus, UsersRound } from "lucide-react";
import { type FormEvent, useMemo, useState } from "react";
import { toast } from "sonner";

const emptyForm = { name: "", householdNo: "", username: "", email: "", password: "" };

export default function ResidentsPage() {
  const utils = trpc.useUtils();
  const usersQuery = trpc.auth.listUsers.useQuery();
  const householdsQuery = trpc.households.list.useQuery({});
  const createResident = trpc.auth.createResident.useMutation();
  const setUserActive = trpc.auth.setUserActive.useMutation();
  const [form, setForm] = useState(emptyForm);

  const householdOptions = useMemo(() => householdsQuery.data?.map(item => item.householdNo) ?? [], [householdsQuery.data]);
  const users = usersQuery.data ?? [];

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await createResident.mutateAsync({
        name: form.name.trim(),
        householdNo: form.householdNo.trim(),
        username: form.username.trim(),
        email: form.email.trim(),
        password: form.password,
      });
      await Promise.all([utils.auth.listUsers.invalidate(), utils.households.list.invalidate()]);
      setForm(emptyForm);
      toast.success("住戶帳號已建立。", { description: "帳號已綁定戶號，住戶登入後僅能查看自己的案件。" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "住戶帳號建立失敗。");
    }
  };

  const toggle = async (userId: number, isActive: boolean) => {
    try {
      await setUserActive.mutateAsync({ userId, isActive });
      await utils.auth.listUsers.invalidate();
      toast.success(isActive ? "帳號已啟用。" : "帳號已停用。" );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "帳號狀態更新失敗。");
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-[0.14em] text-emerald-700"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> ACCESS CONTROL</div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">住戶與帳號</h2>
        <p className="mt-1 text-sm text-slate-600">建立住戶帳密並綁定戶號。住戶登入後僅能查詢自己的案件與提交申訴，無法進入管理員作業。</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[.85fr_1.15fr]">
        <Card className="h-fit border-slate-200 shadow-sm"><CardHeader className="border-b border-slate-100"><CardTitle className="flex items-center gap-2"><UserPlus className="h-5 w-5 text-emerald-700" />建立住戶帳號</CardTitle><CardDescription>建立帳號時會自動建立或更新對應戶號的住戶索引。</CardDescription></CardHeader><CardContent className="pt-6"><form className="space-y-4" onSubmit={submit}><div className="grid gap-2"><Label htmlFor="resident-name">住戶姓名</Label><Input id="resident-name" value={form.name} onChange={event => setForm(current => ({ ...current, name: event.target.value }))} placeholder="例如：陳小明" required /></div><div className="grid gap-2"><Label htmlFor="resident-household">戶號</Label><Input id="resident-household" list="resident-households" value={form.householdNo} onChange={event => setForm(current => ({ ...current, householdNo: event.target.value }))} placeholder="例如：A1-3F" required /><datalist id="resident-households">{householdOptions.map(number => <option key={number} value={number} />)}</datalist></div><div className="grid gap-2"><Label htmlFor="resident-email">電子郵件（選填）</Label><Input id="resident-email" type="email" value={form.email} onChange={event => setForm(current => ({ ...current, email: event.target.value }))} placeholder="name@example.com" /></div><div className="grid gap-2"><Label htmlFor="resident-username">登入帳號</Label><Input id="resident-username" autoComplete="username" value={form.username} onChange={event => setForm(current => ({ ...current, username: event.target.value }))} placeholder="3–64 個英數、句點、底線或連字號" required /></div><div className="grid gap-2"><Label htmlFor="resident-password">初始密碼</Label><Input id="resident-password" type="password" autoComplete="new-password" value={form.password} onChange={event => setForm(current => ({ ...current, password: event.target.value }))} placeholder="至少 10 個字元" minLength={10} required /></div><Button type="submit" className="mt-2 w-full bg-[#14332f] text-white hover:bg-[#0c2723]" disabled={createResident.isPending}>{createResident.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}建立住戶帳號</Button></form></CardContent></Card>

        <Card className="border-slate-200 shadow-sm"><CardHeader className="flex flex-row items-center justify-between border-b border-slate-100"><div><CardTitle className="flex items-center gap-2 text-lg"><UsersRound className="h-5 w-5 text-amber-600" />帳號清單</CardTitle><CardDescription className="mt-1">共 {users.length} 個可管理的本機帳號。</CardDescription></div></CardHeader><CardContent className="p-0">{usersQuery.isLoading ? <div className="p-8 text-center text-sm text-slate-500">載入帳號中…</div> : users.length === 0 ? <div className="p-12 text-center text-sm text-slate-500">尚未建立住戶帳號。</div> : <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left"><thead className="bg-slate-50 text-xs font-semibold tracking-wider text-slate-500"><tr><th className="px-5 py-3">姓名／帳號</th><th className="px-5 py-3">戶號</th><th className="px-5 py-3">角色</th><th className="px-5 py-3">狀態</th><th className="px-5 py-3 text-right">啟用</th></tr></thead><tbody className="divide-y divide-slate-100">{users.map(account => <tr key={account.id}><td className="px-5 py-4"><p className="text-sm font-semibold text-slate-800">{account.name || "未命名"}</p><p className="mt-0.5 font-mono text-xs text-slate-500">{account.username}</p></td><td className="px-5 py-4 text-sm font-medium text-slate-700">{account.householdNo || "—"}</td><td className="px-5 py-4"><Badge variant="outline" className={account.role === "admin" ? "border-amber-200 bg-amber-50 text-amber-800" : "border-slate-200 bg-slate-50 text-slate-700"}>{account.role === "admin" ? "管理員" : "住戶"}</Badge></td><td className="px-5 py-4 text-sm"><span className={account.isActive ? "text-emerald-700" : "text-slate-500"}>{account.isActive ? "使用中" : "已停用"}</span></td><td className="px-5 py-4"><div className="flex justify-end"><Switch checked={account.isActive} onCheckedChange={checked => void toggle(account.id, checked)} aria-label={`切換 ${account.username ?? "帳號"} 啟用狀態`} /></div></td></tr>)}</tbody></table></div>}</CardContent></Card>
      </div>
    </div>
  );
}
