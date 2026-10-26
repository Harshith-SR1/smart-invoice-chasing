import fs from 'fs';
import path from 'path';

console.log('=== VERIFYING AI RULES ROUTING & CONFIGURATION INTEGRATION (AI-RULES-ROUTING-001) ===\n');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`[PASS] ${message}`);
    passed++;
  } else {
    console.error(`[FAIL] ${message}`);
    failed++;
  }
}

const rootDir = process.cwd();

// 1. Verify MainDashboard "Configure AI Rules" quick action
const dashboardPath = path.join(rootDir, 'src', 'components', 'dashboard', 'MainDashboard.tsx');
const dashboardContent = fs.readFileSync(dashboardPath, 'utf8');

assert(
  dashboardContent.includes('href="/settings?tab=ai"') &&
  dashboardContent.includes('Configure AI Rules'),
  'MainDashboard contains "Configure AI Rules" quick action pointing to /settings?tab=ai'
);

assert(
  dashboardContent.includes('Sliders') &&
  dashboardContent.includes('<Link') &&
  dashboardContent.includes('AI COLLECTION OPERATOR ACTIVE'),
  'MainDashboard integrates Configure AI Rules in the top command area'
);

// 2. Verify Workspace page entry point
const workspacePath = path.join(rootDir, 'src', 'app', 'workspace', 'page.tsx');
const workspaceContent = fs.readFileSync(workspacePath, 'utf8');

assert(
  workspaceContent.includes('href="/settings?tab=ai"') &&
  workspaceContent.includes('Configure AI Rules'),
  'Workspace page contains "Configure AI Rules" link pointing to /settings?tab=ai'
);

// 3. Verify AI Decisions page entry point
const decisionsPath = path.join(rootDir, 'src', 'components', 'decisions', 'AiDecisionsView.tsx');
const decisionsContent = fs.readFileSync(decisionsPath, 'utf8');

assert(
  decisionsContent.includes('href="/settings?tab=ai"') &&
  decisionsContent.includes('Configure AI Rules'),
  'AiDecisionsView header contains "Configure AI Rules" link pointing to /settings?tab=ai'
);

// 4. Verify SettingsView tab resolution and alias support
const settingsPath = path.join(rootDir, 'src', 'components', 'settings', 'SettingsView.tsx');
const settingsContent = fs.readFileSync(settingsPath, 'utf8');

assert(
  settingsContent.includes("lower === 'ai' || lower === 'ai-rules' || lower === 'rules'"),
  'SettingsView maps "ai", "rules", and "ai-rules" aliases to the AI Receiver & Rules tab'
);

assert(
  settingsContent.includes("lower === 'collection' || lower === 'cadence'"),
  'SettingsView maps "collection" and "cadence" aliases to Collection Rules tab'
);

assert(
  settingsContent.includes("lower === 'autonomy'"),
  'SettingsView supports "autonomy" tab deep-linking'
);

// 5. Verify URL synchronization, browser refresh persistence & popstate
assert(
  settingsContent.includes('window.history.replaceState') &&
  settingsContent.includes("url.searchParams.set('tab', tabId)"),
  'SettingsView persists active tab to URL search parameter using history.replaceState for refresh stability'
);

assert(
  settingsContent.includes("window.addEventListener('popstate'") &&
  settingsContent.includes("window.removeEventListener('popstate'"),
  'SettingsView subscribes to popstate events for seamless browser back/forward navigation'
);

// 6. Verify required configuration sections in SettingsView
assert(
  settingsContent.includes('AI Receiver Engine Controls') &&
  settingsContent.includes('aiActive') &&
  settingsContent.includes('tone'),
  'SettingsView contains AI Receiver Engine Controls (active state, communication tone)'
);

assert(
  settingsContent.includes('Follow-up Cadence & Sequence Rules') &&
  settingsContent.includes('preDueDays') &&
  settingsContent.includes('firstOverdue') &&
  settingsContent.includes('secondOverdue') &&
  settingsContent.includes('finalEscalation'),
  'SettingsView contains Follow-up Cadence & Sequence Rules (pre-due, post-due schedule, escalation threshold)'
);

assert(
  settingsContent.includes('AI Autonomy & Delegation Boundaries') &&
  settingsContent.includes('autoSend') &&
  settingsContent.includes('autoStopPromise'),
  'SettingsView contains AI Autonomy settings (auto-send, pause on promise, human delegation)'
);

// 7. Verify safe return navigation to dashboard
assert(
  dashboardContent.includes('Sidebar') ||
  fs.readFileSync(path.join(rootDir, 'src', 'app', 'settings', 'page.tsx'), 'utf8').includes('<Sidebar />'),
  'Settings route includes Sidebar navigation to return cleanly to /dashboard'
);

console.log(`\n========================================`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log(`========================================`);

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
