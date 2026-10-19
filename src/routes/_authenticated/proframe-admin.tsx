import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Package, Server, RefreshCw } from "lucide-react";

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
  const [product, setProduct] = useState({ name: "", slug: "", summary: "", provider: "", price: "", currency: "USD", size: "100000", maxDd: "10", dailyDd: "5", risk: "0.5", target: "3", split: "70", terms: "" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editVersion, setEditVersion] = useState<any>(null);
  const [provider, setProvider] = useState({ provider_name: "", account_reference: "", account_size: "100000", currency: "USD", procurement_cost: "0", procurement_currency: "USD", status: "AVAILABLE", operator_mt_reference: "", notes: "" });

  const productsQ = useQuery({
    queryKey: ["proframe-admin-products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("proframe_products").select("*, proframe_product_versions(*)").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const providersQ = useQuery({
    queryKey: ["proframe-admin-providers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("proframe_provider_accounts").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const createProduct = useMutation({
    mutationFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const { data: p, error: pe } = await supabase.from("proframe_products").insert({
        name: product.name.trim(), slug: product.slug.trim().toLowerCase(), summary: product.summary.trim(),
        status: "DRAFT", created_by: auth.user?.id,
      }).select("id").single();
      if (pe) throw pe;
      const { data: v, error: ve } = await supabase.from("proframe_product_versions").insert({
        product_id: p.id, version_number: 1, price: Number(product.price), currency: product.currency,
        provider_name: product.provider.trim(), account_type: "INSTANT_FUNDING",
        provider_account_size: Number(product.size), max_drawdown_pct: Number(product.maxDd),
        daily_drawdown_pct: Number(product.dailyDd), default_risk_pct: Number(product.risk),
        payout_target_pct: Number(product.target), profit_split_investor_pct: Number(product.split),
        terms_text: product.terms.trim(), created_by: auth.user?.id,
      }).select("id").single();
      if (ve) throw ve;
      const { error: ue } = await supabase.from("proframe_products").update({ current_version_id: v.id }).eq("id", p.id);
      if (ue) throw ue;
    },
    onSuccess: () => { toast.success("Proframe draft created"); setProduct({ name: "", slug: "", summary: "", provider: "", price: "", currency: "USD", size: "100000", maxDd: "10", dailyDd: "5", risk: "0.5", target: "3", split: "70", terms: "" }); qc.invalidateQueries({ queryKey: ["proframe-admin-products"] }); },
    onError: (e: any) => toast.error(e.message || "Could not create Proframe"),
  });

  const beginEdit = (p: any) => {
    const v = (p.proframe_product_versions ?? []).find((x: any) => x.id === p.current_version_id);
    if (!v) { toast.error("Current bundle version was not found."); return; }
    setEditingId(p.id);
    setEditVersion({ name: p.name, slug: p.slug, summary: p.summary ?? "", provider: v.provider_name,
      price: String(v.price), currency: v.currency, size: String(v.provider_account_size),
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
      product_id: editingId, version_number: nextVersion, price: Number(editVersion.price),
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

  const saveProvider = useMutation({
    mutationFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase.from("proframe_provider_accounts").insert({ ...provider,
        account_size: Number(provider.account_size), procurement_cost: Number(provider.procurement_cost), created_by: auth.user?.id });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Provider account recorded"); setProvider({ provider_name: "", account_reference: "", account_size: "100000", currency: "USD", procurement_cost: "0", procurement_currency: "USD", status: "AVAILABLE", operator_mt_reference: "", notes: "" }); qc.invalidateQueries({ queryKey: ["proframe-admin-providers"] }); },
    onError: (e: any) => toast.error(e.message || "Could not save provider account"),
  });

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
  const accounts = providersQ.data ?? [];

  return <div className="space-y-6">
    <div className="flex items-start justify-between gap-3">
      <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-400">CEO Command Center</p><h1 className="mt-1 text-2xl font-bold">Proframe Operations</h1><p className="mt-1 text-sm text-muted-foreground">Manage public bundles and operator-owned Instant Funding accounts.</p></div>
      <button onClick={() => { qc.invalidateQueries({ queryKey: ["proframe-admin-products"] }); qc.invalidateQueries({ queryKey: ["proframe-admin-providers"] }); }} className="rounded-lg border border-border p-2" aria-label="Refresh"><RefreshCw className="h-4 w-4"/></button>
    </div>

    <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="mb-4 flex items-center gap-2"><Plus className="h-5 w-5 text-amber-400"/><h2 className="font-semibold">Create Proframe bundle</h2></div>
      <form className="grid gap-3 sm:grid-cols-2" onSubmit={e => { e.preventDefault(); createProduct.mutate(); }}>
        <div><label className={label}>Bundle name</label><input className={field} required value={product.name} onChange={e=>setProduct({...product,name:e.target.value})} placeholder="Proframe 100K"/></div>
        <div><label className={label}>Unique URL slug</label><input className={field} required value={product.slug} onChange={e=>setProduct({...product,slug:e.target.value})} placeholder="proframe-100k"/></div>
        <div><label className={label}>Short description</label><input className={field} value={product.summary} onChange={e=>setProduct({...product,summary:e.target.value})} placeholder="Instant Funding participation"/></div>
        <div><label className={label}>Funding provider</label><input className={field} required value={product.provider} onChange={e=>setProduct({...product,provider:e.target.value})} placeholder="Provider name"/></div>
        <div><label className={label}>Activation price</label><input className={field} type="number" min="0.01" step="0.01" required value={product.price} onChange={e=>setProduct({...product,price:e.target.value})}/></div>
        <div><label className={label}>Currency</label><select className={field} value={product.currency} onChange={e=>setProduct({...product,currency:e.target.value})}><option>USD</option><option>NGN</option><option>EUR</option><option>GBP</option></select></div>
        <div><label className={label}>Provider account size</label><input className={field} type="number" min="1" value={product.size} onChange={e=>setProduct({...product,size:e.target.value})}/></div>
        <div><label className={label}>Maximum drawdown %</label><input className={field} type="number" min="0.01" max="100" step="0.01" value={product.maxDd} onChange={e=>setProduct({...product,maxDd:e.target.value})}/></div>
        <div><label className={label}>Daily drawdown %</label><input className={field} type="number" min="0.01" max="100" step="0.01" value={product.dailyDd} onChange={e=>setProduct({...product,dailyDd:e.target.value})}/></div>
        <div><label className={label}>Per-trade risk %</label><input className={field} type="number" min="0.01" max="100" step="0.01" value={product.risk} onChange={e=>setProduct({...product,risk:e.target.value})}/></div>
        <div><label className={label}>Payout eligibility target %</label><input className={field} type="number" min="0.01" max="100" step="0.01" value={product.target} onChange={e=>setProduct({...product,target:e.target.value})}/></div>
        <div><label className={label}>Investor profit share %</label><input className={field} type="number" min="0" max="100" step="0.01" value={product.split} onChange={e=>setProduct({...product,split:e.target.value})}/></div>
        <div className="sm:col-span-2"><label className={label}>Provider rules and participation terms</label><textarea className={field} rows={3} value={product.terms} onChange={e=>setProduct({...product,terms:e.target.value})} placeholder="Document provider-specific payout conditions, restrictions and fees."/></div>
        <div className="sm:col-span-2 flex justify-end"><button disabled={createProduct.isPending} className="rounded-xl bg-amber-400 px-5 py-2.5 text-sm font-bold text-black disabled:opacity-50">{createProduct.isPending ? "Saving…" : "Save draft bundle"}</button></div>
      </form>
      <p className="mt-3 text-xs text-muted-foreground">New bundles are drafts and are not visible to investors until you publish them. Each saved bundle starts with immutable version 1 terms.</p>
    </section>

    <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="mb-4 flex items-center gap-2"><Package className="h-5 w-5 text-amber-400"/><h2 className="font-semibold">Catalogue management</h2></div>
      {productsQ.isLoading ? <p className="text-sm text-muted-foreground">Loading bundles…</p> : products.length===0 ? <p className="text-sm text-muted-foreground">No Proframe bundles created yet.</p> : <div className="space-y-3">{products.map((p:any)=><div key={p.id} className="rounded-xl border border-border p-3"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-semibold">{p.name}</p><p className="text-xs text-muted-foreground">{p.slug} · {p.proframe_product_versions?.length ?? 0} version(s) · {p.status}</p></div><div className="flex gap-2"><button onClick={()=>beginEdit(p)} className="rounded-lg border border-border px-3 py-2 text-xs">Edit</button>{p.status!=="ACTIVE" ? <button onClick={()=>setProductStatus(p.id,"ACTIVE")} className="rounded-lg bg-amber-400 px-3 py-2 text-xs font-bold text-black">Publish</button> : <button onClick={()=>setProductStatus(p.id,"PAUSED")} className="rounded-lg border border-border px-3 py-2 text-xs">Pause</button>}</div></div>{editingId===p.id && editVersion && <div className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-2">{[["name","Bundle name"],["slug","URL slug"],["summary","Description"],["provider","Provider"],["price","Activation fee"],["currency","Currency"],["size","Provider account size"],["maxDd","Maximum drawdown %"],["dailyDd","Daily drawdown %"],["risk","Per-trade risk %"],["target","Payout eligibility target %"],["split","Investor profit share %"]].map(([key,title])=><label key={key} className="text-xs text-muted-foreground">{title}<input className={field+" mt-1"} value={editVersion[key]} onChange={e=>setEditVersion({...editVersion,[key]:e.target.value})}/></label>)}<label className="sm:col-span-2 text-xs text-muted-foreground">Terms and provider rules<textarea className={field+" mt-1"} rows={3} value={editVersion.terms} onChange={e=>setEditVersion({...editVersion,terms:e.target.value})}/></label><div className="sm:col-span-2 flex justify-end gap-2"><button onClick={()=>{setEditingId(null);setEditVersion(null)}} className="rounded-lg border border-border px-3 py-2 text-xs">Cancel</button><button onClick={saveEditedVersion} className="rounded-lg bg-amber-400 px-3 py-2 text-xs font-bold text-black">Save new version</button></div><p className="sm:col-span-2 text-xs text-muted-foreground">Edits create a new version; previous pricing and rules are preserved for audit.</p></div>}</div>)}</div>}
    </section>

    <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="mb-4 flex items-center gap-2"><Server className="h-5 w-5 text-amber-400"/><h2 className="font-semibold">Operator provider accounts</h2></div>
      <form className="grid gap-3 sm:grid-cols-2" onSubmit={e=>{e.preventDefault();saveProvider.mutate();}}>
        <div><label className={label}>Provider</label><input className={field} required value={provider.provider_name} onChange={e=>setProvider({...provider,provider_name:e.target.value})}/></div>
        <div><label className={label}>Provider account reference (no password)</label><input className={field} required value={provider.account_reference} onChange={e=>setProvider({...provider,account_reference:e.target.value})}/></div>
        <div><label className={label}>Account size</label><input className={field} type="number" min="1" value={provider.account_size} onChange={e=>setProvider({...provider,account_size:e.target.value})}/></div>
        <div><label className={label}>Currency</label><select className={field} value={provider.currency} onChange={e=>setProvider({...provider,currency:e.target.value})}><option>USD</option><option>NGN</option><option>EUR</option><option>GBP</option></select></div>
        <div><label className={label}>Operator procurement cost</label><input className={field} type="number" min="0" step="0.01" value={provider.procurement_cost} onChange={e=>setProvider({...provider,procurement_cost:e.target.value})}/></div>
        <div><label className={label}>Procurement currency</label><select className={field} value={provider.procurement_currency} onChange={e=>setProvider({...provider,procurement_currency:e.target.value})}><option>USD</option><option>NGN</option><option>EUR</option><option>GBP</option></select></div>
        <div><label className={label}>MetaTrader operator reference</label><input className={field} value={provider.operator_mt_reference} onChange={e=>setProvider({...provider,operator_mt_reference:e.target.value})}/></div>
        <div><label className={label}>Status</label><select className={field} value={provider.status} onChange={e=>setProvider({...provider,status:e.target.value})}><option>AVAILABLE</option><option>ORDERED</option><option>ACTIVE</option></select></div>
        <div className="sm:col-span-2"><label className={label}>Notes</label><textarea className={field} rows={2} value={provider.notes} onChange={e=>setProvider({...provider,notes:e.target.value})}/></div>
        <div className="sm:col-span-2 flex justify-end"><button disabled={saveProvider.isPending} className="rounded-xl bg-amber-400 px-5 py-2.5 text-sm font-bold text-black disabled:opacity-50">{saveProvider.isPending ? "Saving…" : "Record provider account"}</button></div>
      </form>
      <div className="mt-5 space-y-2">{providersQ.isLoading ? <p className="text-sm text-muted-foreground">Loading provider accounts…</p> : accounts.length===0 ? <p className="text-sm text-muted-foreground">No provider accounts recorded.</p> : accounts.map((a:any)=><div key={a.id} className="flex flex-wrap justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm"><span>{a.provider_name} · {a.account_reference} · {Number(a.account_size).toLocaleString()} {a.currency}</span><span className="text-xs text-muted-foreground">{a.status} · procurement {Number(a.procurement_cost).toLocaleString()} {a.procurement_currency}</span></div>)}</div>
    </section>
    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs leading-5 text-muted-foreground">Safety boundary: activation fees are not investor trading capital. Provider accounts and procurement costs belong to the operator. Live purchase/debit is intentionally not enabled in this slice until it is wired atomically into the certified Main Account ledger.</div>
  </div>;
}
