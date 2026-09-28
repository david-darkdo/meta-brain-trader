import { createFileRoute } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Share2, GraduationCap, Video, Globe2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/community")({
  head: () => ({ meta: [{ title: "Community — MetaBrain Trader" }] }),
  component: CommunityPlatform,
});

function CommunityPlatform() {
  const pillars = [
    {
      title: "Trader Discussions",
      description: "Connect with verified traders worldwide, discuss live market conditions, and share setups.",
      icon: MessageSquare,
    },
    {
      title: "Strategy Sharing",
      description: "Learn from real executed trading journals, post-mortems, and edge optimization playbooks.",
      icon: Share2,
    },
    {
      title: "Educational Content",
      description: "Level up your technical execution, risk management psychology, and algorithmic rules.",
      icon: GraduationCap,
    },
    {
      title: "Live Events & AMAs",
      description: "Participate in weekly market reviews, strategy debriefs, and syndicate mastermind sessions.",
      icon: Video,
    },
  ];

  return (
    <div className="space-y-6">
      {/* 1. PLATFORM TITLE */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground font-sans">
          Community
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
          Learn. Share. Grow Together.
        </p>
      </div>

      {/* 2. HERO CARD — "A Global Community of Disciplined Traders" */}
      <div className="relative overflow-hidden rounded-2xl gold-card-hero p-5 sm:p-7">
        <div className="flex items-center justify-between relative z-10">
          <div className="space-y-2 max-w-sm">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground leading-snug">
              A Global Community of{" "}
              <span className="gold-gradient-text">Disciplined Traders</span>
            </h2>
            <div className="flex items-center gap-2 pt-1">
              <Badge className="bg-amber-500/15 text-amber-400 border border-amber-500/30 text-xs font-semibold px-2.5 py-0.5">
                Coming Soon
              </Badge>
              <Badge variant="outline" className="text-xs text-muted-foreground">
                Under Development
              </Badge>
            </div>
          </div>

          {/* Golden Globe Vector Graphic */}
          <div className="hidden xs:flex shrink-0 items-center justify-center h-20 w-20 sm:h-24 sm:w-24 rounded-2xl bg-amber-500/10 border border-amber-500/20 shadow-[0_0_25px_rgba(245,158,11,0.15)]">
            <Globe2 className="h-12 w-12 text-amber-400 animate-pulse" />
          </div>
        </div>
      </div>

      {/* 3. UPCOMING COMMUNITY PILLARS (LIST OF 4 CARDS) */}
      <div className="space-y-3">
        {pillars.map((p) => {
          const Icon = p.icon;
          return (
            <div
              key={p.title}
              className="flex items-start gap-4 p-4 rounded-xl border border-border/70 bg-card/60 hover:bg-card hover:border-border transition-all"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-amber-400 mt-0.5">
                <Icon className="h-5 w-5" />
              </div>
              <div className="space-y-0.5">
                <h3 className="text-sm sm:text-base font-semibold text-foreground">
                  {p.title}
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {p.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
