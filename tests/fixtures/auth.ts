import { Page, BrowserContext } from '@playwright/test';

/**
 * Test user configuration
 * This user is used for E2E testing via test mode bypass
 */
export const TEST_USER = {
  id: 'test-user-id-12345',
  name: 'Test User',
  color: '#4F46E5',
  role: 'owner' as const,
  created_at: new Date().toISOString(),
  last_login: new Date().toISOString(),
};

/**
 * Storage keys used by the app
 */
const SESSION_KEY = 'todoSession';
const TEAM_KEY = 'academic-current-team';
const TEST_MODE_KEY = '__test_mode__';
const TEST_USER_KEY = '__test_user__';

/**
 * Mock session data structure
 */
interface MockSession {
  userId: string;
  userName: string;
  loginAt: string;
}

/**
 * Set up authentication by injecting test mode and user data into localStorage
 * This uses the test mode bypass built into the app
 */
export async function setupTestAuth(page: Page): Promise<void> {
  const session: MockSession = {
    userId: TEST_USER.id,
    userName: TEST_USER.name,
    loginAt: new Date().toISOString(),
  };

  // Navigate to the page first to establish the origin
  await page.goto('/');

  // Wait for page to start loading
  await page.waitForLoadState('domcontentloaded');

  // Inject test mode and user into localStorage
  await page.evaluate(({ testModeKey, testUserKey, testUser, sessionKey, session, teamKey }) => {
    // Set test mode flag
    localStorage.setItem(testModeKey, 'true');
    // Set test user data (full user object for test mode bypass)
    localStorage.setItem(testUserKey, JSON.stringify(testUser));
    // Also set legacy session for backward compatibility
    localStorage.setItem(sessionKey, JSON.stringify(session));
    // Set a mock team ID to skip team onboarding
    localStorage.setItem(teamKey, 'test-team-id-12345');
    // Disable multi-tenancy for E2E tests to avoid database dependencies
    localStorage.setItem('__disable_multi_tenancy__', 'true');
  }, {
    testModeKey: TEST_MODE_KEY,
    testUserKey: TEST_USER_KEY,
    testUser: TEST_USER,
    sessionKey: SESSION_KEY,
    session,
    teamKey: TEAM_KEY,
  });

  // Reload to pick up the test mode session
  await page.reload();

  // Wait for the app to fully load (don't use networkidle - real-time subscriptions keep network active)
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000);
}

/**
 * Clear authentication state
 */
export async function clearTestAuth(page: Page): Promise<void> {
  await page.evaluate(({ sessionKey, teamKey }) => {
    localStorage.removeItem(sessionKey);
    localStorage.removeItem(teamKey);
    localStorage.removeItem('todoUserName');
    localStorage.removeItem('userName');
  }, { sessionKey: SESSION_KEY, teamKey: TEAM_KEY });
}

/**
 * Set up authentication using storage state (for faster subsequent tests)
 */
export async function setupAuthState(context: BrowserContext): Promise<void> {
  await context.addInitScript(({ sessionKey, session, teamKey }) => {
    localStorage.setItem(sessionKey, JSON.stringify(session));
    localStorage.setItem(teamKey, 'test-team-id-12345');
  }, {
    sessionKey: SESSION_KEY,
    session: {
      userId: TEST_USER.id,
      userName: TEST_USER.name,
      loginAt: new Date().toISOString(),
    },
    teamKey: TEAM_KEY,
  });
}

/**
 * Check if user is logged in by looking for main app elements
 */
export async function isLoggedIn(page: Page): Promise<boolean> {
  // Look for the task input field which is only visible when logged in
  const taskInput = page.locator('textarea[placeholder*="Add a task"], textarea[placeholder*="task"]').first();
  try {
    await taskInput.waitFor({ state: 'visible', timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Wait for the main app to be fully loaded
 */
export async function waitForAppReady(page: Page): Promise<void> {
  // Wait for either the main app or login screen
  const mainApp = page.locator('textarea[placeholder*="Add a task"], textarea[placeholder*="task"]').first();
  const loginScreen = page.locator('text=Sign in with Google, text=Welcome back').first();

  await Promise.race([
    mainApp.waitFor({ state: 'visible', timeout: 15000 }),
    loginScreen.waitFor({ state: 'visible', timeout: 15000 }),
  ]).catch(() => {
    // Neither appeared, might be loading
  });
}

/**
 * Navigate to main app and ensure authenticated
 */
export async function navigateToApp(page: Page): Promise<void> {
  await setupTestAuth(page);
  await waitForAppReady(page);
}
