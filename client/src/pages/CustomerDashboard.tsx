import { useAuth } from "@/hooks/use-auth";
import { useAccounts, useCreateAccount, useTransactions } from "@/hooks/use-accounts";
import { StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Plus, Wallet, ArrowUpRight, ArrowDownLeft, AlertCircle, RefreshCw, CreditCard } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";

export default function CustomerDashboard() {
  const { user } = useAuth();
  const { data: accounts, isLoading } = useAccounts();
  const { data: transactions } = useTransactions();
  const createAccount = useCreateAccount();
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [accountType, setAccountType] = useState<"share_savings" | "checking">("share_savings");

  const totalBalance = accounts?.reduce((sum, acc) => sum + Number(acc.balance), 0) || 0;
  const recentTransactions = transactions?.slice(0, 5) || [];

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
        <div>
          <h2 className="text-3xl font-display font-bold text-foreground">RFCU Dashboard</h2>
          <p className="text-muted-foreground">Member: {user?.fullName} | Member #: {user?.memberNumber}</p>
        </div>
        
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="shadow-lg shadow-primary/20" disabled={user?.status === 'frozen'}>
              <Plus className="mr-2 h-4 w-4" /> Apply for Account
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Account Application</DialogTitle>
              <DialogDescription>Apply for a new Share Savings or Checking account.</DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <RadioGroup value={accountType} onValueChange={(v) => setAccountType(v as any)} className="grid grid-cols-2 gap-4">
                <div>
                  <RadioGroupItem value="share_savings" id="share_savings" className="peer sr-only" />
                  <Label htmlFor="share_savings" className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent peer-data-[state=checked]:border-primary">
                    <Wallet className="mb-3 h-6 w-6" /> Share Savings
                  </Label>
                </div>
                <div>
                  <RadioGroupItem value="checking" id="checking" className="peer sr-only" />
                  <Label htmlFor="checking" className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent peer-data-[state=checked]:border-primary">
                    <RefreshCw className="mb-3 h-6 w-6" /> Checking
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

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Balance" value={`$${totalBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} icon={Wallet} className="bg-primary text-primary-foreground border-none" />
        <StatCard title="Routing #" value="123456789" icon={AlertCircle} className="bg-card" />
        <StatCard title="Debit Card" value="Active" icon={CreditCard} description="Virtual Card Ready" />
        <StatCard title="Credit Card" value="N/A" icon={CreditCard} description="Coming Soon" className="opacity-50" />
      </div>

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
                  <div className="text-2xl font-bold">${Number(acc.balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                  <p className="text-xs text-muted-foreground mt-1 font-mono">{acc.accountNumber}</p>
                </CardContent>
              </Card>
            ))
          )}
        </div>

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
                          {tx.amount.startsWith('-') ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownLeft className="w-4 h-4" />}
                        </div>
                        <div>
                          <p className="font-medium text-sm capitalize">{tx.type.replace('_', ' ')}</p>
                          <p className="text-xs text-muted-foreground">{format(new Date(tx.createdAt || new Date()), "MMM d, h:mm a")}</p>
                        </div>
                      </div>
                      <div className={`font-bold text-sm ${tx.type.includes('credit') || tx.type === 'deposit' ? 'text-green-600' : ''}`}>
                        ${Number(tx.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      <footer className="text-center py-8 text-xs text-muted-foreground border-t">
        RFCU is federally insured by the NCUA up to $250,000.
      </footer>
    </div>
  );
}
