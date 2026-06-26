import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/strategy-profiles")({
  head: () => ({ meta: [{ title: "Strategy profiles — MetaBrain Trader" }] }),
  component: StrategyProfiles,
});

type Profile = {
  id: string;
  name: string;
  prompt_config: Record<string, unknown>;
  is_active: boolean;
};

function StrategyProfiles() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [rules, setRules] = useState("");

  const q = useQuery({
    queryKey: ["strategy-profiles"],
    queryFn: async (): Promise<Profile[]> => {
      const { data, error } = await supabase
        .from("strategy_profiles")
        .select("id,name,prompt_config,is_active")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Profile[];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      if (!uid) throw new Error("Not signed in");
      const { error } = await supabase.from("strategy_profiles").insert({
        user_id: uid,
        name: name.trim(),
        prompt_config: { rules: rules.split("\n").map((r) => r.trim()).filter(Boolean) },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setName("");
      setRules("");
      qc.invalidateQueries({ queryKey: ["strategy-profiles"] });
      toast.success("Profile created");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const activate = useMutation({
    mutationFn: async (id: string) => {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      if (!uid) throw new Error("Not signed in");
      await supabase.from("strategy_profiles").update({ is_active: false }).eq("user_id", uid);
      const { error } = await supabase.from("strategy_profiles").update({ is_active: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["strategy-profiles"] }),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("strategy_profiles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["strategy-profiles"] }),
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Strategy profiles</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure rules the AI will use when evaluating your trades. Only one profile can be active.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">New profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="pname">Name</Label>
            <Input id="pname" placeholder="ICT 2024 swing" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="prules">Rules (one per line)</Label>
            <Textarea
              id="prules"
              rows={5}
              placeholder={"Only trade with H4 trend\nMin 1:2 RR\nNo Friday entries"}
              value={rules}
              onChange={(e) => setRules(e.target.value)}
            />
          </div>
          <div className="flex justify-end">
            <Button disabled={!name.trim() || create.isPending} onClick={() => create.mutate()}>
              {create.isPending ? "Saving…" : "Create"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {q.data?.map((p) => (
          <Card key={p.id}>
            <CardContent className="flex items-start justify-between gap-3 p-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{p.name}</span>
                  {p.is_active && <Badge>Active</Badge>}
                </div>
                {Array.isArray((p.prompt_config as { rules?: string[] }).rules) && (
                  <ul className="list-disc pl-5 text-sm text-muted-foreground">
                    {((p.prompt_config as { rules: string[] }).rules ?? []).map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="flex shrink-0 gap-2">
                {!p.is_active && (
                  <Button size="sm" variant="outline" onClick={() => activate.mutate(p.id)}>
                    Activate
                  </Button>
                )}
                <Button size="icon" variant="ghost" onClick={() => del.mutate(p.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {q.data && q.data.length === 0 && (
          <p className="text-center text-sm text-muted-foreground">No profiles yet.</p>
        )}
      </div>
    </div>
  );
}
