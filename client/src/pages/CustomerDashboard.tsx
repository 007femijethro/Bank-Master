import { useAuth } from "@/hooks/use-auth";
import { useAccounts, useTransactions } from "@/hooks/use-accounts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  Bell,
  ChevronRight,
  Eye,
  EyeOff,
  FileText,
  Receipt,
  Send,
  ShieldCheck,
  Smartphone,
  Trash2,
  Wallet,
} from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";
import { Link } from "wouter";
import { useNotifications } from "@/hooks/use-product";

const money = (value: string | number) =>
  Number(value).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });

const accountLabel = (type: string) => {
  if (type === "share_savings") return "Share Savings";
  if (type === "checking") return "Checking";
  return type.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
};

export default function CustomerDashboard() {
  const { user } = useAuth();
  const { data: accounts, isLoading } = useAccounts();
  const { data: transactions } = useTransactions();
  const notifications = useNotifications();
  const [showBalances, setShowBalances] = useState(true);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const unreadNotifications = (notifications.data || []).filter((item: any) => !item.read).length;
  const recentTransactions = transactions?.slice(0, 8) || [];
  const userAccountIds = new Set((accounts || []).map((account) => account.id));
  const totalAvailable = (accounts || []).reduce((sum, account) => sum + Number(account.availableBalance), 0);
  const firstName = user?.fullName?.trim().split(/\s+/)[0] || "Member";

  const isCreditTransaction = (tx: any) => {
    const toMine = tx.toAccountId ? userAccountIds.has(tx.toAccountId) : false;
    const fromMine = tx.fromAccountId ? userAccountIds.has(tx.fromAccountId) : false;

    if (toMine && !fromMine) return true;
    if (fromMine && !toMine) return false;

    return tx.type === "deposit" || tx.type === "adjustment_credit";
  };

  const transactionDescription = (tx: any) =>
    tx.merchantName ||
    tx.counterparty ||
    tx.narration ||
    String(tx.type || "Transaction").replaceAll("_", " ");

  if (isLoading) {
    return <div className="py-16 text-center text-sm text-muted-foreground">Loading your accounts…</div>;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 sm:space-y-8">
      {user?.status === "frozen" && (
        <Alert variant="destructive" className="border-red-200 bg-red-50 text-red-800">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Account access restricted</AlertTitle>
          <AlertDescription>Please contact member support for assistance.</AlertDescription>
        </Alert>
      )}

      <section className="border-b pb-5 sm:pb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-primary">Online banking</p>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Welcome back, {firstName}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Member #{user?.memberNumber || "—"}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Dialog open={notificationsOpen} onOpenChange={setNotificationsOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="icon" className="relative" aria-label="Notifications">
                  <Bell className="h-4 w-4" />
                  {unreadNotifications > 0 && (
                    <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white">
                      {unreadNotifications}
                    </span>
                  )}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Notifications</DialogTitle>
                  <DialogDescription>Account and transaction updates.</DialogDescription>
                </DialogHeader>
                <div className="max-h-[55vh] divide-y overflow-y-auto rounded-md border">
                  {notifications.data?.length ? (
                    notifications.data.map((item: any) => (
                      <div key={item.id} className={item.read ? "p-4" : "bg-primary/[0.04] p-4"}>
                        <div className="flex items-start justify-between gap-3">
                          <button
                            className="flex-1 text-left"
                            onClick={() => !item.read && notifications.markRead.mutate(item.id)}
                          >
                            <p className="text-sm font-semibold capitalize">
                              {String(item.eventType || "Account update").replaceAll("_", " ")}
                            </p>
                            <p className="mt-1 text-sm text-muted-foreground">{item.message}</p>
                            <p className="mt-2 text-xs text-muted-foreground">
                              {format(new Date(item.createdAt), "MMM d, yyyy · h:mm a")}
                            </p>
                          </button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => notifications.remove.mutate(item.id)}
                            aria-label="Delete notification"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-10 text-center text-sm text-muted-foreground">You’re all caught up.</div>
                  )}
                </div>
              </DialogContent>
            </Dialog>

            <Button variant="outline" size="icon" onClick={() => setShowBalances((value) => !value)} aria-label="Toggle balances">
              {showBalances ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>

            <Link href="/apply" className="hidden sm:block">
              <Button>Open an account</Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Desktop quick actions. Hidden on mobile by request. */}
      <section className="hidden grid-cols-4 gap-3 sm:grid">
        <Link href="/transactions">
          <Button variant="outline" className="h-12 w-full justify-start bg-white">
            <Send className="mr-2 h-4 w-4 text-primary" /> Transfer money
          </Button>
        </Link>
        <Link href="/transactions">
          <Button variant="outline" className="h-12 w-full justify-start bg-white">
            <Receipt className="mr-2 h-4 w-4 text-primary" /> Pay bills
          </Button>
        </Link>
        <Link href="/mobile-deposit">
          <Button variant="outline" className="h-12 w-full justify-start bg-white">
            <Smartphone className="mr-2 h-4 w-4 text-primary" /> Deposit check
          </Button>
        </Link>
        <Link href="/apply">
          <Button variant="outline" className="h-12 w-full justify-start bg-white">
            <FileText className="mr-2 h-4 w-4 text-primary" /> Apply
          </Button>
        </Link>
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between">
          <div>
            <h2 className="text-lg font-semibold sm:text-xl">Accounts</h2>
            <p className="text-sm text-muted-foreground">Your Redbird FCU deposit accounts</p>
          </div>
          <div className="hidden text-right sm:block">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Total available</p>
            <p className="text-lg font-semibold">{showBalances ? money(totalAvailable) : "••••••"}</p>
          </div>
        </div>

        <Card className="overflow-hidden">
          <CardContent className="p-0">
            {accounts?.length ? (
              <div className="divide-y">
                {accounts.map((account) => (
                  <div key={account.id} className="p-4 sm:p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                          <Wallet className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold">{accountLabel(account.type)}</p>
                            <span className="text-xs text-muted-foreground">•••• {account.accountNumber.slice(-4)}</span>
                          </div>
                          <p className="mt-1 text-xs capitalize text-muted-foreground">{account.status}</p>
                        </div>
                      </div>

                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Available balance</p>
                        <p className="mt-0.5 text-xl font-semibold tracking-tight sm:text-2xl">
                          {showBalances ? money(account.availableBalance) : "••••••"}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Current {showBalances ? money(account.balance) : "••••••"}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center">
                <ShieldCheck className="mx-auto mb-3 h-8 w-8 text-primary" />
                <p className="font-medium">No active accounts</p>
                <p className="mt-1 text-sm text-muted-foreground">Apply for an account to get started.</p>
                <Link href="/apply">
                  <Button className="mt-4">Apply now</Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold sm:text-xl">Recent activity</h2>
            <p className="text-sm text-muted-foreground">Latest transactions across your accounts</p>
          </div>
          <Link href="/transactions">
            <Button variant="ghost" size="sm" className="text-primary">
              View all <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </Link>
        </div>

        <Card className="overflow-hidden">
          <CardContent className="p-0">
            {recentTransactions.length ? (
              <div className="divide-y">
                {recentTransactions.map((tx: any) => {
                  const credit = isCreditTransaction(tx);
                  const pending = tx.status === "pending";
                  return (
                    <div key={tx.id} className="flex items-center justify-between gap-3 p-4 sm:px-5">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-muted text-foreground">
                          {credit ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{transactionDescription(tx)}</p>
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                            <span>{format(new Date(tx.createdAt || new Date()), "MMM d")}</span>
                            <span className="capitalize">{String(tx.rail || tx.type).replaceAll("_", " ")}</span>
                            {pending && <span className="font-medium text-amber-700">Pending</span>}
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        <p className={`text-sm font-semibold tabular-nums ${credit ? "text-emerald-700" : "text-foreground"}`}>
                          {credit ? "+" : "-"}{money(tx.amount)}
                        </p>
                        {!pending && tx.status && (
                          <p className="mt-0.5 text-[11px] capitalize text-muted-foreground">{tx.status}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 text-center text-sm text-muted-foreground">No recent transactions.</div>
            )}
          </CardContent>
        </Card>
      </section>

      <footer className="border-t py-6 text-center text-xs leading-5 text-muted-foreground">
        Redbird FCU demo online banking · Interface simulation only · Not a real financial institution
      </footer>
    </div>
  );
}
