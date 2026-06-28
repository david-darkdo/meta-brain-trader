// Post-trade screenshot uploader with shot_type classification.
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Trash2, Upload } from "lucide-react";

type ShotType = "ENTRY" | "MANAGEMENT" | "EXIT" | "RESULT" | "ACCOUNT";
const TYPES: ShotType[] = ["ENTRY", "MANAGEMENT", "EXIT", "RESULT", "ACCOUNT"];

type Pending = { id: string; file: File; label: string; shot_type: ShotType };

export function PostScreenshotUploader({ tradeId, userId }: { tradeId: string; userId: string }) {
  const qc = useQueryClient();
  const [pending, setPending] = useState<Pending[]>([]);
  const [busy, setBusy] = useState(false);

  const existingQ = useQuery({
    queryKey: ["trade", tradeId, "post-screenshots"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("screenshots")
        .select("screenshot_id,url,user_label,shot_type")
        .eq("trade_id", tradeId)
        .eq("analysis_phase", "POST");
      if (error) throw error;
      const signed = await Promise.all(
        (data ?? []).map(async (s) => {
          const { data: sig } = await supabase.storage
            .from("trade-screenshots").createSignedUrl(s.url, 60 * 60);
          return { ...s, signedUrl: sig?.signedUrl ?? null };
        }),
      );
      return signed;
    },
  });

  function addFiles(files: FileList | null) {
    if (!files) return;
    const next: Pending[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;
      if (file.size > 10 * 1024 * 1024) { toast.error(`${file.name} > 10MB`); continue; }
      next.push({ id: crypto.randomUUID(), file, label: "", shot_type: "EXIT" });
    }
    setPending((p) => [...p, ...next]);
  }

  const upload = useMutation({
    mutationFn: async () => {
      setBusy(true);
      for (const p of pending) {
        const ext = p.file.name.split(".").pop() || "png";
        const path = `${userId}/${tradeId}/post-${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("trade-screenshots").upload(path, p.file, { contentType: p.file.type });
        if (upErr) throw upErr;
        const { error: insErr } = await supabase.from("screenshots").insert({
          trade_id: tradeId, url: path, user_label: p.label.trim() || null,
          shot_type: p.shot_type, analysis_phase: "POST", is_primary: false,
        });
        if (insErr) throw insErr;
      }
    },
    onSuccess: () => {
      toast.success("Post-trade screenshots uploaded");
      setPending([]);
      qc.invalidateQueries({ queryKey: ["trade", tradeId, "post-screenshots"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Upload failed"),
    onSettled: () => setBusy(false),
  });

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Post-trade screenshots</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-secondary/30 p-6 text-center hover:bg-secondary/50">
          <Upload className="h-5 w-5 text-muted-foreground" />
          <span className="text-sm font-medium">Add execution screenshots</span>
          <span className="text-xs text-muted-foreground">Entry, management, exit, result, account</span>
          <input type="file" accept="image/*" multiple className="hidden"
            onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
        </label>

        {pending.length > 0 && (
          <ul className="space-y-3">
            {pending.map((p) => (
              <li key={p.id} className="flex items-start gap-3 rounded-md border border-border bg-card p-3">
                <img src={URL.createObjectURL(p.file)} alt="" className="h-16 w-16 rounded object-cover" />
                <div className="flex-1 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Type</Label>
                      <Select value={p.shot_type} onValueChange={(v) => setPending((arr) => arr.map((x) => x.id === p.id ? { ...x, shot_type: v as ShotType } : x))}>
                        <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Label</Label>
                      <Input className="h-8" placeholder="e.g. after BOS" value={p.label}
                        onChange={(e) => setPending((arr) => arr.map((x) => x.id === p.id ? { ...x, label: e.target.value } : x))} />
                    </div>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setPending((arr) => arr.filter((x) => x.id !== p.id))}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
            <Button size="sm" disabled={busy} onClick={() => upload.mutate()}>
              {busy ? "Uploading…" : `Upload ${pending.length}`}
            </Button>
          </ul>
        )}

        {existingQ.data && existingQ.data.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {existingQ.data.map((s) => (
              <figure key={s.screenshot_id} className="space-y-1">
                {s.signedUrl && <img src={s.signedUrl} alt={s.user_label ?? ""} className="w-full rounded-md border border-border" />}
                <figcaption className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{s.shot_type}</span>
                  <span className="truncate">{s.user_label}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
