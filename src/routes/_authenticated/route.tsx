import { createFileRoute, Outlet, redirect, Link, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { BOARD_PLATFORMS, getActivePlatform } from "@/lib/board-navigation";
import { Layers } from "lucide-react";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data?.user) {
        throw redirect({ to: "/auth", search: { redirect: location.pathname } });
      }
      return { user: data.user };
    } catch (err: any) {
      if (err?.to || err?.isRedirect) throw err;
      console.warn("Auth beforeLoad error, redirecting to /auth:", err);
      throw redirect({ to: "/auth", search: { redirect: location.pathname } });
    }
  },
  component: MetaBrainBoardShell,
});

function MetaBrainBoardShell() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const activePlatformId = getActivePlatform(pathname);
  const currentPlatform = BOARD_PLATFORMS.find((p) => p.id === activePlatformId) ?? BOARD_PLATFORMS[0];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col selection:bg-primary/20">
      {/* 1. GLOBAL BOARD HEADER */}
      <header className="sticky top-0 z-30 border-b border-border/80 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          {/* BRAND LOGO */}
          <Link
            to="/validator"
            className="flex items-center gap-2.5 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-md px-1"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold shadow-sm shadow-primary/25 transition-transform group-hover:scale-105">
              <Layers className="h-4 w-4" />
            </div>
            <div className="flex flex-col">
              <span className="text-base font-bold tracking-tight leading-tight">MetaBrain</span>
              <span className="text-[10px] font-mono tracking-widest uppercase text-muted-foreground leading-none">
                Board Shell
              </span>
            </div>
          </Link>

          {/* ACTIVE PLATFORM PILL INDICATOR */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-full border border-border/80 bg-secondary/60 px-3 py-1 text-xs font-medium backdrop-blur-sm shadow-xs">
              <currentPlatform.icon className="h-3.5 w-3.5 text-primary" />
              <span className="text-foreground">{currentPlatform.label}</span>
            </div>
          </div>
        </div>
      </header>

      {/* 2. ACTIVE PLATFORM SURFACE CONTENT */}
      <main className="flex-1 mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8 pb-28 sm:pb-28">
        <Outlet />
      </main>

      {/* 3. PERSISTENT GLOBAL BOARD BOTTOM NAVIGATION */}
      <nav
        aria-label="MetaBrain Board Global Navigation"
        className="fixed bottom-0 inset-x-0 z-40 border-t border-border/80 bg-background/95 backdrop-blur-lg supports-[backdrop-filter]:bg-background/80 shadow-[0_-4px_20px_rgba(0,0,0,0.25)]"
      >
        <div className="mx-auto flex max-w-xl items-center justify-around px-2 py-1.5 sm:py-2">
          {BOARD_PLATFORMS.map((platform) => {
            const isActive = platform.id === activePlatformId;
            const Icon = platform.icon;

            return (
              <Link
                key={platform.id}
                to={platform.to}
                aria-current={isActive ? "page" : undefined}
                className={`group relative flex flex-1 flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  isActive
                    ? "text-primary font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                }`}
              >
                {/* ACTIVE BACKGROUND PILL */}
                {isActive && (
                  <div className="absolute inset-1 rounded-lg bg-primary/10 -z-10 animate-in fade-in zoom-in-95 duration-150" />
                )}

                {/* PLATFORM ICON WITH ACTIVE ACCENT */}
                <div className="relative flex items-center justify-center">
                  <Icon
                    className={`h-5 w-5 transition-transform duration-200 ${
                      isActive ? "scale-110 text-primary" : "group-hover:scale-105"
                    }`}
                  />
                  {isActive && (
                    <span className="absolute -top-1 -right-1 flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary" />
                    </span>
                  )}
                </div>

                {/* PLATFORM LABEL */}
                <span
                  className={`mt-1 text-[11px] sm:text-xs tracking-tight transition-colors ${
                    isActive ? "text-foreground font-semibold" : "text-muted-foreground"
                  }`}
                >
                  {platform.shortLabel}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
