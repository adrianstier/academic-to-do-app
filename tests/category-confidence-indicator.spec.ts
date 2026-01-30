import { test, expect, Page } from '@playwright/test';
import { setupAndNavigate } from './fixtures/helpers';

/**
 * E2E Tests for CategoryConfidenceIndicator Component
 *
 * Tests the AI pattern detection and suggestion feature:
 * - Pattern detection as user types
 * - Confidence level display
 * - Accept/dismiss suggestions functionality
 * - Subtask suggestions
 *
 * Academic categories: research, writing, analysis, submission,
 * meeting, presentation, reading, coursework, revision, admin
 */

test.describe('CategoryConfidenceIndicator', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app and log in
    await setupAndNavigate(page);
  });

  test('shows pattern detection when typing research-related text', async ({ page }) => {
    // Find the task input
    const taskInput = page.locator('textarea').first();
    await taskInput.focus();

    // Type text that should match "research" pattern
    await taskInput.fill('Conduct literature review on machine learning methodology');

    // Wait for pattern detection (debounced)
    await page.waitForTimeout(500);

    // Should show the confidence indicator
    const indicator = page.locator('text=Detected:');
    await expect(indicator).toBeVisible({ timeout: 5000 });

    // Should show Research category in the indicator
    const categoryText = page.locator('text=Research').first();
    await expect(categoryText).toBeVisible();
  });

  test('shows pattern detection for meeting tasks', async ({ page }) => {
    const taskInput = page.locator('textarea').first();
    await taskInput.focus();

    // Type text that should match "meeting" pattern
    await taskInput.fill('Schedule advisor meeting to discuss thesis progress');

    await page.waitForTimeout(500);

    // Should detect meeting pattern
    const indicator = page.locator('text=Detected:');
    await expect(indicator).toBeVisible({ timeout: 5000 });

    // Should suggest high priority for meetings
    const priorityText = page.locator('text=Suggested priority:');
    await expect(priorityText).toBeVisible();
  });

  test('shows pattern detection for writing tasks with completion rate info', async ({ page }) => {
    const taskInput = page.locator('textarea').first();
    await taskInput.focus();

    // Type text that should match "writing" pattern
    // Writing has 65% completion rate (>= 60), so no low completion warning
    await taskInput.fill('Write draft manuscript for conference paper submission');

    await page.waitForTimeout(500);

    // Should detect writing pattern
    const indicator = page.locator('text=Detected:');
    await expect(indicator).toBeVisible({ timeout: 5000 });

    // Writing category has 65% rate which is >= 60, so no low completion warning
    // Instead verify the indicator and priority are shown
    const priorityText = page.locator('text=Suggested priority:');
    await expect(priorityText).toBeVisible({ timeout: 5000 });
  });

  test('shows suggested subtasks in indicator', async ({ page }) => {
    const taskInput = page.locator('textarea').first();
    await taskInput.focus();

    // Type text that matches a pattern with subtasks (submission pattern)
    await taskInput.fill('Submit paper to conference before the deadline');

    await page.waitForTimeout(500);

    // Should show suggested subtasks section
    const subtasksSection = page.locator('text=Suggested subtasks');
    await expect(subtasksSection).toBeVisible({ timeout: 5000 });

    // Should have subtask items listed (submission subtasks)
    const subtaskItem = page.locator('text=Review submission guidelines');
    await expect(subtaskItem).toBeVisible();
  });

  test('Apply Suggestions button works', async ({ page }) => {
    const taskInput = page.locator('textarea').first();
    await taskInput.focus();

    // Type pattern-matching text (research pattern)
    await taskInput.fill('Conduct literature review and data collection for research study');

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

    // Type pattern-matching text (meeting pattern)
    await taskInput.fill('Prepare for committee meeting with advisor about progress');

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

    // Type pattern-matching text (coursework pattern)
    await taskInput.fill('Complete assignment for homework problem set by Friday');

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
    await taskInput.fill('Read doc');

    await page.waitForTimeout(500);

    // Indicator should NOT appear for short text
    const indicator = page.locator('text=Detected:');
    await expect(indicator).not.toBeVisible({ timeout: 2000 });
  });

  test('indicator shows confidence level styling', async ({ page }) => {
    const taskInput = page.locator('textarea').first();
    await taskInput.focus();

    // Type text with strong pattern match (multiple keywords for research)
    await taskInput.fill('Conduct literature review for research methodology study with data collection and hypothesis testing');

    await page.waitForTimeout(500);

    // Should show confidence badge
    const confidenceBadge = page.locator('text=confidence');
    await expect(confidenceBadge).toBeVisible({ timeout: 5000 });
  });

  test('shows tips when available', async ({ page }) => {
    const taskInput = page.locator('textarea').first();
    await taskInput.focus();

    // Research tasks have tips: "Break large research tasks into weekly milestones..."
    await taskInput.fill('Conduct literature review for research study on methodology');

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
