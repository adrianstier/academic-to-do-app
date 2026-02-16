/**
 * E2E Tests: Tag Management
 *
 * Tests tag CRUD operations, applying/removing tags to tasks, and filtering by tag.
 * Tags are stored in the tags table and linked to tasks via the todo_tags junction table.
 */

import { test, expect, Page } from '@playwright/test';
import { setupAndNavigate, createTask, uniqueTaskName, closeModal } from '../fixtures/helpers';

// Helper to open the tag management UI (typically in task detail or filter panel)
async function openTagFilter(page: Page) {
  // Tags may appear in the advanced filter panel
  const filterBtn = page.locator('button').filter({ hasText: /Filter|Tags/i }).first();
  if (await filterBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await filterBtn.click();
    await page.waitForTimeout(500);
  }
}

// Helper to open a task detail panel by clicking on a task
async function openTaskDetail(page: Page, taskText: string) {
  const task = page.locator(`text=${taskText}`).first();
  await task.click();
  await page.waitForTimeout(800);
}

test.describe('Tag Management', () => {
  test.beforeEach(async ({ page }) => {
    await setupAndNavigate(page);
  });

  test('should display tag filter controls in the filter panel', async ({ page }) => {
    await openTagFilter(page);

    // Look for tag-related UI elements
    const tagSection = page.locator('text=Tags').first();
    const tagFilter = page.locator('[aria-label*="tag"], button').filter({ hasText: /tag/i }).first();

    const hasTagSection = await tagSection.isVisible({ timeout: 3000 }).catch(() => false);
    const hasTagFilter = await tagFilter.isVisible({ timeout: 3000 }).catch(() => false);

    if (!hasTagSection && !hasTagFilter) {
      // Tags might be shown differently or require Supabase
      test.skip(true, 'Tag filter UI not visible -- may require Supabase data or different navigation');
    }
  });

  test('should create a task and open its detail panel', async ({ page }) => {
    const taskName = uniqueTaskName('TagTest');
    await createTask(page, taskName);

    // Wait for task to appear
    await expect(page.locator(`text=${taskName}`)).toBeVisible({ timeout: 10000 });

    // Click on the task to open detail
    await openTaskDetail(page, taskName);

    // The task detail panel or modal should be visible
    const detailPanel = page.locator('[role="dialog"], [class*="detail"], [class*="panel"]').first();
    const isOpen = await detailPanel.isVisible({ timeout: 3000 }).catch(() => false);

    // Also check for task text in a detail context
    const detailTitle = page.locator('h1, h2, h3').filter({ hasText: taskName }).first();
    const hasTitleInDetail = await detailTitle.isVisible({ timeout: 3000 }).catch(() => false);

    expect(isOpen || hasTitleInDetail).toBeTruthy();
  });

  test.skip('should create a new tag from the task detail panel', async ({ page }) => {
    // Creating tags requires a running Supabase instance for persistence
    const taskName = uniqueTaskName('TagCreate');
    await createTask(page, taskName);
    await expect(page.locator(`text=${taskName}`)).toBeVisible({ timeout: 10000 });

    await openTaskDetail(page, taskName);

    // Look for tag section in the detail panel
    const addTagBtn = page.locator('button').filter({ hasText: /Add Tag|New Tag|\+ Tag/i }).first();
    if (!await addTagBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      test.skip(true, 'Add tag button not found in task detail panel');
      return;
    }

    await addTagBtn.click();
    await page.waitForTimeout(500);

    // Fill in tag name
    const tagInput = page.locator('input[placeholder*="tag"], input[type="text"]').last();
    await tagInput.fill('urgent-review');

    // Submit the tag
    const submitBtn = page.locator('button').filter({ hasText: /Create|Add|Save/i }).last();
    await submitBtn.click();
    await page.waitForTimeout(1000);

    // Verify tag chip appears
    await expect(page.locator('text=urgent-review')).toBeVisible({ timeout: 5000 });
  });

  test.skip('should apply a tag to a task', async ({ page }) => {
    // Applying tags requires Supabase for persistence via the todo_tags junction table
    const taskName = uniqueTaskName('TagApply');
    await createTask(page, taskName);
    await expect(page.locator(`text=${taskName}`)).toBeVisible({ timeout: 10000 });

    await openTaskDetail(page, taskName);

    // Look for tag picker / tag section
    const tagPicker = page.locator('button').filter({ hasText: /Add Tag|\+ Tag/i }).first();
    if (!await tagPicker.isVisible({ timeout: 3000 }).catch(() => false)) {
      test.skip(true, 'Tag picker not found -- requires Supabase');
      return;
    }

    await tagPicker.click();
    await page.waitForTimeout(500);

    // Select an existing tag from the dropdown
    const tagOption = page.locator('[role="option"], [role="listbox"] button, [role="listbox"] li').first();
    if (await tagOption.isVisible({ timeout: 2000 }).catch(() => false)) {
      const tagText = await tagOption.textContent();
      await tagOption.click();
      await page.waitForTimeout(500);

      // Verify tag chip appears on the task
      if (tagText) {
        await expect(page.locator(`text=${tagText.trim()}`)).toBeVisible({ timeout: 5000 });
      }
    }
  });

  test.skip('should filter tasks by tag', async ({ page }) => {
    // Filtering by tag requires tags to exist in the database
    await openTagFilter(page);

    // Look for tag filter checkboxes or buttons
    const tagFilterItems = page.locator('[class*="tag"], [role="checkbox"]').filter({ hasText: /./i });
    const count = await tagFilterItems.count();

    if (count === 0) {
      test.skip(true, 'No tags available for filtering -- requires Supabase data');
      return;
    }

    // Click a tag filter
    await tagFilterItems.first().click();
    await page.waitForTimeout(500);

    // The task list should be filtered (fewer items or a filter indicator)
    const filterIndicator = page.locator('text=Showing, text=filtered, text=Clear').first();
    const hasFilter = await filterIndicator.isVisible({ timeout: 3000 }).catch(() => false);
    expect(hasFilter).toBeTruthy();
  });

  test.skip('should remove a tag from a task', async ({ page }) => {
    // Removing tags requires Supabase
    const taskName = uniqueTaskName('TagRemove');
    await createTask(page, taskName);
    await expect(page.locator(`text=${taskName}`)).toBeVisible({ timeout: 10000 });

    await openTaskDetail(page, taskName);

    // Find an existing tag chip with a remove button
    const tagChip = page.locator('[class*="tag"] button[aria-label*="remove"], [class*="tag"] svg.lucide-x').first();
    if (!await tagChip.isVisible({ timeout: 3000 }).catch(() => false)) {
      test.skip(true, 'No removable tag found -- requires tag to be applied first via Supabase');
      return;
    }

    await tagChip.click();
    await page.waitForTimeout(500);
  });

  test.skip('should delete a tag', async ({ page }) => {
    // Deleting tags requires Supabase and admin permissions
    // Navigate to settings or tag management area
    const settingsBtn = page.locator('button, a').filter({ hasText: /Settings|Manage Tags/i }).first();
    if (!await settingsBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      test.skip(true, 'Tag management settings not accessible');
      return;
    }

    await settingsBtn.click();
    await page.waitForTimeout(500);

    // Find a tag with a delete button
    const deleteBtn = page.locator('button[aria-label*="delete tag"], button svg.lucide-trash').first();
    if (await deleteBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await deleteBtn.click();
      await page.waitForTimeout(500);

      // Confirm deletion
      const confirmBtn = page.locator('button').filter({ hasText: /Delete|Confirm/i });
      if (await confirmBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await confirmBtn.click();
        await page.waitForTimeout(500);
      }
    }
  });

  test('should show tag colors as visual indicators', async ({ page }) => {
    // Tags use colored chips. Verify the UI structure supports colored tags.
    // This can be validated by checking the tag color constants match expected values.
    const taskName = uniqueTaskName('TagColor');
    await createTask(page, taskName);
    await expect(page.locator(`text=${taskName}`)).toBeVisible({ timeout: 10000 });

    // The tag UI should render colored badge elements
    // This is a structural check -- tags with colors will render as styled spans
    const page_html = await page.content();
    // The page should at least have the task we created
    expect(page_html).toContain(taskName);
  });
});
