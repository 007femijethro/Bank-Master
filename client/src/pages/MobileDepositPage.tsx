import { useAuth } from "@/hooks/use-auth";
import { useAccounts } from "@/hooks/use-accounts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, Upload, Clock, CheckCircle, XCircle, Smartphone, DollarSign } from "lucide-react";
import { format } from "date-fns";

export default function MobileDepositPage() {
  const { user } = useAuth();
  const { data: accounts } = useAccounts();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedAccount, setSelectedAccount] = useState("");
  const [amount, setAmount] = useState("");
  const [checkFrontUrl, setCheckFrontUrl] = useState("");
  const [checkBackUrl, setCheckBackUrl] = useState("");

  const { data: deposits } = useQuery({
    queryKey: ["/api/mobile-deposits"],
    queryFn: async () => {
      const res = await fetch("/api/mobile-deposits");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const submitDeposit = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/mobile-deposit", {
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
      queryClient.invalidateQueries({ queryKey: ["/api/mobile-deposits"] });
      setAmount("");
      setCheckFrontUrl("");
      setCheckBackUrl("");
      setSelectedAccount("");
      toast({ title: "Deposit Submitted", description: "Your mobile deposit is pending staff review." });
    },
    onError: (e: any) => {
      toast({ variant: "destructive", title: "Deposit Failed", description: e.message });
    },
  });

  const handleSubmit = () => {
    if (!selectedAccount || !amount || !checkFrontUrl) {
      toast({ variant: "destructive", title: "Missing Fields", description: "Please fill in all required fields." });
      return;
    }
    submitDeposit.mutate({
      accountId: parseInt(selectedAccount),
      amount: parseFloat(amount).toFixed(2),
      checkFrontUrl,
      checkBackUrl: checkBackUrl || undefined,
    });
  };

  const simulateCapture = (side: "front" | "back") => {
    const timestamp = Date.now();
    const checkNum = Math.floor(1000 + Math.random() * 9000);
    const url = `check-capture://${side}/${timestamp}/CHK${checkNum}`;
    if (side === "front") {
      setCheckFrontUrl(url);
    } else {
      setCheckBackUrl(url);
    }
    toast({ title: `${side === "front" ? "Front" : "Back"} Captured`, description: "Check image has been captured successfully." });
  };

  const statusIcon = (status: string) => {
    if (status === "pending") return <Clock className="w-4 h-4 text-yellow-500" />;
    if (status === "approved") return <CheckCircle className="w-4 h-4 text-green-500" />;
    return <XCircle className="w-4 h-4 text-red-500" />;
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-display font-bold text-foreground flex items-center gap-3">
          <Smartphone className="w-8 h-8" /> Mobile Deposit
        </h2>
        <p className="text-muted-foreground">Deposit checks by capturing front and back images. Deposits are reviewed by staff.</p>
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Upload className="w-5 h-5" /> New Check Deposit</CardTitle>
            <CardDescription>Capture your check and submit for deposit. Daily limit: $5,000.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Deposit To</Label>
              <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                <SelectTrigger data-testid="select-deposit-account"><SelectValue placeholder="Select account" /></SelectTrigger>
                <SelectContent>
                  {accounts?.map(acc => (
                    <SelectItem key={acc.id} value={String(acc.id)}>
                      {acc.type.replace('_', ' ')} ({acc.accountNumber}) - ${Number(acc.balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Check Amount ($)</Label>
              <Input data-testid="input-deposit-amount" type="number" step="0.01" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Check Front</Label>
                <button
                  data-testid="button-capture-front"
                  onClick={() => simulateCapture("front")}
                  className={`w-full aspect-[1.6] border-2 border-dashed rounded-md flex flex-col items-center justify-center gap-2 transition-colors ${checkFrontUrl ? 'border-green-500 bg-green-50 dark:bg-green-950/20' : 'border-muted-foreground/25 hover:border-primary/50'}`}
                >
                  {checkFrontUrl ? (
                    <>
                      <CheckCircle className="w-8 h-8 text-green-500" />
                      <span className="text-xs text-green-600 font-medium">Front Captured</span>
                    </>
                  ) : (
                    <>
                      <Camera className="w-8 h-8 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Tap to Capture Front</span>
                    </>
                  )}
                </button>
              </div>
              <div className="space-y-2">
                <Label>Check Back</Label>
                <button
                  data-testid="button-capture-back"
                  onClick={() => simulateCapture("back")}
                  className={`w-full aspect-[1.6] border-2 border-dashed rounded-md flex flex-col items-center justify-center gap-2 transition-colors ${checkBackUrl ? 'border-green-500 bg-green-50 dark:bg-green-950/20' : 'border-muted-foreground/25 hover:border-primary/50'}`}
                >
                  {checkBackUrl ? (
                    <>
                      <CheckCircle className="w-8 h-8 text-green-500" />
                      <span className="text-xs text-green-600 font-medium">Back Captured</span>
                    </>
                  ) : (
                    <>
                      <Camera className="w-8 h-8 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Tap to Capture Back</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <Button data-testid="button-submit-deposit" className="w-full" onClick={handleSubmit} disabled={submitDeposit.isPending || !selectedAccount || !amount || !checkFrontUrl}>
              <DollarSign className="w-4 h-4 mr-2" /> {submitDeposit.isPending ? "Submitting..." : "Submit Deposit"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Deposit History</CardTitle>
            <CardDescription>Track your mobile deposit submissions.</CardDescription>
          </CardHeader>
          <CardContent>
            {!deposits || deposits.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Smartphone className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <p>No mobile deposits yet.</p>
                <p className="text-xs mt-1">Submit your first check deposit to get started.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {deposits.map((dep: any) => (
                  <div key={dep.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-3">
                      {statusIcon(dep.status)}
                      <div>
                        <p className="font-medium text-sm">${Number(dep.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                        <p className="text-xs text-muted-foreground">
                          {dep.createdAt ? format(new Date(dep.createdAt), "MMM d, yyyy h:mm a") : "N/A"}
                        </p>
                      </div>
                    </div>
                    <Badge variant={dep.status === "approved" ? "outline" : dep.status === "pending" ? "secondary" : "destructive"}>
                      {dep.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
