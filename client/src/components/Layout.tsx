import { useAuth } from "@/hooks/use-auth";
import { Link, useLocation } from "wouter";
import { 
  LogOut, 
  LayoutDashboard, 
  CreditCard, 
  History, 
  Users, 
  ShieldCheck, 
  Menu
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useState } from "react";

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const [open, setOpen] = useState(false);

  if (!user) return <>{children}</>;

  const isStaff = user.role === 'staff';

  const NavContent = () => (
    <div className="flex flex-col h-full py-4">
      <div className="px-6 py-4 mb-6">
        <h1 className="text-2xl font-display font-bold text-primary flex items-center gap-2">
          <ShieldCheck className="w-8 h-8" />
          RFCU
        </h1>
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
          </>
        )}
      </nav>

      <div className="p-4 border-t mt-auto">
        <div className="flex items-center gap-3 px-2 mb-4">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
            {user.fullName.charAt(0)}
          </div>
          <div className="overflow-hidden">
            <p className="text-sm font-medium truncate">{user.fullName}</p>
            <p className="text-xs text-muted-foreground capitalize">{user.role}</p>
          </div>
        </div>
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
          SecureBank
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
