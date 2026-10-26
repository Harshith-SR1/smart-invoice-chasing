/**
 * scripts/verify_dashboard_loading_001.mjs
 *
 * Focused verification test suite for dashboard mock data flash prevention:
 * 1. Initial state isolation (no mock data in runtime initial state)
 * 2. Loading state active during data fetching
 * 3. Empty workspace genuine empty state
 * 4. Successful authenticated data hydration
 * 5. Failed loading honest error state (no silent mock data substitution)
 * 6. Session sign-out and cross-workspace state isolation
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

console.log('=============================================================');
console.log('   DASHBOARD MOCK DATA FLASH PREVENTION VERIFICATION       ');
console.log('=============================================================\n');

let totalTests = 0;
let passedTests = 0;

function test(description, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✓ PASS: ${description}`);
  } catch (err) {
    console.error(`  ✗ FAIL: ${description}`);
    console.error(`         ${err.message}`);
    process.exitCode = 1;
  }
}

// ── 1. CONTEXT INITIAL STATE AUDIT ──────────────────────────────────────────
console.log('>>> SECTION 1: RUNTIME INITIAL STATE PURITY');

const appContextPath = path.resolve('src/context/AppContext.tsx');
const appContextCode = fs.readFileSync(appContextPath, 'utf8');

test('AppContext initializes invoices as empty array []', () => {
  assert(
    appContextCode.includes('const [invoices, setInvoices] = useState<Invoice[]>([]);'),
    'Invoices must not be initialized with initialInvoices mock data'
  );
});

test('AppContext initializes customers as empty array []', () => {
  assert(
    appContextCode.includes('const [customers, setCustomers] = useState<Customer[]>([]);'),
    'Customers must not be initialized with initialCustomers mock data'
  );
});

test('AppContext initializes promises as empty array []', () => {
  assert(
    appContextCode.includes('const [promises, setPromises] = useState<PaymentPromise[]>([]);'),
    'Promises must not be initialized with initialPaymentPromises mock data'
  );
});

test('AppContext exposes isLoading and loadError in context', () => {
  assert(appContextCode.includes('isLoading: boolean;'), 'Context type must declare isLoading');
  assert(appContextCode.includes('loadError: string | null;'), 'Context type must declare loadError');
  assert(appContextCode.includes('const [isLoading, setIsLoading] = useState<boolean>(true);'), 'Must initialize isLoading to true');
  assert(appContextCode.includes('const [loadError, setLoadError] = useState<string | null>(null);'), 'Must declare loadError state');
});

// ── 2. SESSION AND CROSS-WORKSPACE PURITY ───────────────────────────────────
console.log('\n>>> SECTION 2: CROSS-WORKSPACE AND SIGN-OUT ISOLATION');

test('signOut clears invoices, customers, and promises to prevent cross-workspace exposure', () => {
  const signOutSection = appContextCode.slice(
    appContextCode.indexOf('const signOut = async'),
    appContextCode.indexOf('const handleImportData')
  );
  assert(signOutSection.includes('setInvoices([])'), 'signOut must clear invoices');
  assert(signOutSection.includes('setCustomers([])'), 'signOut must clear customers');
  assert(signOutSection.includes('setPromises([])'), 'signOut must clear promises');
  assert(signOutSection.includes('setLoadError(null)'), 'signOut must clear error');
});

test('onAuthStateChange clears invoices, customers, and promises when user logs out', () => {
  const authListenerSection = appContextCode.slice(
    appContextCode.indexOf('supabase.auth.onAuthStateChange'),
    appContextCode.indexOf('return () => subscription.unsubscribe()')
  );
  assert(authListenerSection.includes('setInvoices([])'), 'Logged out state must clear invoices');
  assert(authListenerSection.includes('setCustomers([])'), 'Logged out state must clear customers');
  assert(authListenerSection.includes('setPromises([])'), 'Logged out state must clear promises');
});

test('loadData cancels in-flight requests if unmounted or user changes', () => {
  assert(appContextCode.includes('let isCancelled = false;'), 'loadData must declare cancellation flag');
  assert(appContextCode.includes('return () => {\n      isCancelled = true;\n    };') || appContextCode.includes('isCancelled = true'), 'useEffect cleanup must cancel in-flight request');
});

test('loadData never queries mock data for real authenticated workspace or error state', () => {
  assert(
    appContextCode.includes("if (isUuid(targetWsId) && targetWsId !== 'ws-default')"),
    'Only genuine UUID workspaces may fetch invoices, avoiding ws-default mock fallback'
  );
  assert(
    appContextCode.includes("setLoadError('Failed to load workspace data. Please refresh.');"),
    'Error branch sets honest loadError'
  );
});

// ── 3. MAIN DASHBOARD LOADING AND ERROR RENDERING ───────────────────────────
console.log('\n>>> SECTION 3: DASHBOARD LOADING, ERROR & EMPTY STATES');

const dashboardPath = path.resolve('src/components/dashboard/MainDashboard.tsx');
const dashboardCode = fs.readFileSync(dashboardPath, 'utf8');

test('MainDashboard consumes isLoading and loadError from useApp()', () => {
  assert(dashboardCode.includes('isLoading,'), 'MainDashboard must consume isLoading');
  assert(dashboardCode.includes('loadError,'), 'MainDashboard must consume loadError');
});

test('MainDashboard renders loading skeleton while isLoading is true', () => {
  assert(dashboardCode.includes('if (isLoading) {'), 'Must guard with if (isLoading)');
  assert(dashboardCode.includes('Top Command Area Skeleton'), 'Must render top command area skeleton');
  assert(dashboardCode.includes('Financial Overview Grid Skeletons'), 'Must render metrics skeleton');
});

test('MainDashboard renders honest error state when loadError is present', () => {
  assert(
    dashboardCode.includes('if (loadError && (!invoices || invoices.length === 0)) {'),
    'Must guard with if (loadError && (!invoices || invoices.length === 0))'
  );
  assert(dashboardCode.includes('Unable to Load Workspace Data'), 'Must display honest error header');
  assert(dashboardCode.includes('Refresh Page'), 'Must provide refresh button on error');
});

test('MainDashboard renders legitimate empty state only after loading is complete and invoices is empty', () => {
  const loadingPos = dashboardCode.indexOf('if (isLoading)');
  const errorPos = dashboardCode.indexOf('if (loadError');
  const emptyPos = dashboardCode.indexOf('// 3. Legitimate Empty State');

  assert(loadingPos !== -1, 'Loading state check exists');
  assert(errorPos !== -1, 'Error state check exists');
  assert(emptyPos !== -1, 'Empty state check exists');
  assert(loadingPos < errorPos, 'Loading check must precede error check');
  assert(errorPos < emptyPos, 'Error check must precede empty state check');
  assert(dashboardCode.includes('Your AI Collection Operator is ready.'), 'Empty state text remains intact');
});

test('MainDashboard businessOrUserName does not use developer name fallback', () => {
  assert(!dashboardCode.includes("return 'Harshith';"), "Must not contain hardcoded developer name fallback 'Harshith'");
  assert(dashboardCode.includes("return 'Account Owner';"), "Must use neutral fallback 'Account Owner'");
});

console.log('\n=============================================================');
console.log(`   DASHBOARD LOADING TEST RESULTS: ${passedTests} / ${totalTests} ASSERTIONS PASSED`);
console.log('=============================================================\n');
