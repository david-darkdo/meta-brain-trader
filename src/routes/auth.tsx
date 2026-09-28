import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MetaBrainLogo } from "@/components/metabrain-logo";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

const searchSchema = z.object({
  mode: z.enum(["signin", "signup", "forgot"]).optional(),
  redirect: z.string().optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [{ title: "Sign in — MetaBrain Trader" }],
  }),
  component: AuthPage,
});

function AuthPage() {
  const search = useSearch({ from: "/auth" });
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">(search.mode ?? "signin");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: search.redirect ?? "/validator" });
    }).catch(() => null);
  }, [navigate, search.redirect]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data: authData, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: fullName || undefined },
          },
        });
        if (error) throw error;

        // Upsert in public.users if user exists
        if (authData.user) {
          try {
            await supabase.from("users").upsert({
              user_id: authData.user.id,
              email: authData.user.email || email,
              subscription_tier: "FREE",
            }, { onConflict: "user_id" });
          } catch (uErr) {
            console.warn("User upsert notice:", uErr);
          }
        }

        toast.success("Account created successfully. Welcome to MetaBrain!");
        navigate({ to: "/validator" });
      } else if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: search.redirect ?? "/validator" });
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success("Password reset email sent.");
        setMode("signin");
      }
    } catch (err: any) {
      console.error("Auth error:", err);
      let msg = err?.message || err?.error_description || (typeof err === "string" ? err : String(err));
      if (msg.includes("Failed to fetch") || msg.includes("fetch failed") || msg.includes("NetworkError")) {
        msg = "Unable to connect to database. Please check your network connection or try again.";
      }
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8 selection:bg-amber-500/20">
      <div className="w-full max-w-sm space-y-6">
        {/* BRAND HEADER */}
        <div className="flex flex-col items-center text-center space-y-2">
          <MetaBrainLogo size="lg" />
          <h1 className="text-2xl font-bold tracking-tight text-foreground font-sans">
            MetaBrain <span className="text-amber-400">Trader</span>
          </h1>
          <p className="text-xs text-muted-foreground tracking-wide">
            Trade Smarter. Build Wealth. Together.
          </p>
        </div>

        {/* AUTH CARD */}
        <div className="rounded-2xl border border-border/80 bg-card/90 p-6 sm:p-7 shadow-2xl backdrop-blur-md">
          {/* TAB TOGGLE: SIGN IN / CREATE ACCOUNT */}
          {mode !== "forgot" ? (
            <div className="grid grid-cols-2 gap-2 border-b border-border/70 pb-3 mb-5">
              <button
                type="button"
                onClick={() => setMode("signin")}
                className={`pb-2 text-sm font-semibold transition-all relative ${
                  mode === "signin"
                    ? "text-amber-400"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Sign In
                {mode === "signin" && (
                  <span className="absolute bottom-0 inset-x-2 h-0.5 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-600 rounded-full shadow-[0_0_8px_rgba(245,158,11,0.6)]" />
                )}
              </button>

              <button
                type="button"
                onClick={() => setMode("signup")}
                className={`pb-2 text-sm font-semibold transition-all relative ${
                  mode === "signup"
                    ? "text-amber-400"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Create Account
                {mode === "signup" && (
                  <span className="absolute bottom-0 inset-x-2 h-0.5 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-600 rounded-full shadow-[0_0_8px_rgba(245,158,11,0.6)]" />
                )}
              </button>
            </div>
          ) : (
            <div className="mb-5 pb-3 border-b border-border/70 text-center">
              <h2 className="text-base font-semibold text-foreground">Reset Password</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Enter your email to receive a recovery link</p>
            </div>
          )}

          {/* FORM */}
          <form onSubmit={onSubmit} className="space-y-4">
            {mode === "signup" && (
              <div className="space-y-1.5">
                <Label htmlFor="fullName" className="text-xs text-muted-foreground">Full Name</Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="John Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="bg-secondary/50 border-border focus-visible:ring-amber-400 text-sm h-10"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs text-muted-foreground">Email address</Label>
              <Input
                id="email"
                type="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                className="bg-secondary/50 border-border focus-visible:ring-amber-400 text-sm h-10"
              />
            </div>

            {mode !== "forgot" && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-xs text-muted-foreground">Password</Label>
                  {mode === "signin" && (
                    <button
                      type="button"
                      onClick={() => setMode("forgot")}
                      className="text-xs text-muted-foreground hover:text-amber-400 transition-colors"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={6}
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete={mode === "signup" ? "new-password" : "current-password"}
                    className="bg-secondary/50 border-border focus-visible:ring-amber-400 text-sm h-10 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}

            {/* PRIMARY BUTTON */}
            <Button
              type="submit"
              className="w-full h-10 gold-gradient-btn mt-2"
              disabled={busy}
            >
              {busy
                ? "Processing…"
                : mode === "signup"
                  ? "Create Account"
                  : mode === "forgot"
                    ? "Send Reset Link"
                    : "Sign In"}
            </Button>
          </form>

          {/* OAUTH DIVIDER */}
          {mode !== "forgot" && (
            <>
              <div className="my-5 flex items-center gap-3">
                <div className="h-px flex-1 bg-border/60" />
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground">or continue with</span>
                <div className="h-px flex-1 bg-border/60" />
              </div>

              {/* GOOGLE SIGN IN */}
              <Button
                type="button"
                variant="outline"
                className="w-full h-10 border-border/80 bg-secondary/40 hover:bg-secondary text-sm font-medium gap-2"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const result = await lovable.auth.signInWithOAuth("google", {
                      redirect_uri: window.location.origin,
                    });
                    if (result.error) throw result.error;
                    if (result.redirected) return;
                    navigate({ to: search.redirect ?? "/validator" });
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Google sign-in failed");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="#EA4335"
                    d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1-3.31 0-6-2.74-6-6.1s2.69-6.1 6-6.1c1.88 0 3.14.8 3.86 1.49l2.63-2.53C16.83 3.42 14.66 2.5 12 2.5 6.98 2.5 2.9 6.58 2.9 11.6s4.08 9.1 9.1 9.1c5.25 0 8.73-3.69 8.73-8.89 0-.6-.07-1.06-.15-1.51H12z"
                  />
                </svg>
                {mode === "signup" ? "Sign up with Google" : "Sign in with Google"}
              </Button>
            </>
          )}

          {mode === "forgot" && (
            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => setMode("signin")}
                className="text-xs text-muted-foreground hover:text-amber-400"
              >
                Back to Sign In
              </button>
            </div>
          )}
        </div>

        {/* FOOTER NOTICE */}
        <p className="text-center text-[11px] text-muted-foreground leading-relaxed">
          By signing in, you agree to our{" "}
          <span className="text-foreground underline underline-offset-2">Terms of Service</span> and{" "}
          <span className="text-foreground underline underline-offset-2">Privacy Policy</span>.
        </p>
      </div>
    </div>
  );
}
