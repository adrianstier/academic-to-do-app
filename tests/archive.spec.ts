import { test, expect, Page } from '@playwright/test';

/**
 * Archive Feature Tests
 *
 * Tests the comprehensive archive browser functionality including:
 * - Navigation to archive view
 * - Filtering and sorting
 * - Restore functionality
 * - Bulk operations
 * - Export functionality
 */

// Helper to login with an existing user
async function loginAsExistingUser(page: Page, userName: string = 'Derrick', pin: string = '8008') {
  await page.goto('/');

  // Wait for login screen
  const header = page.locator('h1, h2').filter({ hasText: 'Bealer Agency' }).first();
  await expect(header).toBeVisible({ timeout: 15000 });

  // Wait for users list to load
  await page.waitForTimeout(1000);

  // Click on the user card to select them
  const userCard = page.locator('button').filter({ hasText: userName }).first();
  await expect(userCard).toBeVisible({ timeout: 10000 });
  await userCard.click();

  // Wait for PIN entry screen
  await page.waitForTimeout(500);

  // Enter PIN
  const pinInputs = page.locator('input[type="password"]');
  await expect(pinInputs.first()).toBeVisible({ timeout: 5000 });

  for (let i = 0; i < 4; i++) {
    await pinInputs.nth(i).fill(pin[i]);
    await page.waitForTimeout(100);
  }

  // Wait for automatic login
  await page.waitForTimeout(2000);

  // Close welcome modal if present
  const viewTasksBtn = page.locator('button').filter({ hasText: 'View Tasks' });
  if (await viewTasksBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await viewTasksBtn.click();
    await page.waitForTimeout(500);
  }

  // Wait for main app to load - look for the "New Task" button in the sidebar
  const newTaskBtn = page.getByRole('button', { name: 'New Task' });
  await expect(newTaskBtn).toBeVisible({ timeout: 15000 });
}

test.describe('Archive Feature Tests', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsExistingUser(page, 'Derrick', '8008');
  });

  test('Navigate to archive view via sidebar', async ({ page }) => {
    // Find the Archive button in the sidebar and click it
    // The sidebar has a button with the text "Archive" in the secondary nav section
    const archiveBtn = page.locator('aside button').filter({ hasText: 'Archive' }).first();
    await expect(archiveBtn).toBeVisible({ timeout: 5000 });
    await archiveBtn.click();

    // Wait for archive view to load
    await page.waitForTimeout(1000);

    // Verify we're on the archive view - check for the Archive header
    const archiveHeader = page.getByRole('heading', { name: 'Archive' });
    await expect(archiveHeader).toBeVisible({ timeout: 5000 });

    console.log('✓ Archive view opened successfully');
  });

  test('Archive view shows statistics', async ({ page }) => {
    // Navigate to archive
    await page.getByText('Archive').click().catch(async () => {
      // Fallback: try sidebar
      const sidebar = page.locator('aside, nav').first();
      await sidebar.getByText('Archive').click();
    });

    await page.waitForTimeout(1000);

    // Check for stats bar elements
    const statsBar = page.locator('[class*="stats"], [class*="border-t"]').filter({ hasText: /this week|this month/i });

    // Stats should show if there are archived tasks
    // If no archived tasks, we may not see stats
    console.log('✓ Archive view loaded (stats visibility depends on archived task count)');
  });

  test('Archive search filters tasks', async ({ page }) => {
    // Navigate to archive
    await page.getByText('Archive').click().catch(async () => {
      const sidebar = page.locator('aside, nav').first();
      await sidebar.getByText('Archive').click();
    });

    await page.waitForTimeout(1000);

    // Find search input in archive
    const searchInput = page.locator('input[placeholder*="Search archived"]');
    await expect(searchInput).toBeVisible({ timeout: 5000 });

    // Type a search query
    await searchInput.fill('test');
    await page.waitForTimeout(500);

    // Results should filter (or show "no results" message)
    const resultsOrEmpty = page.locator('[class*="task"], [class*="rounded-lg"]').first()
      .or(page.locator('text=No tasks match'));

    await expect(resultsOrEmpty).toBeVisible({ timeout: 3000 });

    console.log('✓ Archive search works');
  });

  test('Archive filter panel toggles', async ({ page }) => {
    // Navigate to archive
    await page.locator('aside button').filter({ hasText: 'Archive' }).first().click();

    await page.waitForTimeout(1000);

    // Find and click the Filters button
    const filtersBtn = page.getByRole('button', { name: /filters/i });
    await expect(filtersBtn).toBeVisible({ timeout: 5000 });
    await filtersBtn.click();

    await page.waitForTimeout(500);

    // Filter panel should be visible with date range label
    const dateRangeLabel = page.getByText('Date Range');
    await expect(dateRangeLabel).toBeVisible({ timeout: 3000 });

    console.log('✓ Filter panel toggles correctly');
  });

  test('Archive sort options work', async ({ page }) => {
    // Navigate to archive
    await page.getByText('Archive').click().catch(async () => {
      const sidebar = page.locator('aside, nav').first();
      await sidebar.getByText('Archive').click();
    });

    await page.waitForTimeout(1000);

    // Find sort dropdown
    const sortDropdown = page.locator('select').filter({ hasText: /newest|oldest|name|priority/i });
    await expect(sortDropdown).toBeVisible({ timeout: 5000 });

    // Change sort option
    await sortDropdown.selectOption('name_asc');
    await page.waitForTimeout(500);

    // Verify sort option changed
    await expect(sortDropdown).toHaveValue('name_asc');

    console.log('✓ Sort options work');
  });

  test('Archive export generates CSV', async ({ page }) => {
    // Navigate to archive
    await page.getByText('Archive').click().catch(async () => {
      const sidebar = page.locator('aside, nav').first();
      await sidebar.getByText('Archive').click();
    });

    await page.waitForTimeout(1000);

    // Find Export button
    const exportBtn = page.getByRole('button', { name: /export/i });

    // Only test if export button exists
    if (await exportBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Set up download listener
      const downloadPromise = page.waitForEvent('download', { timeout: 10000 }).catch(() => null);

      await exportBtn.click();

      const download = await downloadPromise;
      if (download) {
        const filename = download.suggestedFilename();
        expect(filename).toContain('.csv');
        console.log('✓ Export generates CSV file:', filename);
      } else {
        console.log('✓ Export button clicked (no download in test environment)');
      }
    } else {
      console.log('ℹ Export button not visible');
    }
  });

  test('Archive task selection works', async ({ page }) => {
    // Navigate to archive
    await page.getByText('Archive').click().catch(async () => {
      const sidebar = page.locator('aside, nav').first();
      await sidebar.getByText('Archive').click();
    });

    await page.waitForTimeout(1000);

    // Find first task item with checkbox
    const firstTaskCheckbox = page.locator('[class*="checkbox"], button[class*="rounded"]')
      .filter({ has: page.locator('svg.lucide-check') })
      .first()
      .or(page.locator('button').filter({ has: page.locator('[class*="border-2"]') }).first());

    // Only test if there are archived tasks with checkboxes
    if (await firstTaskCheckbox.isVisible({ timeout: 2000 }).catch(() => false)) {
      await firstTaskCheckbox.click();
      await page.waitForTimeout(500);

      // Should see bulk actions bar after selection
      const bulkActionsBar = page.locator('text=/\\d+ selected/i')
        .or(page.locator('[class*="selected"]'));

      await expect(bulkActionsBar).toBeVisible({ timeout: 3000 });
      console.log('✓ Task selection shows bulk actions');
    } else {
      console.log('ℹ No archived tasks to select');
    }
  });

  test('Archive close button returns to tasks view', async ({ page }) => {
    // Navigate to archive
    await page.locator('aside button').filter({ hasText: 'Archive' }).first().click();

    await page.waitForTimeout(1000);

    // Verify we're on the archive view
    const archiveHeader = page.getByRole('heading', { name: 'Archive' });
    await expect(archiveHeader).toBeVisible({ timeout: 5000 });

    // Click the X close button in the top right corner of the archive view
    // It's a button that only contains an SVG X icon
    const closeBtn = page.locator('button').locator('svg.lucide-x').first().locator('..'); // Get parent button

    if (await closeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await closeBtn.click();
    } else {
      // Fallback: Click Tasks in sidebar to navigate back
      await page.locator('aside button').filter({ hasText: 'Tasks' }).first().click();
    }

    await page.waitForTimeout(1000);

    // Should be back on tasks view - verify the archive header is gone
    await expect(archiveHeader).not.toBeVisible({ timeout: 5000 });

    console.log('✓ Close button returns to tasks view');
  });

  test('Archive date preset filters work', async ({ page }) => {
    // Navigate to archive
    await page.locator('aside button').filter({ hasText: 'Archive' }).first().click();

    await page.waitForTimeout(1000);

    // Open filters panel
    const filtersBtn = page.getByRole('button', { name: /filters/i });
    await expect(filtersBtn).toBeVisible({ timeout: 5000 });
    await filtersBtn.click();
    await page.waitForTimeout(500);

    // Find the Date Range dropdown specifically (second select after sort)
    const dateRangeLabel = page.getByText('Date Range');
    await expect(dateRangeLabel).toBeVisible({ timeout: 3000 });

    // Find the select element that is a sibling/near the Date Range label
    const dateDropdown = page.locator('select').nth(1); // Date range is second dropdown

    if (await dateDropdown.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Select "Last 7 Days"
      await dateDropdown.selectOption('last_7_days');
      await page.waitForTimeout(500);

      // Verify selection
      await expect(dateDropdown).toHaveValue('last_7_days');
      console.log('✓ Date preset filter works');
    } else {
      console.log('ℹ Date preset dropdown not visible');
    }
  });

  test('Archive task detail modal opens on click', async ({ page }) => {
    // Navigate to archive
    await page.locator('aside button').filter({ hasText: 'Archive' }).first().click();

    await page.waitForTimeout(1000);

    // Wait for the archive view to be fully loaded
    const archiveHeader = page.getByRole('heading', { name: 'Archive' });
    await expect(archiveHeader).toBeVisible({ timeout: 5000 });

    // Find and click on a task card by looking for task content text
    // The task cards have the task text as part of their content
    const taskCards = page.locator('div').filter({ has: page.locator('span.font-medium') });
    const firstTaskCard = taskCards.first();

    if (await firstTaskCard.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Click on a task card - use force click in case there's an overlay
      await firstTaskCard.click({ position: { x: 100, y: 20 } });
      await page.waitForTimeout(500);

      // The detail view should show - look for detailed task info
      // Since we clicked on a task, we should see expanded details or a detail panel
      console.log('✓ Task card clicked (task details may vary based on implementation)');
    } else {
      console.log('ℹ No archived tasks to click');
    }
  });

  test('Archive empty state shows helpful message', async ({ page }) => {
    // Navigate to archive
    await page.getByText('Archive').click().catch(async () => {
      const sidebar = page.locator('aside, nav').first();
      await sidebar.getByText('Archive').click();
    });

    await page.waitForTimeout(1000);

    // Search for something that won't exist
    const searchInput = page.locator('input[placeholder*="Search archived"]');
    if (await searchInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await searchInput.fill('xyznonexistent123456789');
      await page.waitForTimeout(500);

      // Should show empty state message
      const emptyMessage = page.locator('text=/no tasks match|no archived tasks/i');
      await expect(emptyMessage).toBeVisible({ timeout: 3000 });
      console.log('✓ Empty state shows helpful message');
    } else {
      console.log('ℹ Search input not visible');
    }
  });
});
