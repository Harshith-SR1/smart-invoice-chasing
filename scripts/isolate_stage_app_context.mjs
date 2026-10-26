import fs from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';

const appContextPath = path.resolve('src/context/AppContext.tsx');

// 1. Read full current working-tree file (with all Phase 1 changes)
const fullWorkingTreeCode = fs.readFileSync(appContextPath, 'utf8');

// 2. Read clean file from HEAD
const headCode = execSync('git show HEAD:src/context/AppContext.tsx', { encoding: 'utf8' });

// 3. Make ONLY the 4 isLoading changes on top of clean HEAD code:
let stagedCode = headCode;

// Hunk 1: AppContextType declaration
const target1 = `  searchQuery: string;\n  setSearchQuery: (query: string) => void;\n  \n  // Actions`;
const replacement1 = `  searchQuery: string;\n  setSearchQuery: (query: string) => void;\n  isLoading: boolean;\n  \n  // Actions`;
if (!stagedCode.includes(target1)) {
  throw new Error('Target 1 not found in HEAD AppContext.tsx');
}
stagedCode = stagedCode.replace(target1, replacement1);

// Hunk 2: AppProvider state initialization
const target2 = `  const [automationRules, setAutomationRules] = useState<AutomationRules>(defaultAutomationRules);\n  \n  const isRealWorkspace = Boolean(user && isUuid(workspace.id) && workspace.id !== 'ws-default');`;
const replacement2 = `  const [automationRules, setAutomationRules] = useState<AutomationRules>(defaultAutomationRules);\n  const [isLoading, setIsLoading] = useState<boolean>(true);\n  \n  const isRealWorkspace = Boolean(user && isUuid(workspace.id) && workspace.id !== 'ws-default');`;
if (!stagedCode.includes(target2)) {
  throw new Error('Target 2 not found in HEAD AppContext.tsx');
}
stagedCode = stagedCode.replace(target2, replacement2);

// Hunk 3: Auth listeners & loadData lifecycle
const target3 = `  // Sync Supabase Auth Session
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  // Load backend data if available
  useEffect(() => {
    async function loadData() {
      if (!user) return;
      try {`;

const replacement3 = `  // Sync Supabase Auth Session
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (!session?.user) {
        setIsLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (!session?.user) {
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  // Load backend data if available
  useEffect(() => {
    async function loadData() {
      if (!user) {
        setIsLoading(false);
        return;
      }
      try {
        setIsLoading(true);`;

if (!stagedCode.includes(target3)) {
  throw new Error('Target 3 not found in HEAD AppContext.tsx');
}
stagedCode = stagedCode.replace(target3, replacement3);

// Hunk 3b: loadData finally
const target3b = `      } catch (err) {
        console.warn('Backend load notice (using current state):', err);
      }
    }
    loadData();
  }, [user]);`;

const replacement3b = `      } catch (err) {
        console.warn('Backend load notice (using current state):', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [user]);`;

if (!stagedCode.includes(target3b)) {
  throw new Error('Target 3b not found in HEAD AppContext.tsx');
}
stagedCode = stagedCode.replace(target3b, replacement3b);

// Hunk 4: Provider value object
const target4 = `        searchQuery,
        setSearchQuery,
        handleImportData,`;

const replacement4 = `        searchQuery,
        setSearchQuery,
        isLoading,
        handleImportData,`;

if (!stagedCode.includes(target4)) {
  throw new Error('Target 4 not found in HEAD AppContext.tsx');
}
stagedCode = stagedCode.replace(target4, replacement4);

// 4. Temporarily write stagedCode to AppContext.tsx
fs.writeFileSync(appContextPath, stagedCode, 'utf8');

// 5. Stage AppContext.tsx in git index
execSync('git add src/context/AppContext.tsx');

// 6. Restore the full working-tree code (preserving all Phase 1 changes!)
fs.writeFileSync(appContextPath, fullWorkingTreeCode, 'utf8');

console.log('Successfully staged isolated isLoading hunks while preserving all Phase 1 changes in working tree!');
