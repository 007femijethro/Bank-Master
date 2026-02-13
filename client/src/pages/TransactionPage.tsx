import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useAccounts, useTransactions, useDeposit, useTransfer, useBillPay, useAccountLookup } from "@/hooks/use-accounts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CurrencyInput } from "@/components/CurrencyInput";
import { AlertCircle, ArrowRight, Loader2, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

export default function TransactionPage() {
  const { user } = useAuth();
  const { data: accounts } = useAccounts();
  const { data: transactions } = useTransactions();
  const deposit = useDeposit();
  const transfer = useTransfer();
  const billPay = useBillPay();
  const { toast } = useToast();

  const [selectedAccount, setSelectedAccount] = useState<string>("");
  const [recipientAccount, setRecipientAccount] = useState("");
  const [amount, setAmount] = useState("");
  const [narration, setNarration] = useState("");
  const [billerType, setBillerType] = useState("");
  
  // Lookup recipient name
  const { data: recipientInfo, isFetching: isLookingUp } = useAccountLookup(recipientAccount);

  const resetForm = () => {
    setAmount("");
    setNarration("");
    setRecipientAccount("");
    setBillerType("");
  };

  const handleDeposit = () => {
    if (!selectedAccount || !amount) return;
    deposit.mutate({
      accountId: Number(selectedAccount),
      amount,
      narration: narration || "Deposit",
    }, {
      onSuccess: () => {
        toast({ title: "Deposit Successful", description: `$${amount} added to your account.` });
        resetForm();
      },
      onError: (e) => toast({ variant: "destructive", title: "Deposit Failed", description: e.message })
    });
  };

  const handleTransfer = () => {
    if (!selectedAccount || !recipientAccount || !amount) return;
    transfer.mutate({
      fromAccountId: Number(selectedAccount),
      toAccountNumber: recipientAccount,
      amount,
      narration: narration || "Transfer",
    }, {
      onSuccess: () => {
        toast({ title: "Transfer Successful", description: `$${amount} sent to ${recipientInfo?.fullName || recipientAccount}.` });
        resetForm();
      },
      onError: (e) => toast({ variant: "destructive", title: "Transfer Failed", description: e.message })
    });
  };

  const handleBillPay = () => {
    if (!selectedAccount || !billerType || !amount) return;
    billPay.mutate({
      fromAccountId: Number(selectedAccount),
      billerType,
      amount,
      narration: narration || `Bill Payment - ${billerType}`,
    }, {
      onSuccess: () => {
        toast({ title: "Payment Successful", description: `Paid $${amount} for ${billerType}.` });
        resetForm();
      },
      onError: (e) => toast({ variant: "destructive", title: "Payment Failed", description: e.message })
    });
  };

  const isFrozen = user?.status === 'frozen';

  if (isFrozen) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <AlertCircle className="w-16 h-16 text-destructive" />
        <h2 className="text-2xl font-bold">Account Restricted</h2>
        <p className="text-muted-foreground text-center max-w-md">
          Your account status is currently frozen. You cannot perform any transactions.
          Please contact customer support for assistance.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-display font-bold">Transactions</h2>
        <p className="text-muted-foreground">Manage your money securely</p>
      </div>

      <Tabs defaultValue="transfer" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 lg:w-[600px]">
          <TabsTrigger value="deposit">Deposit</TabsTrigger>
          <TabsTrigger value="transfer">Transfer</TabsTrigger>
          <TabsTrigger value="bills">Bill Pay</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="deposit">
          <Card>
            <CardHeader>
              <CardTitle>Deposit Funds</CardTitle>
              <CardDescription>Add money to your account instantly.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 max-w-md">
              <div className="space-y-2">
                <Label>Select Account</Label>
                <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select account" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts?.map((acc) => (
                      <SelectItem key={acc.id} value={String(acc.id)}>
                        {acc.type.replace('_', ' ')} - {acc.accountNumber} (${Number(acc.balance).toLocaleString(undefined, { minimumFractionDigits: 2 })})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <CurrencyInput
                label="Amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
              <div className="space-y-2">
                <Label>Narration (Optional)</Label>
                <Input value={narration} onChange={(e) => setNarration(e.target.value)} placeholder="e.g. Savings" />
              </div>
              <Button 
                className="w-full" 
                onClick={handleDeposit} 
                disabled={!selectedAccount || !amount || deposit.isPending}
              >
                {deposit.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Complete Deposit
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transfer">
          <Card>
            <CardHeader>
              <CardTitle>Transfer Money</CardTitle>
              <CardDescription>Send money to another SecureBank user.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 max-w-md">
              <div className="space-y-2">
                <Label>From Account</Label>
                <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select source account" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts?.map((acc) => (
                      <SelectItem key={acc.id} value={String(acc.id)}>
                        {acc.type.replace('_', ' ')} - {acc.accountNumber} (${Number(acc.balance).toLocaleString(undefined, { minimumFractionDigits: 2 })})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Recipient Account Number</Label>
                <div className="relative">
                  <Input 
                    value={recipientAccount} 
                    onChange={(e) => setRecipientAccount(e.target.value)} 
                    placeholder="10-digit account number"
                    maxLength={10}
                  />
                  {isLookingUp && <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />}
                  {recipientInfo && (
                    <div className="absolute right-3 top-2.5 flex items-center text-green-600 text-xs font-bold bg-green-50 px-2 py-0.5 rounded-full">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      {recipientInfo.fullName}
                    </div>
                  )}
                </div>
              </div>

              <CurrencyInput
                label="Amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
              
              <div className="space-y-2">
                <Label>Narration (Optional)</Label>
                <Input value={narration} onChange={(e) => setNarration(e.target.value)} placeholder="e.g. Lunch money" />
              </div>

              <Button 
                className="w-full" 
                onClick={handleTransfer} 
                disabled={!selectedAccount || !recipientAccount || !amount || transfer.isPending}
              >
                {transfer.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ArrowRight className="w-4 h-4 mr-2" />}
                Send Money
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bills">
          <Card>
            <CardHeader>
              <CardTitle>Pay Bills</CardTitle>
              <CardDescription>Pay for utilities and services directly.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 max-w-md">
              <div className="space-y-2">
                <Label>From Account</Label>
                <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select source account" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts?.map((acc) => (
                      <SelectItem key={acc.id} value={String(acc.id)}>
                        {acc.type.replace('_', ' ')} - {acc.accountNumber} (${Number(acc.balance).toLocaleString(undefined, { minimumFractionDigits: 2 })})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Biller</Label>
                <Select value={billerType} onValueChange={setBillerType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select biller" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="airtime">Airtime Recharge</SelectItem>
                    <SelectItem value="internet">Internet Data</SelectItem>
                    <SelectItem value="electricity">Electricity Bill</SelectItem>
                    <SelectItem value="cable">Cable TV</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <CurrencyInput
                label="Amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />

              <Button 
                className="w-full" 
                onClick={handleBillPay} 
                disabled={!selectedAccount || !billerType || !amount || billPay.isPending}
              >
                {billPay.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Pay Bill
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Transaction History</CardTitle>
            </CardHeader>
            <CardContent>
              {transactions && transactions.length > 0 ? (
                <div className="rounded-md border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="p-3 text-left font-medium">Date</th>
                        <th className="p-3 text-left font-medium">Description</th>
                        <th className="p-3 text-left font-medium">Reference</th>
                        <th className="p-3 text-right font-medium">Amount</th>
                        <th className="p-3 text-center font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((tx) => (
                        <tr key={tx.id} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="p-3">
                            {format(new Date(tx.createdAt || new Date()), "MMM d, yyyy")}
                          </td>
                          <td className="p-3">
                            <div className="font-medium capitalize">{tx.type}</div>
                            <div className="text-xs text-muted-foreground">{tx.narration}</div>
                          </td>
                          <td className="p-3 font-mono text-xs">{tx.reference}</td>
                          <td className={`p-3 text-right font-bold ${
                            tx.type === 'deposit' || tx.type === 'adjustment_credit' ? 'text-green-600' : 'text-foreground'
                          }`}>
                            {tx.type === 'deposit' || tx.type === 'adjustment_credit' ? '+' : '-'}${Number(tx.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td className="p-3 text-center">
                            <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                              tx.status === 'success' ? 'bg-green-50 text-green-700' : 
                              tx.status === 'failed' ? 'bg-red-50 text-red-700' : 
                              'bg-yellow-50 text-yellow-700'
                            }`}>
                              {tx.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No transaction history available.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
