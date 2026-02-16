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
    <Card className={`overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1 border-border/50 ${className}`}>
      <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
        <CardTitle className={`text-sm font-medium ${hasFg ? "text-white/80" : "text-muted-foreground"}`}>
          {title}
        </CardTitle>
        <div className={`h-8 w-8 rounded-full flex items-center justify-center ${hasFg ? "bg-white/20" : "bg-primary/10"}`}>
          <Icon className={`h-4 w-4 ${hasFg ? "text-white" : "text-primary"}`} />
        </div>
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold font-display tracking-tight ${hasFg ? "text-white" : ""}`}>{value}</div>
        {description && (
          <p className={`text-xs mt-1 ${hasFg ? "text-white/70" : "text-muted-foreground"}`}>
            {description}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
