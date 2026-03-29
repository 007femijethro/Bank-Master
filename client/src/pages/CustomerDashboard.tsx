import { useMemo, useState } from "react";
import { Link } from "wouter";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import {
  Bell,
  CircleDot,
  Eye,
  EyeOff,
  Hand,
  Landmark,
  Plus,
  Send,
  ArrowDown,
  Grid2x2,
  ChevronRight,
  Users,
  ChartNoAxesCombined,
  Wallet,
  CreditCard,
  User,
  BadgeDollarSign,
  Coins,
  ArrowUp,
  ArrowDownToLine,
  Gem,
  ShieldCheck,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useAccounts, useTransactions } from "@/hooks/use-accounts";
import { cn } from "@/lib/utils";

const CRYPTO_DATA = [
  { symbol: "BTC", name: "Bitcoin", basePrice: 97284.5 },
  { symbol: "ETH", name: "Ethereum", basePrice: 3642.8 },
  { symbol: "SOL", name: "Solana", basePrice: 178.45 },
  { symbol: "ADA", name: "Cardano", basePrice: 0.87 },
  { symbol: "DOT", name: "Polkadot", basePrice: 8.92 },
  { symbol: "LINK", name: "Chainlink", basePrice: 22.15 },
  { symbol: "XRP", name: "Ripple", basePrice: 2.34 },
  { symbol: "DOGE", name: "Dogecoin", basePrice: 0.32 },
];

const SERVICE_CARDS = [
  {
    title: "Loans",
    detail: "Quick approval process",
    status: "Available",
    cta: "Apply Now",
    icon: Landmark,
    color: "from-blue-500 to-indigo-500",
  },
  {
    title: "Grants",
    detail: "Amount: $5,000.00",
    status: "Rejected",
    cta: "View Status",
    icon: BadgeDollarSign,
    color: "from-emerald-500 to-green-500",
  },
  {
    title: "Tax Refunds",
    detail: "Fast processing",
    status: "Available",
    cta: "Apply Now",
    icon: Wallet,
    color: "from-violet-500 to-fuchsia-500",
  },
  {
    title: "Virtual Cards",
    detail: "Card ending in •••• 3061",
    status: "Active",
    cta: "Manage Cards",
    icon: CreditCard,
    color: "from-orange-500 to-red-500",
  },
] as const;

export default function CustomerDashboard() {
  const { user } = useAuth();
  const { data: accounts, isLoading } = useAccounts();
  const { data: transactions } = useTransactions();
  const [activeAccountIndex, setActiveAccountIndex] = useState(0);
  const [hideBalance, setHideBalance] = useState(false);

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

  const fiatAccount = accounts?.[0];
  const cryptoTotalValue = (cryptoHoldings || []).reduce((sum: number, h: any) => {
    const coin = CRYPTO_DATA.find((c) => c.symbol === h.symbol);
    return sum + (coin ? parseFloat(h.amount) * coin.basePrice : 0);
  }, 0);

  const btcHolding = (cryptoHoldings || []).find((h: any) => h.symbol === "BTC");
  const btcPrice = CRYPTO_DATA.find((c) => c.symbol === "BTC")?.basePrice || 0;
  const btcAmount = btcHolding ? Number(btcHolding.amount) : 0;

  const accountCards = useMemo(
    () => [
      {
        id: "fiat",
        title: "CITY PRIME BANK",
        type: "Fiat Account",
        displayBalance: fiatAccount ? Number(fiatAccount.balance) : 0,
        subtitle: "Available Balance",
        rightValue: fiatAccount ? `•••• ${fiatAccount.accountNumber.slice(-4)}` : "•••• 8308",
        status: "Active",
        footerText: `Last updated: ${format(new Date(), "MMM dd, HH:mm")}`,
        gradient: "from-sky-500 via-cyan-500 to-blue-800",
      },
      {
        id: "crypto",
        title: "BITCOIN WALLET",
        type: "Crypto Account",
        displayBalance: btcAmount,
        subtitle: "Bitcoin Balance",
        rightValue: "₿ BTC",
        status: "Live Rate",
        footerText: `1 BTC = $${btcPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
        gradient: "from-slate-500 via-slate-600 to-slate-900",
      },
    ],
    [btcAmount, btcPrice, fiatAccount],
  );

  const currentCard = accountCards[activeAccountIndex];

  const monthlyIncome = (transactions || [])
    .filter((tx) => tx.type === "deposit" || tx.type === "adjustment_credit")
    .reduce((sum, tx) => sum + Number(tx.amount), 0);

  const monthlyExpense = (transactions || [])
    .filter((tx) => tx.type === "transfer" || tx.type === "billpay" || tx.type === "adjustment_debit" || tx.type === "credit_card_purchase" || tx.type === "fee_assessment")
    .reduce((sum, tx) => sum + Number(tx.amount), 0);

  const limit = 500000;
  const accountHealth = fiatAccount ? Number(fiatAccount.balance) : 0;
  const usageRatio = Math.min((accountHealth / limit) * 100, 100);

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Loading dashboard...</div>;
  }

  return (
    <div className="mx-auto max-w-xl rounded-[34px] bg-[#050b29] px-5 pb-28 pt-6 text-white shadow-2xl">
      <div className="mb-6 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Avatar className="h-12 w-12 border-2 border-white/25">
            <AvatarImage src={user?.avatarUrl || ""} alt={user?.fullName || "User"} />
            <AvatarFallback className="bg-cyan-100 text-cyan-900">{user?.fullName?.charAt(0) || "U"}</AvatarFallback>
          </Avatar>
          <div>
            <p className="text-3xl font-semibold leading-none">Good Morning <Hand className="inline h-5 w-5" /></p>
            <p className="mt-1 text-2xl font-bold">{user?.fullName || "user user"}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="rounded-full bg-white/15 p-3" aria-label="theme">
            <CircleDot className="h-5 w-5 text-yellow-300" />
          </button>
          <button className="relative rounded-full bg-white/15 p-3" aria-label="notifications">
            <Bell className="h-5 w-5" />
            <span className="absolute -right-1 -top-1 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold">4</span>
          </button>
        </div>
      </div>

      <div className="rounded-3xl bg-[#0a1240] p-3">
        <div className={cn("relative overflow-hidden rounded-3xl bg-gradient-to-br p-5", currentCard.gradient)}>
          <div className="flex items-start justify-between text-white/90">
            <div>
              <p className="text-sm tracking-[0.2em]">{currentCard.title}</p>
              <p className="text-xl font-semibold">{user?.fullName || "user user"}</p>
            </div>
            <div className="text-right">
              <p className="text-sm">{currentCard.type}</p>
              <p className="text-2xl font-semibold">{currentCard.rightValue}</p>
            </div>
          </div>

          <div className="mt-7 text-center">
            <p className="text-xl">{currentCard.subtitle}</p>
            <div className="mt-1 flex items-center justify-center gap-2 text-5xl font-bold">
              <span>
                {hideBalance
                  ? "••••••"
                  : activeAccountIndex === 0
                    ? `$${currentCard.displayBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : `${currentCard.displayBalance.toFixed(6)} BTC`}
              </span>
              <button onClick={() => setHideBalance((v) => !v)}>
                {hideBalance ? <Eye className="h-6 w-6" /> : <EyeOff className="h-6 w-6" />}
              </button>
            </div>
            {activeAccountIndex === 1 && !hideBalance && (
              <p className="mt-2 text-3xl">≈ ${cryptoTotalValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
            )}
          </div>

          <div className="mt-8 flex items-center justify-between text-xl">
            <div className="rounded-full bg-emerald-200 px-3 py-1 text-sm font-semibold text-emerald-900">• Active</div>
            <p>{currentCard.footerText}</p>
          </div>
        </div>

        <div className="my-4 flex justify-center gap-2">
          {accountCards.map((item, i) => (
            <button
              key={item.id}
              onClick={() => setActiveAccountIndex(i)}
              className={cn("h-2.5 w-2.5 rounded-full", i === activeAccountIndex ? "bg-white" : "bg-white/35")}
            />
          ))}
        </div>

        <p className="mb-5 text-center text-xl text-white/80">Swipe to switch between accounts</p>

        <div className="grid grid-cols-4 gap-2 pb-4">
          {[
            { label: "Top Up", icon: Plus, color: "bg-yellow-400 text-black" },
            { label: "Send", icon: Send, color: "bg-white/35" },
            { label: "Receive", icon: ArrowDown, color: "bg-white/35" },
            { label: "More", icon: Grid2x2, color: "bg-white/35" },
          ].map((action) => (
            <button key={action.label} className="flex flex-col items-center gap-2">
              <div className={cn("grid h-16 w-16 place-items-center rounded-full", action.color)}>
                <action.icon className="h-7 w-7" />
              </div>
              <span className="text-xl font-medium">{action.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-4xl font-bold">Quick Transfer</h3>
          <span className="flex items-center text-xl text-cyan-300">View All <ChevronRight className="ml-1 h-5 w-5" /></span>
        </div>
        <div className="flex gap-6">
          <div className="grid h-20 w-20 place-items-center rounded-full border border-dashed border-white/40 bg-white/5">
            <Plus className="h-8 w-8 text-white/60" />
          </div>
          <div className="grid h-20 w-20 place-items-center rounded-full bg-white/10">
            <Users className="h-8 w-8 text-white/40" />
          </div>
        </div>
        <p className="mt-2 text-xl text-white/70">No saved beneficiaries</p>
      </div>

      <div className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-4xl font-bold">Your Active Cards</h3>
          <Link href="/credit-cards" className="flex items-center text-xl text-cyan-300">Manage <ChevronRight className="ml-1 h-5 w-5" /></Link>
        </div>
        <div className="rounded-3xl bg-white/10 p-4">
          <div className="rounded-3xl bg-gradient-to-br from-sky-400 to-blue-600 p-4">
            <p className="text-4xl font-bold">City Prime</p>
            <p className="text-xl text-white/85">Virtual Banking</p>
            <p className="mt-4 text-2xl tracking-[0.4em]">•••• •••• •••• {creditCardsList?.[0]?.lastFour || "3061"}</p>
            <div className="mt-3 flex items-end justify-between">
              <div>
                <p className="text-xl text-white/85">Card Holder</p>
                <p className="text-2xl font-semibold">{user?.fullName || "user"}</p>
              </div>
              <div className="text-right">
                <p className="text-xl text-white/85">Valid</p>
                <p className="text-2xl font-semibold">11/28</p>
              </div>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between text-2xl">
            <p>American Express Card <span className="text-emerald-400">• Active</span></p>
            <p className="font-bold">USD {Number(creditCardsList?.[0]?.currentBalance || 0).toFixed(2)}</p>
          </div>
          <Link href="/credit-cards">
            <Button className="mt-3 h-11 w-full rounded-full bg-cyan-100 text-sky-900 hover:bg-cyan-200">Manage Card</Button>
          </Link>
        </div>
      </div>

      <div className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-4xl font-bold">Financial Services</h3>
          <Link href="/apply" className="flex items-center text-xl text-cyan-300">View All <ChevronRight className="ml-1 h-5 w-5" /></Link>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {SERVICE_CARDS.map((service) => (
            <div key={service.title} className="rounded-3xl bg-white/10 p-4">
              <div className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-black/20">
                <service.icon className="h-6 w-6" />
              </div>
              <p className="text-3xl font-semibold">{service.title}</p>
              <p className={cn("mt-1 inline-block rounded-full px-3 py-1 text-sm", service.status === "Rejected" ? "bg-red-500/20 text-red-300" : "bg-white/15 text-white/80")}>{service.status}</p>
              <p className="mt-3 text-xl text-white/80">{service.detail}</p>
              <Button className={cn("mt-4 h-10 w-full rounded-full bg-gradient-to-r text-white", service.color)}>{service.cta}</Button>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-4xl font-bold">Financial Insights</h3>
          <Link href="/transactions" className="flex items-center text-xl text-cyan-300">View Report <ChevronRight className="ml-1 h-5 w-5" /></Link>
        </div>

        <div className="rounded-3xl bg-white/10 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-500/20">
                <ShieldCheck className="h-6 w-6 text-amber-300" />
              </div>
              <div>
                <p className="text-3xl font-semibold">Account Health</p>
                <p className="text-xl text-amber-300">Fair</p>
              </div>
            </div>
            <p className="text-right text-xl">Balance Ratio<br /><span className="text-3xl font-semibold">{usageRatio.toFixed(1)}%</span></p>
          </div>
          <div className="mt-4 h-3 rounded-full bg-white/20">
            <div className="h-3 rounded-full bg-amber-400" style={{ width: `${usageRatio}%` }} />
          </div>
          <p className="mt-2 text-xl text-white/80">${accountHealth.toLocaleString(undefined, { minimumFractionDigits: 2 })} of ${limit.toLocaleString(undefined, { minimumFractionDigits: 2 })} limit</p>
        </div>

        <div className="mt-4 rounded-3xl bg-white/10 p-4">
          <p className="text-3xl font-semibold">This Month</p>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div className="rounded-2xl bg-black/20 p-4 text-center">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-emerald-500/20">
                <ArrowDownToLine className="h-6 w-6 text-emerald-300" />
              </div>
              <p className="mt-3 text-xl text-white/75">Income</p>
              <p className="text-4xl font-bold text-emerald-300">${monthlyIncome.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
            <div className="rounded-2xl bg-black/20 p-4 text-center">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-rose-500/20">
                <ArrowUp className="h-6 w-6 text-rose-300" />
              </div>
              <p className="mt-3 text-xl text-white/75">Expenses</p>
              <p className="text-4xl font-bold text-rose-300">${monthlyExpense.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="fixed bottom-3 left-1/2 z-20 w-[min(92vw,28rem)] -translate-x-1/2 rounded-3xl border border-white/20 bg-[#0a1240]/90 p-3 backdrop-blur">
        <div className="grid grid-cols-5 gap-2 text-center text-sm">
          <Link href="/transactions" className="flex flex-col items-center gap-1 text-white/85"><ChartNoAxesCombined className="h-5 w-5" />Activity</Link>
          <Link href="/transactions" className="flex flex-col items-center gap-1 text-white/85"><Send className="h-5 w-5" />Transfer</Link>
          <Link href="/dashboard" className="-mt-6 rounded-2xl bg-sky-500 py-3 text-white shadow-lg"><HomeTabIcon /></Link>
          <Link href="/credit-cards" className="flex flex-col items-center gap-1 text-white/85"><CreditCard className="h-5 w-5" />Cards</Link>
          <button className="flex flex-col items-center gap-1 text-white/85"><User className="h-5 w-5" />Profile</button>
        </div>
      </div>
    </div>
  );
}

function HomeTabIcon() {
  return (
    <span className="flex flex-col items-center gap-1 text-white">
      <Gem className="h-5 w-5" />
      Home
    </span>
  );
}
