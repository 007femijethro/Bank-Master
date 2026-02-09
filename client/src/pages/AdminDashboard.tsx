import { useAuth } from "@/hooks/use-auth";
import { useAdminUsers, useUpdateUserStatus, useAuditLogs } from "@/hooks/use-admin";
import { Redirect } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, UserX, UserCheck, ShieldAlert } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

export default function AdminDashboard() {
  const { user } = useAuth();
  const { data: users, isLoading: loadingUsers } = useAdminUsers();
  const { data: logs, isLoading: loadingLogs } = useAuditLogs();
  const updateUserStatus = useUpdateUserStatus();
  const { toast } = useToast();

  if (user?.role !== 'admin') {
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

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-display font-bold text-foreground">Admin Portal</h2>
        <p className="text-muted-foreground">Manage users and monitor system activity</p>
      </div>

      <Tabs defaultValue="users" className="space-y-6">
        <TabsList>
          <TabsTrigger value="users">User Management</TabsTrigger>
          <TabsTrigger value="logs">Audit Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <Card>
            <CardHeader>
              <CardTitle>Registered Users</CardTitle>
              <CardDescription>View and manage all customer accounts.</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingUsers ? (
                <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>
              ) : (
                <div className="rounded-md border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="p-3 text-left font-medium">User</th>
                        <th className="p-3 text-left font-medium">Role</th>
                        <th className="p-3 text-left font-medium">Joined</th>
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
                          <td className="p-3 capitalize">{u.role}</td>
                          <td className="p-3 text-muted-foreground">
                            {format(new Date(u.createdAt || new Date()), "MMM d, yyyy")}
                          </td>
                          <td className="p-3">
                            <Badge variant={u.status === 'active' ? 'outline' : 'destructive'} className={u.status === 'active' ? 'bg-green-50 text-green-700 border-green-200' : ''}>
                              {u.status}
                            </Badge>
                          </td>
                          <td className="p-3 text-right">
                            {u.role !== 'admin' && (
                              <Button 
                                variant={u.status === 'active' ? "destructive" : "outline"} 
                                size="sm"
                                onClick={() => handleStatusToggle(u.id, u.status)}
                                disabled={updateUserStatus.isPending}
                              >
                                {u.status === 'active' ? (
                                  <><UserX className="w-4 h-4 mr-2" /> Freeze</>
                                ) : (
                                  <><UserCheck className="w-4 h-4 mr-2" /> Unfreeze</>
                                )}
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
                          <div className="text-xs font-mono bg-muted p-2 rounded mt-2">
                            {JSON.stringify(log.metadata, null, 2)}
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
