/**
 * Automated Verification Suite for Build 1C — MetaBrain Board Platform Shell
 * 
 * Verifies:
 * 1. Global Board Platform navigation integrity (exactly 4 platforms)
 * 2. Active platform route matching logic
 * 3. Default landing platform = Meta Validator
 * 4. Command Center isolation & authorization protection
 * 5. Sibling platform boundaries (zero cross-platform navigation pollution)
 * 6. Generated RouteTree synchronization
 * 7. Live Supabase database connection & backend stability
 */

import fs from "fs";
import path from "path";
import https from "https";

const env = fs.readFileSync(".env", "utf8");
const tokenMatch = env.match(/superbase_Access_Tokens\s*=\s*(.+)/);
const mgmtToken = tokenMatch ? tokenMatch[1].trim().replace(/^["']|["']$/g, "") : "";
const projectRef = "jqptprskuxkhfoxsvwcl";

async function runSql(sql) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: "api.supabase.com",
      path: `/v1/projects/${projectRef}/database/query`,
      method: "POST",
      headers: {
        Authorization: `Bearer ${mgmtToken}`,
        "Content-Type": "application/json",
      },
    }, (res) => {
      let data = "";
      res.on("data", (chunk) => data += chunk);
      res.on("end", () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            resolve(data);
          }
        } else {
          reject(new Error(`SQL Error (${res.statusCode}): ${data}`));
        }
      });
    });
    req.on("error", reject);
    req.write(JSON.stringify({ query: sql }));
    req.end();
  });
}

let passedCount = 0;
let totalCount = 0;

function assert(condition, message) {
  totalCount++;
  if (!condition) {
    console.error(`❌ [FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  passedCount++;
  console.log(`✅ [PASS] ${message}`);
}

async function runBuild1CVerification() {
  console.log("============================================================");
  console.log("METABRAIN BOARD PLATFORM SHELL — BUILD 1C AUTOMATED AUDIT");
  console.log("============================================================\n");

  const cwd = process.cwd();

  // 1. BOARD NAVIGATION DEFINITION AUDIT
  console.log("--- TEST GROUP 1: BOARD PLATFORMS CANONICAL DEFINITION ---");
  const navFilePath = path.join(cwd, "src", "lib", "board-navigation.ts");
  assert(fs.existsSync(navFilePath), "board-navigation.ts exists in src/lib");
  const navContent = fs.readFileSync(navFilePath, "utf8");

  assert(navContent.includes('"validator"'), "Board defines Meta Validator platform");
  assert(navContent.includes('"metafund"'), "Board defines MetaFund platform");
  assert(navContent.includes('"community"'), "Board defines Community platform");
  assert(navContent.includes('"profile"'), "Board defines Profile platform");
  assert(!navContent.includes('"command-center"') || !navContent.includes('id: "command-center"'), "Command Center is NOT defined as a 5th global Board platform");

  // 2. ACTIVE PLATFORM RESOLUTION LOGIC
  console.log("\n--- TEST GROUP 2: ACTIVE PLATFORM RESOLUTION LOGIC ---");
  const { getActivePlatform, BOARD_PLATFORMS } = await import("../src/lib/board-navigation.ts");
  assert(BOARD_PLATFORMS.length === 4, `Board contains exactly 4 primary destinations (Found: ${BOARD_PLATFORMS.length})`);
  assert(BOARD_PLATFORMS[0].id === "validator", "Default first platform is Meta Validator");
  assert(getActivePlatform("/validator") === "validator", "Path /validator resolves to validator platform");
  assert(getActivePlatform("/dashboard") === "validator", "Path /dashboard resolves to validator platform");
  assert(getActivePlatform("/trade-creator") === "validator", "Path /trade-creator resolves to validator platform");
  assert(getActivePlatform("/journal") === "validator", "Path /journal resolves to validator platform");
  assert(getActivePlatform("/strategy-profiles") === "validator", "Path /strategy-profiles resolves to validator platform");
  assert(getActivePlatform("/trade-detail/abc-123") === "validator", "Path /trade-detail/:id resolves to validator platform");
  assert(getActivePlatform("/metafund") === "metafund", "Path /metafund resolves to metafund platform");
  assert(getActivePlatform("/community") === "community", "Path /community resolves to community platform");
  assert(getActivePlatform("/profile") === "profile", "Path /profile resolves to profile platform");

  // 3. DEFAULT LANDING & REDIRECT AUDIT
  console.log("\n--- TEST GROUP 3: AUTHENTICATED REDIRECTS AUDIT ---");
  const indexRoute = fs.readFileSync(path.join(cwd, "src", "routes", "index.tsx"), "utf8");
  assert(indexRoute.includes('to: "/validator"'), "Landing page / redirects authenticated user to /validator");

  const authRoute = fs.readFileSync(path.join(cwd, "src", "routes", "auth.tsx"), "utf8");
  assert(authRoute.includes('to: search.redirect ?? "/validator"'), "Auth page sign-in redirects to /validator by default");

  const dashboardRoute = fs.readFileSync(path.join(cwd, "src", "routes", "_authenticated", "dashboard.tsx"), "utf8");
  assert(dashboardRoute.includes('to: "/validator"'), "Legacy /dashboard route redirects to canonical /validator");

  // 4. SIBLING PLATFORM BOUNDARIES & ZERO CROSS-CONTAMINATION
  console.log("\n--- TEST GROUP 4: SIBLING PLATFORM ISOLATION ---");
  const validatorRoute = fs.readFileSync(path.join(cwd, "src", "routes", "_authenticated", "validator.tsx"), "utf8");
  assert(!validatorRoute.includes('to="/metafund"'), "Meta Validator platform surface does not contain MetaFund navigation");
  assert(!validatorRoute.includes('to="/command-center"'), "Meta Validator platform surface does not contain Command Center navigation");
  assert(validatorRoute.includes('to="/trade-creator"'), "Meta Validator platform surface houses New Trade tool");
  assert(validatorRoute.includes('to="/journal"'), "Meta Validator platform surface houses Journal tool");
  assert(validatorRoute.includes('to="/strategy-profiles"'), "Meta Validator platform surface houses Strategies tool");

  const metafundRoute = fs.readFileSync(path.join(cwd, "src", "routes", "_authenticated", "metafund.tsx"), "utf8");
  assert(!metafundRoute.includes('to="/validator"'), "MetaFund platform surface does not contain Meta Validator navigation");
  assert(!metafundRoute.includes('to="/trade-creator"'), "MetaFund platform surface does not contain New Trade navigation");
  assert(!metafundRoute.includes('to="/command-center"'), "MetaFund investor surface does not contain Command Center navigation");

  // 5. PRIVILEGED COMMAND CENTER & PROFILE CONTROLS
  console.log("\n--- TEST GROUP 5: COMMAND CENTER PRIVILEGE & PROFILE INTEGRATION ---");
  const commandCenterRoute = fs.readFileSync(path.join(cwd, "src", "routes", "_authenticated", "command-center.tsx"), "utf8");
  assert(commandCenterRoute.includes("beforeLoad:"), "Command Center route enforces beforeLoad authorization check");
  assert(commandCenterRoute.includes('roles.some((r) => r.role === "ADMIN"') || commandCenterRoute.includes('role === "ADMIN"'), "Command Center enforces ADMIN role check before route load");

  const profileRoute = fs.readFileSync(path.join(cwd, "src", "routes", "_authenticated", "profile.tsx"), "utf8");
  assert(profileRoute.includes("Administrative Access") || profileRoute.includes("Company Command Center"), "Profile page provides entry point to Command Center");
  assert(profileRoute.includes("p?.isAdmin") || profileRoute.includes("isAdmin"), "Profile page conditionally guards Command Center link to ADMINs only");

  // 6. COMMUNITY PLATFORM SURFACE
  console.log("\n--- TEST GROUP 6: COMMUNITY PLATFORM PLACEHOLDER ---");
  const communityRoute = fs.readFileSync(path.join(cwd, "src", "routes", "_authenticated", "community.tsx"), "utf8");
  assert(communityRoute.includes("Community") && communityRoute.includes("Under Development"), "Community platform clearly presents honest reserved placeholder state");

  // 7. ROUTE TREE SYNCHRONIZATION
  console.log("\n--- TEST GROUP 7: ROUTE TREE SYNCHRONIZATION ---");
  const routeTree = fs.readFileSync(path.join(cwd, "src", "routeTree.gen.ts"), "utf8");
  assert(routeTree.includes("'/validator'"), "Route tree registers /validator");
  assert(routeTree.includes("'/metafund'"), "Route tree registers /metafund");
  assert(routeTree.includes("'/community'"), "Route tree registers /community");
  assert(routeTree.includes("'/profile'"), "Route tree registers /profile");
  assert(routeTree.includes("'/command-center'"), "Route tree registers /command-center");

  // 8. BACKEND CONNECTION & REGRESSION INTEGRITY
  console.log("\n--- TEST GROUP 8: BACKEND CONNECTION & REGRESSION INTEGRITY ---");
  const configRows = await runSql("SELECT version, base_currency, is_active FROM platform_configuration LIMIT 5;");
  assert(Array.isArray(configRows), "Supabase platform_configuration table accessible and operational");

  const cycles = await runSql("SELECT id, name, status FROM investment_cycles LIMIT 5;");
  assert(Array.isArray(cycles), "MetaFund investment_cycles table accessible and operational");

  const rpcCheck = await runSql("SELECT proname FROM pg_proc WHERE proname IN ('process_trade_result_allocation', 'snapshot_trade_participations', 'reconcile_financial_system');");
  assert(Array.isArray(rpcCheck) && rpcCheck.length === 3, "All MetaFund Build 1B operational RPCs intact in database");

  console.log("\n============================================================");
  console.log(`ALL BUILD 1C TESTS PASSED! (${passedCount}/${totalCount})`);
  console.log("============================================================\n");
}

runBuild1CVerification().catch((err) => {
  console.error("Test suite failed:", err);
  process.exit(1);
});
