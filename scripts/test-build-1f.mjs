import fs from 'fs';

let PROJECT_REF = 'jqptprskuxkhfoxsvwcl';
let TOKEN = process.env.SUPABASE_ACCESS_TOKEN || process.env.superbase_Access_Tokens || '';

if (fs.existsSync('.env')) {
  const envContent = fs.readFileSync('.env', 'utf-8');
  for (const line of envContent.split('\n')) {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const val = match[2].trim().replace(/^["']|["']$/g, '');
      if (key === 'SUPABASE_PROJECT_ID') PROJECT_REF = val;
      if (key === 'superbase_Access_Tokens' || key === 'SUPABASE_ACCESS_TOKEN') TOKEN = val;
    }
  }
}

async function runSql(sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query: sql })
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`SQL Error ${res.status}: ${err}`);
  }
  return await res.json();
}

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  [PASS] ${message}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${message}`);
    failed++;
  }
}

async function runTests() {
  console.log('====================================================');
  console.log('BUILD 1F COMPREHENSIVE VERIFICATION SUITE');
  console.log('====================================================\n');

  // ----------------------------------------------------
  // GROUP 1: ADMIN IDENTITY & BOOTSTRAP
  // ----------------------------------------------------
  console.log('--- GROUP 1: ADMIN Identity & Bootstrap ---');
  const davidAuth = await runSql(`
    SELECT id, email, created_at FROM auth.users WHERE email = 'daviddarkdo@gmail.com';
  `);
  assert(davidAuth.length === 1, 'David auth.users record exists and is unique');
  const davidId = davidAuth[0]?.id;
  assert(davidId === 'f7f477c5-ac10-48da-9030-9a81fce77910', 'David account UUID is exactly f7f477c5-ac10-48da-9030-9a81fce77910');

  const davidRoles = await runSql(`
    SELECT role FROM public.user_roles WHERE user_id = '${davidId}';
  `);
  assert(davidRoles.some(r => r.role === 'ADMIN'), 'David has verified ADMIN role in public.user_roles');
  assert(davidRoles.length === 1, 'David has no duplicate or extra roles');

  const isAdminRes = await runSql(`
    SELECT public.is_admin('${davidId}') as is_admin;
  `);
  assert(isAdminRes[0]?.is_admin === true, 'public.is_admin(david_id) returns true');

  const davidInvestor = await runSql(`
    SELECT * FROM public.investor_accounts WHERE user_id = '${davidId}';
  `);
  assert(davidInvestor.length === 0, 'No fake investor account created for David');

  // ----------------------------------------------------
  // GROUP 2: JOURNAL DATABASE & RLS
  // ----------------------------------------------------
  console.log('\n--- GROUP 2: Journal Database & RLS ---');
  const journalCols = await runSql(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'journal_notes' AND table_schema = 'public';
  `);
  const colNames = journalCols.map(c => c.column_name);
  assert(colNames.includes('id'), 'journal_notes has id column');
  assert(colNames.includes('user_id'), 'journal_notes has user_id column');
  assert(colNames.includes('title'), 'journal_notes has title column');
  assert(colNames.includes('content'), 'journal_notes has content column');
  assert(colNames.includes('created_at'), 'journal_notes has created_at column');
  assert(colNames.includes('updated_at'), 'journal_notes has updated_at column');

  const journalPolicies = await runSql(`
    SELECT policyname, cmd FROM pg_policies WHERE tablename = 'journal_notes';
  `);
  assert(journalPolicies.some(p => p.cmd === 'SELECT'), 'journal_notes has SELECT RLS policy');
  assert(journalPolicies.some(p => p.cmd === 'INSERT'), 'journal_notes has INSERT RLS policy');
  assert(journalPolicies.some(p => p.cmd === 'UPDATE'), 'journal_notes has UPDATE RLS policy');
  assert(journalPolicies.some(p => p.cmd === 'DELETE'), 'journal_notes has DELETE RLS policy');

  // Test insert, select, update, delete for journal_notes
  const noteId = '00000000-0000-0000-0000-0000000001f1';
  await runSql(`
    INSERT INTO public.journal_notes (id, user_id, title, content)
    VALUES ('${noteId}', '${davidId}', 'Test Note Build 1F', 'Discipline test content')
    ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title;
  `);
  const testNote = await runSql(`SELECT * FROM public.journal_notes WHERE id = '${noteId}';`);
  assert(testNote.length === 1 && testNote[0].title === 'Test Note Build 1F', 'Can insert & select journal note');

  await runSql(`UPDATE public.journal_notes SET content = 'Updated content' WHERE id = '${noteId}';`);
  const updatedNote = await runSql(`SELECT * FROM public.journal_notes WHERE id = '${noteId}';`);
  assert(updatedNote[0]?.content === 'Updated content', 'Can update journal note');

  await runSql(`DELETE FROM public.journal_notes WHERE id = '${noteId}';`);
  const deletedNote = await runSql(`SELECT * FROM public.journal_notes WHERE id = '${noteId}';`);
  assert(deletedNote.length === 0, 'Can delete journal note');

  // ----------------------------------------------------
  // GROUP 3: METAVALIDATOR HIERARCHY & ACTION DOCK
  // ----------------------------------------------------
  console.log('\n--- GROUP 3: Meta Validator Hierarchy & Action Dock ---');
  const validatorSource = fs.readFileSync('src/routes/_authenticated/validator.tsx', 'utf-8');
  assert(validatorSource.includes('Disciplined trading for real results.'), 'Validator has correct supporting statement');
  
  const perfIdx = validatorSource.indexOf('Validation Performance');
  const dockIdx = validatorSource.indexOf('Validator Action Dock') !== -1 
    ? validatorSource.indexOf('Validator Action Dock') 
    : validatorSource.indexOf('<ValidatorActionDock');
  const recentTradesIdx = validatorSource.indexOf('Recent Trades');
  
  assert(perfIdx !== -1, 'Validation Performance exists in validator.tsx');
  assert(dockIdx !== -1, 'Validator Action Dock exists in validator.tsx');
  assert(recentTradesIdx !== -1, 'Recent Trades exists in validator.tsx');
  assert(perfIdx < recentTradesIdx, 'Validation Performance appears strictly ABOVE Recent Trades');
  assert(dockIdx < recentTradesIdx, 'Validator Action Dock appears strictly ABOVE Recent Trades');

  const dockSource = fs.readFileSync('src/components/validator-action-dock.tsx', 'utf-8');
  assert(dockSource.includes('/trade-creator'), 'Action Dock links to /trade-creator');
  assert(dockSource.includes('/journal'), 'Action Dock links to /journal');
  assert(dockSource.includes('/strategy-profiles'), 'Action Dock links to /strategy-profiles');
  assert(dockSource.includes('/trade-analysis'), 'Action Dock links to /trade-analysis');
  assert(!dockSource.includes('profile') || !dockSource.includes('/profile'), 'Action Dock does NOT contain /profile');

  // ----------------------------------------------------
  // GROUP 4: JOURNAL & TRADE ANALYSIS SEPARATION
  // ----------------------------------------------------
  console.log('\n--- GROUP 4: Journal & Trade Analysis Separation ---');
  const journalSource = fs.readFileSync('src/routes/_authenticated/journal.tsx', 'utf-8');
  const tradeAnalysisSource = fs.readFileSync('src/routes/_authenticated/trade-analysis.tsx', 'utf-8');

  assert(journalSource.includes('journal_notes'), 'journal.tsx uses journal_notes table');
  assert(journalSource.includes('Personal Journal'), 'journal.tsx is Personal Journal notebook');
  assert(!journalSource.includes('deleteSingleTrade'), 'journal.tsx does not manage trade deletions');

  assert(tradeAnalysisSource.includes('Trade Analysis'), 'trade-analysis.tsx has Trade Analysis title');
  assert(tradeAnalysisSource.includes('deleteSingleTrade'), 'trade-analysis.tsx contains trade deletion logic');
  assert(tradeAnalysisSource.includes('learning_insights'), 'trade-analysis.tsx contains learning insights and filters');

  // ----------------------------------------------------
  // GROUP 5: METAFUND PLATFORM & ONBOARDING
  // ----------------------------------------------------
  console.log('\n--- GROUP 5: MetaFund Platform & Onboarding ---');
  const metafundSource = fs.readFileSync('src/routes/_authenticated/metafund.tsx', 'utf-8');
  assert(metafundSource.includes('MetaFund'), 'MetaFund platform header exists');
  assert(!metafundSource.includes('Investor access not activated. Contact an administrator'), 'MetaFund does not block entire screen with empty state');

  const commandCenterSource = fs.readFileSync('src/routes/_authenticated/command-center.tsx', 'utf-8');
  assert(commandCenterSource.includes('onboardInvestorAccount'), 'Command Center has investor onboarding action');
  assert(commandCenterSource.includes('Onboard Investor'), 'Command Center has Onboard Investor dialog');

  // ----------------------------------------------------
  // SUMMARY
  // ----------------------------------------------------
  console.log('\n====================================================');
  console.log(`BUILD 1F VERIFICATION SUMMARY:`);
  console.log(`  Passed: ${passed}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test run error:', err);
  process.exit(1);
});
