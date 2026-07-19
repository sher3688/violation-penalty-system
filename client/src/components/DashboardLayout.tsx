import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/useMobile";
import {
  BarChart3,
  ClipboardList,
  FileDown,
  FilePlus2,
  FileSpreadsheet,
  LayoutDashboard,
  KeyRound,
  LogOut,
  PanelLeft,
  ReceiptText,
  ShieldCheck,
  Tags,
  UsersRound,
} from "lucide-react";
import { type CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";

const SIDEBAR_WIDTH_KEY = "violation-sidebar-width";
const DEFAULT_WIDTH = 270;
const MIN_WIDTH = 220;
const MAX_WIDTH = 420;

type MenuItem = {
  icon: typeof LayoutDashboard;
  label: string;
  path: string;
  roles: Array<"admin" | "user">;
};

const menuItems: MenuItem[] = [
  { icon: LayoutDashboard, label: "案件總覽", path: "/", roles: ["admin", "user"] },
  { icon: FilePlus2, label: "新增開罰", path: "/cases/new", roles: ["admin"] },
  { icon: ClipboardList, label: "案件管理", path: "/cases", roles: ["admin"] },
  { icon: FileDown, label: "每月 PDF 匯出", path: "/monthly-penalties/export", roles: ["admin"] },
  { icon: FileSpreadsheet, label: "戶別金額 Excel", path: "/reports/household-penalties/export", roles: ["admin"] },
  { icon: ReceiptText, label: "我的案件與申訴", path: "/my-cases", roles: ["user"] },
  { icon: Tags, label: "違規項目範本", path: "/templates", roles: ["admin"] },
  { icon: UsersRound, label: "住戶與帳號", path: "/residents", roles: ["admin"] },
  { icon: BarChart3, label: "統計報表", path: "/reports", roles: ["admin"] },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? Number.parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) return <DashboardLayoutSkeleton />;
  if (!user) return null;

  return (
    <SidebarProvider style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}>
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>{children}</DashboardLayoutContent>
    </SidebarProvider>
  );
}

function DashboardLayoutContent({
  children,
  setSidebarWidth,
}: {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
}) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const permittedItems = menuItems.filter(item => user && item.roles.includes(user.role));
  const activeMenuItem = permittedItems.find(item => item.path === location) ?? permittedItems[0];

  useEffect(() => {
    if (isCollapsed) setIsResizing(false);
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!isResizing) return;
      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = event.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) setSidebarWidth(newWidth);
    };
    const handleMouseUp = () => setIsResizing(false);
    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  const initials = (user?.name || user?.username || "住").trim().slice(0, 1).toUpperCase();
  const roleLabel = user?.role === "admin" ? "管理員" : "住戶";

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar collapsible="icon" className="border-r border-slate-200/70 text-white [&_[data-sidebar=sidebar]]:!bg-[#14332f] [&_[data-sidebar=sidebar]]:!text-white" disableTransition={isResizing}>
          <SidebarHeader className="h-[78px] border-b border-white/10 px-3 py-3">
            <div className="flex w-full items-center gap-3">
              <button
                onClick={toggleSidebar}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white transition hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
                aria-label="收合導覽列"
              >
                <PanelLeft className="h-4 w-4" />
              </button>
              {!isCollapsed && (
                <div className="min-w-0">
                  <p className="text-[11px] font-medium tracking-[0.18em] text-amber-200">COMMUNITY OFFICE</p>
                  <p className="truncate text-base font-semibold tracking-tight">社區違規管理</p>
                </div>
              )}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0 px-2 py-4">
            {!isCollapsed && <p className="px-3 pb-2 text-[10px] font-semibold tracking-[0.18em] text-emerald-100/60">功能選單</p>}
            <SidebarMenu className="gap-1">
              {permittedItems.map(item => {
                const isActive = location === item.path;
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => setLocation(item.path)}
                      tooltip={item.label}
                      className="h-11 rounded-xl text-emerald-50 hover:bg-white/10 hover:text-white data-[active=true]:bg-amber-300 data-[active=true]:text-[#17352f] data-[active=true]:font-semibold"
                    >
                      <item.icon className="h-[18px] w-[18px]" />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="border-t border-white/10 p-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 group-data-[collapsible=icon]:justify-center">
                  <Avatar className="h-9 w-9 shrink-0 border border-white/20 bg-amber-200 text-[#14332f]">
                    <AvatarFallback className="bg-amber-200 text-xs font-bold text-[#14332f]">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
                    <p className="truncate text-sm font-medium text-white">{user?.name || user?.username || "使用者"}</p>
                    <p className="mt-0.5 truncate text-xs text-emerald-100/70">{roleLabel}{user?.householdNo ? ` · ${user.householdNo}` : ""}</p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel className="flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="h-3.5 w-3.5" />{roleLabel}帳號</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setLocation("/profile")} className="cursor-pointer">
                  <KeyRound className="mr-2 h-4 w-4" />個人帳號設定
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => void logout().then(() => setLocation("/login"))}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />登出系統
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        <div
          className={`absolute right-0 top-0 z-50 h-full w-1 cursor-col-resize transition-colors hover:bg-amber-300/70 ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => !isCollapsed && setIsResizing(true)}
        />
      </div>

      <SidebarInset className="bg-[#f5f7f5]">
        <header className="sticky top-0 z-30 flex h-[78px] items-center justify-between border-b border-slate-200/80 bg-[#f5f7f5]/90 px-5 backdrop-blur md:px-8">
          <div className="flex min-w-0 items-center gap-3">
            {isMobile && <SidebarTrigger className="h-9 w-9 rounded-xl border border-slate-200 bg-white" />}
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-500">社區自治 · 違規案件作業</p>
              <h1 className="truncate text-lg font-bold tracking-tight text-slate-900">{activeMenuItem?.label ?? "社區違規管理"}</h1>
            </div>
          </div>
          <div className="hidden items-center gap-2 rounded-full border border-emerald-100 bg-white px-3 py-1.5 text-xs font-medium text-emerald-800 sm:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />安全工作階段
          </div>
        </header>
        <main className="min-h-[calc(100vh-78px)] p-4 md:p-8">{children}</main>
      </SidebarInset>
    </>
  );
}
