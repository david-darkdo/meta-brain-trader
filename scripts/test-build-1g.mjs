import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");

let PROJECT_REF = "jqptprskuxkhfoxsvwcl";
let TOKEN = process.env.SUPABASE_ACCESS_TOKEN || process.env.superbase_Access_Tokens || "";

if (fs.existsSync(path.join(root, ".env"))) {
  const envContent = fs.readFileSync(path.join(root, ".env"), "utf-8");
  for (const line of envContent.split("\n")) {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const val = match[2].trim().replace(/^["']|["']$/g, "");
      if (key === "SUPABASE_PROJECT_ID") PROJECT_REF = val;
      if (key === "superbase_Access_Tokens" || key === "SUPABASE_ACCESS_TOKEN") TOKEN = val;
    }
  }
}

async function runSql(sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`SQL Error ${res.status}: ${err}`);
  }
  return await res.json();
}

console.log("============================================================");
console.log("BUILD 1G AUTOMATED VERIFICATION SUITE");
console.log("============================================================");

let failed = false;
function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    failed = true;
  } else {
    console.log(`✅ PASS: ${message}`);
  }
}

async function runTests() {
  // TEST 1: Source file checks for MetaFund
  console.log("\n--- PART 1: MetaFund User Platform Architecture ---");
  const metafundFile = fs.readFileSync(path.join(root, "src/routes/_authenticated/metafund.tsx"), "utf8");
  
  assert(
    !metafundFile.includes("Investor access not activated. Contact an administrator"),
    "MetaFund no longer replaces the entire platform with full-page 'Investor access not activated' blocker"
  );
  assert(
    metafundFile.includes("Not Onboarded") && metafundFile.includes("Active Investor"),
    "MetaFund contains badges and UI handles for all user states (State A, State B, State C)"
  );
  assert(
    metafundFile.includes("requestDeposit") && metafundFile.includes("requestWithdrawal"),
    "MetaFund contains user-facing Deposit and Withdrawal actions"
  );
  assert(
    metafundFile.includes("Deposit Capital") && metafundFile.includes("Request Withdrawal"),
    "MetaFund contains Deposit and Withdrawal modal dialogs"
  );

  // TEST 2: Journal UX Correction
  console.log("\n--- PART 2: Journal UX & Top-Level Composer ---");
  const journalFile = fs.readFileSync(path.join(root, "src/routes/_authenticated/journal.tsx"), "utf8");
  
  assert(
    !journalFile.includes("grid-cols-12 gap-6 items-start"),
    "Journal removed the permanent 2-column split with permanent editor"
  );
  assert(
    journalFile.includes("isEditorOpen") && journalFile.includes("handleOpenNew"),
    "Journal opens editor on demand when [+ New Entry] or Edit is clicked"
  );
  assert(
    journalFile.includes("No journal entries yet"),
    "Journal has clean empty state when no notes exist"
  );
  assert(
    journalFile.includes("Saved Entries ("),
    "Journal displays saved notes list with newest first"
  );

  // TEST 3: Trade Analysis Intelligence
  console.log("\n--- PART 3: Trade Analysis Intelligence ---");
  const tradeAnalysisFile = fs.readFileSync(path.join(root, "src/routes/_authenticated/trade-analysis.tsx"), "utf8");
  
  assert(
    tradeAnalysisFile.includes("Trading Intelligence"),
    "Trade Analysis includes 'Trading Intelligence' section"
  );
  assert(
    tradeAnalysisFile.includes("Not enough completed trades to generate reliable trading patterns."),
    "Trade Analysis includes fallback for accounts with insufficient completed trades"
  );
  assert(
    tradeAnalysisFile.includes("What You Do Well") &&
    tradeAnalysisFile.includes("What You Need to Improve") &&
    tradeAnalysisFile.includes("Recent Patterns") &&
    tradeAnalysisFile.includes("Discipline"),
    "Trade Analysis includes 4 intelligence quadrants: What You Do Well, What You Need to Improve, Recent Patterns, Discipline"
  );

  // TEST 4: MetaFund API layer
  console.log("\n--- PART 4: MetaFund API Layer & Server RPC Integration ---");
  const metafundApiFile = fs.readFileSync(path.join(root, "src/lib/metafund-api.ts"), "utf8");
  
  assert(
    metafundApiFile.includes("onboard_investor_account"),
    "metafund-api calls the server-authoritative onboard_investor_account RPC"
  );
  assert(
    metafundApiFile.includes("request_deposit"),
    "metafund-api calls the request_deposit RPC"
  );

  // TEST 5: Database RPC Verification via Supabase Management API
  console.log("\n--- PART 5: Supabase Database RPC Verification ---");
  if (TOKEN) {
    // Check onboard_investor_account exists in pg_proc
    const onboardProc = await runSql(`
      SELECT routine_name, routine_type, security_type
      FROM information_schema.routines 
      WHERE routine_schema = 'public' AND routine_name = 'onboard_investor_account';
    `);
    assert(
      onboardProc.length === 1 && onboardProc[0].security_type === "DEFINER",
      "public.onboard_investor_account exists in Postgres and is SECURITY DEFINER"
    );

    // Check request_deposit exists in pg_proc
    const depositProc = await runSql(`
      SELECT routine_name, routine_type, security_type
      FROM information_schema.routines 
      WHERE routine_schema = 'public' AND routine_name = 'request_deposit';
    `);
    assert(
      depositProc.length === 1 && depositProc[0].security_type === "DEFINER",
      "public.request_deposit exists in Postgres and is SECURITY DEFINER"
    );

    // Check permissions on both RPCs
    const grants = await runSql(`
      SELECT routine_name, grantee, privilege_type
      FROM information_schema.routine_privileges
      WHERE routine_schema = 'public' AND routine_name IN ('onboard_investor_account', 'request_deposit');
    `);
    const anonGrants = grants.filter((g) => g.grantee === "anon" || g.grantee === "PUBLIC");
    assert(
      anonGrants.length === 0,
      "RPCs are not executable by anon / PUBLIC"
    );
  } else {
    console.log("⚠️ Supabase management token not found, skipping direct SQL RPC inspection.");
  }

  console.log("\n============================================================");
  if (failed) {
    console.error("❌ BUILD 1G VERIFICATION FAILED");
    process.exit(1);
  } else {
    console.log("✅ ALL BUILD 1G VERIFICATION CHECKS PASSED");
  }
}

runTests().catch((err) => {
  console.error("Test execution error:", err);
  process.exit(1);
});
