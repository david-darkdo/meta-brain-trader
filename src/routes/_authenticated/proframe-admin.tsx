import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Package, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/_authenticated/proframe-admin")({
  ssr: false,
  beforeLoad: async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) throw redirect({ to: "/auth" });
    const { data: admin, error } = await supabase.rpc("is_admin", { p_user_id: auth.user.id });
    if (error || admin !== true) throw redirect({ to: "/metafund" });
  },
  component: ProframeAdmin,
});

function ProframeAdmin() {
  const qc = useQueryClient();
  const [product, setProduct] = useState({ name: "", slug: "", summary: "", provider: "", price: "", compareAtPrice: "", currency: "USD", size: "100000", maxDd: "10", dailyDd: "5", risk: "0.5", target: "3", split: "70", terms: "" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editVersion, setEditVersion] = useState<any>(null);

  const productsQ = useQuery({
    queryKey: ["proframe-admin-products"],
    queryFn: async () => {
      // Fetch catalogue rows and version rows separately so the seeded demo and
      // every newly-created bundle remain visible even if PostgREST embedding changes.
      const { data: products, error } = await supabase.from("proframe_products").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      const ids = (products ?? []).map((p: any) => p.id);
      if (!ids.length) return [];
      const { data: versions, error: versionError } = await supabase.from("proframe_product_versions").select("*").in("product_id", ids).order("version_number", { ascending: false });
      if (versionError) throw versionError;
      const grouped = new Map<string, any[]>();
      for (const version of versions ?? []) grouped.set(version.product_id, [...(grouped.get(version.product_id) ?? []), version]);
      return (products ?? []).map((p: any) => ({ ...p, proframe_product_versions: grouped.get(p.id) ?? [] }));
    },
  });
  const createProduct = useMutation({
    mutationFn: async () => {
      const { data, error } = await (supabase as any).rpc("create_proframe_bundle", {
        p_name: product.name.trim(), p_slug: product.slug.trim().toLowerCase(),
        p_summary: product.summary.trim(), p_provider_name: product.provider.trim(),
        p_price: Number(product.price), p_compare_at_price: product.compareAtPrice ? Number(product.compareAtPrice) : null,
        p_currency: product.currency, p_provider_account_size: Number(product.size),
        p_max_drawdown_pct: Number(product.maxDd), p_daily_drawdown_pct: Number(product.dailyDd),
        p_default_risk_pct: Number(product.risk), p_payout_target_pct: Number(product.target),
        p_investor_profit_split_pct: Number(product.split), p_terms_text: product.terms.trim(),
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Proframe created and saved. It now appears below the editor.");
      setProduct({ name: "", slug: "", summary: "", provider: "", price: "", compareAtPrice: "", currency: "USD", size: "100000", maxDd: "10", dailyDd: "5", risk: "0.5", target: "3", split: "70", terms: "" });
      qc.invalidateQueries({ queryKey: ["proframe-admin-products"] });
      qc.invalidateQueries({ queryKey: ["public-proframe-catalogue"] });
    },
    onError: (e: any) => toast.error(e.message || "Could not create Proframe"),
  });

  const beginEdit = (p: any) => {
    const v = (p.proframe_product_versions ?? []).find((x: any) => x.id === p.current_version_id);
    if (!v) { toast.error("Current bundle version was not found."); return; }
    setEditingId(p.id);
    setEditVersion({ name: p.name, slug: p.slug, summary: p.summary ?? "", provider: v.provider_name,
      price: String(v.price), compareAtPrice: v.compare_at_price == null ? "" : String(v.compare_at_price), currency: v.currency, size: String(v.provider_account_size),
      maxDd: String(v.max_drawdown_pct), dailyDd: String(v.daily_drawdown_pct),
      risk: String(v.default_risk_pct), target: String(v.payout_target_pct),
      split: String(v.profit_split_investor_pct), terms: v.terms_text ?? "" });
  };

  const saveEditedVersion = async () => {
    if (!editingId || !editVersion) return;
    const current = products.find((p: any) => p.id === editingId);
    if (!current) return;
    const versions = current.proframe_product_versions ?? [];
    const nextVersion = Math.max(0, ...versions.map((v: any) => Number(v.version_number))) + 1;
    const { data: v, error: ve } = await supabase.from("proframe_product_versions").insert({
      product_id: editingId, version_number: nextVersion, price: Number(editVersion.price), compare_at_price: editVersion.compareAtPrice ? Number(editVersion.compareAtPrice) : null,
      currency: editVersion.currency, provider_name: editVersion.provider.trim(),
      account_type: "INSTANT_FUNDING", provider_account_size: Number(editVersion.size),
      max_drawdown_pct: Number(editVersion.maxDd), daily_drawdown_pct: Number(editVersion.dailyDd),
      default_risk_pct: Number(editVersion.risk), payout_target_pct: Number(editVersion.target),
      profit_split_investor_pct: Number(editVersion.split), terms_text: editVersion.terms,
      is_published: current.status === "ACTIVE",
    }).select("id").single();
    if (ve) { toast.error(ve.message); return; }
    const { error: pe } = await supabase.from("proframe_products").update({
      name: editVersion.name.trim(), slug: editVersion.slug.trim().toLowerCase(),
      summary: editVersion.summary.trim(), current_version_id: v.id,
    }).eq("id", editingId);
    if (pe) { toast.error(pe.message); return; }
    toast.success("New version saved. Previous terms remain in history.");
    setEditingId(null); setEditVersion(null);
    qc.invalidateQueries({ queryKey: ["proframe-admin-products"] });
    qc.invalidateQueries({ queryKey: ["public-proframe-catalogue"] });
  };

  const setProductStatus = async (id: string, status: string) => {
    if (status === "ACTIVE") {
      const { data: row, error: readError } = await supabase.from("proframe_products").select("current_version_id").eq("id", id).single();
      if (readError) { toast.error(readError.message); return; }
      if (!row.current_version_id) { toast.error("This bundle has no current version."); return; }
      const { error: versionError } = await supabase.from("proframe_product_versions").update({ is_published: true }).eq("id", row.current_version_id);
      if (versionError) { toast.error(versionError.message); return; }
    }
    const { error } = await supabase.from("proframe_products").update({ status }).eq("id", id);
    if (error) toast.error(error.message); else { toast.success(status === "ACTIVE" ? "Bundle published to the public catalogue" : "Catalogue status updated"); qc.invalidateQueries({ queryKey: ["proframe-admin-products"] }); }
  };

  const field = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-amber-500";
  const label = "mb-1 block text-xs font-medium text-muted-foreground";
  const products = productsQ.data ?? [];

  return <div className="space-y-6">
    <div className="flex items-start justify-between gap-3">
      <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-400">CEO Command Center</p><h1 className="mt-1 text-2xl font-bold">Proframe Operations</h1><p className="mt-1 text-sm text-muted-foreground">Create and manage published Proframe bundles.</p></div>
      <button onClick={() => { qc.invalidateQueries({ queryKey: ["proframe-admin-products"] }); }} className="rounded-lg border border-border p-2" aria-label="Refresh"><RefreshCw className="h-4 w-4"/></button>
    </div>

    <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="mb-4 flex items-center gap-2"><Plus className="h-5 w-5 text-amber-400"/><h2 className="font-semibold">Create Proframe bundle</h2></div>
      <form className="grid gap-3 sm:grid-cols-2" onSubmit={e => { e.preventDefault(); createProduct.mutate(); }}>
        <div><label className={label}>Bundle name</label><input className={field} required value={product.name} onChange={e=>setProduct({...product,name:e.target.value})} placeholder="Proframe 100K"/></div>
        <div><label className={label}>Unique URL slug</label><input className={field} required value={product.slug} onChange={e=>setProduct({...product,slug:e.target.value})} placeholder="proframe-100k"/></div>
        <div><label className={label}>Short description</label><input className={field} value={product.summary} onChange={e=>setProduct({...product,summary:e.target.value})} placeholder="Instant Funding participation"/></div>
        <div><label className={label}>Funding provider</label><input className={field} required value={product.provider} onChange={e=>setProduct({...product,provider:e.target.value})} placeholder="Provider name"/></div>
        <div><label className={label}>Activation fee (charged to Main Account)</label><input className={field} type="number" min="0.01" step="0.01" required value={product.price} onChange={e=>setProduct({...product,price:e.target.value})}/></div><div><label className={label}>Was price / crossed-out price</label><input className={field} type="number" min="0" step="0.01" value={product.compareAtPrice} onChange={e=>setProduct({...product,compareAtPrice:e.target.value})} placeholder="45000"/></div>
        <div><label className={label}>Currency</label><select className={field} value={product.currency} onChange={e=>setProduct({...product,currency:e.target.value})}><option>USD</option><option>NGN</option><option>EUR</option><option>GBP</option></select></div>
        <div><label className={label}>Provider account size</label><input className={field} type="number" min="1" value={product.size} onChange={e=>setProduct({...product,size:e.target.value})}/></div>
        <div><label className={label}>Maximum drawdown %</label><input className={field} type="number" min="0.01" max="100" step="0.01" value={product.maxDd} onChange={e=>setProduct({...product,maxDd:e.target.value})}/></div>
        <div><label className={label}>Daily drawdown %</label><input className={field} type="number" min="0.01" max="100" step="0.01" value={product.dailyDd} onChange={e=>setProduct({...product,dailyDd:e.target.value})}/></div>
        <div><label className={label}>Per-trade risk %</label><input className={field} type="number" min="0.01" max="100" step="0.01" value={product.risk} onChange={e=>setProduct({...product,risk:e.target.value})}/></div>
        <div><label className={label}>Payout eligibility target %</label><input className={field} type="number" min="0.01" max="100" step="0.01" value={product.target} onChange={e=>setProduct({...product,target:e.target.value})}/></div>
        <div><label className={label}>Investor profit share %</label><input className={field} type="number" min="0" max="100" step="0.01" value={product.split} onChange={e=>setProduct({...product,split:e.target.value})}/></div>
        <div className="sm:col-span-2"><label className={label}>Provider rules and participation terms</label><textarea className={field} rows={3} value={product.terms} onChange={e=>setProduct({...product,terms:e.target.value})} placeholder="Document provider-specific payout conditions, restrictions and fees."/></div>
        <div className="sm:col-span-2 flex justify-end"><button disabled={createProduct.isPending} className="rounded-xl bg-amber-400 px-5 py-2.5 text-sm font-bold text-black disabled:opacity-50">{createProduct.isPending ? "Creating…" : "Create Proframe"}</button></div>
      </form>
      <p className="mt-3 text-xs text-muted-foreground">Provider is saved as part of the Proframe bundle. New bundles remain drafts until published.</p>
          <div className="mt-5 border-t border-border pt-5"><div className="mb-2 flex items-center gap-2"><Package className="h-5 w-5 text-amber-400"/><h3 className="font-semibold">Created Proframes</h3></div><p className="mb-4 text-xs text-muted-foreground">Every Proframe you create stays here. Open any card to edit its details and save a new version.</p></div>
      {productsQ.isLoading ? <p className="text-sm text-muted-foreground">Loading bundles…</p> : products.length===0 ? <p className="text-sm text-muted-foreground">No Proframe bundles created yet.</p> : <div className="space-y-3">{products.map((p:any)=><div key={p.id} className="rounded-xl border border-border p-3"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-semibold">{p.name}</p><p className="text-xs text-muted-foreground">Provider: {(p.proframe_product_versions ?? []).find((v:any)=>v.id===p.current_version_id)?.provider_name ?? "—"} · {p.slug} · {p.proframe_product_versions?.length ?? 0} version(s) · {p.status}</p></div><div className="flex gap-2"><button onClick={()=>beginEdit(p)} className="rounded-lg border border-border px-3 py-2 text-xs">Edit</button>{p.status!=="ACTIVE" ? <button onClick={()=>setProductStatus(p.id,"ACTIVE")} className="rounded-lg bg-amber-400 px-3 py-2 text-xs font-bold text-black">Publish</button> : <button onClick={()=>setProductStatus(p.id,"PAUSED")} className="rounded-lg border border-border px-3 py-2 text-xs">Pause</button>}</div></div>{editingId===p.id && editVersion && <div className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-2">{[["name","Bundle name"],["slug","URL slug"],["summary","Description"],["provider","Provider"],["price","Activation fee"],["compareAtPrice","Was price (crossed out)"],["currency","Currency"],["size","Provider account size"],["maxDd","Maximum drawdown %"],["dailyDd","Daily drawdown %"],["risk","Per-trade risk %"],["target","Payout eligibility target %"],["split","Investor profit share %"]].map(([key,title])=><label key={key} className="text-xs text-muted-foreground">{title}<input className={field+" mt-1"} value={editVersion[key]} onChange={e=>setEditVersion({...editVersion,[key]:e.target.value})}/></label>)}<label className="sm:col-span-2 text-xs text-muted-foreground">Terms and provider rules<textarea className={field+" mt-1"} rows={3} value={editVersion.terms} onChange={e=>setEditVersion({...editVersion,terms:e.target.value})}/></label><div className="sm:col-span-2 flex justify-end gap-2"><button onClick={()=>{setEditingId(null);setEditVersion(null)}} className="rounded-lg border border-border px-3 py-2 text-xs">Cancel</button><button onClick={saveEditedVersion} className="rounded-lg bg-amber-400 px-3 py-2 text-xs font-bold text-black">Save new version</button></div><p className="sm:col-span-2 text-xs text-muted-foreground">Edits create a new version; previous pricing and rules are preserved for audit.</p></div>}</div>)}</div>}
    </section>



    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs leading-5 text-muted-foreground">Safety boundary: the provider name belongs to this bundle. Activation fees are participation fees, not investor trading capital. Provider funding accounts are procured and assigned separately during fulfilment.</div>
  </div>;
}
