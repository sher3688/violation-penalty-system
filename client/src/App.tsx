import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { DashboardLayoutSkeleton } from "@/components/DashboardLayoutSkeleton";
import AuthPage from "@/pages/AuthPage";
import CaseDetailPage from "@/pages/CaseDetailPage";
import CaseFormPage from "@/pages/CaseFormPage";
import CasesPage from "@/pages/CasesPage";
import DashboardPage from "@/pages/DashboardPage";
import NotFound from "@/pages/NotFound";
import PrintNoticePage from "@/pages/PrintNoticePage";
import ProfilePage from "@/pages/ProfilePage";
import ReportsPage from "@/pages/ReportsPage";
import MonthlyPenaltyExportPage from "@/pages/MonthlyPenaltyExportPage";
import HouseholdPenaltyExportPage from "@/pages/HouseholdPenaltyExportPage";
import ResidentsPage from "@/pages/ResidentsPage";
import TemplatesPage from "@/pages/TemplatesPage";
import { ComponentType, useEffect } from "react";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";

type ProtectedOptions = { adminOnly?: boolean; bare?: boolean };

function withProtection(Page: ComponentType, options: ProtectedOptions = {}) {
  return function ProtectedPage() {
    const { user, loading } = useAuth();
    const [, setLocation] = useLocation();

    useEffect(() => {
      if (!loading && !user) setLocation("/login");
      if (!loading && user && options.adminOnly && user.role !== "admin") setLocation("/");
    }, [loading, setLocation, user]);

    if (loading) return <DashboardLayoutSkeleton />;
    if (!user || (options.adminOnly && user.role !== "admin")) return null;
    if (options.bare) return <Page />;
    return <DashboardLayout><Page /></DashboardLayout>;
  };
}

function LoginRoute() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  useEffect(() => {
    if (!loading && user) setLocation("/");
  }, [loading, setLocation, user]);
  if (loading || user) return <DashboardLayoutSkeleton />;
  return <AuthPage />;
}

const DashboardRoute = withProtection(DashboardPage);
const NewCaseRoute = withProtection(CaseFormPage, { adminOnly: true });
const EditCaseRoute = withProtection(CaseFormPage, { adminOnly: true });
const CasesRoute = withProtection(CasesPage, { adminOnly: true });
const CaseDetailRoute = withProtection(CaseDetailPage);
const MyCasesRoute = withProtection(CasesPage);
const TemplatesRoute = withProtection(TemplatesPage, { adminOnly: true });
const ResidentsRoute = withProtection(ResidentsPage, { adminOnly: true });
const ReportsRoute = withProtection(ReportsPage, { adminOnly: true });
const MonthlyPenaltyExportRoute = withProtection(MonthlyPenaltyExportPage, { adminOnly: true });
const HouseholdPenaltyExportRoute = withProtection(HouseholdPenaltyExportPage, { adminOnly: true });
const PrintRoute = withProtection(PrintNoticePage, { bare: true });
const ProfileRoute = withProtection(ProfilePage);

function Router() {
  return (
    <Switch>
      <Route path="/login" component={LoginRoute} />
      <Route path="/" component={DashboardRoute} />
      <Route path="/cases/new" component={NewCaseRoute} />
      <Route path="/cases/:id/edit" component={EditCaseRoute} />
      <Route path="/cases" component={CasesRoute} />
      <Route path="/my-cases" component={MyCasesRoute} />
      <Route path="/cases/:id" component={CaseDetailRoute} />
      {import.meta.env.DEV && <Route path="/print-preview" component={PrintNoticePage} />}
      <Route path="/print/:id" component={PrintRoute} />
      <Route path="/profile" component={ProfileRoute} />
      <Route path="/templates" component={TemplatesRoute} />
      <Route path="/residents" component={ResidentsRoute} />
      <Route path="/reports/household-penalties/export" component={HouseholdPenaltyExportRoute} />
      <Route path="/reports" component={ReportsRoute} />
      <Route path="/monthly-penalties/export" component={MonthlyPenaltyExportRoute} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster richColors position="top-right" />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
