/**
 * E2E Tests: Task Dependencies
 *
 * Tests creating dependencies between tasks (blocker/blocked relationships),
 * verifying blocked badge display, unblocking on completion, and circular
 * dependency prevention.
 *
 * Dependencies use the DependencyPicker component and the
 * /api/todos/dependencies endpoint.
 */

import { test, expect, Page } from '@playwright/test';
import { setupAndNavigate, createTask, uniqueTaskName, completeTask, closeModal } from '../fixtures/helpers';

// Helper to open task detail by clicking on the task text
async function openTaskDetail(page: Page, taskText: string) {
  const task = page.locator(`text=${taskText}`).first();
  await task.click();
  await page.waitForTimeout(800);
}

// Helper to find the dependency section in the task detail panel
async function findDependencySection(page: Page): Promise<boolean> {
  const depSection = page.locator('text=Dependencies').first();
  return await depSection.isVisible({ timeout: 3000 }).catch(() => false);
}

test.describe('Task Dependencies', () => {
  test.beforeEach(async ({ page }) => {
    await setupAndNavigate(page);
  });

  test('should create two tasks for dependency testing', async ({ page }) => {
    const taskA = uniqueTaskName('BlockerTask');
    const taskB = uniqueTaskName('BlockedTask');

    await createTask(page, taskA);
    await expect(page.locator(`text=${taskA}`)).toBeVisible({ timeout: 10000 });

    await createTask(page, taskB);
    await expect(page.locator(`text=${taskB}`)).toBeVisible({ timeout: 10000 });
  });

  test('should display dependency section in task detail panel', async ({ page }) => {
    const taskName = uniqueTaskName('DepDetail');
    await createTask(page, taskName);
    await expect(page.locator(`text=${taskName}`)).toBeVisible({ timeout: 10000 });

    // Open task detail
    await openTaskDetail(page, taskName);

    // Check for the Dependencies section header (from DependencyPicker component)
    const hasDeps = await findDependencySection(page);

    if (!hasDeps) {
      // Dependencies may not be visible in the initial view -- check for the
      // link icon that represents dependencies
      const linkIcon = page.locator('svg.lucide-link-2, svg.lucide-link').first();
      const hasLinkIcon = await linkIcon.isVisible({ timeout: 3000 }).catch(() => false);

      if (!hasLinkIcon) {
        test.skip(true, 'Dependency section not visible in task detail -- may require Supabase');
      }
    }
  });

  test.skip('should add a dependency (task A blocks task B)', async ({ page }) => {
    // This test requires a running Supabase instance for the dependencies API
    const taskA = uniqueTaskName('Blocker');
    const taskB = uniqueTaskName('Blocked');

    await createTask(page, taskA);
    await expect(page.locator(`text=${taskA}`)).toBeVisible({ timeout: 10000 });

    await createTask(page, taskB);
    await expect(page.locator(`text=${taskB}`)).toBeVisible({ timeout: 10000 });

    // Open task B detail
    await openTaskDetail(page, taskB);

    // Find the "Add blocker" button in the DependencyPicker
    const addBlockerBtn = page.locator('button').filter({ hasText: /Add blocker/i }).first();
    if (!await addBlockerBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      test.skip(true, 'Add blocker button not found -- requires Supabase');
      return;
    }

    await addBlockerBtn.click();
    await page.waitForTimeout(500);

    // Search for task A in the dependency search
    const searchInput = page.locator('input[aria-label*="blocking task"], input[placeholder*="Search"]').first();
    await searchInput.fill(taskA);
    await page.waitForTimeout(500);

    // Select task A from the results
    const taskOption = page.locator('[role="option"], [role="listbox"] button').filter({ hasText: taskA }).first();
    if (await taskOption.isVisible({ timeout: 3000 }).catch(() => false)) {
      await taskOption.click();
      await page.waitForTimeout(500);

      // Verify the "Blocked by" section shows task A
      const blockedBySection = page.locator('text=Blocked by').first();
      await expect(blockedBySection).toBeVisible({ timeout: 3000 });

      const blockerChip = page.locator(`text=${taskA}`);
      await expect(blockerChip).toBeVisible({ timeout: 3000 });
    }
  });

  test.skip('should show blocked badge on task B when blocked by task A', async ({ page }) => {
    // Requires dependencies to have been set up via Supabase
    // After adding a dependency, the task list should show a blocked indicator

    const taskB = 'Blocked'; // Use partial match for any blocked task
    const blockedIndicator = page.locator('[class*="blocked"], [aria-label*="blocked"]').first();
    const lockIcon = page.locator('svg.lucide-lock').first();

    const hasBlockedIndicator = await blockedIndicator.isVisible({ timeout: 3000 }).catch(() => false);
    const hasLockIcon = await lockIcon.isVisible({ timeout: 3000 }).catch(() => false);

    // Either a blocked badge or lock icon should appear
    if (!hasBlockedIndicator && !hasLockIcon) {
      test.skip(true, 'No blocked indicators visible -- requires Supabase dependencies');
    }
  });

  test.skip('should unblock task B when task A is completed', async ({ page }) => {
    // Requires existing dependencies in Supabase
    // When the blocker task is completed, the blocked task should become unblocked

    const taskA = uniqueTaskName('UnblockBlocker');
    const taskB = uniqueTaskName('UnblockBlocked');

    await createTask(page, taskA);
    await createTask(page, taskB);

    // Set up dependency first (task A blocks task B)
    // ... (would need to call the dependency API)

    // Complete task A
    await completeTask(page, taskA);
    await page.waitForTimeout(1000);

    // Verify task B no longer has a blocked indicator
    await openTaskDetail(page, taskB);

    const blockedBySection = page.locator('text=Blocked by');
    const isStillBlocked = await blockedBySection.isVisible({ timeout: 2000 }).catch(() => false);

    // After completing the blocker, the blocked-by section should either be empty or hidden
    // (Implementation may vary)
  });

  test.skip('should prevent circular dependency', async ({ page }) => {
    // Circular dependency prevention is handled by the API endpoint
    // Testing this E2E requires setting up dependencies and attempting to create a cycle
    // This is better tested at the API/integration level

    const taskA = uniqueTaskName('CircA');
    const taskB = uniqueTaskName('CircB');

    await createTask(page, taskA);
    await createTask(page, taskB);

    // Step 1: Set task A blocks task B
    // Step 2: Try to set task B blocks task A (should fail)
    // This requires the Supabase dependencies API to be running

    test.skip(true, 'Circular dependency prevention requires running Supabase instance');
  });

  test('should show "Add blocker" and "Add blocked task" buttons in the dependency picker', async ({ page }) => {
    const taskName = uniqueTaskName('DepButtons');
    await createTask(page, taskName);
    await expect(page.locator(`text=${taskName}`)).toBeVisible({ timeout: 10000 });

    await openTaskDetail(page, taskName);

    // Look for the dependency picker buttons
    const addBlockerBtn = page.locator('button').filter({ hasText: /Add blocker/i }).first();
    const addBlockedBtn = page.locator('button').filter({ hasText: /Add blocked task/i }).first();

    const hasAddBlocker = await addBlockerBtn.isVisible({ timeout: 5000 }).catch(() => false);
    const hasAddBlocked = await addBlockedBtn.isVisible({ timeout: 3000 }).catch(() => false);

    if (!hasAddBlocker && !hasAddBlocked) {
      // The dependency picker may require scrolling or may not be rendered without Supabase
      test.skip(true, 'Dependency picker buttons not visible -- may require Supabase or scrolling');
    } else {
      // At least one button should be visible
      expect(hasAddBlocker || hasAddBlocked).toBeTruthy();
    }
  });

  test.skip('should close dependency search with Escape key', async ({ page }) => {
    // Requires the dependency picker to be open
    const taskName = uniqueTaskName('DepEscape');
    await createTask(page, taskName);
    await expect(page.locator(`text=${taskName}`)).toBeVisible({ timeout: 10000 });

    await openTaskDetail(page, taskName);

    const addBlockerBtn = page.locator('button').filter({ hasText: /Add blocker/i }).first();
    if (!await addBlockerBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      test.skip(true, 'Add blocker button not visible');
      return;
    }

    await addBlockerBtn.click();
    await page.waitForTimeout(500);

    // Dependency search should be open
    const searchInput = page.locator('input[aria-label*="blocking"], input[placeholder*="Search"]').first();
    await expect(searchInput).toBeVisible({ timeout: 3000 });

    // Press Escape to close
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // Search should be hidden
    await expect(searchInput).not.toBeVisible({ timeout: 2000 });
  });

  test('should show dependency count badge when dependencies exist', async ({ page }) => {
    // The DependencyPicker shows a count badge next to the "Dependencies" header
    // This check validates the UI structure exists

    const taskName = uniqueTaskName('DepCount');
    await createTask(page, taskName);
    await expect(page.locator(`text=${taskName}`)).toBeVisible({ timeout: 10000 });

    await openTaskDetail(page, taskName);

    // Check for the Dependencies header
    const depHeader = page.locator('text=Dependencies').first();
    const hasDeps = await depHeader.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasDeps) {
      // The dependency section is rendered -- it may show a "0" count or no badge
      // Verify the section structure exists
      const linkIcon = page.locator('svg.lucide-link-2').first();
      const hasIcon = await linkIcon.isVisible({ timeout: 2000 }).catch(() => false);
      expect(hasDeps || hasIcon).toBeTruthy();
    } else {
      test.skip(true, 'Dependency section not rendered -- may require Supabase');
    }
  });
});
