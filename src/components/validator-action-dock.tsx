import { Link } from "@tanstack/react-router";
import {
  Plus,
  BookOpen,
  Sliders,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface ValidatorActionItem {
  id: string;
  label: string;
  description: string;
  to: string;
  icon: LucideIcon;
  primary?: boolean;
}

export const DEFAULT_VALIDATOR_ACTIONS: readonly ValidatorActionItem[] = [
  {
    id: "new-trade",
    label: "New Trade",
    description: "Plan, size, and execute a new validated trade",
    to: "/trade-creator",
    icon: Plus,
    primary: true,
  },
  {
    id: "journal",
    label: "Journal",
    description: "Open your personal trading notebook and psychological memory",
    to: "/journal",
    icon: BookOpen,
  },
  {
    id: "strategy",
    label: "Strategy",
    description: "Manage rule profiles, checklists, and edge setups",
    to: "/strategy-profiles",
    icon: Sliders,
  },
  {
    id: "trade-analysis",
    label: "Trade Analysis",
    description: "Deep AI validation verdicts, reviews, and trade history",
    to: "/trade-analysis",
    icon: Sparkles,
  },
] as const;

interface ValidatorActionDockProps {
  actions?: readonly ValidatorActionItem[];
  className?: string;
}

export function ValidatorActionDock({
  actions = DEFAULT_VALIDATOR_ACTIONS,
  className = "",
}: ValidatorActionDockProps) {
  return (
    <TooltipProvider delayDuration={200}>
      <div className={`space-y-2 ${className}`}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Validator Tools
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
          {actions.map((act) => {
            const Icon = act.icon;
            return (
              <Tooltip key={act.id}>
                <TooltipTrigger asChild>
                  <Link
                    to={act.to}
                    className={`group relative flex items-center gap-3 rounded-xl border p-3 sm:p-3.5 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                      act.primary
                        ? "border-amber-500/40 bg-card/90 hover:border-amber-400 hover:bg-card hover:shadow-[0_4px_20px_rgba(245,158,11,0.12)]"
                        : "border-border/70 bg-card/60 hover:border-border hover:bg-card hover:shadow-sm"
                    }`}
                  >
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-transform group-hover:scale-105 ${
                        act.primary
                          ? "bg-amber-500/15 text-amber-400"
                          : "bg-secondary text-amber-400/90 group-hover:text-amber-400"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>

                    <div className="min-w-0 overflow-hidden text-left">
                      <div className="text-xs sm:text-sm font-semibold text-foreground truncate group-hover:text-amber-400 transition-colors">
                        {act.label}
                      </div>
                      <div className="text-[10px] text-muted-foreground truncate hidden xs:block">
                        {act.description}
                      </div>
                    </div>
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs max-w-xs">
                  {act.description}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </div>
    </TooltipProvider>
  );
}
