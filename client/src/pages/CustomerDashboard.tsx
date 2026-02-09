import { useAuth } from "@/hooks/use-auth";
import { useAccounts, useCreateAccount, useTransactions } from "@/hooks/use-accounts";
import { StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Plus, Wallet, ArrowUpRight, ArrowDownLeft, AlertCircle, RefreshCw } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { format } from "date-fns";

export default function CustomerDashboard() {
  const { user } = useAuth();
  const { data: accounts, isLoading } = useAccounts();
  const { data: transactions } = useTransactions();
  const createAccount = useCreateAccount();
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [accountType, setAccountType] = useState<"savings" | "current">("savings");

  const totalBalance = accounts?.reduce((sum, acc) => sum + Number(acc.balance), 0) || 0;
  
  // Calculate recent activity
  const recentTransactions = transactions?.slice(0, 5) || [];

  function handleCreateAccount() {
    createAccount.mutate({ type: accountType }, {
      onSuccess: () => {
        setIsCreateOpen(false);
        toast({
          title: "Account Created",
          description: `Your new ${accountType} account is ready.`,
        });
      },
      onError: (e) => {
        toast({
          variant: "destructive",
          title: "Failed to create account",
          description: e.message,
        });
      }
    });
  }

  if (isLoading) return <div className="p-8 text-center">Loading your financial data...</div>;

  return (
    <div className="space-y-8">
      {user?.status === 'frozen' && (
        <Alert variant="destructive" className="bg-red-50 border-red-200 text-red-800">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Account Frozen</AlertTitle>
          <AlertDescription>
            Your account has been frozen by administration. You cannot perform any transactions. Please contact support.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-display font-bold text-foreground">Overview</h2>
          <p className="text-muted-foreground">Welcome back, {user?.fullName}</p>
        </div>
        
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="shadow-lg shadow-primary/20" disabled={user?.status === 'frozen'}>
              <Plus className="mr-2 h-4 w-4" /> Open New Account
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Open a New Account</DialogTitle>
              <DialogDescription>Choose the type of account you want to open.</DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <RadioGroup value={accountType} onValueChange={(v) => setAccountType(v as any)} className="grid grid-cols-2 gap-4">
                <div>
                  <RadioGroupItem value="savings" id="savings" className="peer sr-only" />
                  <Label
                    htmlFor="savings"
                    className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                  >
                    <Wallet className="mb-3 h-6 w-6" />
                    Savings
                  </Label>
                </div>
                <div>
                  <RadioGroupItem value="current" id="current" className="peer sr-only" />
                  <Label
                    htmlFor="current"
                    className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                  >
                    <RefreshCw className="mb-3 h-6 w-6" />
                    Current
                  </Label>
                </div>
              </RadioGroup>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
              <Button onClick={handleCreateAccount} disabled={createAccount.isPending}>
                {createAccount.isPending ? "Creating..." : "Create Account"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Balance"
          value={`₦${totalBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
          icon={Wallet}
          description="Across all accounts"
          className="bg-primary text-primary-foreground border-none shadow-xl shadow-primary/20"
        />
        <StatCard
          title="Active Accounts"
          value={String(accounts?.length || 0)}
          icon={Wallet}
          className="bg-card"
        />
        {/* Placeholder stats for a real dashboard feel */}
        <StatCard
          title="Total Income (Month)"
          value="₦0.00"
          icon={ArrowDownLeft}
          description="Coming soon"
        />
        <StatCard
          title="Total Expenses (Month)"
          value="₦0.00"
          icon={ArrowUpRight}
          description="Coming soon"
        />
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        <div className="space-y-4">
          <h3 className="text-xl font-bold font-display">Your Accounts</h3>
          {accounts?.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground border-dashed">
              No accounts yet. Open one to get started!
            </Card>
          ) : (
            accounts?.map((acc) => (
              <Card key={acc.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-base font-medium capitalize">
                    {acc.type} Account
                  </CardTitle>
                  <span className={`text-xs px-2 py-1 rounded-full ${acc.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {acc.status}
                  </span>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold tracking-tight">
                    ₦{Number(acc.balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 font-mono">
                    {acc.accountNumber}
                  </p>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        <div className="space-y-4">
          <h3 className="text-xl font-bold font-display">Recent Transactions</h3>
          <Card>
            <CardContent className="p-0">
              {recentTransactions.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  No transactions yet.
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {recentTransactions.map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-full ${
                          tx.type === 'deposit' ? 'bg-green-100 text-green-600' : 
                          tx.type === 'transfer' && tx.toAccountId ? 'bg-orange-100 text-orange-600' : 
                          'bg-blue-100 text-blue-600'
                        }`}>
                          {tx.type === 'deposit' ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                        </div>
                        <div>
                          <p className="font-medium text-sm capitalize">{tx.type}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(tx.createdAt || new Date()), "MMM d, h:mm a")}
                          </p>
                        </div>
                      </div>
                      <div className={`font-bold text-sm ${
                        tx.type === 'deposit' || (tx.type === 'transfer' && tx.toAccountId && accounts?.some(a => a.id === tx.toAccountId))
                          ? 'text-green-600' 
                          : 'text-foreground'
                      }`}>
                        {tx.type === 'deposit' ? '+' : '-'}₦{Number(tx.amount).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
