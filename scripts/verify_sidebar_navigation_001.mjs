import fs from 'fs';
import path from 'path';

console.log('=== VERIFYING SIDEBAR NAVIGATION (SIDEBAR-001) ===\n');

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
const sidebarPath = path.join(rootDir, 'src', 'components', 'layout', 'Sidebar.tsx');
const sidebarContent = fs.readFileSync(sidebarPath, 'utf8');

// Required 9 destinations from prompt
const REQUIRED_DESTINATIONS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/invoices', label: 'Invoices' },
  { href: '/collections', label: 'Collections' },
  { href: '/aging', label: 'Aging' },
  { href: '/customers', label: 'Customers' },
  { href: '/reports', label: 'Reports' },
  { href: '/risk', label: 'Risk' },
  { href: '/ai-decisions', label: 'AI Decisions' },
  { href: '/activity', label: 'Activity' },
];

// 1. Verify all 9 routes exist in PRIMARY_NAV_ITEMS
REQUIRED_DESTINATIONS.forEach(({ href, label }) => {
  const hasRoute = sidebarContent.includes(`href: '${href}'`);
  assert(hasRoute, `Sidebar defines route destination ${href}`);
});

// 2. Verify all 9 App Router pages exist on disk
REQUIRED_DESTINATIONS.forEach(({ href }) => {
  const routeFolder = href.replace('/', '');
  const pagePath = path.join(rootDir, 'src', 'app', routeFolder, 'page.tsx');
  const exists = fs.existsSync(pagePath);
  assert(exists, `App Router page exists at src/app/${routeFolder}/page.tsx`);

  if (exists) {
    const pageContent = fs.readFileSync(pagePath, 'utf8');
    const hasSidebar = pageContent.includes('<Sidebar') && pageContent.includes('Sidebar');
    const hasNavbar = pageContent.includes('<Navbar') && pageContent.includes('Navbar');
    assert(hasSidebar && hasNavbar, `Page ${href} renders Sidebar and Navbar`);
  }
});

// 3. Verify Sidebar does not unconditionally return null on dedicated App Router routes
assert(
  sidebarContent.includes("(!pathname || pathname === '/') && isLandingScreen"),
  'Sidebar only suppresses rendering on root landing screen, never on dedicated App Router routes'
);

// 4. Verify Navbar does not unconditionally return null on dedicated App Router routes
const navbarSection = sidebarContent.slice(sidebarContent.indexOf('export const Navbar'));
assert(
  navbarSection.includes("(!pathname || pathname === '/') && isLandingScreen"),
  'Navbar only suppresses rendering on root landing screen, never on dedicated App Router routes'
);

// 5. Verify Mobile navigation support
assert(
  sidebarContent.includes('useMobileNav') &&
  sidebarContent.includes('isMobileNavOpen') &&
  sidebarContent.includes('setMobileNavOpen'),
  'Shared mobile navigation state hook (useMobileNav) exists'
);

assert(
  sidebarContent.includes("e.key === 'Escape'") &&
  sidebarContent.includes('setMobileNavOpen(false)'),
  'Mobile drawer closes on Escape key press'
);

assert(
  sidebarContent.includes('setMobileNavOpen(false)') &&
  sidebarContent.includes('[pathname, setMobileNavOpen]'),
  'Mobile drawer automatically closes upon pathname navigation'
);

// 6. Verify Accessibility & Styling
assert(
  sidebarContent.includes('aria-label="Primary navigation"') &&
  sidebarContent.includes('aria-label="Sidebar main links"'),
  'Sidebar contains proper ARIA labels for accessibility'
);

assert(
  sidebarContent.includes('aria-current={isActive ? \'page\' : undefined}'),
  'Sidebar navigation links specify aria-current="page" on the active route'
);

assert(
  sidebarContent.includes('focus-visible:ring-2 focus-visible:ring-emerald-500'),
  'Sidebar navigation links specify visible focus indicators for keyboard navigation'
);

// 7. Verify active item calculation handles nested and alternate routes
assert(
  sidebarContent.includes("pathname.startsWith(item.href + '/')"),
  'isItemActive properly matches nested subroutes'
);

assert(
  sidebarContent.includes("pathname === '/recovery-reports'"),
  'isItemActive maps /recovery-reports to the Reports nav item'
);

// 8. Verify top navbar has duplicate "+ Import Invoices" removed, and Dashboard retains it
assert(
  !sidebarContent.includes('+ Import Invoices') &&
  !sidebarContent.includes('isImportModalOpen'),
  'Top Navbar cleanly removes duplicate "+ Import Invoices" button and modal state'
);

const dashboardPath = path.join(rootDir, 'src', 'components', 'dashboard', 'MainDashboard.tsx');
const dashboardContent = fs.readFileSync(dashboardPath, 'utf8');
assert(
  dashboardContent.includes('+ Import Invoices') &&
  dashboardContent.includes('Configure AI Rules') &&
  dashboardContent.includes('Upload CSV or Excel'),
  'Dashboard preserves primary "+ Import Invoices" entry point and "Configure AI Rules"'
);

assert(
  sidebarContent.includes('Search className="w-4 h-4') &&
  sidebarContent.includes("searchMode === 'ai'"),
  'Top Navbar preserves global search with AI switch'
);

assert(
  sidebarContent.includes('Bell className="w-4 h-4"'),
  'Top Navbar preserves notifications control'
);

assert(
  sidebarContent.includes('isProfileOpen') &&
  sidebarContent.includes('My Profile') &&
  sidebarContent.includes('Workspace') &&
  sidebarContent.includes('Billing & Plan'),
  'Top Navbar preserves full profile dropdown navigation'
);

console.log(`\n========================================`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log(`========================================`);

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
