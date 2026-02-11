import { useAuth } from "@/hooks/use-auth";
import { useAdminUsers, useUpdateUserStatus, useAuditLogs, useAdminApplications, useUpdateApplication, useAdjustBalance } from "@/hooks/use-admin";
import { Redirect } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, UserX, UserCheck, ShieldAlert, Check, X, DollarSign } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function AdminDashboard() {
  const { user } = useAuth();
  const { data: users, isLoading: loadingUsers } = useAdminUsers();
  const { data: logs, isLoading: loadingLogs } = useAuditLogs();
  const { data: applications, isLoading: loadingApps } = useAdminApplications();
  const updateUserStatus = useUpdateUserStatus();
  const updateApplication = useUpdateApplication();
  const adjustBalance = useAdjustBalance();
  const { toast } = useToast();

  const [adjustDialogOpen, setAdjustDialogOpen] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustType, setAdjustType] = useState<"adjustment_credit" | "adjustment_debit">("adjustment_credit");
  const [adjustReason, setAdjustReason] = useState("");

  if (user?.role !== 'staff') {
    return <Redirect to="/dashboard" />;
  }

  const handleStatusToggle = (userId: number, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'frozen' : 'active';
    updateUserStatus.mutate({ id: userId, status: newStatus as any }, {
      onSuccess: () => {
        toast({
          title: `User ${newStatus === 'active' ? 'Unfrozen' : 'Frozen'}`,
          description: `User status has been updated to ${newStatus}.`
        });
      },
      onError: (e) => {
        toast({
          variant: "destructive",
          title: "Update Failed",
          description: e.message
        });
      }
    });
  };

  const handleAppAction = (id: number, status: "approved" | "rejected") => {
    updateApplication.mutate({ id, status }, {
      onSuccess: () => {
        toast({
          title: `Application ${status === 'approved' ? 'Approved' : 'Rejected'}`,
          description: `The account application has been ${status}.`
        });
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

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-display font-bold text-foreground">Staff Portal</h2>
        <p className="text-muted-foreground">Manage members, applications, and account adjustments</p>
      </div>

      <Tabs defaultValue="users" className="space-y-6">
        <TabsList>
          <TabsTrigger value="users">Members</TabsTrigger>
          <TabsTrigger value="applications">Applications</TabsTrigger>
          <TabsTrigger value="logs">Audit Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <Card>
            <CardHeader>
              <CardTitle>Member Management</CardTitle>
              <CardDescription>View members and adjust balances.</CardDescription>
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
                            <Badge variant={u.status === 'active' ? 'outline' : 'destructive'}>
                              {u.status}
                            </Badge>
                          </td>
                          <td className="p-3 text-right space-x-2">
                            <Dialog open={adjustDialogOpen} onOpenChange={setAdjustDialogOpen}>
                              <DialogTrigger asChild>
                                <Button variant="outline" size="sm" onClick={() => setSelectedAccountId(u.id)}>
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
                                  <Button onClick={handleAdjustBalance}>Apply Adjustment</Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                            {u.role !== 'staff' && (
                              <Button 
                                variant={u.status === 'active' ? "destructive" : "outline"} 
                                size="sm"
                                onClick={() => handleStatusToggle(u.id, u.status)}
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
              <CardTitle>Account Applications</CardTitle>
              <CardDescription>Review and approve new account requests.</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingApps ? (
                <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>
              ) : (
                <div className="rounded-md border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="p-3 text-left font-medium">Type</th>
                        <th className="p-3 text-left font-medium">Status</th>
                        <th className="p-3 text-right font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {applications?.map((app) => (
                        <tr key={app.id} className="border-b last:border-0">
                          <td className="p-3 capitalize">{app.type.replace('_', ' ')}</td>
                          <td className="p-3">
                            <Badge variant={app.status === 'approved' ? 'outline' : app.status === 'pending' ? 'secondary' : 'destructive'}>
                              {app.status}
                            </Badge>
                          </td>
                          <td className="p-3 text-right space-x-2">
                            {app.status === 'pending' && (
                              <>
                                <Button size="sm" variant="outline" onClick={() => handleAppAction(app.id, 'approved')}>
                                  <Check className="w-4 h-4 mr-1" /> Approve
                                </Button>
                                <Button size="sm" variant="destructive" onClick={() => handleAppAction(app.id, 'rejected')}>
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
