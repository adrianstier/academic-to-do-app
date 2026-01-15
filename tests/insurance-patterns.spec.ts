import { test, expect, Page } from '@playwright/test';

/**
 * E2E Tests for Insurance Patterns Module
 *
 * Tests the pattern matching and categorization logic through the UI.
 * The analyzeTaskPattern function runs client-side when user types.
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

test.describe('Insurance Patterns - Pattern Detection via UI', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsExistingUser(page);
  });

  test('detects policy review patterns when typing', async ({ page }) => {
    const taskInput = page.locator('textarea').first();
    await taskInput.focus();

    // Type text with policy review keywords
    await taskInput.fill('Review policy coverage for customer renewal');
    await page.waitForTimeout(500);

    // Should detect and show indicator
    const indicator = page.locator('text=Detected:');
    await expect(indicator).toBeVisible({ timeout: 5000 });

    // Should show Policy Review category in indicator
    const category = page.locator('text=Policy Review').first();
    await expect(category).toBeVisible();
  });

  test('detects follow-up patterns when typing', async ({ page }) => {
    const taskInput = page.locator('textarea').first();
    await taskInput.focus();

    await taskInput.fill('Call back John about his voicemail');
    await page.waitForTimeout(500);

    const indicator = page.locator('text=Detected:');
    await expect(indicator).toBeVisible({ timeout: 5000 });

    // Follow-up detected
    const category = page.locator('text=Follow Up').first();
    await expect(category).toBeVisible();
  });

  test('detects vehicle patterns when typing', async ({ page }) => {
    const taskInput = page.locator('textarea').first();
    await taskInput.focus();

    await taskInput.fill('Add new car to policy VIN verification');
    await page.waitForTimeout(500);

    const indicator = page.locator('text=Detected:');
    await expect(indicator).toBeVisible({ timeout: 5000 });

    // Vehicle Add detected
    const category = page.locator('text=Vehicle Add');
    await expect(category).toBeVisible();
  });

  test('detects payment patterns when typing', async ({ page }) => {
    const taskInput = page.locator('textarea').first();
    await taskInput.focus();

    await taskInput.fill('Process payment for overdue billing');
    await page.waitForTimeout(500);

    const indicator = page.locator('text=Detected:');
    await expect(indicator).toBeVisible({ timeout: 5000 });

    // Should suggest high priority
    const priorityText = page.locator('text=Suggested priority:');
    await expect(priorityText).toBeVisible();
  });

  test('detects claim patterns with urgent priority', async ({ page }) => {
    const taskInput = page.locator('textarea').first();
    await taskInput.focus();

    await taskInput.fill('File accident claim for customer collision');
    await page.waitForTimeout(500);

    const indicator = page.locator('text=Detected:');
    await expect(indicator).toBeVisible({ timeout: 5000 });

    // Claim detected
    const category = page.locator('text=Claim').first();
    await expect(category).toBeVisible();

    // Should show urgent priority suggestion
    const urgentText = page.locator('text=urgent').first();
    await expect(urgentText).toBeVisible();
  });

  test('detects quote patterns when typing', async ({ page }) => {
    const taskInput = page.locator('textarea').first();
    await taskInput.focus();

    await taskInput.fill('Prepare quote proposal for new customer');
    await page.waitForTimeout(500);

    const indicator = page.locator('text=Detected:');
    await expect(indicator).toBeVisible({ timeout: 5000 });

    // Quote detected
    const category = page.locator('text=Quote').first();
    await expect(category).toBeVisible();
  });

  test('no detection for non-matching short text', async ({ page }) => {
    const taskInput = page.locator('textarea').first();
    await taskInput.focus();

    // Short text (under 10 chars) should not trigger detection
    await taskInput.fill('random');
    await page.waitForTimeout(500);

    const indicator = page.locator('text=Detected:');
    await expect(indicator).not.toBeVisible({ timeout: 2000 });
  });

  test('shows suggested subtasks for detected patterns', async ({ page }) => {
    const taskInput = page.locator('textarea').first();
    await taskInput.focus();

    await taskInput.fill('Process policy renewal for coverage review');
    await page.waitForTimeout(500);

    const subtasksSection = page.locator('text=Suggested subtasks');
    await expect(subtasksSection).toBeVisible({ timeout: 5000 });
  });

  test('accepts suggestions and populates form', async ({ page }) => {
    const taskInput = page.locator('textarea').first();
    await taskInput.focus();

    await taskInput.fill('New client onboarding for customer');
    await page.waitForTimeout(500);

    // Wait for indicator
    await page.waitForSelector('text=Detected:', { timeout: 5000 });

    // Click Apply Suggestions
    const applyButton = page.locator('button:has-text("Apply Suggestions")');
    await applyButton.click();

    // Indicator should disappear
    await expect(page.locator('text=Detected:')).not.toBeVisible({ timeout: 3000 });

    // Subtasks should now be in the form
    const formSubtasks = page.locator('text=Suggested Subtasks');
    await expect(formSubtasks).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Completion Rate Badges Logic', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsExistingUser(page);
  });

  test('payment category shows high completion badge', async ({ page }) => {
    // Find Payment template button and verify it has the 💯 badge
    await page.waitForSelector('text=Quick Add', { timeout: 10000 });

    // Expand templates
    const showMore = page.locator('button:has-text("more")');
    if (await showMore.isVisible({ timeout: 2000 }).catch(() => false)) {
      await showMore.click();
      await page.waitForTimeout(500);
    }

    // Look for Payment template with badge
    const paymentWithBadge = page.locator('.grid button').filter({ hasText: /Payment/i }).locator('text=💯');
    // Payment has 100% completion rate, should have 💯 badge
    await expect(paymentWithBadge).toBeVisible({ timeout: 5000 });
  });

  test('quote category shows warning badge', async ({ page }) => {
    await page.waitForSelector('text=Quick Add', { timeout: 10000 });

    // Expand templates
    const showMore = page.locator('button:has-text("more")');
    if (await showMore.isVisible({ timeout: 2000 }).catch(() => false)) {
      await showMore.click();
      await page.waitForTimeout(500);
    }

    // Look for Quote template with warning badge
    const quoteWithBadge = page.locator('.grid button').filter({ hasText: /Quote/i }).locator('text=⚠️');
    // Quote has 50% completion rate, should have ⚠️ badge
    await expect(quoteWithBadge).toBeVisible({ timeout: 5000 });
  });
});
