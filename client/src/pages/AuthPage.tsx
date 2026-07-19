import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { KeyRound, Loader2, LockKeyhole, ShieldCheck } from "lucide-react";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

export default function AuthPage() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const bootstrapStatus = trpc.auth.needsBootstrap.useQuery(undefined, { retry: false });
  const login = trpc.auth.login.useMutation();
  const bootstrap = trpc.auth.bootstrap.useMutation();
  const [loginValues, setLoginValues] = useState({ username: "", password: "" });
  const [setupValues, setSetupValues] = useState({ name: "", email: "", username: "", password: "" });

  const authenticate = async () => {
    await utils.auth.me.invalidate();
    setLocation("/");
  };

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await login.mutateAsync(loginValues);
      await authenticate();
      toast.success("登入成功。", { description: "已進入社區違規管理系統。" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "登入失敗，請稍後再試。");
    }
  };

  const handleBootstrap = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await bootstrap.mutateAsync(setupValues);
      await authenticate();
      toast.success("管理員帳號已建立。", { description: "請由「住戶與帳號」建立住戶帳號。" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "初始設定失敗，請稍後再試。");
    }
  };

  const isLoading = bootstrapStatus.isLoading;
  const isSetup = bootstrapStatus.data?.required;
  const isSubmitting = login.isPending || bootstrap.isPending;

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#10312d] px-4 py-8 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 opacity-70">
        <div className="absolute -left-20 top-[-6rem] h-80 w-80 rounded-full bg-emerald-500/30 blur-3xl" />
        <div className="absolute -right-24 bottom-[-6rem] h-96 w-96 rounded-full bg-amber-300/20 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(115deg,transparent_0%,rgba(255,255,255,.04)_50%,transparent_100%)]" />
      </div>
      <div className="relative mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl items-center gap-8 lg:grid-cols-[1.15fr_.85fr]">
        <section className="hidden max-w-xl text-white lg:block">
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold tracking-[0.16em] text-amber-200">
            <ShieldCheck className="h-3.5 w-3.5" /> COMMUNITY OFFICE
          </div>
          <h1 className="text-5xl font-semibold leading-[1.12] tracking-tight">社區違規管理<br /><span className="text-amber-200">與開罰作業系統</span></h1>
          <p className="mt-6 max-w-lg text-base leading-7 text-emerald-50/75">
            將案件登記、違規照片、A4 雙聯通知單、繳款、申訴及統計整合於同一個受權限保護的工作平台。
          </p>
          <div className="mt-10 grid grid-cols-3 gap-3 text-sm">
            {[
              ["案件", "完整追蹤"],
              ["版面", "A4 雙聯列印"],
              ["權限", "住戶分流"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-white/10 bg-white/[.06] p-4">
                <p className="text-xs text-emerald-100/60">{label}</p>
                <p className="mt-1 font-semibold text-white">{value}</p>
              </div>
            ))}
          </div>
        </section>

        <Card className="border-white/20 bg-white/95 shadow-2xl shadow-black/20 backdrop-blur">
          <CardHeader className="space-y-3 pb-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#14332f] text-amber-200">
              {isSetup ? <KeyRound className="h-5 w-5" /> : <LockKeyhole className="h-5 w-5" />}
            </div>
            <div>
              <CardTitle className="text-2xl tracking-tight">{isLoading ? "確認系統狀態" : isSetup ? "建立第一位管理員" : "登入系統"}</CardTitle>
              <CardDescription className="mt-2 leading-6">
                {isLoading
                  ? "正在確認是否已完成初始管理員設定。"
                  : isSetup
                    ? "首次使用請設定管理員帳號。完成後，只有管理員能建立住戶帳號及管理案件。"
                    : "請輸入由社區管理員建立的帳號與密碼。"}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-[#14332f]" /></div>
            ) : isSetup ? (
              <form className="space-y-4" onSubmit={handleBootstrap}>
                <div className="grid gap-2">
                  <Label htmlFor="setup-name">管理員姓名</Label>
                  <Input id="setup-name" value={setupValues.name} onChange={event => setSetupValues(values => ({ ...values, name: event.target.value }))} placeholder="例如：王主任委員" required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="setup-email">電子郵件（選填）</Label>
                  <Input id="setup-email" type="email" value={setupValues.email} onChange={event => setSetupValues(values => ({ ...values, email: event.target.value }))} placeholder="name@example.com" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="setup-username">管理員帳號</Label>
                  <Input id="setup-username" value={setupValues.username} onChange={event => setSetupValues(values => ({ ...values, username: event.target.value }))} placeholder="3–64 個英數、句點、底線或連字號" required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="setup-password">管理員密碼</Label>
                  <Input id="setup-password" type="password" value={setupValues.password} onChange={event => setSetupValues(values => ({ ...values, password: event.target.value }))} placeholder="至少 10 個字元" minLength={10} required />
                </div>
                <Button type="submit" className="mt-2 w-full bg-[#14332f] text-white hover:bg-[#0c2723]" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}完成初始設定
                </Button>
              </form>
            ) : (
              <form className="space-y-5" onSubmit={handleLogin}>
                <div className="grid gap-2">
                  <Label htmlFor="login-username">帳號</Label>
                  <Input id="login-username" autoComplete="username" value={loginValues.username} onChange={event => setLoginValues(values => ({ ...values, username: event.target.value }))} required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="login-password">密碼</Label>
                  <Input id="login-password" type="password" autoComplete="current-password" value={loginValues.password} onChange={event => setLoginValues(values => ({ ...values, password: event.target.value }))} required />
                </div>
                <Button type="submit" className="w-full bg-[#14332f] text-white hover:bg-[#0c2723]" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}登入
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
