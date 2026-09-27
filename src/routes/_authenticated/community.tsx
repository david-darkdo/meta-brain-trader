import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, ShieldCheck, Zap, Trophy, MessageSquare, Sparkles, Clock } from "lucide-react";

export const Route = createFileRoute("/_authenticated/community")({
  head: () => ({ meta: [{ title: "Community — MetaBrain Platform" }] }),
  component: CommunityPlatform,
});

function CommunityPlatform() {
  const plannedPillars = [
    {
      title: "Verified Trader Network",
      description: "Connect with peer traders running institutional strategies with cryptographically verified track records.",
      icon: ShieldCheck,
      badge: "Reserved",
    },
    {
      title: "Alpha Syndicates",
      description: "Collaborative trade validation squads sharing multi-timeframe analysis and high-probability setups.",
      icon: Zap,
      badge: "Planned",
    },
    {
      title: "Strategy & Edge Discussions",
      description: "In-depth post-mortem debriefs on rule execution, market structure shifts, and AI verdict accuracy.",
      icon: MessageSquare,
      badge: "Planned",
    },
    {
      title: "Global Performance Leaderboards",
      description: "Objective rankings based on execution discipline scores, risk management consistency, and audited returns.",
      icon: Trophy,
      badge: "Planned",
    },
  ];

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Users className="h-5 w-5" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Community</h1>
            <Badge variant="secondary" className="gap-1 text-xs">
              <Clock className="h-3 w-3" />
              Under Development
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            The collaborative intelligence layer for MetaBrain traders and capital syndicates.
          </p>
        </div>
      </div>

      {/* PLATFORM NOTICE */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg text-foreground">
            <Sparkles className="h-5 w-5 text-primary" />
            MetaBrain Community Platform Architecture
          </CardTitle>
          <CardDescription className="text-sm">
            Community is an approved primary sibling platform on the MetaBrain Board. This surface is reserved for verified peer collaboration and strategy syndication once the core validation and capital foundations are fully established.
          </CardDescription>
        </CardHeader>
      </Card>

      {/* ROADMAP PILLARS */}
      <div className="grid gap-4 sm:grid-cols-2">
        {plannedPillars.map((p) => (
          <Card key={p.title} className="relative overflow-hidden">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-primary">
                  <p.icon className="h-5 w-5" />
                </div>
                <Badge variant="outline" className="text-xs">
                  {p.badge}
                </Badge>
              </div>
              <CardTitle className="mt-3 text-base">{p.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {p.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
