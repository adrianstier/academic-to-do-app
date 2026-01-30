import { Page, expect } from '@playwright/test';
import { setupTestAuth, TEST_USER, waitForAppReady } from './auth';

/**
 * Generate unique task name to avoid duplicate detection
 */
export function uniqueTaskName(prefix: string = 'Task'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
}

/**
 * Set up test user and navigate to the main app
 * Returns the task input element for convenience
 */
export async function setupAndNavigate(page: Page): Promise<void> {
  await setupTestAuth(page);
  await waitForAppReady(page);

  // Handle welcome modal if present - click "View Tasks" to dismiss
  const viewTasksBtn = page.locator('button').filter({ hasText: 'View Tasks' });
  if (await viewTasksBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await viewTasksBtn.click();
    await page.waitForTimeout(500);
  }

  // Try closing any modal with X button
  const closeBtn = page.locator('button svg.lucide-x').locator('..').first();
  if (await closeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
    await closeBtn.click();
    await page.waitForTimeout(300);
  }

  // Wait for either the task input or handle the team onboarding modal
  // The task input placeholder is "What needs to be done? Describe your task here..."
  const taskInput = page.locator('textarea[placeholder*="What needs to be done"], textarea[placeholder*="Add a task"], textarea[placeholder*="task"]').first();
  const onboardingModal = page.locator('text=Let\'s get you set up');

  // Check if we're on the onboarding modal
  const isOnboarding = await onboardingModal.isVisible({ timeout: 1000 }).catch(() => false);

  if (isOnboarding) {
    // Skip team onboarding for tests - click "Create a New Team" and fill in details
    const createTeamBtn = page.locator('button').filter({ hasText: 'Create a New Team' });
    if (await createTeamBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await createTeamBtn.click();

      // Fill in team name
      await page.locator('input[placeholder*="Smith Research Lab"]').fill('Test Team');

      // Click create team button
      const createBtn = page.locator('button').filter({ hasText: 'Create Team' });
      await createBtn.click();

      // Wait for completion and click Get Started
      const getStartedBtn = page.locator('button').filter({ hasText: 'Get Started' });
      await getStartedBtn.waitFor({ state: 'visible', timeout: 5000 });
      await getStartedBtn.click();
    }
  }

  // Wait for main app to load - look for task view indicators
  const addTaskBtn = page.locator('button').filter({ hasText: /Add Task|New Task/i }).first();
  const newTaskBtn = page.locator('button').filter({ hasText: 'New Task' }).first();

  // Wait for either the task input or add task button to be visible
  try {
    await taskInput.waitFor({ state: 'visible', timeout: 5000 });
  } catch {
    // If task input not visible, click the Add Task button to show it
    if (await addTaskBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await addTaskBtn.click();
      await page.waitForTimeout(500);
    } else if (await newTaskBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await newTaskBtn.click();
      await page.waitForTimeout(500);
    }

    // Now wait for the task input
    await taskInput.waitFor({ state: 'visible', timeout: 10000 });
  }
}

/**
 * Create a task with the given text
 */
export async function createTask(page: Page, taskText: string): Promise<void> {
  // The task input placeholder is "What needs to be done? Describe your task here..."
  const taskInput = page.locator('textarea[placeholder*="What needs to be done"], textarea[placeholder*="Add a task"], textarea[placeholder*="task"]').first();

  // If task input is not visible, click Add Task button to open the modal
  if (!await taskInput.isVisible({ timeout: 1000 }).catch(() => false)) {
    const addTaskBtn = page.locator('button').filter({ hasText: /Add Task|New Task/i }).first();
    if (await addTaskBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await addTaskBtn.click();
      await page.waitForTimeout(500);
    }
  }

  await taskInput.waitFor({ state: 'visible', timeout: 5000 });
  await taskInput.fill(taskText);

  // Click Add button to submit
  const addButton = page.locator('button').filter({ hasText: /^Add$|^\+ Add$/i }).first();
  if (await addButton.isVisible({ timeout: 1000 }).catch(() => false)) {
    await addButton.click();
  } else {
    await taskInput.press('Enter');
  }

  // Wait for task to appear in list
  await page.waitForTimeout(500);
}

/**
 * Find a task by text
 */
export async function findTask(page: Page, taskText: string) {
  return page.locator(`[data-testid="todo-item"], .todo-item, [class*="task"]`).filter({ hasText: taskText }).first();
}

/**
 * Complete a task by clicking its checkbox
 */
export async function completeTask(page: Page, taskText: string): Promise<void> {
  const task = await findTask(page, taskText);
  const checkbox = task.locator('input[type="checkbox"], [role="checkbox"], button[aria-label*="complete"]').first();
  await checkbox.click();
  await page.waitForTimeout(300);
}

/**
 * Delete a task
 */
export async function deleteTask(page: Page, taskText: string): Promise<void> {
  const task = await findTask(page, taskText);

  // Hover to reveal delete button
  await task.hover();

  const deleteBtn = task.locator('button[aria-label*="delete"], button svg.lucide-trash, button:has(svg.lucide-trash-2)').first();
  await deleteBtn.click();

  // Confirm deletion if dialog appears
  const confirmBtn = page.locator('button').filter({ hasText: /^Delete$|^Confirm$/i });
  if (await confirmBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
    await confirmBtn.click();
  }

  await page.waitForTimeout(300);
}

/**
 * Check if Supabase is configured (app showing main interface vs config error)
 */
export async function isSupabaseConfigured(page: Page): Promise<boolean> {
  const taskInput = page.locator('textarea[placeholder*="Add a task"]');
  const configRequired = page.locator('text=Configuration Required');

  await page.waitForTimeout(1000);

  if (await configRequired.isVisible().catch(() => false)) {
    return false;
  }

  if (await taskInput.isVisible().catch(() => false)) {
    return true;
  }

  return false;
}

/**
 * Navigate to a specific view (tasks, dashboard, archive, etc.)
 */
export async function navigateToView(page: Page, view: 'tasks' | 'dashboard' | 'archive' | 'chat'): Promise<void> {
  const viewSelectors: Record<string, string> = {
    tasks: 'button[aria-label*="tasks"], a[href*="tasks"], [data-view="tasks"]',
    dashboard: 'button[aria-label*="dashboard"], a[href*="dashboard"], [data-view="dashboard"]',
    archive: 'button[aria-label*="archive"], a[href*="archive"], [data-view="archive"]',
    chat: 'button[aria-label*="chat"], a[href*="chat"], [data-view="chat"]',
  };

  const selector = viewSelectors[view];
  const navButton = page.locator(selector).first();

  if (await navButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    await navButton.click();
    await page.waitForTimeout(500);
  }
}

/**
 * Close any modal that might be open
 */
export async function closeModal(page: Page): Promise<void> {
  const closeButtons = [
    page.locator('button[aria-label*="close"], button[aria-label*="Close"]'),
    page.locator('button svg.lucide-x').locator('..'),
    page.locator('[role="dialog"] button').filter({ hasText: /close|cancel|dismiss/i }),
  ];

  for (const closeBtn of closeButtons) {
    if (await closeBtn.first().isVisible({ timeout: 500 }).catch(() => false)) {
      await closeBtn.first().click();
      await page.waitForTimeout(300);
      return;
    }
  }

  // Try pressing Escape as fallback
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
}

/**
 * Wait for any loading indicators to disappear
 */
export async function waitForLoading(page: Page): Promise<void> {
  const loaders = page.locator('.animate-spin, [class*="loading"], [class*="spinner"]');

  try {
    await loaders.first().waitFor({ state: 'hidden', timeout: 10000 });
  } catch {
    // No loader found or already hidden
  }
}

/**
 * Get the test user info
 */
export function getTestUser() {
  return TEST_USER;
}
