import { useAuth } from "@/hooks/use-auth";
import { useAdminUsers, useUpdateUserStatus, useAuditLogs, useAdminApplications, useUpdateApplication, useAdjustBalance, usePendingTransactions, useReviewPendingTransaction, useMemberFinancials } from "@/hooks/use-admin";
import { Redirect, useLocation } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, UserX, UserCheck, ShieldAlert, Check, X, DollarSign, Smartphone, Eye, Receipt } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export default function AdminDashboard() {
  const { user } = useAuth();
  const [location] = useLocation();
  const { data: users, isLoading: loadingUsers } = useAdminUsers();
  const { data: logs, isLoading: loadingLogs } = useAuditLogs();
  const { data: applications, isLoading: loadingApps } = useAdminApplications();
  const { data: memberFinancials, isLoading: loadingMemberFinancials } = useMemberFinancials();
  const updateUserStatus = useUpdateUserStatus();
  const updateApplication = useUpdateApplication();
  const adjustBalance = useAdjustBalance();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [adjustDialogOpen, setAdjustDialogOpen] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustType, setAdjustType] = useState<"adjustment_credit" | "adjustment_debit">("adjustment_credit");
  const [adjustReason, setAdjustReason] = useState("");
  const [formDataDialog, setFormDataDialog] = useState<any>(null);

  const { data: mobileDeposits, isLoading: loadingDeposits } = useQuery({
    queryKey: ["/api/admin/mobile-deposits"],
    queryFn: async () => {
      const res = await fetch("/api/admin/mobile-deposits");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });


  const { data: pendingTransactions, isLoading: loadingPendingTransactions } = usePendingTransactions();

  const reviewPendingTransaction = useReviewPendingTransaction();

  const reviewDeposit = useMutation({
    mutationFn: async ({ id, status, reason }: { id: number; status: string; reason?: string }) => {
      const res = await fetch(`/api/admin/mobile-deposits/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, reason }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/mobile-deposits"] });
      toast({ title: "Deposit Reviewed", description: "Mobile deposit has been processed." });
    },
  });

  const financialByUserId = new Map((memberFinancials || []).map((f) => [f.userId, f]));

  if (user?.role !== 'staff') {
    return <Redirect to="/dashboard" />;
  }

  const handleStatusChange = (userId: number, newStatus: string) => {
    updateUserStatus.mutate({ id: userId, status: newStatus as any }, {
      onSuccess: () => {
        const labels: Record<string, string> = { active: "Approved", frozen: "Frozen", pending: "Set to Pending" };
        toast({
          title: `Member ${labels[newStatus] || newStatus}`,
          description: `Member status has been updated to ${newStatus}.`
        });
      },
      onError: (e) => {
        toast({ variant: "destructive", title: "Update Failed", description: e.message });
      }
    });
  };

  const handleAppAction = (id: number, status: "approved" | "rejected") => {
    updateApplication.mutate({ id, status }, {
      onSuccess: () => {
        toast({
          title: `Application ${status === 'approved' ? 'Approved' : 'Rejected'}`,
          description: `The application has been ${status}.`
        });
      },
      onError: (e) => {
        toast({ variant: "destructive", title: "Action Failed", description: e.message });
      }
    });
  };

  const handleAdjustBalance = () => {
    if (!selectedAccountId || !adjustAmount || !adjustReason) return;
    adjustBalance.mutate({
      accountId: selectedAccountId,
      amount: adjustAmount,
      type: adjustType,
      reasonCode: adjustReason,
      narration: `Manual adjustment by staff`
    }, {
      onSuccess: () => {
        setAdjustDialogOpen(false);
        setAdjustAmount("");
        setAdjustReason("");
        toast({ title: "Adjustment Successful", description: "Account balance has been updated." });
      },
      onError: (e) => {
        toast({ variant: "destructive", title: "Adjustment Failed", description: e.message });
      }
    });
  };

  const renderFormData = (formData: any) => {
    if (!formData) return null;
    return Object.entries(formData).map(([key, value]) => (
      <div key={key} className="flex justify-between text-sm py-1">
        <span className="text-muted-foreground capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
        <span className="font-medium">{String(value)}</span>
      </div>
    ));
  };

  const defaultTab = location === "/admin/logs" ? "logs" : "users";

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-display font-bold text-foreground">Staff Portal</h2>
        <p className="text-muted-foreground">Manage members, applications, mobile deposits, and account adjustments</p>
      </div>

      <Tabs key={defaultTab} defaultValue={defaultTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="users" data-testid="tab-admin-users">Members
            {users?.filter((u: any) => u.status === 'pending').length ? (
              <Badge variant="destructive" className="ml-2">{users.filter((u: any) => u.status === 'pending').length}</Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="applications" data-testid="tab-admin-apps">Applications
            {applications?.filter((a: any) => a.status === 'pending').length ? (
              <Badge variant="destructive" className="ml-2">{applications.filter((a: any) => a.status === 'pending').length}</Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="deposits" data-testid="tab-admin-deposits">Mobile Deposits
            {mobileDeposits?.filter((d: any) => d.status === 'pending').length ? (
              <Badge variant="destructive" className="ml-2">{mobileDeposits.filter((d: any) => d.status === 'pending').length}</Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="transaction-reviews" data-testid="tab-admin-transaction-reviews">Transaction Reviews
            {pendingTransactions?.length ? (
              <Badge variant="destructive" className="ml-2">{pendingTransactions.length}</Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="logs" data-testid="tab-admin-logs">Audit Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <Card>
            <CardHeader>
              <CardTitle>Member Management</CardTitle>
              <CardDescription>View members, balances, assets, and adjust balances.</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingUsers ? (
                <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>
              ) : (
                <div className="rounded-md border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="p-3 text-left font-medium">Member</th>
                        <th className="p-3 text-left font-medium">Status</th>
                        <th className="p-3 text-left font-medium">Total Balance</th>
                        <th className="p-3 text-left font-medium">Assets</th>
                        <th className="p-3 text-right font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users?.map((u) => (
                        <tr key={u.id} className="border-b last:border-0">
                          <td className="p-3">
                            <div className="font-medium">{u.fullName}</div>
                            <div className="text-xs text-muted-foreground">{u.email}</div>
                          </td>
                          <td className="p-3">
                            <Badge variant={u.status === 'active' ? 'outline' : u.status === 'pending' ? 'secondary' : 'destructive'}>
                              {u.status}
                            </Badge>
                          </td>
                          <td className="p-3">
                            {loadingMemberFinancials ? (
                              <span className="text-xs text-muted-foreground">Loading...</span>
                            ) : (
                              <span className="font-medium">
                                ${Number(financialByUserId.get(u.id)?.totalBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-xs text-muted-foreground">
                            {loadingMemberFinancials ? (
                              <span>Loading...</span>
                            ) : (
                              <span>
                                {(financialByUserId.get(u.id)?.assetCount || 0)} total ({financialByUserId.get(u.id)?.accountCount || 0} accounts, {financialByUserId.get(u.id)?.cryptoAssetCount || 0} crypto)
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-right space-x-2">
                            {u.status === 'pending' && u.role !== 'staff' && (
                              <>
                                <Button 
                                  variant="default" 
                                  size="sm"
                                  onClick={() => handleStatusChange(u.id, 'active')}
                                  data-testid={`button-approve-member-${u.id}`}
                                >
                                  <UserCheck className="w-4 h-4 mr-1" /> Approve
                                </Button>
                                <Button 
                                  variant="destructive" 
                                  size="sm"
                                  onClick={() => handleStatusChange(u.id, 'frozen')}
                                  data-testid={`button-reject-member-${u.id}`}
                                >
                                  <UserX className="w-4 h-4 mr-1" /> Reject
                                </Button>
                              </>
                            )}
                            {u.status !== 'pending' && (
                              <Dialog open={adjustDialogOpen} onOpenChange={setAdjustDialogOpen}>
                                <DialogTrigger asChild>
                                  <Button variant="outline" size="sm" onClick={() => setSelectedAccountId(u.id)} data-testid={`button-adjust-${u.id}`}>
                                    <DollarSign className="w-4 h-4 mr-1" /> Adjust
                                  </Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>Adjust Member Balance</DialogTitle>
                                    <DialogDescription>Add or remove funds from member accounts.</DialogDescription>
                                  </DialogHeader>
                                  <div className="space-y-4 py-4">
                                    <div className="space-y-2">
                                      <Label>Adjustment Type</Label>
                                      <Select value={adjustType} onValueChange={(v) => setAdjustType(v as any)}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="adjustment_credit">Add Funds (Credit)</SelectItem>
                                          <SelectItem value="adjustment_debit">Remove Funds (Debit)</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div className="space-y-2">
                                      <Label>Amount ($)</Label>
                                      <Input type="number" placeholder="0.00" value={adjustAmount} onChange={(e) => setAdjustAmount(e.target.value)} />
                                    </div>
                                    <div className="space-y-2">
                                      <Label>Reason Code</Label>
                                      <Input placeholder="e.g., CORRECTION, FEE_REFUND" value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} />
                                    </div>
                                  </div>
                                  <DialogFooter>
                                    <Button onClick={handleAdjustBalance} data-testid="button-apply-adjustment">Apply Adjustment</Button>
                                  </DialogFooter>
                                </DialogContent>
                              </Dialog>
                            )}
                            {u.role !== 'staff' && u.status !== 'pending' && (
                              <Button 
                                variant={u.status === 'active' ? "destructive" : "outline"} 
                                size="sm"
                                onClick={() => handleStatusChange(u.id, u.status === 'active' ? 'frozen' : 'active')}
                                data-testid={`button-toggle-status-${u.id}`}
                              >
                                {u.status === 'active' ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="applications">
          <Card>
            <CardHeader>
              <CardTitle>Account & Product Applications</CardTitle>
              <CardDescription>Review accounts, loans, home equity, and credit card applications.</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingApps ? (
                <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>
              ) : (
                <div className="rounded-md border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="p-3 text-left font-medium">Applicant</th>
                        <th className="p-3 text-left font-medium">Type</th>
                        <th className="p-3 text-left font-medium">Status</th>
                        <th className="p-3 text-left font-medium">Details</th>
                        <th className="p-3 text-right font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {applications?.map((app: any) => (
                        <tr key={app.id} className="border-b last:border-0">
                          <td className="p-3">
                            <div className="font-medium">{app.user?.fullName}</div>
                            <div className="text-xs text-muted-foreground">{app.user?.email}</div>
                          </td>
                          <td className="p-3">
                            <Badge variant="outline" className="capitalize">{app.type.replace('_', ' ')}</Badge>
                          </td>
                          <td className="p-3">
                            <Badge variant={app.status === 'approved' ? 'outline' : app.status === 'pending' ? 'secondary' : 'destructive'}>
                              {app.status}
                            </Badge>
                          </td>
                          <td className="p-3">
                            {app.formData && (
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button variant="ghost" size="sm" data-testid={`button-view-details-${app.id}`}>
                                    <Eye className="w-4 h-4 mr-1" /> View Details
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-md">
                                  <DialogHeader>
                                    <DialogTitle className="capitalize">{app.type.replace('_', ' ')} Application Details</DialogTitle>
                                    <DialogDescription>Submitted by {app.user?.fullName}</DialogDescription>
                                  </DialogHeader>
                                  <div className="space-y-1 py-4 divide-y">
                                    {renderFormData(app.formData)}
                                  </div>
                                </DialogContent>
                              </Dialog>
                            )}
                            {!app.formData && <span className="text-xs text-muted-foreground">No additional details</span>}
                          </td>
                          <td className="p-3 text-right space-x-2">
                            {app.status === 'pending' && (
                              <>
                                <Button size="sm" variant="outline" onClick={() => handleAppAction(app.id, 'approved')} data-testid={`button-approve-app-${app.id}`}>
                                  <Check className="w-4 h-4 mr-1" /> Approve
                                </Button>
                                <Button size="sm" variant="destructive" onClick={() => handleAppAction(app.id, 'rejected')} data-testid={`button-reject-app-${app.id}`}>
                                  <X className="w-4 h-4 mr-1" /> Reject
                                </Button>
                              </>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="deposits">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Smartphone className="w-5 h-5" /> Mobile Deposit Review</CardTitle>
              <CardDescription>Review and approve pending mobile check deposits.</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingDeposits ? (
                <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>
              ) : !mobileDeposits?.length ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Smartphone className="w-12 h-12 mx-auto mb-3 opacity-40" />
                  <p>No mobile deposits to review.</p>
                </div>
              ) : (
                <div className="rounded-md border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="p-3 text-left font-medium">Member</th>
                        <th className="p-3 text-left font-medium">Amount</th>
                        <th className="p-3 text-left font-medium">Date</th>
                        <th className="p-3 text-left font-medium">Status</th>
                        <th className="p-3 text-left font-medium">Total Balance</th>
                        <th className="p-3 text-left font-medium">Assets</th>
                        <th className="p-3 text-right font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mobileDeposits.map((dep: any) => (
                        <tr key={dep.id} className="border-b last:border-0">
                          <td className="p-3">
                            <div className="font-medium">{dep.user?.fullName}</div>
                            <div className="text-xs text-muted-foreground">{dep.user?.email}</div>
                          </td>
                          <td className="p-3 font-medium">${Number(dep.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          <td className="p-3 text-muted-foreground text-xs">{dep.createdAt ? format(new Date(dep.createdAt), "MMM d, yyyy h:mm a") : "N/A"}</td>
                          <td className="p-3">
                            <Badge variant={dep.status === 'approved' ? 'outline' : dep.status === 'pending' ? 'secondary' : 'destructive'}>
                              {dep.status}
                            </Badge>
                          </td>
                          <td className="p-3 text-right space-x-2">
                            {dep.status === 'pending' && (
                              <>
                                <Button size="sm" variant="outline" onClick={() => reviewDeposit.mutate({ id: dep.id, status: "approved" })} data-testid={`button-approve-deposit-${dep.id}`}>
                                  <Check className="w-4 h-4 mr-1" /> Approve
                                </Button>
                                <Button size="sm" variant="destructive" onClick={() => reviewDeposit.mutate({ id: dep.id, status: "rejected", reason: "Check not valid" })} data-testid={`button-reject-deposit-${dep.id}`}>
                                  <X className="w-4 h-4 mr-1" /> Reject
                                </Button>
                              </>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transaction-reviews">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Receipt className="w-5 h-5" /> Deposit & Bill Pay Reviews</CardTitle>
              <CardDescription>Approve or reject pending member deposits and bill payments.</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingPendingTransactions ? (
                <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>
              ) : !pendingTransactions?.length ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Receipt className="w-12 h-12 mx-auto mb-3 opacity-40" />
                  <p>No pending deposit or bill pay transactions.</p>
                </div>
              ) : (
                <div className="rounded-md border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="p-3 text-left font-medium">Member</th>
                        <th className="p-3 text-left font-medium">Type</th>
                        <th className="p-3 text-left font-medium">Amount</th>
                        <th className="p-3 text-left font-medium">Account</th>
                        <th className="p-3 text-left font-medium">Date</th>
                        <th className="p-3 text-right font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingTransactions.map((tx: any) => (
                        <tr key={tx.id} className="border-b last:border-0">
                          <td className="p-3">
                            <div className="font-medium">{tx.user?.fullName || "Unknown"}</div>
                            <div className="text-xs text-muted-foreground">{tx.user?.email || "N/A"}</div>
                          </td>
                          <td className="p-3">
                            <Badge variant="outline" className="capitalize">{tx.type.replace('_', ' ')}</Badge>
                          </td>
                          <td className="p-3 font-medium">${Number(tx.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          <td className="p-3 text-xs text-muted-foreground">{tx.account?.accountNumber || "N/A"}</td>
                          <td className="p-3 text-muted-foreground text-xs">{tx.createdAt ? format(new Date(tx.createdAt), "MMM d, yyyy h:mm a") : "N/A"}</td>
                          <td className="p-3 text-right space-x-2">
                            <Button size="sm" variant="outline" onClick={() => reviewPendingTransaction.mutate({ id: tx.id, status: "approved" }, { onSuccess: () => toast({ title: "Transaction Approved", description: "Pending transaction has been approved." }), onError: (e) => toast({ variant: "destructive", title: "Review Failed", description: e.message }) })}>
                              <Check className="w-4 h-4 mr-1" /> Approve
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => reviewPendingTransaction.mutate({ id: tx.id, status: "rejected", reason: "Declined by staff" }, { onSuccess: () => toast({ title: "Transaction Rejected", description: "Pending transaction has been rejected." }), onError: (e) => toast({ variant: "destructive", title: "Review Failed", description: e.message }) })}>
                              <X className="w-4 h-4 mr-1" /> Reject
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs">
          <Card>
            <CardHeader>
              <CardTitle>System Audit Logs</CardTitle>
              <CardDescription>Track security events and important actions.</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingLogs ? (
                <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>
              ) : (
                <ScrollArea className="h-[600px] rounded-md border p-4">
                  <div className="space-y-4">
                    {logs?.map((log) => (
                      <div key={log.id} className="flex items-start gap-4 p-4 rounded-lg bg-muted/30 border text-sm">
                        <div className="p-2 bg-primary/10 rounded-full text-primary mt-1">
                          <ShieldAlert className="w-4 h-4" />
                        </div>
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center justify-between">
                            <p className="font-semibold">{log.action}</p>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(log.createdAt || new Date()), "PP pp")}
                            </span>
                          </div>
                          <p className="text-muted-foreground">User ID: {log.actorUserId || 'System'}</p>
                          <div className="text-xs font-mono bg-muted p-2 rounded mt-2 truncate">
                            {JSON.stringify(log.metadata)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
