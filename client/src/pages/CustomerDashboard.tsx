import { useAuth } from "@/hooks/use-auth";
import { useAccounts, useCreateAccount, useTransactions } from "@/hooks/use-accounts";
import { StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Plus, Wallet, ArrowUpRight, ArrowDownLeft, AlertCircle, RefreshCw, CreditCard, Settings2, History, Coins, Home, Eye, EyeOff, Send, ArrowDown, Grid2x2, Users, ChevronRight, Landmark, HandCoins, Receipt, LineChart, TrendingUp, TrendingDown } from "lucide-react";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { api } from "@shared/routes";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Link } from "wouter";

const CRYPTO_DATA = [
  { symbol: "BTC", name: "Bitcoin", basePrice: 97284.50 },
  { symbol: "ETH", name: "Ethereum", basePrice: 3642.80 },
  { symbol: "SOL", name: "Solana", basePrice: 178.45 },
  { symbol: "ADA", name: "Cardano", basePrice: 0.87 },
  { symbol: "DOT", name: "Polkadot", basePrice: 8.92 },
  { symbol: "LINK", name: "Chainlink", basePrice: 22.15 },
  { symbol: "XRP", name: "Ripple", basePrice: 2.34 },
  { symbol: "DOGE", name: "Dogecoin", basePrice: 0.32 },
];

export default function CustomerDashboard() {
  const { user } = useAuth();
  const { data: accounts, isLoading } = useAccounts();
  const { data: transactions } = useTransactions();
  const createAccount = useCreateAccount();
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [accountType, setAccountType] = useState<"share_savings" | "checking" | "loan" | "home_equity" | "credit_card">("share_savings");
  const [showCardDetails, setShowCardDetails] = useState(false);
  const [activeSnapshot, setActiveSnapshot] = useState<"fiat" | "crypto">("fiat");
  const [hideSnapshotBalance, setHideSnapshotBalance] = useState(false);
  
  const queryClient = useQueryClient();

  const { data: creditCardsList } = useQuery({
    queryKey: ["/api/credit-cards"],
    queryFn: async () => {
      const res = await fetch("/api/credit-cards");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: cryptoHoldings } = useQuery({
    queryKey: ["/api/crypto/holdings"],
    queryFn: async () => {
      const res = await fetch("/api/crypto/holdings");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const cryptoTotalValue = (cryptoHoldings || []).reduce((sum: number, h: any) => {
    const coin = CRYPTO_DATA.find(c => c.symbol === h.symbol);
    return sum + (coin ? parseFloat(h.amount) * coin.basePrice : 0);
  }, 0);
  const btcHolding = (cryptoHoldings || []).find((h: any) => h.symbol === "BTC");
  const btcPrice = CRYPTO_DATA.find((c) => c.symbol === "BTC")?.basePrice || 0;

  const homeEquityAccounts = accounts?.filter(a => (a.type as string) === "home_equity") || [];
  const fiatAccount = accounts?.find((a) => (a.type as string) !== "loan");
  const primaryCreditCard = creditCardsList?.[0];
  const updateWidgets = useMutation({
    mutationFn: async (newWidgets: string[]) => {
      const res = await fetch("/api/user/widgets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ widgets: newWidgets }),
      });
      if (!res.ok) throw new Error("Failed to update widgets");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData([api.auth.me.path], data);
      toast({ title: "Preferences Saved", description: "Your dashboard layout has been updated." });
    }
  });

  const totalBalance = accounts?.reduce((sum, acc) => sum + Number(acc.balance), 0) || 0;
  const recentTransactions = transactions?.slice(0, 5) || [];
  const monthlyIncome = (transactions || [])
    .filter((tx) => tx.type === "deposit" || tx.type === "adjustment_credit")
    .reduce((sum, tx) => sum + Number(tx.amount), 0);
  const monthlyExpenses = (transactions || [])
    .filter((tx) => tx.type === "transfer" || tx.type === "billpay" || tx.type === "adjustment_debit" || tx.type === "credit_card_purchase" || tx.type === "fee_assessment")
    .reduce((sum, tx) => sum + Number(tx.amount), 0);
  const utilizationLimit = 500000;
  const utilizationRatio = Math.min((totalBalance / utilizationLimit) * 100, 100);
  const userAccountIds = new Set((accounts || []).map((acc) => acc.id));

  const isCreditTransaction = (tx: any) => {
    const toMine = tx.toAccountId ? userAccountIds.has(tx.toAccountId) : false;
    const fromMine = tx.fromAccountId ? userAccountIds.has(tx.fromAccountId) : false;

    if (toMine && !fromMine) return true;
    if (fromMine && !toMine) return false;

    return tx.type === "deposit" || tx.type === "adjustment_credit";
  };

  const currentWidgets = user?.dashboardWidgets || ["balance", "activity", "cards", "crypto", "home_equity"];

  const toggleWidget = (widget: string) => {
    const newWidgets = currentWidgets.includes(widget)
      ? currentWidgets.filter(w => w !== widget)
      : [...currentWidgets, widget];
    updateWidgets.mutate(newWidgets);
  };

  function handleCreateAccount() {
    createAccount.mutate({ type: accountType }, {
      onSuccess: () => {
        setIsCreateOpen(false);
        toast({
          title: "Application Submitted",
          description: `Your ${accountType.replace('_', ' ')} application is pending staff approval.`,
        });
      },
      onError: (e) => {
        toast({ variant: "destructive", title: "Submission Failed", description: e.message });
      }
    });
  }

  if (isLoading) return <div className="p-8 text-center">Loading...</div>;

  return (
    <div className="space-y-8">
      {user?.status === 'frozen' && (
        <Alert variant="destructive" className="bg-red-50 border-red-200 text-red-800">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Account Frozen</AlertTitle>
          <AlertDescription>Your account has been frozen. Please contact support.</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <Avatar className="w-12 h-12 border-2 border-primary/10">
            <AvatarImage src={user?.avatarUrl || ""} alt={user?.fullName} />
            <AvatarFallback className="bg-primary/10 text-primary font-bold">
              {user?.fullName?.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <div>
            <h2 className="text-3xl font-display font-bold text-foreground">Redbird FCU Dashboard</h2>
            <p className="text-muted-foreground">Member: {user?.fullName} | Member #: {user?.memberNumber}</p>
          </div>
        </div>
        
        <div className="flex gap-2">
          <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="icon">
                <Settings2 className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Customize Dashboard</DialogTitle>
                <DialogDescription>Choose which widgets you want to see.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                {[
                  { id: "balance", label: "Total Balance" },
                  { id: "activity", label: "Recent Activity" },
                  { id: "cards", label: "Credit Cards" },
                  { id: "crypto", label: "Crypto Portfolio" },
                  { id: "home_equity", label: "Home Equity" },
                ].map((w) => (
                  <div key={w.id} className="flex items-center space-x-2">
                    <Checkbox 
                      id={w.id} 
                      checked={currentWidgets.includes(w.id)}
                      onCheckedChange={() => toggleWidget(w.id)}
                    />
                    <label htmlFor={w.id} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      {w.label}
                    </label>
                  </div>
                ))}
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="shadow-lg shadow-primary/20" disabled={user?.status === 'frozen'}>
                <Plus className="mr-2 h-4 w-4" /> Apply for Account
              </Button>
            </DialogTrigger>
            <DialogContent>
            <DialogHeader>
              <DialogTitle>Account Application</DialogTitle>
              <DialogDescription>Apply for a new account, loan, or credit line. Applications are reviewed by staff.</DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <RadioGroup value={accountType} onValueChange={(v) => setAccountType(v as any)} className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <RadioGroupItem value="share_savings" id="share_savings" className="peer sr-only" />
                  <Label htmlFor="share_savings" className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent peer-data-[state=checked]:border-primary cursor-pointer">
                    <Wallet className="mb-3 h-6 w-6" /> Share Savings
                  </Label>
                </div>
                <div>
                  <RadioGroupItem value="checking" id="checking" className="peer sr-only" />
                  <Label htmlFor="checking" className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent peer-data-[state=checked]:border-primary cursor-pointer">
                    <RefreshCw className="mb-3 h-6 w-6" /> Checking
                  </Label>
                </div>
                <div>
                  <RadioGroupItem value="loan" id="loan" className="peer sr-only" />
                  <Label htmlFor="loan" className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent peer-data-[state=checked]:border-primary cursor-pointer">
                    <ArrowUpRight className="mb-3 h-6 w-6" /> Personal Loan
                  </Label>
                </div>
                <div>
                  <RadioGroupItem value="home_equity" id="home_equity" className="peer sr-only" />
                  <Label htmlFor="home_equity" className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent peer-data-[state=checked]:border-primary cursor-pointer">
                    <History className="mb-3 h-6 w-6" /> Home Equity
                  </Label>
                </div>
                <div>
                  <RadioGroupItem value="credit_card" id="credit_card" className="peer sr-only" />
                  <Label htmlFor="credit_card" className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent peer-data-[state=checked]:border-primary cursor-pointer">
                    <CreditCard className="mb-3 h-6 w-6" /> Credit Card
                  </Label>
                </div>
              </RadioGroup>
            </div>
            <DialogFooter>
              <Button onClick={handleCreateAccount} disabled={createAccount.isPending}>Submit Application</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {currentWidgets.includes("balance") && (
          <StatCard title="Total Balance" value={`$${totalBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} icon={Wallet} className="bg-primary text-primary-foreground border-none" />
        )}
        {currentWidgets.includes("crypto") && cryptoTotalValue > 0 && (
          <Link href="/crypto">
            <StatCard title="Crypto Portfolio" value={`$${cryptoTotalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} icon={Coins} description={`${(cryptoHoldings || []).length} asset${(cryptoHoldings || []).length !== 1 ? 's' : ''} held`} />
          </Link>
        )}
        {currentWidgets.includes("home_equity") && homeEquityAccounts.length > 0 && (
          homeEquityAccounts.map((acc: any) => (
            <StatCard key={acc.id} title="Home Equity" value={`$${Number(acc.balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}`} icon={Home} description={`Acct: ****${acc.accountNumber.slice(-4)}`} />
          ))
        )}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Account Snapshot</CardTitle>
            <Button variant="ghost" size="icon" onClick={() => setHideSnapshotBalance((v) => !v)}>
              {hideSnapshotBalance ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            </Button>
          </div>
          <CardDescription>Switch between fiat and crypto balances.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button
              variant={activeSnapshot === "fiat" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveSnapshot("fiat")}
            >
              Fiat Account
            </Button>
            <Button
              variant={activeSnapshot === "crypto" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveSnapshot("crypto")}
            >
              Crypto Wallet
            </Button>
          </div>

          {activeSnapshot === "fiat" ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Available Balance</p>
              <p className="text-3xl font-bold">
                {hideSnapshotBalance
                  ? "••••••"
                  : `$${Number(fiatAccount?.availableBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
              </p>
              <p className="text-sm text-muted-foreground">Account: {fiatAccount?.accountNumber || "N/A"}</p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Bitcoin Balance</p>
              <p className="text-3xl font-bold">
                {hideSnapshotBalance ? "••••••" : `${Number(btcHolding?.amount || 0).toFixed(6)} BTC`}
              </p>
              <p className="text-sm text-muted-foreground">
                {hideSnapshotBalance ? "≈ ••••••" : `≈ $${cryptoTotalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} · 1 BTC = ${btcPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Link href="/transactions"><Button variant="outline" className="w-full justify-start"><Plus className="w-4 h-4 mr-2" />Top Up</Button></Link>
          <Link href="/transactions"><Button variant="outline" className="w-full justify-start"><Send className="w-4 h-4 mr-2" />Send</Button></Link>
          <Link href="/transactions"><Button variant="outline" className="w-full justify-start"><ArrowDown className="w-4 h-4 mr-2" />Receive</Button></Link>
          <Link href="/apply"><Button variant="outline" className="w-full justify-start"><Grid2x2 className="w-4 h-4 mr-2" />More</Button></Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Quick Transfer</CardTitle>
          <Link href="/transactions" className="text-sm text-primary font-medium inline-flex items-center">View All <ChevronRight className="w-4 h-4 ml-1" /></Link>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          <Button variant="outline" className="rounded-full w-16 h-16 p-0 border-dashed">
            <Plus className="w-6 h-6" />
          </Button>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="w-4 h-4" />
            No saved beneficiaries
          </div>
        </CardContent>
      </Card>

      {currentWidgets.includes("cards") && primaryCreditCard && (
        <Card data-testid="dashboard-credit-card">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <div>
              <CardTitle className="text-base">Credit Card</CardTitle>
              <CardDescription>****{primaryCreditCard.lastFour} {primaryCreditCard.cardType.replace('_', ' ')}</CardDescription>
            </div>
            <Link href="/credit-cards">
              <Button variant="outline" size="sm" data-testid="button-view-cards">
                Manage <ArrowUpRight className="w-3 h-3 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6 flex-wrap">
              <div className={`relative w-64 aspect-[1.586/1] bg-gradient-to-br ${primaryCreditCard.cardType === 'rewards' ? 'from-violet-600 to-indigo-700' : primaryCreditCard.cardType === 'travel' ? 'from-blue-600 to-cyan-700' : primaryCreditCard.cardType === 'low_interest' ? 'from-emerald-600 to-teal-700' : primaryCreditCard.cardType === 'secured' ? 'from-slate-600 to-zinc-700' : 'from-orange-500 to-amber-600'} rounded-xl p-4 text-white shadow-md`}>
                <div className="flex justify-between items-start">
                  <p className="text-[10px] uppercase tracking-widest opacity-80">REDBIRD FCU</p>
                  <CreditCard className="w-5 h-5 opacity-60" />
                </div>
                <p className="font-mono text-sm tracking-[0.15em] mt-4" data-testid="text-dashboard-card-number">
                  {showCardDetails ? primaryCreditCard.cardNumber.replace(/(.{4})/g, "$1 ").trim() : `**** **** **** ${primaryCreditCard.lastFour}`}
                </p>
                <div className="flex justify-between items-end mt-3 text-[10px]">
                  <div>
                    <p className="opacity-60 uppercase">Cardholder</p>
                    <p className="text-xs font-medium">{primaryCreditCard.cardholderName}</p>
                  </div>
                  <div className="text-right">
                    <p className="opacity-60 uppercase">Exp</p>
                    <p className="text-xs font-mono">{String(primaryCreditCard.expirationMonth).padStart(2, "0")}/{String(primaryCreditCard.expirationYear).slice(-2)}</p>
                  </div>
                  <div className="text-right">
                    <p className="opacity-60 uppercase">CVV</p>
                    <p className="text-xs font-mono">{showCardDetails ? primaryCreditCard.cvv : "***"}</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowCardDetails(!showCardDetails)}
                  className="absolute top-2 right-2 p-1 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                  data-testid="button-toggle-card-reveal"
                >
                  {showCardDetails ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                </button>
              </div>
              <div className="flex-1 min-w-[180px] space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Credit Limit</span>
                  <span className="font-bold" data-testid="text-dash-credit-limit">${Number(primaryCreditCard.creditLimit).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Current Balance</span>
                  <span className="font-bold text-destructive" data-testid="text-dash-card-balance">${Number(primaryCreditCard.currentBalance).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Available Credit</span>
                  <span className="font-bold text-green-600" data-testid="text-dash-available-credit">${(Number(primaryCreditCard.creditLimit) - Number(primaryCreditCard.currentBalance)).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">APR</span>
                  <span className="font-semibold">{primaryCreditCard.apr}%</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all"
                    style={{ width: `${Math.min((Number(primaryCreditCard.currentBalance) / Number(primaryCreditCard.creditLimit)) * 100, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {((Number(primaryCreditCard.currentBalance) / Number(primaryCreditCard.creditLimit)) * 100).toFixed(1)}% utilization
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Financial Services</CardTitle>
          <Link href="/apply" className="text-sm text-primary font-medium inline-flex items-center">View All <ChevronRight className="w-4 h-4 ml-1" /></Link>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-4">
          <Card className="border-muted">
            <CardContent className="pt-5 space-y-3">
              <div className="flex items-center justify-between">
                <p className="font-semibold flex items-center gap-2"><Landmark className="w-4 h-4" />Loans</p>
                <Badge variant="secondary">Available</Badge>
              </div>
              <p className="text-sm text-muted-foreground">Quick approval process</p>
              <Link href="/apply"><Button className="w-full">Apply Now</Button></Link>
            </CardContent>
          </Card>
          <Card className="border-muted">
            <CardContent className="pt-5 space-y-3">
              <div className="flex items-center justify-between">
                <p className="font-semibold flex items-center gap-2"><HandCoins className="w-4 h-4" />Grants</p>
                <Badge variant="destructive">Rejected</Badge>
              </div>
              <p className="text-sm text-muted-foreground">Amount: $5,000.00</p>
              <Link href="/apply"><Button variant="outline" className="w-full">View Status</Button></Link>
            </CardContent>
          </Card>
          <Card className="border-muted">
            <CardContent className="pt-5 space-y-3">
              <div className="flex items-center justify-between">
                <p className="font-semibold flex items-center gap-2"><Receipt className="w-4 h-4" />Tax Refunds</p>
                <Badge variant="secondary">Available</Badge>
              </div>
              <p className="text-sm text-muted-foreground">Fast processing</p>
              <Link href="/apply"><Button className="w-full">Apply Now</Button></Link>
            </CardContent>
          </Card>
          <Card className="border-muted">
            <CardContent className="pt-5 space-y-3">
              <div className="flex items-center justify-between">
                <p className="font-semibold flex items-center gap-2"><CreditCard className="w-4 h-4" />Virtual Cards</p>
                <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Active</Badge>
              </div>
              <p className="text-sm text-muted-foreground">Card ending in •••• {primaryCreditCard?.lastFour || "3061"}</p>
              <Link href="/credit-cards"><Button className="w-full">Manage Cards</Button></Link>
            </CardContent>
          </Card>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Financial Insights</CardTitle>
          <Link href="/transactions" className="text-sm text-primary font-medium inline-flex items-center">View Report <ChevronRight className="w-4 h-4 ml-1" /></Link>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="font-semibold inline-flex items-center gap-2"><LineChart className="w-4 h-4" />Account Health</p>
              <p className="text-sm text-muted-foreground">Balance Ratio {utilizationRatio.toFixed(1)}%</p>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div className="bg-primary rounded-full h-2" style={{ width: `${utilizationRatio}%` }} />
            </div>
            <p className="text-sm text-muted-foreground">${totalBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })} of ${utilizationLimit.toLocaleString(undefined, { minimumFractionDigits: 2 })} limit</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <Card className="border-muted">
              <CardContent className="pt-5">
                <p className="text-sm text-muted-foreground inline-flex items-center gap-2"><TrendingUp className="w-4 h-4 text-emerald-600" />Income</p>
                <p className="text-2xl font-bold text-emerald-600">${monthlyIncome.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
              </CardContent>
            </Card>
            <Card className="border-muted">
              <CardContent className="pt-5">
                <p className="text-sm text-muted-foreground inline-flex items-center gap-2"><TrendingDown className="w-4 h-4 text-red-600" />Expenses</p>
                <p className="text-2xl font-bold text-red-600">${monthlyExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-8 md:grid-cols-2">
        <div className="space-y-4">
          <h3 className="text-xl font-bold font-display">Your Accounts</h3>
          {accounts?.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground border-dashed">No active accounts. Apply to get started.</Card>
          ) : (
            accounts?.map((acc) => (
              <Card key={acc.id}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-base capitalize">{acc.type.replace('_', ' ')} Account</CardTitle>
                  <Badge variant="outline" className="bg-green-50 text-green-700">{acc.status}</Badge>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1">
                    <div className="text-sm text-muted-foreground">Current Balance</div>
                    <div className="text-2xl font-bold">${Number(acc.balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                    <div className="text-sm text-muted-foreground mt-2">Available Balance</div>
                    <div className="text-lg font-semibold">${Number(acc.availableBalance).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 font-mono">{acc.accountNumber}</p>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {currentWidgets.includes("activity") && (
          <div className="space-y-4">
            <h3 className="text-xl font-bold font-display">Recent Activity</h3>
            <Card>
              <CardContent className="p-0">
                {recentTransactions.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">No transactions.</div>
                ) : (
                  <div className="divide-y divide-border">
                    {recentTransactions.map((tx) => (
                      <div key={tx.id} className="flex items-center justify-between p-4">
                        <div className="flex items-center gap-4">
                          <div className={`p-2 rounded-full ${tx.type.includes('adjustment') ? 'bg-purple-100 text-purple-600' : 'bg-muted'}`}>
                            {isCreditTransaction(tx) ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                          </div>
                          <div>
                            <p className="font-medium text-sm capitalize">{tx.type.replace('_', ' ')}</p>
                            <p className="text-xs text-muted-foreground">{format(new Date(tx.createdAt || new Date()), "MMM d, h:mm a")}</p>
                          </div>
                        </div>
                        <div className={`font-bold text-sm ${isCreditTransaction(tx) ? 'text-green-600' : 'text-foreground'}`}>
                          {isCreditTransaction(tx) ? '+' : '-'}${Number(tx.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
      <footer className="text-center py-8 text-xs text-muted-foreground border-t">
        Redbird FCU is federally insured by the NCUA up to $250,000.
      </footer>
    </div>
  );
}
