import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user) throw redirect({ to: "/dashboard" });
  },
  head: () => ({
    meta: [
      { title: "MetaBrain Trader — Trade journal for serious traders" },
      { name: "description", content: "Plan trades, capture screenshots, and journal every decision in one focused workspace." },
      { property: "og:title", content: "MetaBrain Trader" },
      { property: "og:description", content: "Plan, journal, and review every trade." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-md bg-primary" />
            <span className="font-semibold tracking-tight">MetaBrain Trader</span>
          </div>
          <nav className="flex items-center gap-3">
            <Link to="/auth" className="text-sm text-muted-foreground hover:text-foreground">Sign in</Link>
            <Link to="/auth" className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90">
              Get started
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-24 text-center">
        <p className="text-sm font-medium uppercase tracking-widest text-primary">Foundation release</p>
        <h1 className="mt-4 text-5xl font-bold tracking-tight sm:text-6xl">
          Your trading edge,<br />
          <span className="text-primary">structured.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
          Log every setup, attach your charts, and review your decisions with discipline.
          MetaBrain Trader is the journal built for traders who treat this like a craft.
        </p>
        <div className="mt-10 flex justify-center gap-3">
          <Link to="/auth" className="rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90">
            Create your account
          </Link>
          <Link to="/auth" className="rounded-md border border-border px-5 py-2.5 text-sm font-semibold hover:bg-secondary">
            Sign in
          </Link>
        </div>
      </main>
    </div>
  );
}
