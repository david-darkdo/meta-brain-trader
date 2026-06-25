import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Profile — MetaBrain Trader" }] }),
  component: Profile,
});

function Profile() {
  const { data } = useQuery({
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
      return { authUser: u.user, row };
    },
  });

  const tier = data?.row?.subscription_tier ?? "FREE";
  const email = data?.row?.email ?? data?.authUser?.email ?? "—";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your account and subscription.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Account</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <Row k="Email" v={email} />
          <Row k="Member since" v={data?.row?.created_at ? new Date(data.row.created_at).toLocaleDateString() : "—"} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Subscription</CardTitle>
            <Badge variant={tier === "FREE" ? "secondary" : "default"}>{tier}</Badge>
          </div>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {tier === "FREE"
            ? "You're on the Free plan. Upgrades will unlock the full coaching engine."
            : `You're on the ${tier} plan.`}
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between border-b border-border py-2 last:border-0">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-medium">{v}</span>
    </div>
  );
}
