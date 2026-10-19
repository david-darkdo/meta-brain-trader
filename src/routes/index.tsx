import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MetaBrainLogo } from "@/components/metabrain-logo";
import { ArrowRight, ShieldCheck, TrendingUp, Wallet } from "lucide-react";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({ meta: [
    { title: "MetaBrain — Disciplined Trading & Investment" },
    { name: "description", content: "Explore MetaBrain's trading approach, investor accounts and proprietary funding participation." },
  ]}),
  component: PublicHome,
});

function PublicHome() {
  const authQ = useQuery({
    queryKey: ["public_home_auth"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      return !!data.user;
    },
    staleTime: 30_000,
  });
  const signedIn = authQ.data === true;
  const catalogueQ = useQuery({
    queryKey: ["public-proframe-catalogue"],
    queryFn: async () => {
      const { data: products, error } = await supabase.from("proframe_products")
        .select("id,name,summary,current_version_id").eq("status", "ACTIVE").order("display_order");
      if (error) throw error;
      const ids = (products ?? []).map((p: any) => p.current_version_id).filter(Boolean);
      if (!ids.length) return [];
      const { data: versions, error: versionError } = await supabase.from("proframe_product_versions")
        .select("id,price,compare_at_price,currency,provider_account_size,default_risk_pct,payout_target_pct,provider_name")
        .in("id", ids).eq("is_published", true);
      if (versionError) throw versionError;
      const byId = new Map((versions ?? []).map((v: any) => [v.id, v]));
      return (products ?? []).map((p: any) => ({ ...p, version: byId.get(p.current_version_id) })).filter((p: any) => p.version);
    },
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
        <MetaBrainLogo size="md" showText />
        <Link to={signedIn ? "/metafund" : "/auth"} className="rounded-full border border-amber-500/40 px-5 py-2.5 text-sm font-semibold text-amber-300 hover:bg-amber-500/10">
          {signedIn ? "Open My Account" : "Sign In"}
        </Link>
      </header>
      <main className="mx-auto max-w-6xl px-5 pb-20 pt-10 sm:px-8 sm:pt-20">
        <section className="relative overflow-hidden rounded-3xl border border-amber-500/20 bg-gradient-to-br from-amber-500/10 via-card to-background p-7 sm:p-14">
          <div className="max-w-3xl space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold tracking-wide text-amber-300">
              <ShieldCheck className="h-4 w-4" /> DISCIPLINE · RISK CONTROL · TRANSPARENCY
            </div>
            <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-6xl">
              A more disciplined approach to <span className="text-amber-400">trading participation.</span>
            </h1>
            <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
              Discover how MetaBrain approaches market analysis, manages trading risk and gives investors visibility into their participation.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link to={signedIn ? "/metafund" : "/auth"} className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-5 py-3 font-semibold text-black hover:bg-amber-300">
                {signedIn ? "Go to MetaFund" : "Get Started"} <ArrowRight className="h-4 w-4" />
              </Link>
              <a href="#approach" className="rounded-xl border border-border px-5 py-3 font-semibold hover:bg-card">How it works</a>
            </div>
          </div>
        </section>
        <section id="approach" className="grid gap-4 py-12 sm:grid-cols-3">
          {[
            { icon: TrendingUp, title: "Structured trading", text: "Trading decisions follow a defined analysis and execution process." },
            { icon: ShieldCheck, title: "Risk-aware participation", text: "Risk settings and account rules guide how each participation is managed." },
            { icon: Wallet, title: "Investor visibility", text: "Manage your Main Account and review your participation through MetaFund." },
          ].map((item) => <article key={item.title} className="rounded-2xl border border-border bg-card/60 p-6">
            <item.icon className="mb-4 h-6 w-6 text-amber-400" />
            <h2 className="mb-2 text-lg font-semibold">{item.title}</h2>
            <p className="text-sm leading-6 text-muted-foreground">{item.text}</p>
          </article>)}
        </section>
        <section className="pb-12">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-400">Instant Funding</p><h2 className="mt-1 text-2xl font-bold">Explore Proframe bundles</h2><p className="mt-1 text-sm text-muted-foreground">Published participation options and their current terms.</p></div>
          </div>
          {catalogueQ.isLoading ? <p className="text-sm text-muted-foreground">Loading available bundles…</p> : (catalogueQ.data?.length ?? 0) === 0 ? <div className="rounded-2xl border border-border bg-card/50 p-5 text-sm text-muted-foreground">Proframe bundles will appear here when they are officially published.</div> : <div className="grid gap-4 sm:grid-cols-2">{catalogueQ.data?.map((p: any) => <article key={p.id} className="rounded-2xl border border-amber-500/20 bg-card/60 p-5"><div className="flex items-start justify-between gap-3"><h3 className="font-semibold">{p.name}</h3><span className="rounded-full bg-amber-500/10 px-2 py-1 text-[10px] font-semibold text-amber-300">INSTANT FUNDING</span></div><p className="mt-2 min-h-10 text-sm text-muted-foreground">{p.summary}</p><div className="mt-4 flex flex-wrap items-end gap-x-3 gap-y-1"><div><p className="text-xs text-muted-foreground">Funding account size</p><p className="text-3xl font-extrabold tracking-tight text-amber-300">USD {Number(p.version.provider_account_size).toLocaleString()}</p></div><div className="pb-1"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Activation fee</p><p className="text-base font-semibold">{p.version.currency} {Number(p.version.price).toLocaleString()}</p>{p.version.compare_at_price && Number(p.version.compare_at_price)>Number(p.version.price) ? <p className="text-xs text-muted-foreground line-through">{p.version.currency} {Number(p.version.compare_at_price).toLocaleString()}</p> : null}</div></div><div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground"><span>Account size<br/><b className="text-foreground">USD {Number(p.version.provider_account_size).toLocaleString()}</b></span><span>Per-trade risk<br/><b className="text-foreground">{p.version.default_risk_pct}%</b></span><span>Max payout target<br/><b className="text-foreground">{p.version.payout_target_pct}% eligibility threshold</b></span><span>Provider<br/><b className="text-foreground">{p.version.provider_name}</b></span></div><a href={signedIn ? `/metafund?purchase=${encodeURIComponent(p.id)}` : `/auth?redirect=${encodeURIComponent(`/metafund?purchase=${p.id}`)}`} className="mt-5 inline-flex w-full justify-center rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-bold text-black">{signedIn ? "Continue to checkout" : "Sign in to purchase"}</a></article>)}</div>}
          <p className="mt-3 text-xs text-muted-foreground">Activation prices are participation fees, not investor-owned trading capital. Targets are eligibility conditions, not guaranteed returns or payouts. Provider terms and trading risk apply.</p>
        </section>
        <footer className="border-t border-border pt-6 text-xs leading-5 text-muted-foreground">
          Trading involves risk. Account rules, eligibility and outcomes vary. No profit or payout is guaranteed.
        </footer>
      </main>
    </div>
  );
}
