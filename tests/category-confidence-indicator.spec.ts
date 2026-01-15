import { test, expect, Page } from '@playwright/test';

/**
 * E2E Tests for CategoryConfidenceIndicator Component
 *
 * Tests the AI pattern detection and suggestion feature:
 * - Pattern detection as user types
 * - Confidence level display
 * - Accept/dismiss suggestions functionality
 * - Subtask suggestions
 */

// Helper to login with an existing user by selecting them and entering PIN
async function loginAsExistingUser(page: Page, userName: string = 'Derrick', pin: string = '8008') {
  await page.goto('/');

  // Wait for login screen - look for "Welcome back" text which is always visible
  const welcomeText = page.locator('text=Welcome back').first();
  await expect(welcomeText).toBeVisible({ timeout: 15000 });

  // Wait for users list to load
  await page.waitForTimeout(1000);

  // Click on the user card to select them
  const userCard = page.locator('button').filter({ hasText: userName }).first();
  await expect(userCard).toBeVisible({ timeout: 10000 });
  await userCard.click();

  // Wait for PIN entry screen
  await page.waitForTimeout(500);

  // Enter PIN - look for 4 password inputs
  const pinInputs = page.locator('input[type="password"]');
  await expect(pinInputs.first()).toBeVisible({ timeout: 5000 });

  // Enter each digit of the PIN
  for (let i = 0; i < 4; i++) {
    await pinInputs.nth(i).fill(pin[i]);
    await page.waitForTimeout(100); // Small delay between digits
  }

  // Wait for automatic login after PIN entry
  await page.waitForTimeout(2000);

  // Close welcome modal if present (click outside, X button, or View Tasks button)
  const viewTasksBtn = page.locator('button').filter({ hasText: 'View Tasks' });
  const closeModalBtn = page.locator('button[aria-label*="close"]').or(page.locator('button svg.lucide-x').locator('..'));

  // Try clicking View Tasks first (most reliable)
  if (await viewTasksBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await viewTasksBtn.click();
    await page.waitForTimeout(500);
  }
  // Or try clicking the close button
  else if (await closeModalBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
    await closeModalBtn.click();
    await page.waitForTimeout(500);
  }

  // Wait for main app to load - use correct placeholder text
  const todoInput = page.locator('textarea[placeholder*="Add a task"]')
    .or(page.locator('textarea[placeholder*="task"]').first());
  await expect(todoInput).toBeVisible({ timeout: 15000 });

  return todoInput;
}

test.describe('CategoryConfidenceIndicator', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app and log in
    await loginAsExistingUser(page);
  });

  test('shows pattern detection when typing policy-related text', async ({ page }) => {
    // Find the task input
    const taskInput = page.locator('textarea').first();
    await taskInput.focus();

    // Type text that should match "policy_review" pattern
    await taskInput.fill('Review policy coverage for John Smith renewal');

    // Wait for pattern detection (debounced)
    await page.waitForTimeout(500);

    // Should show the confidence indicator
    const indicator = page.locator('text=Detected:');
    await expect(indicator).toBeVisible({ timeout: 5000 });

    // Should show Policy Review category in the indicator
    const categoryText = page.locator('.text-amber-600, .dark\\:text-amber-400').filter({ hasText: 'Policy Review' }).first();
    await expect(categoryText).toBeVisible();
  });

  test('shows pattern detection for follow-up tasks', async ({ page }) => {
    const taskInput = page.locator('textarea').first();
    await taskInput.focus();

    // Type text that should match "follow_up" pattern
    await taskInput.fill('Call back customer about their policy questions');

    await page.waitForTimeout(500);

    // Should detect follow-up pattern
    const indicator = page.locator('text=Detected:');
    await expect(indicator).toBeVisible({ timeout: 5000 });

    // Should suggest high priority for follow-ups
    const priorityText = page.locator('text=Suggested priority:');
    await expect(priorityText).toBeVisible();
  });

  test('shows pattern detection for quote tasks with low completion warning', async ({ page }) => {
    const taskInput = page.locator('textarea').first();
    await taskInput.focus();

    // Type text that should match "quote" pattern
    await taskInput.fill('Get new quote proposal for business insurance client');

    await page.waitForTimeout(500);

    // Should detect quote pattern
    const indicator = page.locator('text=Detected:');
    await expect(indicator).toBeVisible({ timeout: 5000 });

    // Quote has low completion rate, should show warning
    const lowCompletionWarning = page.locator('text=completion rate').first();
    await expect(lowCompletionWarning).toBeVisible({ timeout: 5000 });
  });

  test('shows suggested subtasks in indicator', async ({ page }) => {
    const taskInput = page.locator('textarea').first();
    await taskInput.focus();

    // Type text that matches a pattern with subtasks
    await taskInput.fill('Process claim for auto accident customer');

    await page.waitForTimeout(500);

    // Should show suggested subtasks section
    const subtasksSection = page.locator('text=Suggested subtasks');
    await expect(subtasksSection).toBeVisible({ timeout: 5000 });

    // Should have subtask items listed
    const subtaskItem = page.locator('text=File claim');
    await expect(subtaskItem).toBeVisible();
  });

  test('Apply Suggestions button works', async ({ page }) => {
    const taskInput = page.locator('textarea').first();
    await taskInput.focus();

    // Type pattern-matching text
    await taskInput.fill('Review customer policy for upcoming renewal');

    await page.waitForTimeout(500);

    // Wait for indicator to appear
    await page.waitForSelector('text=Detected:', { timeout: 5000 });

    // Click Apply Suggestions
    const applyButton = page.locator('button:has-text("Apply Suggestions")');
    await applyButton.click();

    // Indicator should disappear after applying
    const indicator = page.locator('text=Detected:');
    await expect(indicator).not.toBeVisible({ timeout: 3000 });

    // Suggested subtasks should now appear in the form
    const subtasksSection = page.locator('text=Suggested Subtasks');
    await expect(subtasksSection).toBeVisible({ timeout: 5000 });
  });

  test('Ignore button dismisses indicator', async ({ page }) => {
    const taskInput = page.locator('textarea').first();
    await taskInput.focus();

    // Type pattern-matching text
    await taskInput.fill('Call customer back about policy changes');

    await page.waitForTimeout(500);

    // Wait for indicator
    await page.waitForSelector('text=Detected:', { timeout: 5000 });

    // Click Ignore
    const ignoreButton = page.locator('button:has-text("Ignore")');
    await ignoreButton.click();

    // Indicator should disappear
    const indicator = page.locator('text=Detected:');
    await expect(indicator).not.toBeVisible({ timeout: 3000 });
  });

  test('X button dismisses indicator', async ({ page }) => {
    const taskInput = page.locator('textarea').first();
    await taskInput.focus();

    // Type pattern-matching text
    await taskInput.fill('Process payment for customer billing issue');

    await page.waitForTimeout(500);

    // Wait for indicator
    await page.waitForSelector('text=Detected:', { timeout: 5000 });

    // Click X button (dismiss)
    const dismissButton = page.locator('[aria-label="Dismiss suggestion"]');
    await dismissButton.click();

    // Indicator should disappear
    const indicator = page.locator('text=Detected:');
    await expect(indicator).not.toBeVisible({ timeout: 3000 });
  });

  test('indicator does not appear for short text', async ({ page }) => {
    const taskInput = page.locator('textarea').first();
    await taskInput.focus();

    // Type very short text (less than 10 chars)
    await taskInput.fill('Call John');

    await page.waitForTimeout(500);

    // Indicator should NOT appear for short text
    const indicator = page.locator('text=Detected:');
    await expect(indicator).not.toBeVisible({ timeout: 2000 });
  });

  test('indicator shows confidence level styling', async ({ page }) => {
    const taskInput = page.locator('textarea').first();
    await taskInput.focus();

    // Type text with strong pattern match (multiple keywords)
    await taskInput.fill('Policy renewal review and coverage check for customer John Smith');

    await page.waitForTimeout(500);

    // Should show confidence badge
    const confidenceBadge = page.locator('text=confidence');
    await expect(confidenceBadge).toBeVisible({ timeout: 5000 });
  });

  test('shows tips when available', async ({ page }) => {
    const taskInput = page.locator('textarea').first();
    await taskInput.focus();

    // Follow-up tasks have tips
    await taskInput.fill('Follow up with customer about their voicemail regarding policy');

    await page.waitForTimeout(500);

    // Wait for indicator
    await page.waitForSelector('text=Detected:', { timeout: 5000 });

    // Tips icon (lightbulb) should be visible if tips are present
    // The component shows tips with a lightbulb icon
    const tipsSection = page.locator('[class*="text-xs"]').filter({
      has: page.locator('svg'),
    });

    // There should be some tips or info displayed
    expect(await tipsSection.count()).toBeGreaterThan(0);
  });
});
