import { useAuth } from "@/hooks/use-auth";
import { useAccounts } from "@/hooks/use-accounts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { TrendingUp, TrendingDown, ArrowUpRight, ArrowDownLeft, Coins, Send } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const CRYPTO_DATA = [
  { symbol: "BTC", name: "Bitcoin", basePrice: 97284.50, change24h: 2.34, icon: "B" },
  { symbol: "ETH", name: "Ethereum", basePrice: 3642.80, change24h: -1.12, icon: "E" },
  { symbol: "SOL", name: "Solana", basePrice: 178.45, change24h: 5.67, icon: "S" },
  { symbol: "ADA", name: "Cardano", basePrice: 0.87, change24h: -0.45, icon: "A" },
  { symbol: "DOT", name: "Polkadot", basePrice: 8.92, change24h: 1.89, icon: "D" },
  { symbol: "LINK", name: "Chainlink", basePrice: 22.15, change24h: 3.21, icon: "L" },
  { symbol: "XRP", name: "Ripple", basePrice: 2.34, change24h: -2.05, icon: "X" },
  { symbol: "DOGE", name: "Dogecoin", basePrice: 0.32, change24h: 7.12, icon: "D" },
];

function useSimulatedPrices() {
  const [prices, setPrices] = useState(CRYPTO_DATA.map(c => ({ ...c, price: c.basePrice })));

  useEffect(() => {
    const interval = setInterval(() => {
      setPrices(prev => prev.map(coin => {
        const variation = (Math.random() - 0.5) * 0.002;
        return { ...coin, price: coin.price * (1 + variation) };
      }));
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return prices;
}

export default function CryptoPage() {
  const { user } = useAuth();
  const { data: accounts } = useAccounts();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const prices = useSimulatedPrices();

  const [buyOpen, setBuyOpen] = useState(false);
  const [sellOpen, setSellOpen] = useState(false);
  const [selectedCrypto, setSelectedCrypto] = useState<string>("");
  const [buyAmount, setBuyAmount] = useState("");
  const [sellAmount, setSellAmount] = useState("");
  const [selectedAccount, setSelectedAccount] = useState<string>("");
  const [selectedHolding, setSelectedHolding] = useState<string>("");
  const [sendOpen, setSendOpen] = useState(false);
  const [sendHolding, setSendHolding] = useState<string>("");
  const [sendAmount, setSendAmount] = useState("");
  const [sendRecipient, setSendRecipient] = useState("");

  const { data: holdings } = useQuery({
    queryKey: ["/api/crypto/holdings"],
    queryFn: async () => {
      const res = await fetch("/api/crypto/holdings");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const buyCrypto = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/crypto/buy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crypto/holdings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      setBuyOpen(false);
      setBuyAmount("");
      toast({ title: "Purchase Complete", description: "Cryptocurrency purchased successfully." });
    },
    onError: (e: any) => {
      toast({ variant: "destructive", title: "Purchase Failed", description: e.message });
    },
  });

  const sellCrypto = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/crypto/sell", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crypto/holdings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      setSellOpen(false);
      setSellAmount("");
      toast({ title: "Sale Complete", description: "Cryptocurrency sold successfully." });
    },
    onError: (e: any) => {
      toast({ variant: "destructive", title: "Sale Failed", description: e.message });
    },
  });

  const sendCrypto = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/crypto/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message);
      }
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/crypto/holdings"] });
      setSendOpen(false);
      setSendAmount("");
      setSendRecipient("");
      setSendHolding("");
      toast({ title: "Transfer Complete", description: data.message });
    },
    onError: (e: any) => {
      toast({ variant: "destructive", title: "Transfer Failed", description: e.message });
    },
  });

  const handleBuy = () => {
    if (!selectedCrypto || !buyAmount || !selectedAccount) return;
    const coin = prices.find(c => c.symbol === selectedCrypto);
    if (!coin) return;
    const cryptoAmount = (parseFloat(buyAmount) / coin.price).toFixed(8);
    buyCrypto.mutate({
      symbol: coin.symbol,
      name: coin.name,
      amountUsd: parseFloat(buyAmount).toFixed(2),
      cryptoAmount,
      accountId: parseInt(selectedAccount),
    });
  };

  const handleSell = () => {
    if (!selectedHolding || !sellAmount || !selectedAccount) return;
    const holding = holdings?.find((h: any) => h.id === parseInt(selectedHolding));
    if (!holding) return;
    const coin = prices.find(c => c.symbol === holding.symbol);
    if (!coin) return;
    const usdAmount = (parseFloat(sellAmount) * coin.price).toFixed(2);
    sellCrypto.mutate({
      holdingId: parseInt(selectedHolding),
      amountCrypto: sellAmount,
      usdAmount,
      accountId: parseInt(selectedAccount),
    });
  };

  const handleSend = () => {
    if (!sendHolding || !sendAmount || !sendRecipient) return;
    const holding = holdings?.find((h: any) => h.id === parseInt(sendHolding));
    if (!holding) return;
    const amt = parseFloat(sendAmount);
    if (amt <= 0 || amt > parseFloat(holding.amount)) {
      toast({ variant: "destructive", title: "Invalid Amount", description: `Amount must be between 0 and ${parseFloat(holding.amount).toFixed(8)}` });
      return;
    }
    sendCrypto.mutate({
      holdingId: parseInt(sendHolding),
      amountCrypto: sendAmount,
      recipientIdentifier: sendRecipient,
    });
  };

  const totalCryptoValue = holdings?.reduce((sum: number, h: any) => {
    const coin = prices.find(c => c.symbol === h.symbol);
    return sum + (coin ? parseFloat(h.amount) * coin.price : 0);
  }, 0) || 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-display font-bold text-foreground">Crypto Portfolio</h2>
          <p className="text-muted-foreground">Buy, sell, and track cryptocurrency directly from your Redbird FCU account.</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={buyOpen} onOpenChange={setBuyOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-buy-crypto">
                <ArrowDownLeft className="w-4 h-4 mr-2" /> Buy Crypto
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Buy Cryptocurrency</DialogTitle>
                <DialogDescription>Purchase crypto using funds from your account.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Select Cryptocurrency</Label>
                  <Select value={selectedCrypto} onValueChange={setSelectedCrypto}>
                    <SelectTrigger data-testid="select-buy-crypto"><SelectValue placeholder="Choose crypto" /></SelectTrigger>
                    <SelectContent>
                      {prices.map(c => (
                        <SelectItem key={c.symbol} value={c.symbol}>{c.name} ({c.symbol}) - ${c.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Amount (USD)</Label>
                  <Input data-testid="input-buy-amount" type="number" placeholder="100.00" value={buyAmount} onChange={(e) => setBuyAmount(e.target.value)} />
                  {selectedCrypto && buyAmount && (
                    <p className="text-xs text-muted-foreground">
                      You'll receive approximately {(parseFloat(buyAmount || "0") / (prices.find(c => c.symbol === selectedCrypto)?.price || 1)).toFixed(8)} {selectedCrypto}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>From Account</Label>
                  <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                    <SelectTrigger data-testid="select-buy-account"><SelectValue placeholder="Select account" /></SelectTrigger>
                    <SelectContent>
                      {accounts?.map(acc => (
                        <SelectItem key={acc.id} value={String(acc.id)}>{acc.type.replace('_', ' ')} - ${Number(acc.balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button data-testid="button-confirm-buy" onClick={handleBuy} disabled={buyCrypto.isPending}>
                  {buyCrypto.isPending ? "Processing..." : "Confirm Purchase"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={sellOpen} onOpenChange={setSellOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-sell-crypto" variant="outline" disabled={!holdings?.length}>
                <ArrowUpRight className="w-4 h-4 mr-2" /> Sell Crypto
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Sell Cryptocurrency</DialogTitle>
                <DialogDescription>Sell your crypto and deposit funds to your account.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Select Holding</Label>
                  <Select value={selectedHolding} onValueChange={setSelectedHolding}>
                    <SelectTrigger data-testid="select-sell-holding"><SelectValue placeholder="Choose holding" /></SelectTrigger>
                    <SelectContent>
                      {holdings?.filter((h: any) => parseFloat(h.amount) > 0).map((h: any) => (
                        <SelectItem key={h.id} value={String(h.id)}>{h.name} ({h.symbol}) - {parseFloat(h.amount).toFixed(8)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Amount to Sell (Crypto)</Label>
                  <Input data-testid="input-sell-amount" type="number" step="0.00000001" placeholder="0.001" value={sellAmount} onChange={(e) => setSellAmount(e.target.value)} />
                  {selectedHolding && sellAmount && (
                    <p className="text-xs text-muted-foreground">
                      You'll receive approximately ${(parseFloat(sellAmount || "0") * (prices.find(c => c.symbol === holdings?.find((h: any) => h.id === parseInt(selectedHolding))?.symbol)?.price || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>To Account</Label>
                  <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                    <SelectTrigger data-testid="select-sell-account"><SelectValue placeholder="Select account" /></SelectTrigger>
                    <SelectContent>
                      {accounts?.map(acc => (
                        <SelectItem key={acc.id} value={String(acc.id)}>{acc.type.replace('_', ' ')} - ${Number(acc.balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button data-testid="button-confirm-sell" onClick={handleSell} disabled={sellCrypto.isPending}>
                  {sellCrypto.isPending ? "Processing..." : "Confirm Sale"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={sendOpen} onOpenChange={setSendOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-send-crypto" variant="outline" disabled={!holdings?.length}>
                <Send className="w-4 h-4 mr-2" /> Send Crypto
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Send Cryptocurrency</DialogTitle>
                <DialogDescription>Transfer crypto to another Redbird FCU member using their email or member number.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Select Holding</Label>
                  <Select value={sendHolding} onValueChange={setSendHolding}>
                    <SelectTrigger data-testid="select-send-holding"><SelectValue placeholder="Choose holding" /></SelectTrigger>
                    <SelectContent>
                      {holdings?.filter((h: any) => parseFloat(h.amount) > 0).map((h: any) => (
                        <SelectItem key={h.id} value={String(h.id)}>{h.name} ({h.symbol}) - {parseFloat(h.amount).toFixed(8)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Amount to Send</Label>
                  <Input data-testid="input-send-amount" type="number" step="0.00000001" min="0.00000001" placeholder="0.001" value={sendAmount} onChange={(e) => setSendAmount(e.target.value)} />
                  {sendHolding && (
                    <p className="text-xs text-muted-foreground">
                      Available: {parseFloat(holdings?.find((h: any) => h.id === parseInt(sendHolding))?.amount || "0").toFixed(8)} {holdings?.find((h: any) => h.id === parseInt(sendHolding))?.symbol}
                    </p>
                  )}
                  {sendHolding && sendAmount && (
                    <p className="text-xs text-muted-foreground">
                      Estimated value: ${(parseFloat(sendAmount || "0") * (prices.find(c => c.symbol === holdings?.find((h: any) => h.id === parseInt(sendHolding))?.symbol)?.price || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Recipient (Email or Member Number)</Label>
                  <Input data-testid="input-send-recipient" type="text" placeholder="member@email.com or 1234567" value={sendRecipient} onChange={(e) => setSendRecipient(e.target.value)} />
                </div>
              </div>
              <DialogFooter>
                <Button data-testid="button-confirm-send" onClick={handleSend} disabled={sendCrypto.isPending}>
                  {sendCrypto.isPending ? "Processing..." : "Send Crypto"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-primary text-primary-foreground border-none">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium opacity-90">Total Portfolio Value</CardTitle>
            <Coins className="w-5 h-5 opacity-70" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-display">${totalCryptoValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <p className="text-xs opacity-70 mt-1">{holdings?.length || 0} assets held</p>
          </CardContent>
        </Card>
      </div>

      {holdings && holdings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Your Holdings</CardTitle>
            <CardDescription>Current cryptocurrency portfolio</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="p-3 text-left font-medium">Asset</th>
                    <th className="p-3 text-right font-medium">Amount</th>
                    <th className="p-3 text-right font-medium">Price</th>
                    <th className="p-3 text-right font-medium">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {holdings.filter((h: any) => parseFloat(h.amount) > 0).map((h: any) => {
                    const coin = prices.find(c => c.symbol === h.symbol);
                    const value = coin ? parseFloat(h.amount) * coin.price : 0;
                    return (
                      <tr key={h.id} className="border-b last:border-0">
                        <td className="p-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">{h.symbol.charAt(0)}</div>
                            <div>
                              <div className="font-medium">{h.name}</div>
                              <div className="text-xs text-muted-foreground">{h.symbol}</div>
                            </div>
                          </div>
                        </td>
                        <td className="p-3 text-right font-mono">{parseFloat(h.amount).toFixed(8)}</td>
                        <td className="p-3 text-right">${coin?.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="p-3 text-right font-medium">${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Market Prices</CardTitle>
          <CardDescription>Live simulated cryptocurrency prices (updates every 5 seconds)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {prices.map(coin => (
              <Card key={coin.symbol} className="hover-elevate">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">{coin.icon}</div>
                      <div>
                        <p className="font-medium text-sm">{coin.symbol}</p>
                        <p className="text-xs text-muted-foreground">{coin.name}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className={`gap-1 ${coin.change24h >= 0 ? "text-green-600" : "text-red-500"}`}>
                      {coin.change24h >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {coin.change24h >= 0 ? "+" : ""}{coin.change24h}%
                    </Badge>
                  </div>
                  <p className="text-lg font-bold font-display">${coin.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
