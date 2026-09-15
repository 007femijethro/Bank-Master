import { useMemo, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useAccounts, useTransactions, useDeposit, useTransfer, useBillPay, useAccountLookup } from "@/hooks/use-accounts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CurrencyInput } from "@/components/CurrencyInput";
import { AlertCircle, ArrowRight, Loader2, CheckCircle2, Printer, Search, Star, Trash2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useBeneficiaries } from "@/hooks/use-product";

export default function TransactionPage() {
  const { user } = useAuth();
  const { data: accounts } = useAccounts();
  const { data: transactions } = useTransactions();
  const deposit = useDeposit();
  const transfer = useTransfer();
  const billPay = useBillPay();
  const beneficiaries = useBeneficiaries();
  const { toast } = useToast();

  const [selectedAccount, setSelectedAccount] = useState<string>("");
  const [recipientAccount, setRecipientAccount] = useState("");
  const [amount, setAmount] = useState("");
  const [narration, setNarration] = useState("");
  const [billerType, setBillerType] = useState("");
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [receipt, setReceipt] = useState<any>(null);
  const [beneficiaryNickname, setBeneficiaryNickname] = useState("");
  const [transactionSearch, setTransactionSearch] = useState("");
  const [transactionType, setTransactionType] = useState("all");
  
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
        toast({ title: "Deposit Submitted", description: `Your $${amount} deposit is pending admin approval.` });
        resetForm();
      },
      onError: (e) => toast({ variant: "destructive", title: "Deposit Submission Failed", description: e.message })
    });
  };

  const filteredTransactions = useMemo(() => (transactions || []).filter((tx) => {
    const matchesType = transactionType === "all" || tx.type === transactionType;
    const haystack = `${tx.type} ${tx.narration || ""} ${tx.reference}`.toLowerCase();
    return matchesType && haystack.includes(transactionSearch.toLowerCase());
  }), [transactions, transactionSearch, transactionType]);

  const handleTransfer = () => {
    if (!selectedAccount || !recipientAccount || !amount || !recipientInfo) return;
    setConfirmationOpen(true);
  };

  const submitTransfer = () => {
    transfer.mutate({
      fromAccountId: Number(selectedAccount),
      toAccountNumber: recipientAccount,
      amount,
      narration: narration || "Transfer",
      idempotencyKey: crypto.randomUUID(),
    }, {
      onSuccess: (transaction) => {
        setConfirmationOpen(false);
        setReceipt(transaction);
        toast({ title: "Transfer Successful", description: `$${amount} sent to ${recipientInfo?.fullName || recipientAccount}.` });
        resetForm();
      },
      onError: (e) => toast({ variant: "destructive", title: "Transfer Failed", description: e.message })
    });
  };

  const saveBeneficiary = () => {
    if (!beneficiaryNickname.trim() || !recipientAccount || !recipientInfo) return;
    beneficiaries.create.mutate({ nickname: beneficiaryNickname.trim(), accountNumber: recipientAccount }, {
      onSuccess: () => {
        setBeneficiaryNickname("");
        toast({ title: "Beneficiary saved", description: `${recipientInfo.fullName} is now in your saved recipients.` });
      },
      onError: (e) => toast({ variant: "destructive", title: "Could not save beneficiary", description: e.message }),
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
        toast({ title: "Payment Submitted", description: `Your $${amount} bill payment for ${billerType} is pending admin approval.` });
        resetForm();
      },
      onError: (e) => toast({ variant: "destructive", title: "Payment Submission Failed", description: e.message })
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
              <CardDescription>Deposits are submitted for admin review and will post after approval.</CardDescription>
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
                        {acc.type.replace('_', ' ')} - {acc.accountNumber} (Current: ${Number(acc.balance).toLocaleString(undefined, { minimumFractionDigits: 2 })} | Available: ${Number(acc.availableBalance).toLocaleString(undefined, { minimumFractionDigits: 2 })})
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
              <CardDescription>Send money securely to another Redbird FCU member.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 max-w-md">
              {beneficiaries.data?.length > 0 && (
                <div className="space-y-2">
                  <Label>Saved recipient</Label>
                  <Select value={beneficiaries.data.some((b: any) => b.accountNumber === recipientAccount) ? recipientAccount : ""} onValueChange={setRecipientAccount}>
                    <SelectTrigger><SelectValue placeholder="Choose a beneficiary" /></SelectTrigger>
                    <SelectContent>
                      {beneficiaries.data.map((beneficiary: any) => (
                        <SelectItem key={beneficiary.id} value={beneficiary.accountNumber}>
                          {beneficiary.nickname} · ••••{beneficiary.accountNumber.slice(-4)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label>From Account</Label>
                <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select source account" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts?.map((acc) => (
                      <SelectItem key={acc.id} value={String(acc.id)}>
                        {acc.type.replace('_', ' ')} - {acc.accountNumber} (Current: ${Number(acc.balance).toLocaleString(undefined, { minimumFractionDigits: 2 })} | Available: ${Number(acc.availableBalance).toLocaleString(undefined, { minimumFractionDigits: 2 })})
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

              {recipientInfo && !beneficiaries.data?.some((b: any) => b.accountNumber === recipientAccount) && (
                <div className="flex gap-2 rounded-lg border bg-muted/30 p-3">
                  <Input
                    value={beneficiaryNickname}
                    onChange={(e) => setBeneficiaryNickname(e.target.value)}
                    placeholder="Nickname, e.g. Mum"
                  />
                  <Button variant="outline" onClick={saveBeneficiary} disabled={!beneficiaryNickname.trim() || beneficiaries.create.isPending}>
                    <Star className="mr-2 h-4 w-4" /> Save
                  </Button>
                </div>
              )}

              {beneficiaries.data?.some((b: any) => b.accountNumber === recipientAccount) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                  onClick={() => beneficiaries.remove.mutate(beneficiaries.data.find((b: any) => b.accountNumber === recipientAccount).id)}
                >
                  <Trash2 className="mr-2 h-4 w-4" /> Remove saved recipient
                </Button>
              )}

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
                disabled={!selectedAccount || !recipientAccount || !amount || !recipientInfo || transfer.isPending}
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
              <CardDescription>Bill payments are submitted for admin review before posting.</CardDescription>
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
                        {acc.type.replace('_', ' ')} - {acc.accountNumber} (Current: ${Number(acc.balance).toLocaleString(undefined, { minimumFractionDigits: 2 })} | Available: ${Number(acc.availableBalance).toLocaleString(undefined, { minimumFractionDigits: 2 })})
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
                    <SelectItem value="electricity">Electric Utility</SelectItem>
                    <SelectItem value="water">Water Utility</SelectItem>
                    <SelectItem value="gas">Natural Gas</SelectItem>
                    <SelectItem value="internet">Internet Service</SelectItem>
                    <SelectItem value="mobile">Mobile Phone</SelectItem>
                    <SelectItem value="insurance_auto">Auto Insurance</SelectItem>
                    <SelectItem value="insurance_home">Home Insurance</SelectItem>
                    <SelectItem value="insurance_health">Health Insurance</SelectItem>
                    <SelectItem value="mortgage">Mortgage</SelectItem>
                    <SelectItem value="rent">Rent</SelectItem>
                    <SelectItem value="credit_card">Credit Card</SelectItem>
                    <SelectItem value="student_loan">Student Loan</SelectItem>
                    <SelectItem value="car_loan">Auto Loan</SelectItem>
                    <SelectItem value="medical">Medical Bill</SelectItem>
                    <SelectItem value="property_tax">Property Tax</SelectItem>
                    <SelectItem value="hoa">HOA Dues</SelectItem>
                    <SelectItem value="streaming">Streaming Services</SelectItem>
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
              <CardDescription>Search by description or reference and filter by transaction type.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_220px]">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input className="pl-9" value={transactionSearch} onChange={(e) => setTransactionSearch(e.target.value)} placeholder="Search transactions" />
                </div>
                <Select value={transactionType} onValueChange={setTransactionType}>
                  <SelectTrigger><SelectValue placeholder="All types" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All types</SelectItem>
                    <SelectItem value="transfer">Transfers</SelectItem>
                    <SelectItem value="deposit">Deposits</SelectItem>
                    <SelectItem value="bill_payment">Bill payments</SelectItem>
                    <SelectItem value="adjustment_credit">Credits</SelectItem>
                    <SelectItem value="adjustment_debit">Debits</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {transactions && transactions.length > 0 ? (
                <div className="overflow-x-auto rounded-md border">
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
                      {filteredTransactions.map((tx) => (
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
                              tx.status === 'success' || tx.status === 'posted' ? 'bg-green-50 text-green-700' :
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
                  {filteredTransactions.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">No transactions match your filters.</div>}
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

      <Dialog open={confirmationOpen} onOpenChange={setConfirmationOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm transfer</DialogTitle>
            <DialogDescription>Review these details carefully before sending. Transfers cannot be reversed automatically.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 rounded-lg bg-muted/40 p-4 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Recipient</span><span className="font-medium">{recipientInfo?.fullName}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Account</span><span className="font-mono">••••{recipientAccount.slice(-4)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Amount</span><span className="text-lg font-bold">${Number(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Narration</span><span>{narration || "Transfer"}</span></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmationOpen(false)}>Go back</Button>
            <Button onClick={submitTransfer} disabled={transfer.isPending}>
              {transfer.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Confirm and send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!receipt} onOpenChange={(open) => !open && setReceipt(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-green-600" /> Transfer receipt</DialogTitle>
            <DialogDescription>Your transfer was completed successfully.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 rounded-lg border p-4 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Reference</span><span className="font-mono text-xs">{receipt?.reference}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Amount</span><span className="text-lg font-bold">${Number(receipt?.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Status</span><span className="font-medium capitalize text-green-700">{receipt?.status}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Date</span><span>{receipt?.createdAt ? format(new Date(receipt.createdAt), "MMM d, yyyy h:mm a") : "Just now"}</span></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" /> Print receipt</Button>
            <Button onClick={() => setReceipt(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
