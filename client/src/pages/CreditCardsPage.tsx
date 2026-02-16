import { useAuth } from "@/hooks/use-auth";
import { useAccounts } from "@/hooks/use-accounts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CreditCard, Eye, EyeOff, ShoppingCart, DollarSign, Lock, Loader2, ArrowRight } from "lucide-react";
import { format } from "date-fns";

const CARD_TYPE_LABELS: Record<string, string> = {
  rewards: "Rewards Card",
  travel: "Travel Card",
  low_interest: "Low Interest",
  secured: "Secured Card",
  student: "Student Card",
};

const CARD_TYPE_COLORS: Record<string, string> = {
  rewards: "from-violet-600 to-indigo-700",
  travel: "from-blue-600 to-cyan-700",
  low_interest: "from-emerald-600 to-teal-700",
  secured: "from-slate-600 to-zinc-700",
  student: "from-orange-500 to-amber-600",
};

const MERCHANTS = [
  "Amazon",
  "Walmart",
  "Target",
  "Starbucks",
  "Shell Gas Station",
  "Netflix",
  "Uber",
  "Whole Foods",
  "Best Buy",
  "Apple Store",
  "Home Depot",
  "Costco",
];

function formatCardNumber(cardNumber: string) {
  return cardNumber.replace(/(.{4})/g, "$1 ").trim();
}

function CreditCardVisual({ card, showDetails, onToggle }: { card: any; showDetails: boolean; onToggle: () => void }) {
  const gradient = CARD_TYPE_COLORS[card.cardType] || "from-gray-600 to-gray-800";

  return (
    <div className={`relative w-full max-w-md aspect-[1.586/1] bg-gradient-to-br ${gradient} rounded-xl p-6 text-white shadow-lg`} data-testid={`card-visual-${card.id}`}>
      <div className="flex justify-between items-start">
        <div>
          <p className="text-xs uppercase tracking-widest opacity-80">RFCU</p>
          <p className="text-sm font-medium mt-1">{CARD_TYPE_LABELS[card.cardType] || card.cardType}</p>
        </div>
        <CreditCard className="w-8 h-8 opacity-60" />
      </div>

      <div className="mt-6">
        <p className="font-mono text-lg tracking-[0.2em]" data-testid={`card-number-${card.id}`}>
          {showDetails ? formatCardNumber(card.cardNumber) : `**** **** **** ${card.lastFour}`}
        </p>
      </div>

      <div className="mt-4 flex justify-between items-end">
        <div>
          <p className="text-[10px] uppercase opacity-60">Cardholder</p>
          <p className="text-sm font-medium tracking-wide" data-testid={`card-holder-${card.id}`}>{card.cardholderName}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase opacity-60">Expires</p>
          <p className="text-sm font-mono" data-testid={`card-expiry-${card.id}`}>
            {String(card.expirationMonth).padStart(2, "0")}/{String(card.expirationYear).slice(-2)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase opacity-60">CVV</p>
          <p className="text-sm font-mono" data-testid={`card-cvv-${card.id}`}>
            {showDetails ? card.cvv : "***"}
          </p>
        </div>
      </div>

      <button
        onClick={onToggle}
        className="absolute top-2 right-2 p-1.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
        data-testid={`button-toggle-details-${card.id}`}
      >
        {showDetails ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}

export default function CreditCardsPage() {
  const { user } = useAuth();
  const { data: bankAccounts } = useAccounts();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [revealedCards, setRevealedCards] = useState<Set<number>>(new Set());
  const [selectedCard, setSelectedCard] = useState<number | null>(null);
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [purchaseAmount, setPurchaseAmount] = useState("");
  const [purchaseMerchant, setPurchaseMerchant] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentAccountId, setPaymentAccountId] = useState("");

  const { data: creditCardsList, isLoading } = useQuery({
    queryKey: ["/api/credit-cards"],
    queryFn: async () => {
      const res = await fetch("/api/credit-cards");
      if (!res.ok) throw new Error("Failed to fetch credit cards");
      return res.json();
    },
  });

  const { data: cardTransactions } = useQuery({
    queryKey: ["/api/credit-cards", selectedCard, "transactions"],
    queryFn: async () => {
      if (!selectedCard) return [];
      const res = await fetch(`/api/credit-cards/${selectedCard}/transactions`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!selectedCard,
  });

  const makePurchase = useMutation({
    mutationFn: async ({ cardId, amount, merchant }: { cardId: number; amount: string; merchant: string }) => {
      const res = await fetch(`/api/credit-cards/${cardId}/purchase`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, merchant }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Purchase failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/credit-cards"] });
      queryClient.invalidateQueries({ queryKey: ["/api/credit-cards", selectedCard, "transactions"] });
      toast({ title: "Purchase Complete", description: `$${purchaseAmount} charged to your card at ${purchaseMerchant}.` });
      setPurchaseOpen(false);
      setPurchaseAmount("");
      setPurchaseMerchant("");
    },
    onError: (e: any) => {
      toast({ variant: "destructive", title: "Purchase Failed", description: e.message });
    },
  });

  const makePayment = useMutation({
    mutationFn: async ({ cardId, amount, fromAccountId }: { cardId: number; amount: string; fromAccountId: number }) => {
      const res = await fetch(`/api/credit-cards/${cardId}/payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, fromAccountId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Payment failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/credit-cards"] });
      queryClient.invalidateQueries({ queryKey: ["/api/credit-cards", selectedCard, "transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
      toast({ title: "Payment Successful", description: `$${paymentAmount} payment applied to your card.` });
      setPaymentOpen(false);
      setPaymentAmount("");
      setPaymentAccountId("");
    },
    onError: (e: any) => {
      toast({ variant: "destructive", title: "Payment Failed", description: e.message });
    },
  });

  const toggleReveal = (cardId: number) => {
    setRevealedCards(prev => {
      const next = new Set(prev);
      if (next.has(cardId)) next.delete(cardId);
      else next.add(cardId);
      return next;
    });
  };

  const cards = creditCardsList || [];
  const activeCard = selectedCard ? cards.find((c: any) => c.id === selectedCard) : cards[0];

  if (cards.length > 0 && !selectedCard && cards[0]) {
    setSelectedCard(cards[0].id);
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-display font-bold text-foreground" data-testid="text-cc-title">Credit Cards</h2>
        <p className="text-muted-foreground">Manage your RFCU credit cards, make purchases, and view statements.</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : cards.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
            <Lock className="w-12 h-12 text-muted-foreground" />
            <div className="text-center">
              <h3 className="text-lg font-semibold" data-testid="text-no-cards">No Credit Cards</h3>
              <p className="text-muted-foreground text-sm mt-1">
                You don't have any credit cards yet. Apply for one from the Apply page, and once staff approves your application, your card will appear here.
              </p>
            </div>
            <Button variant="outline" onClick={() => window.location.href = "/apply"} data-testid="button-apply-cc">
              <CreditCard className="w-4 h-4 mr-2" /> Apply for a Credit Card
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {cards.length > 1 && (
            <div className="flex gap-2 flex-wrap">
              {cards.map((card: any) => (
                <Button
                  key={card.id}
                  variant={selectedCard === card.id ? "default" : "outline"}
                  onClick={() => setSelectedCard(card.id)}
                  className="gap-2"
                  data-testid={`button-select-card-${card.id}`}
                >
                  <CreditCard className="w-4 h-4" />
                  ****{card.lastFour}
                </Button>
              ))}
            </div>
          )}

          {activeCard && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-6">
                <CreditCardVisual
                  card={activeCard}
                  showDetails={revealedCards.has(activeCard.id)}
                  onToggle={() => toggleReveal(activeCard.id)}
                />

                <Card>
                  <CardContent className="pt-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground uppercase">Credit Limit</p>
                        <p className="text-lg font-bold" data-testid="text-credit-limit">${Number(activeCard.creditLimit).toLocaleString("en-US", { minimumFractionDigits: 2 })}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase">Current Balance</p>
                        <p className="text-lg font-bold text-destructive" data-testid="text-current-balance">${Number(activeCard.currentBalance).toLocaleString("en-US", { minimumFractionDigits: 2 })}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase">Available Credit</p>
                        <p className="text-lg font-bold text-green-600" data-testid="text-available-credit">
                          ${(Number(activeCard.creditLimit) - Number(activeCard.currentBalance)).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase">APR</p>
                        <p className="text-lg font-bold" data-testid="text-apr">{activeCard.apr}%</p>
                      </div>
                    </div>

                    <div className="mt-4 w-full bg-muted rounded-full h-2.5">
                      <div
                        className="bg-primary h-2.5 rounded-full transition-all"
                        style={{ width: `${Math.min((Number(activeCard.currentBalance) / Number(activeCard.creditLimit)) * 100, 100)}%` }}
                        data-testid="progress-utilization"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {((Number(activeCard.currentBalance) / Number(activeCard.creditLimit)) * 100).toFixed(1)}% utilization
                    </p>

                    <div className="flex gap-2 mt-4">
                      <Dialog open={purchaseOpen} onOpenChange={setPurchaseOpen}>
                        <DialogTrigger asChild>
                          <Button className="flex-1 gap-2" data-testid="button-make-purchase">
                            <ShoppingCart className="w-4 h-4" /> Make Purchase
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Simulate Purchase</DialogTitle>
                            <DialogDescription>Charge a purchase to your ****{activeCard.lastFour} credit card.</DialogDescription>
                          </DialogHeader>
                          <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                              <Label>Merchant</Label>
                              <Select value={purchaseMerchant} onValueChange={setPurchaseMerchant}>
                                <SelectTrigger data-testid="select-merchant"><SelectValue placeholder="Select merchant" /></SelectTrigger>
                                <SelectContent>
                                  {MERCHANTS.map(m => (
                                    <SelectItem key={m} value={m}>{m}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="grid gap-2">
                              <Label>Amount ($)</Label>
                              <Input
                                data-testid="input-purchase-amount"
                                type="number"
                                step="0.01"
                                placeholder="49.99"
                                value={purchaseAmount}
                                onChange={(e) => setPurchaseAmount(e.target.value)}
                              />
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Available Credit: ${(Number(activeCard.creditLimit) - Number(activeCard.currentBalance)).toFixed(2)}
                            </p>
                          </div>
                          <DialogFooter>
                            <Button
                              data-testid="button-confirm-purchase"
                              disabled={makePurchase.isPending || !purchaseAmount || !purchaseMerchant || parseFloat(purchaseAmount) <= 0}
                              onClick={() => makePurchase.mutate({ cardId: activeCard.id, amount: purchaseAmount, merchant: purchaseMerchant })}
                            >
                              {makePurchase.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                              Confirm Purchase
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>

                      <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
                        <DialogTrigger asChild>
                          <Button variant="outline" className="flex-1 gap-2" data-testid="button-make-payment">
                            <DollarSign className="w-4 h-4" /> Make Payment
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Pay Credit Card</DialogTitle>
                            <DialogDescription>Pay your ****{activeCard.lastFour} balance from your bank account.</DialogDescription>
                          </DialogHeader>
                          <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                              <Label>Pay From</Label>
                              <Select value={paymentAccountId} onValueChange={setPaymentAccountId}>
                                <SelectTrigger data-testid="select-payment-account"><SelectValue placeholder="Select account" /></SelectTrigger>
                                <SelectContent>
                                  {(bankAccounts || []).map((acc: any) => (
                                    <SelectItem key={acc.id} value={String(acc.id)}>
                                      {acc.type === "share_savings" ? "Share Savings" : "Checking"} (****{acc.accountNumber.slice(-4)}) - ${Number(acc.balance).toFixed(2)}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="grid gap-2">
                              <Label>Payment Amount ($)</Label>
                              <Input
                                data-testid="input-payment-amount"
                                type="number"
                                step="0.01"
                                placeholder={Number(activeCard.currentBalance).toFixed(2)}
                                value={paymentAmount}
                                onChange={(e) => setPaymentAmount(e.target.value)}
                              />
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Current Balance: ${Number(activeCard.currentBalance).toFixed(2)}
                            </p>
                          </div>
                          <DialogFooter>
                            <Button
                              data-testid="button-confirm-payment"
                              disabled={makePayment.isPending || !paymentAmount || !paymentAccountId || parseFloat(paymentAmount) <= 0}
                              onClick={() => makePayment.mutate({ cardId: activeCard.id, amount: paymentAmount, fromAccountId: Number(paymentAccountId) })}
                            >
                              {makePayment.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                              Submit Payment
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ArrowRight className="w-5 h-5" /> Card Activity
                  </CardTitle>
                  <CardDescription>Recent transactions on your ****{activeCard.lastFour} card.</CardDescription>
                </CardHeader>
                <CardContent>
                  {!cardTransactions || cardTransactions.length === 0 ? (
                    <p className="text-muted-foreground text-sm text-center py-8" data-testid="text-no-transactions">
                      No transactions yet. Make a purchase to see activity here.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {cardTransactions.map((tx: any) => (
                        <div key={tx.id} className="flex items-center justify-between py-2 border-b last:border-0" data-testid={`cc-transaction-${tx.id}`}>
                          <div className="flex items-center gap-3">
                            {tx.type === "credit_card_purchase" ? (
                              <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                                <ShoppingCart className="w-4 h-4 text-red-600" />
                              </div>
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                                <DollarSign className="w-4 h-4 text-green-600" />
                              </div>
                            )}
                            <div>
                              <p className="text-sm font-medium">{tx.narration}</p>
                              <p className="text-xs text-muted-foreground">
                                {tx.createdAt ? format(new Date(tx.createdAt), "MMM d, yyyy h:mm a") : ""}
                              </p>
                            </div>
                          </div>
                          <p className={`text-sm font-mono font-bold ${tx.type === "credit_card_purchase" ? "text-destructive" : "text-green-600"}`}>
                            {tx.type === "credit_card_purchase" ? "-" : "+"}${Number(tx.amount).toFixed(2)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Card Details</CardTitle>
          <CardDescription>Important information about your RFCU credit cards.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="font-semibold mb-1">Billing Cycle</p>
              <p className="text-muted-foreground">Monthly, 1st of each month</p>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="font-semibold mb-1">Grace Period</p>
              <p className="text-muted-foreground">25 days from statement date</p>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="font-semibold mb-1">Minimum Payment</p>
              <p className="text-muted-foreground">$25 or 2% of balance, whichever is greater</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
