import { useMemo, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useAccounts, useTransactions, useTransfer, useBillPay, useAccountLookup } from "@/hooks/use-accounts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CurrencyInput } from "@/components/CurrencyInput";
import { AlertCircle, ArrowRight, Loader2, CheckCircle2, Globe2, Landmark } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

const INTERNATIONAL_METHODS = [
  "wire_transfer",
  "cryptocurrency",
  "paypal",
  "wise_transfer",
  "cash_app",
  "zelle",
  "venmo",
] as const;

export default function TransactionPage() {
  const { user } = useAuth();
  const { data: accounts } = useAccounts();
  const { data: transactions } = useTransactions();
  const transfer = useTransfer();
  const billPay = useBillPay();
  const { toast } = useToast();

  const [selectedAccount, setSelectedAccount] = useState<string>("");
  const [recipientAccount, setRecipientAccount] = useState("");
  const [amount, setAmount] = useState("");
  const [narration, setNarration] = useState("");
  const [billerType, setBillerType] = useState("");

  const [beneficiaryName, setBeneficiaryName] = useState("");
  const [beneficiaryBank, setBeneficiaryBank] = useState("");
  const [beneficiaryAccountType, setBeneficiaryAccountType] = useState("");
  const [beneficiaryRouting, setBeneficiaryRouting] = useState("");
  const [beneficiarySwift, setBeneficiarySwift] = useState("");
  const [transferPassword, setTransferPassword] = useState("");

  const [internationalMethod, setInternationalMethod] = useState<(typeof INTERNATIONAL_METHODS)[number] | "">("");
  const [internationalDestination, setInternationalDestination] = useState("");
  const [internationalCountry, setInternationalCountry] = useState("");

  const { data: recipientInfo, isFetching: isLookingUp } = useAccountLookup(recipientAccount);

  const resetTransferForms = () => {
    setAmount("");
    setNarration("");
    setRecipientAccount("");
    setBeneficiaryName("");
    setBeneficiaryBank("");
    setBeneficiaryAccountType("");
    setBeneficiaryRouting("");
    setBeneficiarySwift("");
    setTransferPassword("");
    setInternationalMethod("");
    setInternationalDestination("");
    setInternationalCountry("");
  };

  const resetBillPay = () => {
    setAmount("");
    setNarration("");
    setBillerType("");
  };

  const totalIncome = useMemo(() => (transactions || []).reduce((sum, tx) => (
    tx.type === "deposit" || tx.type === "adjustment_credit" ? sum + Number(tx.amount) : sum
  ), 0), [transactions]);

  const isFrozen = user?.status === "frozen";

  const handleLocalTransfer = () => {
    if (!selectedAccount || !recipientAccount || !amount || !beneficiaryName || !beneficiaryBank || !beneficiaryAccountType || !beneficiaryRouting || !transferPassword) return;

    const transferNarration = [
      narration || "Local transfer",
      `Beneficiary: ${beneficiaryName}`,
      `Bank: ${beneficiaryBank}`,
      `Type: ${beneficiaryAccountType}`,
      `Routing: ${beneficiaryRouting}`,
      `Swift: ${beneficiarySwift || "N/A"}`,
      `Password Confirmed: Yes`,
    ].join(" | ");

    transfer.mutate({
      fromAccountId: Number(selectedAccount),
      toAccountNumber: recipientAccount,
      amount,
      rail: "internal",
      narration: transferNarration,
    }, {
      onSuccess: () => {
        toast({ title: "Local Transfer Sent", description: `$${amount} has been sent instantly to ${beneficiaryName}.` });
        resetTransferForms();
      },
      onError: (e) => toast({ variant: "destructive", title: "Transfer Failed", description: e.message })
    });
  };

  const handleInternationalTransfer = () => {
    if (!selectedAccount || !amount || !internationalMethod || !internationalDestination || !internationalCountry || !transferPassword) return;

    const internationalNarration = [
      narration || "International transfer",
      `Method: ${internationalMethod.replace("_", " ")}`,
      `Destination: ${internationalDestination}`,
      `Country: ${internationalCountry}`,
      `ETA: within 72 hours`,
      `Password Confirmed: Yes`,
    ].join(" | ");

    transfer.mutate({
      fromAccountId: Number(selectedAccount),
      toAccountNumber: "0000000000",
      amount,
      rail: "wire",
      narration: internationalNarration,
    }, {
      onSuccess: () => {
        toast({ title: "International Transfer Submitted", description: `Your ${internationalMethod.replace("_", " ")} transfer is queued for completion within 72 hours.` });
        resetTransferForms();
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
        toast({ title: "Payment Submitted", description: `Your $${amount} bill payment for ${billerType} is pending admin approval.` });
        resetBillPay();
      },
      onError: (e) => toast({ variant: "destructive", title: "Payment Submission Failed", description: e.message })
    });
  };

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
        <p className="text-muted-foreground">Manage your money securely. Customer cash/check deposits are disabled.</p>
      </div>

      <Tabs defaultValue="transfer" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 lg:w-[560px]">
          <TabsTrigger value="transfer">Send Money</TabsTrigger>
          <TabsTrigger value="bills">Bill Pay</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="transfer">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Landmark className="w-4 h-4" /> Local Transfer</CardTitle>
                <CardDescription>Send money to local accounts instantly.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>From Account</Label>
                  <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                    <SelectTrigger><SelectValue placeholder="Select source account" /></SelectTrigger>
                    <SelectContent>
                      {accounts?.map((acc) => (
                        <SelectItem key={acc.id} value={String(acc.id)}>
                          {acc.type.replace("_", " ")} - {acc.accountNumber} (Available: ${Number(acc.availableBalance).toLocaleString(undefined, { minimumFractionDigits: 2 })})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <CurrencyInput label="Transfer Amount" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />

                <div className="space-y-2">
                  <Label>Beneficiary Account Number</Label>
                  <div className="relative">
                    <Input value={recipientAccount} onChange={(e) => setRecipientAccount(e.target.value)} placeholder="10-digit account number" maxLength={10} />
                    {isLookingUp && <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />}
                    {recipientInfo && (
                      <div className="absolute right-3 top-2.5 flex items-center text-green-600 text-xs font-bold bg-green-50 px-2 py-0.5 rounded-full">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        {recipientInfo.fullName}
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Account Holder Name</Label>
                    <Input value={beneficiaryName} onChange={(e) => setBeneficiaryName(e.target.value)} placeholder="Full name" />
                  </div>
                  <div className="space-y-2">
                    <Label>Bank Name</Label>
                    <Input value={beneficiaryBank} onChange={(e) => setBeneficiaryBank(e.target.value)} placeholder="Bank name" />
                  </div>
                  <div className="space-y-2">
                    <Label>Account Type</Label>
                    <Input value={beneficiaryAccountType} onChange={(e) => setBeneficiaryAccountType(e.target.value)} placeholder="Checking / Savings" />
                  </div>
                  <div className="space-y-2">
                    <Label>Routing Number</Label>
                    <Input value={beneficiaryRouting} onChange={(e) => setBeneficiaryRouting(e.target.value)} placeholder="Routing number" />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>SWIFT Code</Label>
                    <Input value={beneficiarySwift} onChange={(e) => setBeneficiarySwift(e.target.value)} placeholder="Optional for local transfers" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input value={narration} onChange={(e) => setNarration(e.target.value)} placeholder="What is this transfer for?" />
                </div>

                <div className="space-y-2">
                  <Label>Confirm Password</Label>
                  <Input type="password" value={transferPassword} onChange={(e) => setTransferPassword(e.target.value)} placeholder="Re-enter your password" />
                </div>

                <Button className="w-full" onClick={handleLocalTransfer} disabled={!selectedAccount || !amount || !recipientAccount || !beneficiaryName || !beneficiaryBank || !beneficiaryAccountType || !beneficiaryRouting || !transferPassword || transfer.isPending}>
                  {transfer.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ArrowRight className="w-4 h-4 mr-2" />}Send Local Transfer
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Globe2 className="w-4 h-4" /> International Wire</CardTitle>
                <CardDescription>Global transfers within 72 hours.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Transfer Method</Label>
                  <Select value={internationalMethod} onValueChange={(v) => setInternationalMethod(v as (typeof INTERNATIONAL_METHODS)[number])}>
                    <SelectTrigger><SelectValue placeholder="Select international method" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="wire_transfer">Wire Transfer</SelectItem>
                      <SelectItem value="cryptocurrency">Cryptocurrency</SelectItem>
                      <SelectItem value="paypal">PayPal</SelectItem>
                      <SelectItem value="wise_transfer">Wise Transfer</SelectItem>
                      <SelectItem value="cash_app">Cash App</SelectItem>
                      <SelectItem value="zelle">Zelle</SelectItem>
                      <SelectItem value="venmo">Venmo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <CurrencyInput label="Transfer Amount" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />

                <div className="space-y-2">
                  <Label>Destination Details</Label>
                  <Input value={internationalDestination} onChange={(e) => setInternationalDestination(e.target.value)} placeholder="Wallet, IBAN, email, or handle" />
                </div>

                <div className="space-y-2">
                  <Label>Destination Country</Label>
                  <Input value={internationalCountry} onChange={(e) => setInternationalCountry(e.target.value)} placeholder="Country" />
                </div>

                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input value={narration} onChange={(e) => setNarration(e.target.value)} placeholder="Reason for transfer" />
                </div>

                <div className="space-y-2">
                  <Label>Confirm Password</Label>
                  <Input type="password" value={transferPassword} onChange={(e) => setTransferPassword(e.target.value)} placeholder="Re-enter your password" />
                </div>

                <Button className="w-full" onClick={handleInternationalTransfer} disabled={!selectedAccount || !amount || !internationalMethod || !internationalDestination || !internationalCountry || !transferPassword || transfer.isPending}>
                  {transfer.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ArrowRight className="w-4 h-4 mr-2" />}Send International Transfer
                </Button>
              </CardContent>
            </Card>
          </div>
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
              <CardDescription>Total income: ${totalIncome.toLocaleString(undefined, { minimumFractionDigits: 2 })}</CardDescription>
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
                          <td className="p-3">{format(new Date(tx.createdAt || new Date()), "MMM d, yyyy")}</td>
                          <td className="p-3">
                            <div className="font-medium capitalize">{tx.type}</div>
                            <div className="text-xs text-muted-foreground">{tx.narration}</div>
                          </td>
                          <td className="p-3 font-mono text-xs">{tx.reference}</td>
                          <td className={`p-3 text-right font-bold ${tx.type === "deposit" || tx.type === "adjustment_credit" ? "text-green-600" : "text-foreground"}`}>
                            {tx.type === "deposit" || tx.type === "adjustment_credit" ? "+" : "-"}${Number(tx.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td className="p-3 text-center">
                            <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                              tx.status === "success" ? "bg-green-50 text-green-700" :
                              tx.status === "failed" ? "bg-red-50 text-red-700" :
                              "bg-yellow-50 text-yellow-700"
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
                <div className="text-center py-8 text-muted-foreground">No transaction history available.</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
