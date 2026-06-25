import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AnimatedNumber } from "@/components/shared/AnimatedNumber";
import { cn } from "@/lib/utils";

interface KPICardProps {
  label: string;
  value: number;
  tone?: "default" | "success" | "warning" | "danger";
  hint?: string;
}

const TONE_CLASS: Record<NonNullable<KPICardProps["tone"]>, string> = {
  default: "text-foreground",
  success: "text-accent-success",
  warning: "text-accent-warning",
  danger: "text-accent-danger",
};

export function KPICard({ label, value, tone = "default", hint }: KPICardProps) {
  return (
    <Card className="transition-transform hover:scale-[1.02]">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-normal text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <AnimatedNumber
          value={value}
          className={cn("text-mono-amount text-2xl font-semibold", TONE_CLASS[tone])}
        />
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}
