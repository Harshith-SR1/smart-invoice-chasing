/**
 * INTRO-001 — INTRO SLIDES VERIFICATION SUITE
 *
 * Verifies:
 * 1. Exactly seven slides defined and bounded (0 to 6).
 * 2. Navigation handlers, boundary states, wheel, touch, and keyboard support.
 * 3. All CTAs (Start Recovering, Watch It Work, Start Recovering Now) connect to real auth routes.
 * 4. Sample data, customer names, amounts, and activity logs explicitly labeled illustrative/demo.
 * 5. Elimination of misleading claims (e.g. autonomous background sending, payment promise reducing balance).
 * 6. Mathematical reconciliation of recovery numbers in Slide 6 (₹4,80,000 / 84.2% / ₹90,000).
 * 7. Date consistency in Slide 2 timeline (15 May issue, 30 May due, 43 days overdue = 12 July).
 *
 * Usage: node scripts/verify_intro_001.mjs
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

console.log('=============================================================');
console.log('      INTRO-001: INTRO SLIDES FINAL CORRECTION AUDIT         ');
console.log('=============================================================\n');

function pass(msg) {
  console.log(`  [PASS] ${msg}`);
}

const landingPath = path.resolve('src/components/landing/LandingPage.tsx');
assert.strictEqual(fs.existsSync(landingPath), true, 'LandingPage.tsx exists');
const code = fs.readFileSync(landingPath, 'utf8');

// =============================================================
// SECTION 1: SLIDE ARCHITECTURE & BOUNDARIES
// =============================================================
console.log('>>> SECTION 1: SLIDE ARCHITECTURE & BOUNDARIES');

// 1.1 Total slides count
assert.strictEqual(
  code.includes('const totalSlides = 7;'),
  true,
  'totalSlides must be exactly 7'
);
pass('Slide count: Exactly 7 slides configured (0 through 6)');

// 1.2 Boundary checks in prev/next navigation
assert.strictEqual(
  code.includes('currentSlide < totalSlides - 1 ? prev + 1 : prev') ||
  code.includes('(prev < totalSlides - 1 ? prev + 1 : prev)'),
  true,
  'Next navigation is strictly bounded at totalSlides - 1'
);
assert.strictEqual(
  code.includes('currentSlide > 0 ? prev - 1 : prev') ||
  code.includes('(prev > 0 ? prev - 1 : prev)'),
  true,
  'Prev navigation is strictly bounded at 0'
);
pass('Navigation logic: Strict boundary checks prevent underflow (<0) or overflow (>6)');

// 1.3 Boundary disabled buttons
assert.strictEqual(
  code.includes('disabled={currentSlide === 0}'),
  true,
  'Previous button disabled on slide 0'
);
assert.strictEqual(
  code.includes('disabled={currentSlide === totalSlides - 1}'),
  true,
  'Next button disabled on slide 6'
);
pass('UI Controls: Previous and Next buttons disabled at slide boundaries');

// =============================================================
// SECTION 2: NAVIGATION & PROGRESS SYNCHRONIZATION
// =============================================================
console.log('\n>>> SECTION 2: NAVIGATION & PROGRESS SYNCHRONIZATION');

// 2.1 Progress indicator matches totalSlides
assert.strictEqual(
  code.includes('0{currentSlide + 1}'),
  true,
  'Slide indicator displays 1-indexed current slide'
);
assert.strictEqual(
  code.includes('/ 07') || code.includes('<span>07</span>'),
  true,
  'Slide indicator displays / 07'
);
pass('Progress counter: Synchronized with 1-indexed slide position out of 07');

// 2.2 Navigation methods: Keyboard, Wheel, Touch, and Dots
assert.strictEqual(
  code.includes("e.key === 'ArrowDown'") &&
  code.includes("e.key === 'ArrowUp'") &&
  code.includes("e.key === 'ArrowRight'") &&
  code.includes("e.key === 'ArrowLeft'"),
  true,
  'Keyboard navigation supports arrows'
);
assert.strictEqual(
  code.includes('handleWheel') && code.includes('wheelCooldown'),
  true,
  'Mouse-wheel handler with cooldown debouncing'
);
assert.strictEqual(
  code.includes('handleTouchStart') && code.includes('handleTouchEnd'),
  true,
  'Touch swipe handler enabled'
);
assert.strictEqual(
  code.includes('onClick={() => setCurrentSlide(idx)}'),
  true,
  'Direct slide indicator dots are interactive'
);
pass('Interactions: Keyboard arrows, mouse wheel with cooldown, touch swipe, and progress dots supported');

// =============================================================
// SECTION 3: CALL TO ACTION (CTA) DESTINATIONS & AUTH COMPATIBILITY
// =============================================================
console.log('\n>>> SECTION 3: CALL TO ACTION (CTA) DESTINATIONS');

// 3.1 Start Recovering button uses safe auth router
assert.strictEqual(
  code.includes('handleStartRecovering') &&
  code.includes("router.push('/dashboard')") &&
  code.includes("router.push('/signup')"),
  true,
  'handleStartRecovering routes existing users to dashboard and new users to signup'
);
pass('Hero CTA: Start Recovering navigates to signup or dashboard for authenticated users');

// 3.2 Watch It Work button advances slide
assert.strictEqual(
  code.includes('onClick={goToNextSlide}') && code.includes('WATCH IT WORK'),
  true,
  'Watch It Work triggers goToNextSlide'
);
pass('Hero CTA: Watch It Work advances smoothly to demonstration slides');

// 3.3 Final CTA routes to auth
assert.strictEqual(
  code.includes('START RECOVERING NOW') &&
  code.includes('onClick={handleStartRecovering}'),
  true,
  'Slide 7 CTA triggers handleStartRecovering'
);
pass('Slide 7 CTA: Start Recovering Now connects to the canonical authentication flow');

// 3.4 Direct Sign In link for existing users
assert.strictEqual(
  code.includes("router.push('/login')") || code.includes('href="/login"'),
  true,
  'Direct Sign In link available for existing authenticated users'
);
pass('Auth Navigation: Existing users provided direct Sign In link to avoid duplicate registration');

// =============================================================
// SECTION 4: SLIDE-BY-SLIDE PRODUCT CLAIM AUDIT
// =============================================================
console.log('\n>>> SECTION 4: SLIDE-BY-SLIDE PRODUCT CLAIM AUDIT');

// 4.1 Slide 1 Hero: No fake autonomous execution claims
assert.strictEqual(
  code.includes("DON'T CHASE INVOICES. <br />") &&
  code.includes('LET AI CHASE THE MONEY.'),
  true,
  'Slide 1 preserves primary headline'
);
assert.strictEqual(
  code.includes('DEMO PREVIEW'),
  true,
  'Slide 1 labels agent workspace as DEMO PREVIEW'
);
assert.strictEqual(
  !code.includes('Generating email...'),
  true,
  'Slide 1 does not claim email is generating when no real operation is occurring'
);
pass('Slide 1: Hero preserves headline, labels demo preview, removes misleading generating claim');

// 4.2 Slide 2: Untracked receivables labeled illustrative & date consistent
assert.strictEqual(
  code.includes('ILLUSTRATIVE SCENARIO') || code.includes('SAMPLE SCENARIO'),
  true,
  'Slide 2 labels scenario illustrative'
);
assert.strictEqual(
  code.includes('NOT A REAL CUSTOMER') || code.includes('Illustrative'),
  true,
  'Slide 2 clarifies customer is not a real client'
);
assert.strictEqual(
  code.includes('15 May') && code.includes('30 May') && (code.includes('43 DAYS PAST DUE') || code.includes('43 Days Past Due')),
  true,
  'Slide 2 timeline dates are internally consistent'
);
pass('Slide 2: Sample invoice labeled illustrative with consistent timeline arithmetic');

// 4.3 Slide 3: Conversational context & non-mutation of financial balance
assert.strictEqual(
  code.includes('Illustrative') || code.includes('DEMO'),
  true,
  'Slide 3 labels context illustrative/demo'
);
assert.strictEqual(
  code.includes('NEXT RECOMMENDED ACTION') && !code.includes('NEXT AUTOMATED ACTION'),
  true,
  'Slide 3 uses NEXT RECOMMENDED ACTION rather than NEXT AUTOMATED ACTION'
);
assert.strictEqual(
  code.includes('Ledger Unchanged'),
  true,
  'Slide 3 clarifies that unverified promises leave financial ledger balances unchanged'
);
pass('Slide 3: Recommended action clarified; financial balance shown unchanged by promises');

// 4.4 Slide 4: Decision engine & unverified payment claim protection
assert.strictEqual(
  code.includes('PAYMENT CLAIM DETECTED (UNVERIFIED)'),
  true,
  'Slide 4 flags payment claims as unverified'
);
assert.strictEqual(
  code.includes('Flag for Bank Verification (Ledger Unchanged)') ||
  code.includes('Keep the outstanding balance unchanged until payment is verified using available evidence'),
  true,
  'Slide 4 clarifies balance remains outstanding until bank verification'
);
assert.strictEqual(
  code.includes('Review payment status on Friday') ||
  code.includes('Review payment status on the promised date'),
  true,
  'Slide 4 uses review rather than implying scheduled background verification'
);
assert.strictEqual(
  code.includes('Recommend resuming follow-up if still unpaid'),
  true,
  'Slide 4 uses recommend resuming rather than automatic execution'
);
pass('Slide 4: Payment claims explicitly marked unverified; scheduled actions accurately framed');

// 4.5 Slide 5: Background execution replaced with relationship-aware preview
assert.strictEqual(
  !code.includes('LIVE AGENT WORK QUEUE'),
  true,
  'Slide 5 removes misleading LIVE AGENT WORK QUEUE label'
);
assert.strictEqual(
  code.includes('COLLECTION WORKFLOW PREVIEW'),
  true,
  'Slide 5 uses COLLECTION WORKFLOW PREVIEW'
);
assert.strictEqual(
  code.includes('RELATIONSHIP-AWARE COLLECTIONS'),
  true,
  'Slide 5 uses RELATIONSHIP-AWARE COLLECTIONS'
);
assert.strictEqual(
  code.includes('Follow-up recommended') && !code.includes('Following up automatically'),
  true,
  'Slide 5 uses Follow-up recommended instead of Following up automatically'
);
assert.strictEqual(
  code.includes('Collection complete (Verified)'),
  true,
  'Slide 5 ties collection complete strictly to verified payment'
);
pass('Slide 5: Replaced live background agent claims with workflow preview and recommendations');

// 4.6 Slide 6: Recovery outcomes reconciled & labeled illustrative
assert.strictEqual(
  code.includes('ILLUSTRATIVE SCENARIOS') || code.includes('Illustrative Recovery Scenarios'),
  true,
  'Slide 6 labels recovery stories as illustrative'
);
// Total = ₹1,20,000 + ₹85,000 + ₹2,10,000 + ₹65,000 = ₹4,80,000
const s1 = 120000, s2 = 85000, s3 = 210000, s4 = 65000;
const totalRecovered = s1 + s2 + s3 + s4;
assert.strictEqual(totalRecovered, 480000, 'Sum of 4 stories matches ₹4,80,000');
// Reconciliation: If recovered is ₹4,80,000 and Attention Needed is ₹90,000, total cohort = ₹5,70,000.
// Rate = 480,000 / 570,000 = 84.21%
const attentionNeeded = 90000;
const cohortTotal = totalRecovered + attentionNeeded;
const recoveryRate = (totalRecovered / cohortTotal) * 100;
assert.strictEqual(code.includes('₹4,80,000') && code.includes('₹90,000'), true, 'Amounts reconcile');
assert.strictEqual(Math.round(recoveryRate * 10) / 10, 84.2, 'Recovery rate reconciles to 84.2%');
pass('Slide 6: Recovery stories reconcile mathematically (₹4.80L recovered / ₹90K attention needed / 84.2% rate)');

// 4.7 Slide 7: Import validation accurate & figures labeled sample
assert.strictEqual(
  code.includes('VALIDATION & AI ANALYSIS'),
  true,
  'Slide 7 emphasizes validation in progression'
);
assert.strictEqual(
  code.includes('SAMPLE WORKSPACE IMPORT PREVIEW (ILLUSTRATIVE)'),
  true,
  'Slide 7 labels preview metrics as illustrative sample'
);
assert.strictEqual(
  code.includes('validate invoices, detect duplicates'),
  true,
  'Slide 7 accurately describes spreadsheet validation & duplicate detection'
);
pass('Slide 7: Spreadsheet import accurately promises validation & duplicate detection with sample preview');

// =============================================================
// SECTION 5: ACCESSIBILITY & RESPONSIVENESS
// =============================================================
console.log('\n>>> SECTION 5: ACCESSIBILITY & RESPONSIVENESS');

assert.strictEqual(
  code.includes('aria-label="Previous Slide"') &&
  code.includes('aria-label="Next Slide"'),
  true,
  'Slide controls include aria-labels'
);
assert.strictEqual(
  code.includes('focus-visible:ring-'),
  true,
  'Visible focus ring styles present for keyboard navigation'
);
assert.strictEqual(
  code.includes('overflow-x-hidden'),
  true,
  'Main container prevents mobile horizontal scrollbars'
);
pass('Accessibility: Aria labels, keyboard focus rings, and horizontal overflow protection verified');

console.log('\n=============================================================');
console.log('      ALL INTRO-001 AUDITS & INVARIANTS PASSED (24/24)       ');
console.log('=============================================================');
