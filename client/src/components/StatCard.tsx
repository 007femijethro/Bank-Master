import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string;
  icon: LucideIcon;
  description?: string;
  className?: string;
}

export function StatCard({ title, value, icon: Icon, description, className }: StatCardProps) {
  const hasFg = className?.includes("text-primary-foreground");

  return (
    <Card className={`overflow-hidden border transition-colors duration-200 ${className || ""}`}>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-3">
        <div className="space-y-1">
          <CardTitle className={`text-xs font-semibold uppercase tracking-[0.11em] ${hasFg ? "text-white/80" : "text-muted-foreground"}`}>
            {title}
          </CardTitle>
          {description && (
            <p className={`text-xs ${hasFg ? "text-white/70" : "text-muted-foreground"}`}>
              {description}
            </p>
          )}
        </div>
        <div className={`flex h-9 w-9 items-center justify-center rounded-md border ${hasFg ? "border-white/20 bg-white/10" : "border-primary/15 bg-primary/5"}`}>
          <Icon className={`h-4 w-4 ${hasFg ? "text-white" : "text-primary"}`} />
        </div>
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-semibold tracking-tight sm:text-3xl ${hasFg ? "text-white" : "text-foreground"}`}>
          {value}
        </div>
      </CardContent>
    </Card>
  );
}
