import { useAuth } from "@/hooks/use-auth";
import { Link, useLocation } from "wouter";
import { 
  LogOut, 
  LayoutDashboard, 
  CreditCard, 
  History, 
  Users, 
  ShieldCheck, 
  Menu,
  UserCircle,
  Camera,
  FileText,
  Coins,
  Smartphone,
  RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || "");
  const [fullName, setFullName] = useState(user?.fullName || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Reset local state when user data changes (e.g. after login or update)
  if (user && fullName === "" && user.fullName) {
    setFullName(user.fullName);
    setAvatarUrl(user.avatarUrl || "");
    setPhone(user.phone || "");
  }

  const updateProfile = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update profile");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData([api.auth.me.path], data);
      toast({ title: "Profile Updated", description: "Your profile has been successfully updated." });
      setProfileOpen(false);
    },
    onError: (e: any) => {
      toast({ variant: "destructive", title: "Update Failed", description: e.message });
    }
  });

  const updatePassword = useMutation({
    mutationFn: async (data: { currentPassword: string; newPassword: string }) => {
      const res = await fetch("/api/user/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.message || "Failed to update password");
      return payload;
    },
    onSuccess: () => {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast({ title: "Password Updated", description: "Your password has been changed successfully." });
    },
    onError: (e: any) => {
      toast({ variant: "destructive", title: "Password Update Failed", description: e.message });
    }
  });

  if (!user) return <>{children}</>;

  const isStaff = user.role === 'staff';

  const NavContent = () => (
    <div className="flex flex-col h-full py-4">
      <div className="px-6 py-4 mb-6">
        <h1 className="text-2xl font-display font-bold text-primary flex items-center gap-2">
          <ShieldCheck className="w-8 h-8" />
          Redbird FCU
        </h1>
        <p className="text-[10px] text-muted-foreground mt-1 font-mono uppercase tracking-wider">
          Routing: 262275835
        </p>
      </div>

      <nav className="flex-1 px-4 space-y-2">
        {isStaff ? (
          <>
            <Link href="/admin">
              <Button 
                variant={location === "/admin" ? "secondary" : "ghost"} 
                className="w-full justify-start gap-3"
                onClick={() => setOpen(false)}
              >
                <Users className="w-4 h-4" />
                Staff Portal
              </Button>
            </Link>
            <Link href="/admin/logs">
              <Button 
                variant={location === "/admin/logs" ? "secondary" : "ghost"} 
                className="w-full justify-start gap-3"
                onClick={() => setOpen(false)}
              >
                <History className="w-4 h-4" />
                Audit Logs
              </Button>
            </Link>
          </>
        ) : (
          <>
            <Link href="/dashboard">
              <Button 
                variant={location === "/dashboard" ? "secondary" : "ghost"} 
                className="w-full justify-start gap-3"
                onClick={() => setOpen(false)}
              >
                <LayoutDashboard className="w-4 h-4" />
                Overview
              </Button>
            </Link>
            <Link href="/transactions">
              <Button 
                variant={location === "/transactions" ? "secondary" : "ghost"} 
                className="w-full justify-start gap-3"
                onClick={() => setOpen(false)}
              >
                <CreditCard className="w-4 h-4" />
                Transactions
              </Button>
            </Link>
            <Link href="/apply">
              <Button 
                variant={location === "/apply" ? "secondary" : "ghost"} 
                className="w-full justify-start gap-3"
                onClick={() => setOpen(false)}
                data-testid="nav-apply"
              >
                <FileText className="w-4 h-4" />
                Apply
              </Button>
            </Link>
            <Link href="/crypto">
              <Button 
                variant={location === "/crypto" ? "secondary" : "ghost"} 
                className="w-full justify-start gap-3"
                onClick={() => setOpen(false)}
                data-testid="nav-crypto"
              >
                <Coins className="w-4 h-4" />
                Crypto
              </Button>
            </Link>
            <Link href="/credit-cards">
              <Button 
                variant={location === "/credit-cards" ? "secondary" : "ghost"} 
                className="w-full justify-start gap-3"
                onClick={() => setOpen(false)}
                data-testid="nav-credit-cards"
              >
                <CreditCard className="w-4 h-4" />
                Credit Cards
              </Button>
            </Link>
            <Link href="/mobile-deposit">
              <Button 
                variant={location === "/mobile-deposit" ? "secondary" : "ghost"} 
                className="w-full justify-start gap-3"
                onClick={() => setOpen(false)}
                data-testid="nav-mobile-deposit"
              >
                <Smartphone className="w-4 h-4" />
                Mobile Deposit
              </Button>
            </Link>
          </>
        )}
      </nav>

      <div className="p-4 border-t mt-auto">
        <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
          <DialogTrigger asChild>
            <button className="w-full flex items-center gap-3 px-2 mb-4 hover:bg-muted/50 p-2 rounded-lg transition-colors text-left group">
              <Avatar className="w-10 h-10 border-2 border-primary/10 group-hover:border-primary/30 transition-colors">
                <AvatarImage src={user.avatarUrl || ""} alt={user.fullName} />
                <AvatarFallback className="bg-primary/10 text-primary font-bold">
                  {user.fullName.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div className="overflow-hidden flex-1">
                <p className="text-sm font-medium truncate">{user.fullName}</p>
                <p className="text-xs text-muted-foreground capitalize flex items-center gap-1">
                  {user.role} <UserCircle className="w-3 h-3" />
                </p>
              </div>
            </button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Member Profile</DialogTitle>
              <DialogDescription>
                Update your personal information and profile picture.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="flex flex-col items-center gap-4 mb-4">
                <div className="relative group cursor-pointer" onClick={() => {
                  const url = window.prompt("Enter Image URL for profile picture:", avatarUrl);
                  if (url !== null) setAvatarUrl(url);
                }}>
                  <Avatar className="w-24 h-24 border-4 border-muted">
                    <AvatarImage src={avatarUrl} />
                    <AvatarFallback className="text-2xl">{fullName.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Camera className="text-white w-6 h-6" />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">Click image to update URL</p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="name">Full Name</Label>
                <Input 
                  id="name" 
                  value={fullName} 
                  onChange={(e) => setFullName(e.target.value)} 
                  placeholder="Your full name"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input 
                  id="phone" 
                  value={phone} 
                  onChange={(e) => setPhone(e.target.value)} 
                  placeholder="Phone number"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="avatar">Avatar URL</Label>
                <Input 
                  id="avatar" 
                  value={avatarUrl} 
                  onChange={(e) => setAvatarUrl(e.target.value)} 
                  placeholder="https://example.com/image.png"
                />
              </div>

              <Separator className="my-2" />

              <div className="space-y-1">
                <p className="text-sm font-medium">Change Password</p>
                <p className="text-xs text-muted-foreground">Use at least 8 characters and keep it unique.</p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="current-password">Current Password</Label>
                <Input
                  id="current-password"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="confirm-password">Confirm New Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (!currentPassword || !newPassword || !confirmPassword) {
                    toast({ variant: "destructive", title: "Missing fields", description: "Please fill out all password fields." });
                    return;
                  }
                  if (newPassword !== confirmPassword) {
                    toast({ variant: "destructive", title: "Passwords do not match", description: "New password and confirmation must match." });
                    return;
                  }
                  updatePassword.mutate({ currentPassword, newPassword });
                }}
                disabled={updatePassword.isPending}
              >
                {updatePassword.isPending && <RefreshCw className="w-4 h-4 mr-2 animate-spin" />}
                Update Password
              </Button>
              <Button 
                type="submit" 
                onClick={() => updateProfile.mutate({ avatarUrl, fullName, phone })}
                disabled={updateProfile.isPending}
              >
                {updateProfile.isPending && <RefreshCw className="w-4 h-4 mr-2 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Button 
          variant="outline" 
          className="w-full gap-2 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/20"
          onClick={() => logout.mutate()}
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50/50 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-72 bg-white border-r border-border fixed inset-y-0 z-30">
        <NavContent />
      </aside>

      {/* Mobile Sidebar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-white border-b border-border p-4 flex items-center justify-between">
        <h1 className="text-xl font-display font-bold text-primary flex items-center gap-2">
          <ShieldCheck className="w-6 h-6" />
          Redbird FCU
        </h1>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="w-6 h-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-72">
            <NavContent />
          </SheetContent>
        </Sheet>
      </div>

      <main className="flex-1 lg:ml-72 pt-20 lg:pt-0 p-4 md:p-8 min-h-screen">
        <div className="max-w-6xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
