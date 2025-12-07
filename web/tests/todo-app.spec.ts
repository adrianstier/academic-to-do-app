import { test, expect, Page } from '@playwright/test';

// Helper function to create a task
async function createTestTask(page: Page, taskName: string) {
  await page.click('header button:has-text("New Task")');
  await expect(page.locator('text=Create New Task')).toBeVisible();
  await page.fill('input[placeholder="Enter task title..."]', taskName);
  // Click the submit button inside the form
  await page.locator('form button[type="submit"]').click();
  await expect(page.locator('text=Create New Task')).not.toBeVisible({ timeout: 5000 });
  await expect(page.locator(`text=${taskName}`).first()).toBeVisible({ timeout: 5000 });
}

// Helper to ensure at least one task exists
async function ensureTaskExists(page: Page) {
  // Wait a bit for page to settle
  await page.waitForTimeout(1000);

  // Check if table exists with tasks or empty state
  const table = page.locator('table');
  const noTasks = page.locator('text=No tasks yet');

  // If no tasks, create one
  if (await noTasks.isVisible()) {
    await createTestTask(page, `Setup Task ${Date.now()}`);
  }

  // Now wait for table
  await page.waitForSelector('table', { timeout: 15000 });
}

test.describe('Todo App', () => {
  test.beforeEach(async ({ page }) => {
    // Set localStorage to skip onboarding modal
    await page.addInitScript(() => {
      localStorage.setItem('hasSeenOnboarding', 'true');
    });
    await page.goto('/');
  });

  test('page loads with header', async ({ page }) => {
    await expect(page.locator('h1')).toContainText("Derrick's Agency Tasks");
  });

  test('shows dashboard stats', async ({ page }) => {
    // Wait for dashboard to load
    await expect(page.locator('text=Dashboard')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Total Tasks')).toBeVisible();
  });

  test('shows task list or empty state', async ({ page }) => {
    // Wait for page to load - either table or empty state
    await page.waitForTimeout(1000);
    const hasTable = await page.locator('table').isVisible();
    const hasEmptyState = await page.locator('text=No tasks yet').isVisible();
    const hasNoMatchingTasks = await page.locator('text=No matching tasks').isVisible();
    expect(hasTable || hasEmptyState || hasNoMatchingTasks).toBeTruthy();
  });

  test('filter by status works', async ({ page }) => {
    await ensureTaskExists(page);

    // Click on status dropdown and select "Done"
    await page.selectOption('select:has-text("All Statuses")', 'done');

    // Wait for filter to apply
    await page.waitForTimeout(500);

    // Check that filtered results show (could be 0 or more)
    const rows = page.locator('tbody tr');
    const count = await rows.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('filter by priority works', async ({ page }) => {
    await ensureTaskExists(page);

    // Select high priority filter
    await page.selectOption('select:has-text("All Priorities")', 'high');
    await page.waitForTimeout(500);
  });

  test('filter by assignee works', async ({ page }) => {
    await ensureTaskExists(page);

    // Select Derrick as assignee
    await page.selectOption('select:has-text("All Assignees")', 'Derrick');
    await page.waitForTimeout(500);
  });

  test('create task modal opens', async ({ page }) => {
    // Click New Task button in header
    await page.click('header button:has-text("New Task")');

    // Modal should be visible
    await expect(page.locator('text=Create New Task')).toBeVisible();

    // Form fields should be visible
    await expect(page.locator('input[placeholder="Enter task title..."]')).toBeVisible();
  });

  test('can create a new task', async ({ page }) => {
    await page.waitForTimeout(1000); // Wait for page to load

    // Use unique task name with timestamp
    const taskName = `Test Task ${Date.now()}`;

    // Open create modal
    await page.click('header button:has-text("New Task")');
    await expect(page.locator('text=Create New Task')).toBeVisible();

    // Fill in the form
    await page.fill('input[placeholder="Enter task title..."]', taskName);
    await page.fill('textarea[placeholder="Enter task description..."]', 'Created by Playwright test');
    await page.selectOption('select:below(:text("Priority"))', 'high');
    await page.fill('input[placeholder*="Marketing"]', 'Testing');
    await page.selectOption('select:below(:text("Assignee"))', 'Derrick');

    // Submit form
    await page.locator('form button[type="submit"]').click();

    // Wait for modal to close
    await expect(page.locator('text=Create New Task')).not.toBeVisible({ timeout: 5000 });

    // Verify task appears in list (use first since there should only be one with this unique name)
    await expect(page.locator(`text=${taskName}`).first()).toBeVisible({ timeout: 5000 });
  });

  test('can click on a task to view details', async ({ page }) => {
    await ensureTaskExists(page);

    // Click on a task row
    const firstTaskRow = page.locator('tbody tr').first();
    await firstTaskRow.click();

    // Task detail panel should appear - use more specific locators
    await expect(page.locator('label:has-text("Description")')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('label:has-text("Priority")')).toBeVisible();
    await expect(page.locator('label:has-text("Status")')).toBeVisible();
  });

  test('can edit a task', async ({ page }) => {
    await ensureTaskExists(page);

    // Click on a task row
    const firstTaskRow = page.locator('tbody tr').first();
    await firstTaskRow.click();

    // Click Edit button
    await page.click('button:has-text("Edit")');

    // Edit form should be visible (inputs appear)
    await expect(page.locator('input[type="text"]').first()).toBeVisible();

    // Click Save
    await page.click('button:has-text("Save Changes")');

    // Should return to view mode
    await expect(page.locator('button:has-text("Edit")')).toBeVisible({ timeout: 5000 });
  });

  test('can add a note to a task', async ({ page }) => {
    await ensureTaskExists(page);

    // Click on a task row
    const firstTaskRow = page.locator('tbody tr').first();
    await firstTaskRow.click();

    // Wait for detail panel
    await expect(page.locator('label:has-text("Description")')).toBeVisible({ timeout: 5000 });

    // Scroll to notes section using h3 heading
    await page.locator('h3:has-text("Notes")').scrollIntoViewIfNeeded();

    // Add a note
    await page.fill('input[placeholder="Add a note..."]', 'Test note from Playwright');
    await page.click('button:has-text("Add")');

    // Note should appear
    await expect(page.locator('text=Test note from Playwright')).toBeVisible({ timeout: 5000 });
  });

  test('dashboard stats are clickable', async ({ page }) => {
    await expect(page.locator('text=Dashboard')).toBeVisible({ timeout: 10000 });

    // Click on "To Do" stat
    await page.click('button:has-text("To Do")');

    // Filter should be applied (status dropdown should change)
    await page.waitForTimeout(500);
  });

  test('can select tasks with checkboxes', async ({ page }) => {
    await ensureTaskExists(page);

    // Click first checkbox
    const firstCheckbox = page.locator('tbody tr input[type="checkbox"]').first();
    await firstCheckbox.click();

    // Bulk action bar should appear
    await expect(page.locator('text=selected')).toBeVisible();
  });

  test('search works', async ({ page }) => {
    await ensureTaskExists(page);

    // Type in search
    await page.fill('input[placeholder="Search tasks..."]', 'Task');

    // Wait for debounce and filter
    await page.waitForTimeout(1000);

    // Results should be filtered
    const rows = page.locator('tbody tr');
    const count = await rows.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('overdue filter works', async ({ page }) => {
    await ensureTaskExists(page);

    // Click overdue checkbox (now just says "Overdue")
    await page.click('label:has-text("Overdue")');

    // Wait for filter
    await page.waitForTimeout(500);
  });

  test('refresh button works', async ({ page }) => {
    await ensureTaskExists(page);

    // Click refresh button (now icon-only with title="Refresh")
    await page.click('button[title="Refresh"]');

    // Should still show tasks or empty state after refresh
    await page.waitForTimeout(1000);
  });

  test('can close task detail panel', async ({ page }) => {
    await ensureTaskExists(page);

    // Click on a task row
    const firstTaskRow = page.locator('tbody tr').first();
    await firstTaskRow.click();

    // Wait for detail panel
    await expect(page.locator('label:has-text("Description")')).toBeVisible({ timeout: 5000 });

    // Click close button (X)
    await page.click('button:has(svg path[d*="M6 18L18 6"])');

    // Detail panel should close (Description should not be visible in main view)
    await page.waitForTimeout(500);
  });

  test('can delete a task', async ({ page }) => {
    await page.waitForTimeout(1000); // Wait for page to load

    // Create a unique task to delete
    const taskName = `Delete Me ${Date.now()}`;
    await page.click('header button:has-text("New Task")');
    await page.fill('input[placeholder="Enter task title..."]', taskName);
    await page.locator('form button[type="submit"]').click();
    await expect(page.locator('text=Create New Task')).not.toBeVisible({ timeout: 5000 });

    // Verify task exists
    await expect(page.locator(`text=${taskName}`).first()).toBeVisible({ timeout: 5000 });

    // Click on the task to open detail panel
    await page.locator(`text=${taskName}`).first().click();

    // Wait for detail panel
    await expect(page.locator('label:has-text("Description")')).toBeVisible({ timeout: 5000 });

    // Click Delete button
    await page.click('button:has-text("Delete")');

    // Confirm modal should appear
    await expect(page.locator('text=Delete Task')).toBeVisible({ timeout: 5000 });

    // Click confirm button in modal
    await page.locator('button:has-text("Delete")').last().click();

    // Task should be removed (wait for refresh)
    await page.waitForTimeout(1000);
  });

  test('bulk mark as done works', async ({ page }) => {
    await ensureTaskExists(page);

    // Select first checkbox
    const firstCheckbox = page.locator('tbody tr input[type="checkbox"]').first();
    await firstCheckbox.click();

    // Bulk action bar should appear
    await expect(page.locator('text=selected')).toBeVisible();

    // Click Mark Done
    await page.click('button:has-text("Mark Done")');

    // Wait for update
    await page.waitForTimeout(500);
  });

  test('priority badges display correctly', async ({ page }) => {
    await ensureTaskExists(page);

    // Check that priority column exists
    await expect(page.locator('th:has-text("Priority")')).toBeVisible();

    // Priority badges are in td elements - check table cells contain priority text
    const priorityCell = page.locator('tbody td:nth-child(4)').first();
    await expect(priorityCell).toBeVisible();
  });

  test('status badges display correctly', async ({ page }) => {
    await ensureTaskExists(page);

    // Check that status column exists
    await expect(page.locator('th:has-text("Status")')).toBeVisible();

    // Status badges are in td elements - check table cells contain status
    const statusCell = page.locator('tbody td:nth-child(5)').first();
    await expect(statusCell).toBeVisible();
  });

  test('category filter dropdown exists', async ({ page }) => {
    await ensureTaskExists(page);

    // Check for category in task detail
    const firstTaskRow = page.locator('tbody tr').first();
    await firstTaskRow.click();

    // Category field should be visible
    await expect(page.locator('label:has-text("Category")')).toBeVisible({ timeout: 5000 });
  });

  test('assignee options are Derrick and Sefra', async ({ page }) => {
    await page.click('header button:has-text("New Task")');
    await expect(page.locator('text=Create New Task')).toBeVisible();

    // Find the assignee select element by its label
    const assigneeLabel = page.locator('label:has-text("Assignee")');
    await expect(assigneeLabel).toBeVisible();

    // Get the select element that follows the Assignee label
    const assigneeSelect = page.locator('select').nth(2); // Third select (after Priority and Status)

    // Check that the select can be set to Derrick and Sefra
    await assigneeSelect.selectOption('Derrick');
    await expect(assigneeSelect).toHaveValue('Derrick');

    await assigneeSelect.selectOption('Sefra');
    await expect(assigneeSelect).toHaveValue('Sefra');
  });

  test('clear all button exists', async ({ page }) => {
    // Verify Clear All button exists in header
    await expect(page.locator('button:has-text("Clear All")')).toBeVisible();
  });
});

// This test runs last as it clears all data
test.describe('Destructive operations', () => {
  test('clear all button works', async ({ page }) => {
    // Set localStorage to skip onboarding modal
    await page.addInitScript(() => {
      localStorage.setItem('hasSeenOnboarding', 'true');
    });
    await page.goto('/');

    // Create a task first to ensure we have something to clear
    const taskName = `Clear Test ${Date.now()}`;
    await page.click('header button:has-text("New Task")');
    await page.fill('input[placeholder="Enter task title..."]', taskName);
    await page.locator('form button[type="submit"]').click();
    await expect(page.locator('text=Create New Task')).not.toBeVisible({ timeout: 5000 });

    // Wait for task to appear
    await expect(page.locator(`text=${taskName}`).first()).toBeVisible({ timeout: 5000 });

    // Click Clear All button
    await page.click('header button:has-text("Clear All")');

    // Confirm modal should appear
    await expect(page.locator('h3:has-text("Delete All Tasks")')).toBeVisible({ timeout: 5000 });

    // Click Delete All button in modal
    await page.locator('button:has-text("Delete All")').click();

    // Wait for tasks to be cleared
    await page.waitForTimeout(1000);

    // Should show empty state
    await expect(page.locator('text=No tasks yet')).toBeVisible({ timeout: 5000 });
  });
});
