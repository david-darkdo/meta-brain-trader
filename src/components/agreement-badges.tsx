// AI Agreement Engine badges for the trade detail header.
import { Badge } from "@/components/ui/badge";

type Props = {
  verdict: string | null | undefined;
  executed: boolean | null | undefined;
  hasResult: boolean;
};

export function AgreementBadges({ verdict, executed, hasResult }: Props) {
  if (!verdict || !hasResult) return null;
  const v = verdict.toUpperCase();
  const ex = !!executed;

  if (v === "APPROVED" && ex)
    return <Badge className="bg-success text-success-foreground hover:bg-success/80">Alignment</Badge>;
  if (v === "DISQUALIFIED" && ex)
    return <Badge variant="destructive">Override</Badge>;
  if (v === "DISQUALIFIED" && !ex)
    return <Badge className="bg-primary text-primary-foreground">Discipline</Badge>;
  if (v === "APPROVED" && !ex)
    return <Badge variant="secondary">Missed opportunity</Badge>;
  return null;
}
