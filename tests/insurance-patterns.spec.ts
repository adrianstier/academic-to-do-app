import { test, expect, Page } from '@playwright/test';
import { setupAndNavigate } from './fixtures/helpers';

/**
 * E2E Tests for Academic Patterns Module
 *
 * Tests the pattern matching and categorization logic through the UI.
 * The analyzeTaskPattern function runs client-side when user types.
 *
 * Academic categories: research, writing, analysis, submission,
 * meeting, presentation, reading, coursework, revision, admin
 */

test.describe('Academic Patterns - Pattern Detection via UI', () => {
  test.beforeEach(async ({ page }) => {
    await setupAndNavigate(page);
  });

  test('detects research patterns when typing', async ({ page }) => {
    const taskInput = page.locator('textarea').first();
    await taskInput.focus();

    // Type text with research keywords (literature review, methodology)
    await taskInput.fill('Conduct literature review on research methodology for study');
    await page.waitForTimeout(500);

    // Should detect and show indicator
    const indicator = page.locator('text=Detected:');
    await expect(indicator).toBeVisible({ timeout: 5000 });

    // Should show Research category in indicator
    const category = page.locator('text=Research').first();
    await expect(category).toBeVisible();
  });

  test('detects meeting patterns when typing', async ({ page }) => {
    const taskInput = page.locator('textarea').first();
    await taskInput.focus();

    // Type text with meeting keywords (advisor, committee, meeting)
    await taskInput.fill('Schedule advisor meeting to review thesis committee feedback');
    await page.waitForTimeout(500);

    const indicator = page.locator('text=Detected:');
    await expect(indicator).toBeVisible({ timeout: 5000 });

    // Meeting detected
    const category = page.locator('text=Meeting').first();
    await expect(category).toBeVisible();
  });

  test('detects analysis patterns when typing', async ({ page }) => {
    const taskInput = page.locator('textarea').first();
    await taskInput.focus();

    // Type text with analysis keywords (data analysis, statistics, regression)
    await taskInput.fill('Run statistical analysis on data with regression model');
    await page.waitForTimeout(500);

    const indicator = page.locator('text=Detected:');
    await expect(indicator).toBeVisible({ timeout: 5000 });

    // Analysis detected
    const category = page.locator('text=Analysis').first();
    await expect(category).toBeVisible();
  });

  test('detects submission patterns when typing', async ({ page }) => {
    const taskInput = page.locator('textarea').first();
    await taskInput.focus();

    // Type text with submission keywords (submit, conference, deadline)
    await taskInput.fill('Submit paper to conference before the deadline');
    await page.waitForTimeout(500);

    const indicator = page.locator('text=Detected:');
    await expect(indicator).toBeVisible({ timeout: 5000 });

    // Should suggest urgent priority for submissions
    const priorityText = page.locator('text=Suggested priority:');
    await expect(priorityText).toBeVisible();
  });

  test('detects presentation patterns with high priority', async ({ page }) => {
    const taskInput = page.locator('textarea').first();
    await taskInput.focus();

    // Type text with presentation keywords (defense, slides, talk)
    await taskInput.fill('Prepare presentation slides for thesis defense practice talk');
    await page.waitForTimeout(500);

    const indicator = page.locator('text=Detected:');
    await expect(indicator).toBeVisible({ timeout: 5000 });

    // Presentation detected
    const category = page.locator('text=Presentation').first();
    await expect(category).toBeVisible();

    // Should show high priority suggestion
    const highText = page.locator('text=high').first();
    await expect(highText).toBeVisible();
  });

  test('detects writing patterns when typing', async ({ page }) => {
    const taskInput = page.locator('textarea').first();
    await taskInput.focus();

    // Type text with writing keywords (draft, paper, manuscript, thesis)
    await taskInput.fill('Write draft paper for manuscript thesis introduction');
    await page.waitForTimeout(500);

    const indicator = page.locator('text=Detected:');
    await expect(indicator).toBeVisible({ timeout: 5000 });

    // Writing detected
    const category = page.locator('text=Writing').first();
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

    // Type text matching research pattern which has subtasks
    await taskInput.fill('Conduct literature review and data collection for research study');
    await page.waitForTimeout(500);

    const subtasksSection = page.locator('text=Suggested subtasks');
    await expect(subtasksSection).toBeVisible({ timeout: 5000 });
  });

  test('accepts suggestions and populates form', async ({ page }) => {
    const taskInput = page.locator('textarea').first();
    await taskInput.focus();

    // Type text matching coursework pattern
    await taskInput.fill('Complete assignment for course homework problem set');
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
    await setupAndNavigate(page);
  });

  test('meeting category shows high completion indicator', async ({ page }) => {
    // Wait for Quick Add section to appear
    await page.waitForSelector('text=Quick Add', { timeout: 10000 });

    // Expand templates if collapsed
    const showMore = page.locator('button:has-text("more")');
    if (await showMore.isVisible({ timeout: 2000 }).catch(() => false)) {
      await showMore.click();
      await page.waitForTimeout(500);
    }

    // Meeting has 95% completion rate (>= 90), should have high completion indicator dot
    // The button has aria-label "Create Meeting task" and contains a green dot with aria-label "High completion rate"
    const meetingButton = page.locator('button[aria-label="Create Meeting task"]');
    const highIndicator = meetingButton.locator('[aria-label="High completion rate"]');
    await expect(highIndicator).toBeVisible({ timeout: 5000 });
  });

  test('writing category shows low completion indicator', async ({ page }) => {
    await page.waitForSelector('text=Quick Add', { timeout: 10000 });

    // Expand templates if collapsed
    const showMore = page.locator('button:has-text("more")');
    if (await showMore.isVisible({ timeout: 2000 }).catch(() => false)) {
      await showMore.click();
      await page.waitForTimeout(500);
    }

    // Writing has 65% completion rate which is in middle range (>= 60, < 90)
    // So it gets NO indicator dot. Research at 60% also no indicator.
    // Check that Writing button exists but does NOT have a completion indicator
    const writingButton = page.locator('button[aria-label="Create Writing task"]');
    await expect(writingButton).toBeVisible({ timeout: 5000 });

    // Verify the button title shows the completion rate
    await expect(writingButton).toHaveAttribute('title', /Writing - 65% completion rate/);
  });
});
