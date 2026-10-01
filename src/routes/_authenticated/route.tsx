import { createFileRoute, Outlet, redirect, Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BOARD_PLATFORMS, getActivePlatform } from "@/lib/board-navigation";
import { MetaBrainLogo } from "@/components/metabrain-logo";
import { Bell } from "lucide-react";

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

  // Fetch current user details for header avatar
  const userQ = useQuery({
    queryKey: ["auth_user_header"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      const email = data.user?.email || "";
      const initials = email
        ? email.substring(0, 2).toUpperCase()
        : "MB";
      return { email, initials };
    },
    staleTime: 1000 * 60 * 5,
  });

  const initials = userQ.data?.initials || "MB";

  return (
    <div className="min-h-screen min-w-0 max-w-full overflow-x-hidden bg-background text-foreground flex flex-col selection:bg-amber-500/20">
      {/* 1. GLOBAL BOARD HEADER */}
      <header className="sticky top-0 z-30 border-b border-border/80 bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-2.5 sm:px-6">
          {/* BRAND LOGO */}
          <Link
            to="/validator"
            className="flex items-center gap-2 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-md"
          >
            <MetaBrainLogo size="sm" showText={true} />
          </Link>

          {/* HEADER RIGHT ACTIONS */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              aria-label="Notifications"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-border/60 bg-secondary/40 text-muted-foreground hover:text-foreground hover:border-amber-500/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <Bell className="h-4 w-4" />
            </button>

            <Link
              to="/profile"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-amber-500/40 bg-secondary font-mono text-xs font-semibold text-amber-400 hover:border-amber-400 hover:bg-secondary/80 transition-colors shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {initials}
            </Link>
          </div>
        </div>
      </header>

      {/* 2. ACTIVE PLATFORM CONTENT SURFACE */}
      <main className="flex-1 min-w-0 w-full max-w-full mx-auto px-3 py-5 sm:max-w-4xl sm:px-6 sm:py-7 pb-24 sm:pb-24 overflow-x-hidden">
        <Outlet />
      </main>

      {/* 3. PERSISTENT GLOBAL BOARD BOTTOM NAVIGATION */}
      <nav
        aria-label="MetaBrain Board Global Navigation"
        className="fixed bottom-0 inset-x-0 z-40 border-t border-border/80 bg-background/95 backdrop-blur-xl shadow-[0_-4px_25px_rgba(0,0,0,0.4)]"
      >
        <div className="mx-auto flex w-full max-w-4xl items-center justify-around px-1.5 py-1.5 sm:px-2 sm:py-2">
          {BOARD_PLATFORMS.map((platform) => {
            const isActive = platform.id === activePlatformId;
            const Icon = platform.icon;

            return (
              <Link
                key={platform.id}
                to={platform.to}
                aria-current={isActive ? "page" : undefined}
                className={`group relative flex flex-1 flex-col items-center justify-center py-1 px-1 rounded-xl transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  isActive
                    ? "text-amber-400 font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {/* ACTIVE TOP INDICATOR ACCENT */}
                {isActive && (
                  <div className="absolute top-0 inset-x-4 h-0.5 rounded-full bg-gradient-to-r from-amber-500 via-amber-400 to-amber-600 -mt-1.5 shadow-[0_0_8px_rgba(245,158,11,0.6)]" />
                )}

                {/* PLATFORM ICON */}
                <div className="relative flex items-center justify-center mt-0.5">
                  <Icon
                    className={`h-5 w-5 transition-transform duration-200 ${
                      isActive ? "scale-105 text-amber-400" : "group-hover:scale-105 text-muted-foreground"
                    }`}
                  />
                </div>

                {/* PLATFORM LABEL */}
                <span
                  className={`mt-1 text-[10px] sm:text-[11px] tracking-tight whitespace-nowrap transition-colors ${
                    isActive ? "text-amber-400 font-semibold" : "text-muted-foreground"
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
