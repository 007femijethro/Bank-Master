import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/AuthPage";
import CustomerDashboard from "@/pages/CustomerDashboard";
import TransactionPage from "@/pages/TransactionPage";
import AdminDashboard from "@/pages/AdminDashboard";
import ApplyPage from "@/pages/ApplyPage";
import CryptoPage from "@/pages/CryptoPage";
import MobileDepositPage from "@/pages/MobileDepositPage";
import CreditCardsPage from "@/pages/CreditCardsPage";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";

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
        <Router />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
