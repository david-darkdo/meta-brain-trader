import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type Outcome = "WIN" | "LOSS" | "BREAKEVEN" | "CANCELLED";

export function ResultForm({ tradeId }: { tradeId: string }) {
  const qc = useQueryClient();
  const resultQ = useQuery({
    queryKey: ["trade", tradeId, "result"],
    queryFn: async () => {
      const { data } = await supabase.from("results").select("*").eq("trade_id", tradeId).maybeSingle();
      return data;
    },
  });

  const [outcome, setOutcome] = useState<Outcome>("WIN");
  const [closingPrice, setClosingPrice] = useState("");
  const [pnlAmount, setPnlAmount] = useState("");
  const [pnlPercent, setPnlPercent] = useState("");
  const [rrAchieved, setRrAchieved] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    const r = resultQ.data;
    if (r) {
      setOutcome((r.outcome as Outcome) ?? "WIN");
      setClosingPrice(r.closing_price?.toString() ?? "");
      setPnlAmount(r.pnl_amount?.toString() ?? "");
      setPnlPercent(r.pnl_percent?.toString() ?? "");
      setRrAchieved(r.rr_achieved?.toString() ?? "");
      setNotes(r.result_notes ?? "");
    }
  }, [resultQ.data]);

  const save = useMutation({
    mutationFn: async () => {
      const pnl = pnlPercent === "" ? null : Number(pnlPercent);
      if (pnl === null || !Number.isFinite(pnl)) {
        throw new Error("Enter a valid P&L percentage before posting the trade result.");
      }

      const { data, error } = await supabase.rpc("save_trade_result_and_allocate", {
        p_trade_id: tradeId,
        p_outcome: outcome,
        p_closing_price: closingPrice ? Number(closingPrice) : null,
        p_pnl_amount: pnlAmount ? Number(pnlAmount) : null,
        p_pnl_percent: pnl,
        p_rr_achieved: rrAchieved ? Number(rrAchieved) : null,
        p_result_notes: notes || null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trade", tradeId, "result"] });
      qc.invalidateQueries({ queryKey: ["trade", tradeId] });
      qc.invalidateQueries({ queryKey: ["investor"] });
      qc.invalidateQueries({ queryKey: ["admin"] });
      toast.success("Result saved and MetaFund allocation posted");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Trade result</CardTitle></CardHeader>
      <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <Label>Outcome</Label>
          <Select value={outcome} onValueChange={(v) => setOutcome(v as Outcome)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {["WIN", "LOSS", "BREAKEVEN", "CANCELLED"].map((o) => (
                <SelectItem key={o} value={o}>{o}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Closing price</Label>
          <Input type="number" step="any" value={closingPrice} onChange={(e) => setClosingPrice(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>P&L amount</Label>
          <Input type="number" step="any" value={pnlAmount} onChange={(e) => setPnlAmount(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>P&L %</Label>
          <Input type="number" step="any" value={pnlPercent} onChange={(e) => setPnlPercent(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>R achieved</Label>
          <Input type="number" step="any" value={rrAchieved} onChange={(e) => setRrAchieved(e.target.value)} />
        </div>
        <div className="col-span-full space-y-1">
          <Label>Notes</Label>
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div className="col-span-full flex justify-end">
          <Button size="sm" disabled={save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? "Saving…" : "Save result"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
