import { supabase } from "@/integrations/supabase/client";

/**
 * Permanently deletes a single trade by ID, including its storage screenshots
 * and all cascading database records (screenshots, ai_analyses, reflections, results, job_queue).
 */
export async function deleteSingleTrade(tradeId: string): Promise<void> {
  // 1. Fetch screenshot storage URLs for this trade to clean up storage
  const { data: screenshots } = await supabase
    .from("screenshots")
    .select("url")
    .eq("trade_id", tradeId);

  if (screenshots && screenshots.length > 0) {
    const paths = screenshots.map((s) => s.url).filter(Boolean);
    if (paths.length > 0) {
      const { error: storageErr } = await supabase.storage
        .from("trade-screenshots")
        .remove(paths);
      if (storageErr) {
        console.warn("Storage deletion warning:", storageErr.message);
      }
    }
  }

  // 2. Delete trade from database (triggers CASCADE on child tables)
  const { error } = await supabase
    .from("trades")
    .delete()
    .eq("trade_id", tradeId);

  if (error) {
    throw new Error(error.message || "Failed to delete trade");
  }
}

/**
 * Permanently deletes ALL trades belonging to the authenticated user,
 * including all screenshot files from storage and all database records.
 */
export async function deleteAllUserTrades(userId: string): Promise<void> {
  // 1. Get all trade IDs belonging to this user
  const { data: userTrades, error: fetchErr } = await supabase
    .from("trades")
    .select("trade_id")
    .eq("user_id", userId);

  if (fetchErr) {
    throw new Error(fetchErr.message || "Failed to fetch trade history for deletion");
  }

  if (!userTrades || userTrades.length === 0) {
    return; // Nothing to delete
  }

  const tradeIds = userTrades.map((t) => t.trade_id);

  // 2. Fetch screenshot URLs for all user trades
  const { data: screenshots } = await supabase
    .from("screenshots")
    .select("url")
    .in("trade_id", tradeIds);

  if (screenshots && screenshots.length > 0) {
    const paths = screenshots.map((s) => s.url).filter(Boolean);
    if (paths.length > 0) {
      const { error: storageErr } = await supabase.storage
        .from("trade-screenshots")
        .remove(paths);
      if (storageErr) {
        console.warn("Storage cleanup warning during bulk delete:", storageErr.message);
      }
    }
  }

  // 3. Delete all trades for the user (cascades to all child tables)
  const { error: deleteErr } = await supabase
    .from("trades")
    .delete()
    .eq("user_id", userId);

  if (deleteErr) {
    throw new Error(deleteErr.message || "Failed to clear trade history");
  }
}
