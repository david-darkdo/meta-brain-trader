import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  User,
  Shield,
  SlidersHorizontal,
  Bell,
  Building2,
  ChevronRight,
  LogOut,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Profile — MetaBrain Trader" }] }),
  component: ProfilePlatform,
});

function ProfilePlatform() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const profileQ = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const userId = u.user?.id;
      if (!userId) return null;

      const { data: row } = await supabase
        .from("users")
        .select("email,subscription_tier,created_at")
        .eq("user_id", userId)
        .maybeSingle();

      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);

      const roleList = (roles ?? []).map((r) => r.role);

      return {
        authUser: u.user,
        row,
        isAdmin: roleList.includes("ADMIN"),
        isInvestor: roleList.includes("INVESTOR"),
        roles: roleList,
      };
    },
  });

  async function handleSignOut() {
    try {
      await queryClient.cancelQueries();
      queryClient.clear();
      await supabase.auth.signOut();
      toast.success("Signed out successfully");
      navigate({ to: "/auth", replace: true });
    } catch (err) {
      toast.error("Failed to sign out");
    }
  }

  const p = profileQ.data;
  const email = p?.row?.email ?? p?.authUser?.email ?? "trader@metabrain.io";
  const displayName = p?.authUser?.user_metadata?.full_name || email.split("@")[0] || "MetaBrain Trader";
  const initials = displayName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase() || "MB";

  const tier = p?.row?.subscription_tier ?? "PRO";

  return (
    <div className="space-y-6">
      {/* 1. PLATFORM TITLE */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground font-sans">
          Profile
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
          Your Account. Your Settings.
        </p>
      </div>

      {/* 2. USER PROFILE HERO CARD */}
      <div className="flex items-center gap-4 p-5 rounded-2xl border border-border/80 bg-card/80 backdrop-blur-md">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-amber-500/40 bg-secondary font-mono text-lg font-bold text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.12)]">
          {initials}
        </div>
        <div className="space-y-1 overflow-hidden">
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-bold text-foreground truncate">
              {displayName}
            </h2>
            <Badge className="bg-amber-500/15 text-amber-400 border border-amber-500/30 text-[10px] font-semibold">
              {tier}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground font-mono truncate">
            {email}
          </p>
        </div>
      </div>

      {/* 3. SETTINGS & PREFERENCES MENU LIST */}
      <div className="space-y-2.5">
        {/* ACCOUNT INFORMATION */}
        <div className="flex items-center justify-between p-4 rounded-xl border border-border/70 bg-card/60 hover:bg-card hover:border-border transition-all cursor-pointer">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-amber-400">
              <User className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-semibold text-foreground">Account Information</div>
              <div className="text-[11px] text-muted-foreground">Manage your identity and email preferences</div>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </div>

        {/* SECURITY & PASSWORD */}
        <Link
          to="/reset-password"
          className="flex items-center justify-between p-4 rounded-xl border border-border/70 bg-card/60 hover:bg-card hover:border-border transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-amber-400">
              <Shield className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-semibold text-foreground">Security & Password</div>
              <div className="text-[11px] text-muted-foreground">Session management and password updates</div>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Link>

        {/* PREFERENCES */}
        <div className="flex items-center justify-between p-4 rounded-xl border border-border/70 bg-card/60 hover:bg-card hover:border-border transition-all cursor-pointer">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-amber-400">
              <SlidersHorizontal className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-semibold text-foreground">Preferences</div>
              <div className="text-[11px] text-muted-foreground">Trading defaults, theme accents, and sound alerts</div>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </div>

        {/* NOTIFICATIONS */}
        <div className="flex items-center justify-between p-4 rounded-xl border border-border/70 bg-card/60 hover:bg-card hover:border-border transition-all cursor-pointer">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-amber-400">
              <Bell className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-semibold text-foreground">Notifications</div>
              <div className="text-[11px] text-muted-foreground">AI validation alerts and cycle settlement notices</div>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </div>

        {/* COMPANY COMMAND CENTER (ADMIN PRIVILEGED ACCESS) */}
        {p?.isAdmin && (
          <Link
            to="/command-center"
            className="flex items-center justify-between p-4 rounded-xl border border-amber-500/40 bg-amber-500/5 hover:bg-amber-500/10 hover:border-amber-400 transition-all mt-3"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400">
                <Building2 className="h-4 w-4" />
              </div>
              <div>
                <div className="text-sm font-semibold text-foreground flex items-center gap-2">
                  Company Command Center
                  <Badge className="bg-amber-500 text-black text-[10px] font-bold px-1.5 py-0">
                    Admin Access
                  </Badge>
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Manage MetaFund cycles, capital activations, and reconciliation
                </div>
              </div>
            </div>
            <ExternalLink className="h-4 w-4 text-amber-400" />
          </Link>
        )}
      </div>

      {/* 4. SIGN OUT BUTTON */}
      <div className="pt-4">
        <Button
          type="button"
          onClick={handleSignOut}
          variant="outline"
          className="w-full h-11 border-rose-500/30 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 hover:border-rose-500/50 text-sm font-semibold gap-2"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </div>
  );
}
