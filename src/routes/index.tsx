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
        <footer className="border-t border-border pt-6 text-xs leading-5 text-muted-foreground">
          Trading involves risk. Account rules, eligibility and outcomes vary. No profit or payout is guaranteed.
        </footer>
      </main>
    </div>
  );
}
