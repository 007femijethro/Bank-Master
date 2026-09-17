import { useMemo, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import {
  useAccounts,
  useTransactions,
  useDeposit,
  useTransfer,
  useBillPay,
  useAccountLookup,
} from "@/hooks/use-accounts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CurrencyInput } from "@/components/CurrencyInput";
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Loader2,
  Printer,
  Search,
  Star,
  Trash2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useBeneficiaries } from "@/hooks/use-product";

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

const statusClasses = (status: string) => {
  if (["posted", "success"].includes(status)) return "bg-emerald-50 text-emerald-700";
  if (["failed", "returned", "reversed"].includes(status)) return "bg-red-50 text-red-700";
  return "bg-amber-50 text-amber-700";
};

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

  const { data: recipientInfo, isFetching: isLookingUp } = useAccountLookup(recipientAccount);
  const userAccountIds = useMemo(() => new Set((accounts || []).map((account) => account.id)), [accounts]);

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

  const filteredTransactions = useMemo(
    () =>
      (transactions || []).filter((tx: any) => {
        const matchesType = transactionType === "all" || tx.type === transactionType;
        const haystack = [
          tx.type,
          tx.merchantName,
          tx.counterparty,
          tx.narration,
          tx.reference,
          tx.rail,
          tx.status,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return matchesType && haystack.includes(transactionSearch.trim().toLowerCase());
      }),
    [transactions, transactionSearch, transactionType],
  );

  const resetForm = () => {
    setAmount("");
    setNarration("");
    setRecipientAccount("");
    setBillerType("");
  };

  const handleDeposit = () => {
    if (!selectedAccount || !amount) return;
    deposit.mutate(
      {
        accountId: Number(selectedAccount),
        amount,
        narration: narration || "Deposit",
      },
      {
        onSuccess: () => {
          toast({ title: "Deposit submitted", description: `Your ${money(amount)} deposit was submitted for review.` });
          resetForm();
        },
        onError: (error) =>
          toast({ variant: "destructive", title: "Deposit failed", description: error.message }),
      },
    );
  };

  const handleTransfer = () => {
    if (!selectedAccount || !recipientAccount || !amount || !recipientInfo) return;
    setConfirmationOpen(true);
  };

  const submitTransfer = () => {
    transfer.mutate(
      {
        fromAccountId: Number(selectedAccount),
        toAccountNumber: recipientAccount,
        amount,
        narration: narration || "Transfer",
        idempotencyKey: crypto.randomUUID(),
      },
      {
        onSuccess: (transaction) => {
          setConfirmationOpen(false);
          setReceipt(transaction);
          toast({
            title: "Transfer submitted",
            description: `${money(amount)} sent to ${recipientInfo?.fullName || recipientAccount}.`,
          });
          resetForm();
        },
        onError: (error) =>
          toast({ variant: "destructive", title: "Transfer failed", description: error.message }),
      },
    );
  };

  const saveBeneficiary = () => {
    if (!beneficiaryNickname.trim() || !recipientAccount || !recipientInfo) return;
    beneficiaries.create.mutate(
      { nickname: beneficiaryNickname.trim(), accountNumber: recipientAccount },
      {
        onSuccess: () => {
          setBeneficiaryNickname("");
          toast({ title: "Recipient saved", description: `${recipientInfo.fullName} is now in your saved recipients.` });
        },
        onError: (error) =>
          toast({ variant: "destructive", title: "Could not save recipient", description: error.message }),
      },
    );
  };

  const handleBillPay = () => {
    if (!selectedAccount || !billerType || !amount) return;
    billPay.mutate(
      {
        fromAccountId: Number(selectedAccount),
        billerType,
        amount,
        narration: narration || `Bill Payment - ${billerType}`,
      },
      {
        onSuccess: () => {
          toast({ title: "Payment submitted", description: `Your ${money(amount)} payment was submitted.` });
          resetForm();
        },
        onError: (error) =>
          toast({ variant: "destructive", title: "Payment failed", description: error.message }),
      },
    );
  };

  if (user?.status === "frozen") {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center space-y-4">
        <AlertCircle className="h-14 w-14 text-destructive" />
        <h2 className="text-2xl font-semibold">Account access restricted</h2>
        <p className="max-w-md text-center text-muted-foreground">
          Transactions are unavailable while this account is restricted. Please contact member support.
        </p>
      </div>
    );
  }

  const accountOptions = accounts?.map((account) => (
    <SelectItem key={account.id} value={String(account.id)}>
      {accountLabel(account.type)} · ••••{account.accountNumber.slice(-4)} · {money(account.availableBalance)} available
    </SelectItem>
  ));

  return (
    <div className="mx-auto max-w-6xl space-y-6 sm:space-y-8">
      <header className="border-b pb-5 sm:pb-6">
        <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-primary">Online banking</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Account activity</h1>
        <p className="mt-1 text-sm text-muted-foreground">Review transactions and manage money movement.</p>
      </header>

      <Tabs defaultValue="history" className="space-y-6">
        <TabsList className="grid h-auto w-full grid-cols-4 gap-1 p-1 lg:w-[560px]">
          <TabsTrigger value="history" className="text-xs sm:text-sm">Activity</TabsTrigger>
          <TabsTrigger value="transfer" className="text-xs sm:text-sm">Transfer</TabsTrigger>
          <TabsTrigger value="bills" className="text-xs sm:text-sm">Bill pay</TabsTrigger>
          <TabsTrigger value="deposit" className="text-xs sm:text-sm">Deposit</TabsTrigger>
        </TabsList>

        <TabsContent value="history">
          <Card>
            <CardHeader className="border-b pb-4">
              <CardTitle className="text-lg">Transaction history</CardTitle>
              <CardDescription>Search, filter and review activity across your accounts.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="grid gap-3 border-b p-4 sm:grid-cols-[1fr_220px] sm:p-5">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    value={transactionSearch}
                    onChange={(event) => setTransactionSearch(event.target.value)}
                    placeholder="Search description or reference"
                  />
                </div>
                <Select value={transactionType} onValueChange={setTransactionType}>
                  <SelectTrigger><SelectValue placeholder="All transactions" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All transactions</SelectItem>
                    <SelectItem value="transfer">Transfers</SelectItem>
                    <SelectItem value="deposit">Deposits</SelectItem>
                    <SelectItem value="billpay">Bill payments</SelectItem>
                    <SelectItem value="mobile_deposit">Mobile deposits</SelectItem>
                    <SelectItem value="credit_card_purchase">Card purchases</SelectItem>
                    <SelectItem value="credit_card_payment">Card payments</SelectItem>
                    <SelectItem value="adjustment_credit">Credits</SelectItem>
                    <SelectItem value="adjustment_debit">Debits</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {filteredTransactions.length ? (
                <>
                  <div className="divide-y md:hidden">
                    {filteredTransactions.map((tx: any) => {
                      const credit = isCreditTransaction(tx);
                      return (
                        <div key={tx.id} className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex min-w-0 gap-3">
                              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-muted">
                                {credit ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                              </div>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium">{transactionDescription(tx)}</p>
                                <p className="mt-0.5 text-xs text-muted-foreground">
                                  {format(new Date(tx.createdAt || new Date()), "MMM d, yyyy")}
                                  {tx.rail ? ` · ${String(tx.rail).toUpperCase()}` : ""}
                                </p>
                              </div>
                            </div>
                            <p className={`shrink-0 text-sm font-semibold tabular-nums ${credit ? "text-emerald-700" : "text-foreground"}`}>
                              {credit ? "+" : "-"}{money(tx.amount)}
                            </p>
                          </div>
                          <div className="mt-3 flex items-center justify-between gap-3 pl-12">
                            <span className={`rounded-full px-2 py-1 text-[11px] font-medium capitalize ${statusClasses(tx.status)}`}>
                              {tx.status}
                            </span>
                            <span className="truncate font-mono text-[10px] text-muted-foreground">{tx.reference}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="hidden overflow-x-auto md:block">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/40">
                          <th className="px-5 py-3 text-left font-medium text-muted-foreground">Date</th>
                          <th className="px-5 py-3 text-left font-medium text-muted-foreground">Description</th>
                          <th className="px-5 py-3 text-left font-medium text-muted-foreground">Type</th>
                          <th className="px-5 py-3 text-left font-medium text-muted-foreground">Status</th>
                          <th className="px-5 py-3 text-right font-medium text-muted-foreground">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredTransactions.map((tx: any) => {
                          const credit = isCreditTransaction(tx);
                          return (
                            <tr key={tx.id} className="border-b last:border-0 hover:bg-muted/20">
                              <td className="whitespace-nowrap px-5 py-4 align-top">
                                {format(new Date(tx.createdAt || new Date()), "MMM d, yyyy")}
                              </td>
                              <td className="max-w-[360px] px-5 py-4">
                                <p className="truncate font-medium">{transactionDescription(tx)}</p>
                                <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground">{tx.reference}</p>
                              </td>
                              <td className="px-5 py-4 align-top text-muted-foreground">
                                <span className="capitalize">{String(tx.rail || tx.type).replaceAll("_", " ")}</span>
                              </td>
                              <td className="px-5 py-4 align-top">
                                <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium capitalize ${statusClasses(tx.status)}`}>
                                  {tx.status}
                                </span>
                              </td>
                              <td className={`whitespace-nowrap px-5 py-4 text-right align-top font-semibold tabular-nums ${credit ? "text-emerald-700" : "text-foreground"}`}>
                                {credit ? "+" : "-"}{money(tx.amount)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <div className="p-10 text-center text-sm text-muted-foreground">
                  No transactions match your filters.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transfer">
          <Card className="max-w-2xl">
            <CardHeader className="border-b">
              <CardTitle className="text-lg">Transfer money</CardTitle>
              <CardDescription>Send money to another Redbird FCU member.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 p-4 sm:p-6">
              {beneficiaries.data?.length > 0 && (
                <div className="space-y-2">
                  <Label>Saved recipient</Label>
                  <Select
                    value={beneficiaries.data.some((beneficiary: any) => beneficiary.accountNumber === recipientAccount) ? recipientAccount : ""}
                    onValueChange={setRecipientAccount}
                  >
                    <SelectTrigger><SelectValue placeholder="Choose a saved recipient" /></SelectTrigger>
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
                <Label>From account</Label>
                <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                  <SelectTrigger><SelectValue placeholder="Choose an account" /></SelectTrigger>
                  <SelectContent>{accountOptions}</SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Recipient account number</Label>
                <div className="relative">
                  <Input
                    value={recipientAccount}
                    onChange={(event) => setRecipientAccount(event.target.value)}
                    placeholder="10-digit account number"
                    maxLength={10}
                  />
                  {isLookingUp && <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />}
                </div>
                {recipientInfo && (
                  <div className="flex items-center rounded-md bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
                    <CheckCircle2 className="mr-2 h-4 w-4" /> {recipientInfo.fullName}
                  </div>
                )}
              </div>

              {recipientInfo && !beneficiaries.data?.some((beneficiary: any) => beneficiary.accountNumber === recipientAccount) && (
                <div className="flex flex-col gap-2 rounded-md border bg-muted/20 p-3 sm:flex-row">
                  <Input
                    value={beneficiaryNickname}
                    onChange={(event) => setBeneficiaryNickname(event.target.value)}
                    placeholder="Recipient nickname"
                  />
                  <Button variant="outline" onClick={saveBeneficiary} disabled={!beneficiaryNickname.trim() || beneficiaries.create.isPending}>
                    <Star className="mr-2 h-4 w-4" /> Save recipient
                  </Button>
                </div>
              )}

              {beneficiaries.data?.some((beneficiary: any) => beneficiary.accountNumber === recipientAccount) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                  onClick={() => beneficiaries.remove.mutate(beneficiaries.data.find((beneficiary: any) => beneficiary.accountNumber === recipientAccount).id)}
                >
                  <Trash2 className="mr-2 h-4 w-4" /> Remove saved recipient
                </Button>
              )}

              <CurrencyInput label="Amount" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" />

              <div className="space-y-2">
                <Label>Memo (optional)</Label>
                <Input value={narration} onChange={(event) => setNarration(event.target.value)} placeholder="What is this for?" />
              </div>

              <Button className="w-full sm:w-auto" onClick={handleTransfer} disabled={!selectedAccount || !recipientAccount || !amount || !recipientInfo || transfer.isPending}>
                {transfer.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />}
                Review transfer
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bills">
          <Card className="max-w-2xl">
            <CardHeader className="border-b">
              <CardTitle className="text-lg">Pay a bill</CardTitle>
              <CardDescription>Schedule a payment from one of your deposit accounts.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 p-4 sm:p-6">
              <div className="space-y-2">
                <Label>Pay from</Label>
                <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                  <SelectTrigger><SelectValue placeholder="Choose an account" /></SelectTrigger>
                  <SelectContent>{accountOptions}</SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Biller</Label>
                <Select value={billerType} onValueChange={setBillerType}>
                  <SelectTrigger><SelectValue placeholder="Select biller" /></SelectTrigger>
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

              <CurrencyInput label="Amount" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" />

              <Button className="w-full sm:w-auto" onClick={handleBillPay} disabled={!selectedAccount || !billerType || !amount || billPay.isPending}>
                {billPay.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Submit payment
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="deposit">
          <Card className="max-w-2xl">
            <CardHeader className="border-b">
              <CardTitle className="text-lg">Deposit funds</CardTitle>
              <CardDescription>Submit a deposit to one of your accounts.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 p-4 sm:p-6">
              <div className="space-y-2">
                <Label>Deposit to</Label>
                <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                  <SelectTrigger><SelectValue placeholder="Choose an account" /></SelectTrigger>
                  <SelectContent>{accountOptions}</SelectContent>
                </Select>
              </div>

              <CurrencyInput label="Amount" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" />

              <div className="space-y-2">
                <Label>Memo (optional)</Label>
                <Input value={narration} onChange={(event) => setNarration(event.target.value)} placeholder="Deposit memo" />
              </div>

              <Button className="w-full sm:w-auto" onClick={handleDeposit} disabled={!selectedAccount || !amount || deposit.isPending}>
                {deposit.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Submit deposit
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={confirmationOpen} onOpenChange={setConfirmationOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review transfer</DialogTitle>
            <DialogDescription>Confirm the recipient and amount before submitting.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 rounded-md border bg-muted/20 p-4 text-sm">
            <div className="flex justify-between gap-4"><span className="text-muted-foreground">Recipient</span><span className="text-right font-medium">{recipientInfo?.fullName}</span></div>
            <div className="flex justify-between gap-4"><span className="text-muted-foreground">Account</span><span className="font-mono">••••{recipientAccount.slice(-4)}</span></div>
            <div className="flex justify-between gap-4"><span className="text-muted-foreground">Amount</span><span className="text-lg font-semibold">{money(amount || 0)}</span></div>
            <div className="flex justify-between gap-4"><span className="text-muted-foreground">Memo</span><span className="text-right">{narration || "Transfer"}</span></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmationOpen(false)}>Go back</Button>
            <Button onClick={submitTransfer} disabled={transfer.isPending}>
              {transfer.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Submit transfer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!receipt} onOpenChange={(open) => !open && setReceipt(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-emerald-600" /> Transfer receipt</DialogTitle>
            <DialogDescription>Your transfer request has been recorded.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 rounded-md border p-4 text-sm">
            <div className="flex justify-between gap-4"><span className="text-muted-foreground">Reference</span><span className="break-all text-right font-mono text-xs">{receipt?.reference}</span></div>
            <div className="flex justify-between gap-4"><span className="text-muted-foreground">Amount</span><span className="text-lg font-semibold">{money(receipt?.amount || 0)}</span></div>
            <div className="flex justify-between gap-4"><span className="text-muted-foreground">Status</span><span className="capitalize">{receipt?.status}</span></div>
            <div className="flex justify-between gap-4"><span className="text-muted-foreground">Date</span><span>{receipt?.createdAt ? format(new Date(receipt.createdAt), "MMM d, yyyy h:mm a") : "Just now"}</span></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" /> Print</Button>
            <Button onClick={() => setReceipt(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <footer className="border-t py-6 text-center text-xs leading-5 text-muted-foreground">
        Redbird FCU demo online banking · Interface simulation only · Not a real financial institution
      </footer>
    </div>
  );
}
