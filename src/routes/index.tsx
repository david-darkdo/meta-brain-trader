import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: async () => {
    try {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        throw redirect({ to: "/validator" });
      } else {
        throw redirect({ to: "/auth" });
      }
    } catch (e) {
      if ((e as any)?.to) throw e;
      throw redirect({ to: "/auth" });
    }
  },
  component: () => null,
});
