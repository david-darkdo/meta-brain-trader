import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { History } from "lucide-react";

type Section =
  | "WHAT_I_SAW"
  | "WHAT_I_FELT"
  | "WHAT_I_DID_RIGHT"
  | "WHAT_I_DID_WRONG"
  | "WHAT_I_LEARNED"
  | "PROMISE_TO_MYSELF";

const SECTIONS: { key: Section; label: string; hint: string }[] = [
  { key: "WHAT_I_SAW", label: "What I saw", hint: "The price action and context you observed" },
  { key: "WHAT_I_FELT", label: "What I felt", hint: "Emotions during entry, hold, and exit" },
  { key: "WHAT_I_DID_RIGHT", label: "What I did right", hint: "Decisions that aligned with your plan" },
  { key: "WHAT_I_DID_WRONG", label: "What I did wrong", hint: "Where you deviated or hesitated" },
  { key: "WHAT_I_LEARNED", label: "What I learned", hint: "The single biggest takeaway" },
  { key: "PROMISE_TO_MYSELF", label: "Promise to myself", hint: "A concrete commitment going forward" },
];

type Reflection = { id: string; section_type: string; content: string; updated_at: string };
type Version = { id: string; version: number; content: string; created_at: string };

export function ReflectionSections({ tradeId }: { tradeId: string }) {
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["trade", tradeId, "reflections-sections"],
    queryFn: async (): Promise<Reflection[]> => {
      const { data, error } = await supabase
        .from("reflections")
        .select("id,section_type,content,updated_at")
        .eq("trade_id", tradeId);
      if (error) throw error;
      return (data ?? []) as Reflection[];
    },
  });

  const byKey = new Map<string, Reflection>();
  (q.data ?? []).forEach((r) => byKey.set(r.section_type, r));

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Reflection journal</CardTitle></CardHeader>
      <CardContent className="space-y-6">
        {SECTIONS.map((s) => (
          <SectionEditor
            key={s.key}
            tradeId={tradeId}
            section={s.key}
            label={s.label}
            hint={s.hint}
            existing={byKey.get(s.key)}
            onSaved={() => qc.invalidateQueries({ queryKey: ["trade", tradeId, "reflections-sections"] })}
          />
        ))}
      </CardContent>
    </Card>
  );
}

function SectionEditor({
  tradeId, section, label, hint, existing, onSaved,
}: {
  tradeId: string; section: Section; label: string; hint: string;
  existing?: Reflection; onSaved: () => void;
}) {
  const [draft, setDraft] = useState(existing?.content ?? "");
  const [showHistory, setShowHistory] = useState(false);
  useEffect(() => { setDraft(existing?.content ?? ""); }, [existing?.content]);

  const save = useMutation({
    mutationFn: async () => {
      if (existing) {
        const { error } = await supabase.from("reflections").update({ content: draft }).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("reflections").insert({ trade_id: tradeId, section_type: section, content: draft });
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success(`${label} saved`); onSaved(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const versionsQ = useQuery({
    queryKey: ["reflection", existing?.id, "versions"],
    enabled: !!existing && showHistory,
    queryFn: async (): Promise<Version[]> => {
      const { data, error } = await supabase
        .from("reflection_versions")
        .select("id,version,content,created_at")
        .eq("reflection_id", existing!.id)
        .order("version", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Version[];
    },
  });

  const dirty = draft !== (existing?.content ?? "");

  return (
    <div className="space-y-2 rounded-md border border-border bg-card/40 p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium">{label}</div>
          <div className="text-xs text-muted-foreground">{hint}</div>
        </div>
        {existing && (
          <Button variant="ghost" size="sm" onClick={() => setShowHistory((v) => !v)} className="gap-1">
            <History className="h-3.5 w-3.5" /> History
          </Button>
        )}
      </div>
      <Textarea rows={3} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={`Write your ${label.toLowerCase()}…`} />
      <div className="flex items-center justify-end gap-2">
        {dirty && (
          <Button size="sm" variant="ghost" onClick={() => setDraft(existing?.content ?? "")}>Cancel</Button>
        )}
        <Button size="sm" disabled={!dirty || save.isPending || !draft.trim()} onClick={() => save.mutate()}>
          {save.isPending ? "Saving…" : "Save"}
        </Button>
      </div>
      {showHistory && versionsQ.data && versionsQ.data.length > 0 && (
        <ul className="space-y-2 border-t border-border pt-2">
          {versionsQ.data.map((v) => (
            <li key={v.id} className="rounded bg-muted/40 p-2 text-xs">
              <div className="mb-1 flex items-center justify-between text-muted-foreground">
                <Badge variant="secondary">v{v.version}</Badge>
                <span>{new Date(v.created_at).toLocaleString()}</span>
              </div>
              <p className="whitespace-pre-wrap text-foreground">{v.content}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
