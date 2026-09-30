import { BarChart3, Wallet, Users, User, type LucideIcon } from "lucide-react";

export interface BoardPlatform {
  id: "validator" | "metafund" | "community" | "profile";
  label: string;
  shortLabel: string;
  to: string;
  icon: LucideIcon;
  description: string;
  matchPrefixes: string[];
}

export const BOARD_PLATFORMS: readonly BoardPlatform[] = [
  {
    id: "validator",
    label: "Meta Validator",
    shortLabel: "Meta Validator",
    to: "/validator",
    icon: BarChart3,
    description: "Trading intelligence & multi-timeframe validation platform",
    matchPrefixes: [
      "/validator",
      "/dashboard",
      "/trade-creator",
      "/journal",
      "/trade-analysis",
      "/strategy-profiles",
      "/trade-detail",
    ],
  },
  {
    id: "metafund",
    label: "MetaFund",
    shortLabel: "MetaFund",
    to: "/metafund",
    icon: Wallet,
    description: "Investor capital & financial participation platform",
    matchPrefixes: ["/metafund"],
  },
  {
    id: "community",
    label: "Community",
    shortLabel: "Community",
    to: "/community",
    icon: Users,
    description: "Trader network & alpha syndicates platform",
    matchPrefixes: ["/community"],
  },
  {
    id: "profile",
    label: "Profile",
    shortLabel: "Profile",
    to: "/profile",
    icon: User,
    description: "Account settings, preferences & administrative access",
    matchPrefixes: ["/profile"],
  },
] as const;

export function getActivePlatform(pathname: string): BoardPlatform["id"] {
  if (pathname.startsWith("/metafund")) return "metafund";
  if (pathname.startsWith("/community")) return "community";
  if (pathname.startsWith("/profile")) return "profile";
  // Default to Meta Validator for /validator, /dashboard, /trade-creator, /journal, /strategy-profiles, /trade-detail, etc.
  return "validator";
}
