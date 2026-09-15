import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { lazy, Suspense } from "react";

const AuthPage = lazy(() => import("@/pages/AuthPage"));
const CustomerDashboard = lazy(() => import("@/pages/CustomerDashboard"));
const TransactionPage = lazy(() => import("@/pages/TransactionPage"));
const AdminDashboard = lazy(() => import("@/pages/AdminDashboard"));
const ApplyPage = lazy(() => import("@/pages/ApplyPage"));
const CryptoPage = lazy(() => import("@/pages/CryptoPage"));
const MobileDepositPage = lazy(() => import("@/pages/MobileDepositPage"));
const CreditCardsPage = lazy(() => import("@/pages/CreditCardsPage"));

function ProtectedRoute({ component: Component, adminOnly = false }: { component: React.ComponentType, adminOnly?: boolean }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/" />;
  }

  if (adminOnly && user.role !== 'staff') {
    return <Redirect to="/dashboard" />;
  }

  return (
    <Layout>
      <Component />
    </Layout>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={AuthPage} />
      
      <Route path="/dashboard">
        <ProtectedRoute component={CustomerDashboard} />
      </Route>
      <Route path="/transactions">
        <ProtectedRoute component={TransactionPage} />
      </Route>
      <Route path="/apply">
        <ProtectedRoute component={ApplyPage} />
      </Route>
      <Route path="/crypto">
        <ProtectedRoute component={CryptoPage} />
      </Route>
      <Route path="/credit-cards">
        <ProtectedRoute component={CreditCardsPage} />
      </Route>
      <Route path="/mobile-deposit">
        <ProtectedRoute component={MobileDepositPage} />
      </Route>

      <Route path="/admin">
        <ProtectedRoute component={AdminDashboard} adminOnly />
      </Route>
      <Route path="/admin/logs">
        <ProtectedRoute component={AdminDashboard} adminOnly />
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
          <Router />
        </Suspense>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
