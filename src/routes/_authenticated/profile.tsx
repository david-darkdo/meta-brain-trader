import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  UserCircle,
  Building2,
  ShieldAlert,
  LogOut,
  Lock,
  Mail,
  Calendar,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Profile — MetaBrain Board" }] }),
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
  const tier = p?.row?.subscription_tier ?? "FREE";
  const email = p?.row?.email ?? p?.authUser?.email ?? "—";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <UserCircle className="h-5 w-5" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
            <Badge variant="outline" className="text-xs font-mono">
              {p?.roles?.join(", ") || "USER"}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Account identity, subscription tier, and platform administration.
          </p>
        </div>

        <Button variant="outline" size="sm" onClick={handleSignOut} className="gap-2 text-destructive hover:bg-destructive/10">
          <LogOut className="h-4 w-4" />
          Sign Out
        </Button>
      </div>

      {/* PRIVILEGED ADMINISTRATIVE CONTROLS (ADMIN ONLY) */}
      {p?.isAdmin && (
        <Card className="border-primary/40 bg-primary/5">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg font-semibold">Administrative Access</CardTitle>
              </div>
              <Badge className="bg-primary text-primary-foreground font-mono text-xs">
                ADMIN PRIVILEGED
              </Badge>
            </div>
            <CardDescription className="text-sm">
              You are authenticated with Company Administrator privileges. Access the internal Company Command Center to manage MetaFund operations, capital activations, cycle creation, and system reconciliation.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full sm:w-auto gap-2">
              <Link to="/command-center">
                <Building2 className="h-4 w-4" />
                Enter Company Command Center
                <ExternalLink className="h-3.5 w-3.5 ml-1" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ACCOUNT DETAILS */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Mail className="h-4 w-4 text-muted-foreground" />
            Account Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <Row k="Email Address" v={email} />
          <Row
            k="Member Since"
            v={p?.row?.created_at ? new Date(p.row.created_at).toLocaleDateString() : "—"}
          />
          <Row
            k="Platform Roles"
            v={p?.roles && p.roles.length > 0 ? p.roles.join(" · ") : "Standard User"}
          />
        </CardContent>
      </Card>

      {/* SUBSCRIPTION */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Subscription Tier</CardTitle>
            <Badge variant={tier === "FREE" ? "secondary" : "default"}>{tier}</Badge>
          </div>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {tier === "FREE"
            ? "You are currently on the Free tier. Upgrades unlock real-time AI validation insights and advanced portfolio analytics."
            : `Active ${tier} plan with unlimited trading intelligence features.`}
        </CardContent>
      </Card>

      {/* SECURITY & CREDENTIALS */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Lock className="h-4 w-4 text-muted-foreground" />
            Security & Authentication
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            Your session is secured via Supabase JWT token authentication with Row Level Security (RLS) enforcement on all platform endpoints.
          </p>
          <div className="flex flex-wrap gap-2 pt-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/reset-password">Change Password</Link>
            </Button>
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              End Current Session
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between border-b border-border py-2 last:border-0">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-medium text-foreground">{v}</span>
    </div>
  );
}
