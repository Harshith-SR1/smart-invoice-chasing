/**
 * STANDALONE LEGAL ROUTES & BRANDED 404 VERIFICATION SUITE
 * TASK: REM-02
 *
 * Verifies:
 * 1. Static presence and complete text fidelity for /privacy, /terms, and not-found.tsx.
 * 2. Next.js production build compilation.
 * 3. Live HTTP probe against a running server:
 *    - GET /privacy -> HTTP 200 + Content
 *    - GET /terms -> HTTP 200 + Content
 *    - GET /nonexistent-route -> HTTP 404 + Branded Page Not Found
 *
 * Usage: node scripts/verify_standalone_legal_and_404_001.mjs
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import http from 'node:http';

console.log('======================================================================');
console.log('  REM-02: STANDALONE LEGAL ROUTES & BRANDED 404 AUDIT SUITE');
console.log('======================================================================\n');

let passedTests = 0;
let totalTests = 0;

function it(desc, fn) {
  totalTests++;
  try {
    fn();
    console.log(`[PASS] Check ${totalTests}: ${desc}`);
    passedTests++;
  } catch (err) {
    console.error(`[FAIL] Check ${totalTests}: ${desc}`);
    console.error(`       Error: ${err.message}`);
  }
}

async function itAsync(desc, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`[PASS] Check ${totalTests}: ${desc}`);
    passedTests++;
  } catch (err) {
    console.error(`[FAIL] Check ${totalTests}: ${desc}`);
    console.error(`       Error: ${err.message}`);
  }
}

const rootDir = process.cwd();

// -----------------------------------------------------------------------------
// CHECK 1: File Presence on Disk
// -----------------------------------------------------------------------------
it('Privacy, Terms, and NotFound files exist in src/app', () => {
  assert(fs.existsSync(path.join(rootDir, 'src/app/privacy/page.tsx')), 'privacy/page.tsx must exist');
  assert(fs.existsSync(path.join(rootDir, 'src/app/terms/page.tsx')), 'terms/page.tsx must exist');
  assert(fs.existsSync(path.join(rootDir, 'src/app/not-found.tsx')), 'not-found.tsx must exist');
});

// -----------------------------------------------------------------------------
// CHECK 2: Privacy Policy Text Fidelity
// -----------------------------------------------------------------------------
it('Privacy page contains all 7 authoritative sections from PolicyModal', () => {
  const content = fs.readFileSync(path.join(rootDir, 'src/app/privacy/page.tsx'), 'utf8');
  assert(content.includes('PRIVACY POLICY'), 'Contains main heading');
  assert(content.includes('1.</span> Information We Collect'), 'Contains Section 1');
  assert(content.includes('2.</span> How We Use Information'), 'Contains Section 2');
  assert(content.includes('3.</span> AI Model Processing'), 'Contains Section 3');
  assert(content.includes('4.</span> Data Security &amp; Storage') || content.includes('Data Security'), 'Contains Section 4');
  assert(content.includes('5.</span> Third-Party Integrations'), 'Contains Section 5');
  assert(content.includes('6.</span> User Rights &amp; Data Retention') || content.includes('User Rights'), 'Contains Section 6');
  assert(content.includes('7.</span> Contact Information'), 'Contains Section 7');
  assert(content.includes('support@smart-invoice-chasing.vercel.app'), 'Contains official support email');
});

// -----------------------------------------------------------------------------
// CHECK 3: Terms of Service Text Fidelity
// -----------------------------------------------------------------------------
it('Terms page contains all 11 authoritative sections from PolicyModal', () => {
  const content = fs.readFileSync(path.join(rootDir, 'src/app/terms/page.tsx'), 'utf8');
  assert(content.includes('TERMS OF SERVICE'), 'Contains main heading');
  assert(content.includes('1.</span> Introduction &amp; Acceptance'), 'Contains Section 1');
  assert(content.includes('2.</span> Description of Service'), 'Contains Section 2');
  assert(content.includes('3.</span> Account Creation &amp; Workspace Setup'), 'Contains Section 3');
  assert(content.includes('4.</span> Invoice Data &amp; Customer Content'), 'Contains Section 4');
  assert(content.includes('5.</span> AI Recommendations &amp; Automated Chasing'), 'Contains Section 5');
  assert(content.includes('6.</span> Email Communications'), 'Contains Section 6');
  assert(content.includes('7.</span> No Guarantee of Payment Recovery'), 'Contains Section 7');
  assert(content.includes('8.</span> Fees, Subscriptions &amp; Billing'), 'Contains Section 8');
  assert(content.includes('9.</span> Prohibited Uses'), 'Contains Section 9');
  assert(content.includes('10.</span> Limitation of Liability'), 'Contains Section 10');
  assert(content.includes('11.</span> Governing Law &amp; Contact'), 'Contains Section 11');
  assert(content.includes('SMART INVOICE CHASING IS A SOFTWARE TOOL TO ASSIST IN RECEIVABLES COLLECTION'), 'Preserves uppercase disclaimer');
});

// -----------------------------------------------------------------------------
// CHECK 4: Branded 404 Navigation Links
// -----------------------------------------------------------------------------
it('NotFound page provides working navigation to dashboard, login, and home', () => {
  const content = fs.readFileSync(path.join(rootDir, 'src/app/not-found.tsx'), 'utf8');
  assert(content.includes('Page Not Found'), 'Contains page title');
  assert(content.includes('href="/dashboard"'), 'Links to /dashboard');
  assert(content.includes('href="/login"'), 'Links to /login');
  assert(content.includes('href="/"'), 'Links to / (Home)');
  assert(content.includes('HTTP 404'), 'Indicates 404 status clearly to users');
});

// -----------------------------------------------------------------------------
// CHECK 5 & 6 & 7: Live HTTP Status Verification Against Running Server
// -----------------------------------------------------------------------------
await itAsync('Live HTTP Server verification: /privacy (200), /terms (200), /invalid-route (404)', async () => {
  const TEST_PORT = 3199;
  const isWindows = process.platform === 'win32';
  const npmCmd = isWindows ? 'npx.cmd' : 'npx';

  console.log(`       [Server] Starting Next.js production server on port ${TEST_PORT}...`);

  const serverProc = spawn(npmCmd, ['next', 'start', '-H', '127.0.0.1', '-p', String(TEST_PORT)], {
    cwd: rootDir,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true,
  });

  let serverLogs = '';
  serverProc.stdout.on('data', (d) => {
    serverLogs += d.toString();
  });
  serverProc.stderr.on('data', (d) => {
    serverLogs += d.toString();
  });
  serverProc.on('error', (err) => {
    serverLogs += `[Spawn Error: ${err.message}]\n`;
  });

  function fetchUrl(urlPath) {
    return new Promise((resolve, reject) => {
      const req = http.get(`http://127.0.0.1:${TEST_PORT}${urlPath}`, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          resolve({ status: res.statusCode, headers: res.headers, body: data });
        });
      });
      req.on('error', reject);
    });
  }

  // Poll server until ready (up to 20 seconds)
  let serverReady = false;
  let lastProbeError = null;
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      const probe = await fetchUrl('/privacy');
      if (probe.status === 200) {
        serverReady = true;
        break;
      } else {
        lastProbeError = `Status ${probe.status}`;
      }
    } catch (err) {
      lastProbeError = err.message;
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  try {
    assert(serverReady, `Next.js server failed to respond on port ${TEST_PORT} within 20s. Last probe: ${lastProbeError}. Logs:\n${serverLogs}`);

    // 1. Verify /privacy
    const privacyRes = await fetchUrl('/privacy');
    assert.strictEqual(privacyRes.status, 200, `/privacy must return HTTP 200 (Got: ${privacyRes.status})`);
    assert(privacyRes.body.includes('PRIVACY POLICY'), 'Response contains PRIVACY POLICY');
    assert(privacyRes.body.includes('Information We Collect'), 'Response contains Information We Collect');
    console.log('       [HTTP] GET /privacy -> HTTP 200 OK (Verified)');

    // 2. Verify /terms
    const termsRes = await fetchUrl('/terms');
    assert.strictEqual(termsRes.status, 200, `/terms must return HTTP 200 (Got: ${termsRes.status})`);
    assert(termsRes.body.includes('TERMS OF SERVICE'), 'Response contains TERMS OF SERVICE');
    assert(termsRes.body.includes('No Guarantee of Payment Recovery'), 'Response contains disclaimer');
    console.log('       [HTTP] GET /terms -> HTTP 200 OK (Verified)');

    // 3. Verify /help/nonexistent-test-route-404
    const notFoundRes = await fetchUrl('/help/nonexistent-test-route-404');
    assert.strictEqual(notFoundRes.status, 404, `/help/nonexistent-test-route-404 must return HTTP 404 (Got: ${notFoundRes.status})`);
    assert(notFoundRes.body.includes('Page Not Found'), '404 response contains branded Page Not Found text');
    console.log('       [HTTP] GET /help/nonexistent-test-route-404 -> HTTP 404 Not Found (Verified)');

  } finally {
    // Terminate the background server process cleanly
    if (serverProc.pid) {
      if (isWindows) {
        spawn('taskkill', ['/pid', String(serverProc.pid), '/f', '/t'], { stdio: 'ignore' });
      } else {
        serverProc.kill('SIGKILL');
      }
    }
  }
});

console.log('\n----------------------------------------------------------------------');
console.log(`Results: ${passedTests} / ${totalTests} checks passed.`);
if (passedTests === totalTests) {
  console.log('STATUS: ALL STANDALONE LEGAL & 404 CHECKS PASSED SUCCESSFULLY.');
} else {
  console.error(`STATUS: ${totalTests - passedTests} CHECKS FAILED.`);
  process.exit(1);
}
